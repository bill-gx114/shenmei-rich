// POST /api/tts  Body: { text, voice? }  → { url, cached }
//
// Proxies Microsoft Edge's neural TTS and caches each result in Supabase
// Storage by sha256(voice|text). Runs on the Vercel Edge runtime — uses
// native WebSocket + Web Crypto, no Node-only dependencies.

export const config = { runtime: 'edge' };

import { createClient } from '@supabase/supabase-js';

const BUCKET = 'tts-cache';
const DEFAULT_VOICE = 'zh-CN-XiaoxiaoNeural';
// This is the same trusted-client token Edge browsers ship publicly.
// Documented widely in open-source Edge-TTS clients (Python edge-tts,
// rust-edge-tts, msedge-tts, etc.).
const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const WSS_URL = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}`;

function jsonResp(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function uuid32(): string {
  // 32-char hex, MS expects no dashes.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Speak `text` via Microsoft Edge's WebSocket TTS API, return MP3 bytes.
 *
 * Protocol:
 *  - Connect to WSS_URL
 *  - Send a JSON config message (speech.config)
 *  - Send the SSML message
 *  - Receive a series of binary frames (audio data, prefixed by a 2-byte
 *    big-endian header length + textual header)
 *  - A text message with Path: turn.end signals the end
 */
function synthesize(voice: string, text: string): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reqId = uuid32();
    const ws = new WebSocket(WSS_URL);
    ws.binaryType = 'arraybuffer';

    const chunks: Uint8Array[] = [];
    let settled = false;

    const failTimer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { ws.close(); } catch { /* ignore */ }
      reject(new Error('Edge TTS websocket timeout (20s)'));
    }, 20_000);

    const finish = (ok: Uint8Array | null, err?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(failTimer);
      try { ws.close(); } catch { /* ignore */ }
      if (err) reject(err);
      else if (ok) resolve(ok);
      else reject(new Error('Edge TTS returned no audio'));
    };

    ws.onopen = () => {
      const now = new Date().toISOString();
      // 1. Speech config
      const config = {
        context: {
          synthesis: {
            audio: {
              metadataoptions: { sentenceBoundaryEnabled: 'false', wordBoundaryEnabled: 'false' },
              outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
            },
          },
        },
      };
      ws.send(
        `X-Timestamp:${now}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n${JSON.stringify(config)}`,
      );
      // 2. SSML
      const ssml =
        `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-CN">` +
        `<voice name="${voice}">${text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')}</voice>` +
        `</speak>`;
      ws.send(
        `X-RequestId:${reqId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${now}Z\r\nPath:ssml\r\n\r\n${ssml}`,
      );
    };

    ws.onmessage = (ev) => {
      const data = ev.data;
      if (typeof data === 'string') {
        // Text frame — look for turn.end which signals completion.
        if (data.includes('Path:turn.end')) {
          const all = chunks.reduce((n, c) => n + c.byteLength, 0);
          const out = new Uint8Array(all);
          let off = 0;
          for (const c of chunks) {
            out.set(c, off);
            off += c.byteLength;
          }
          finish(out);
        }
        return;
      }
      // Binary frame: [2-byte header length BE][headers][audio bytes]
      const buf = data instanceof ArrayBuffer ? data : (data as Blob);
      if (buf instanceof ArrayBuffer) {
        const view = new DataView(buf);
        const headerLen = view.getUint16(0, false);
        const audio = new Uint8Array(buf, 2 + headerLen);
        if (audio.byteLength > 0) chunks.push(audio);
      }
    };

    ws.onerror = () => finish(null, new Error('Edge TTS websocket error'));
    ws.onclose = () => {
      if (!settled) finish(null, new Error('Edge TTS websocket closed before turn.end'));
    };
  });
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') return jsonResp(405, { error: 'Method not allowed' });

  let body: { text?: string; voice?: string };
  try {
    body = (await req.json()) as { text?: string; voice?: string };
  } catch {
    return jsonResp(400, { error: '请求体不是合法 JSON' });
  }
  const text = (body.text ?? '').trim();
  if (!text) return jsonResp(400, { error: 'missing text' });
  if (text.length > 1000) return jsonResp(400, { error: 'text too long (>1000)' });
  const voice = body.voice || DEFAULT_VOICE;

  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return jsonResp(500, { error: 'Supabase 凭据未配置' });
  }
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const hashFull = await sha256Hex(`${voice}|${text}`);
  const hash = hashFull.slice(0, 24);
  const path = `${voice}/${hash}.mp3`;
  const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = publicUrlData.publicUrl;

  // Cache probe.
  const { data: existing } = await supabase.storage
    .from(BUCKET)
    .list(voice, { search: `${hash}.mp3`, limit: 1 });
  if ((existing ?? []).some((f) => f.name === `${hash}.mp3`)) {
    return jsonResp(200, { url: publicUrl, cached: true });
  }

  let buf: Uint8Array;
  try {
    buf = await synthesize(voice, text);
  } catch (e) {
    return jsonResp(502, {
      error: 'Edge TTS 合成失败',
      detail: e instanceof Error ? e.message : String(e),
    });
  }
  if (!buf.byteLength) return jsonResp(502, { error: 'Edge TTS 返回空音频' });

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, buf, { contentType: 'audio/mpeg', upsert: true });
  if (upErr) {
    return jsonResp(500, { error: '写 Supabase Storage 失败', detail: upErr.message });
  }

  return jsonResp(200, { url: publicUrl, cached: false });
}
