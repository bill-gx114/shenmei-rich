// POST /api/tts  Body: { text, voice? }  → { url, cached }
//
// Proxies Microsoft Edge's neural TTS and caches each result in Supabase
// Storage by sha256(voice|text). Runs on Vercel Node runtime so we can use
// the `ws` package and set the custom User-Agent / Origin headers that
// Microsoft's endpoint actually accepts (Edge runtime's WebSocket constructor
// doesn't expose headers, which made the endpoint reject the connection).

import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

const BUCKET = 'tts-cache';
const DEFAULT_VOICE = 'zh-CN-XiaoxiaoNeural';
const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const WSS_URL = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}`;
// These two headers are what the public clients (python edge-tts, msedge-tts,
// etc.) send. Without them MS bing.com refuses the websocket handshake.
const WS_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
  Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
};

function jsonResp(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function uuid32(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Connect to Edge TTS over WSS and stream MP3 bytes back. Protocol:
 *  1. send speech.config (JSON, audio output format)
 *  2. send SSML (text wrapped in <voice name=…>)
 *  3. receive binary frames: [2B headerLen BE][headers][audio bytes]
 *  4. receive text frame containing Path:turn.end → done
 */
function synthesize(voice: string, text: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const reqId = uuid32();
    const ws = new WebSocket(WSS_URL, { headers: WS_HEADERS });
    const chunks: Buffer[] = [];
    let settled = false;

    const failTimer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { ws.terminate(); } catch { /* ignore */ }
      reject(new Error('Edge TTS websocket timeout (20s)'));
    }, 20_000);

    const finish = (ok: Buffer | null, err?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(failTimer);
      try { ws.close(); } catch { /* ignore */ }
      if (err) reject(err);
      else if (ok) resolve(ok);
      else reject(new Error('Edge TTS returned no audio'));
    };

    ws.on('open', () => {
      const now = new Date().toISOString();
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
    });

    ws.on('message', (raw, isBinary) => {
      if (!isBinary) {
        const text = raw.toString('utf-8');
        if (text.includes('Path:turn.end')) {
          finish(Buffer.concat(chunks));
        }
        return;
      }
      const buf = raw as Buffer;
      if (buf.length < 2) return;
      const headerLen = buf.readUInt16BE(0);
      const audio = buf.subarray(2 + headerLen);
      if (audio.length > 0) chunks.push(audio);
    });

    ws.on('error', (e) => finish(null, e instanceof Error ? e : new Error(String(e))));
    ws.on('close', (code, reason) => {
      if (settled) return;
      const msg = `Edge TTS ws closed before turn.end (code=${code}, reason="${reason?.toString() ?? ''}")`;
      finish(null, new Error(msg));
    });
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

  const hash = crypto.createHash('sha256').update(`${voice}|${text}`).digest('hex').slice(0, 24);
  const path = `${voice}/${hash}.mp3`;
  const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = publicUrlData.publicUrl;

  const { data: existing } = await supabase.storage
    .from(BUCKET)
    .list(voice, { search: `${hash}.mp3`, limit: 1 });
  if ((existing ?? []).some((f) => f.name === `${hash}.mp3`)) {
    return jsonResp(200, { url: publicUrl, cached: true });
  }

  let buf: Buffer;
  try {
    buf = await synthesize(voice, text);
  } catch (e) {
    return jsonResp(502, {
      error: 'Edge TTS 合成失败',
      detail: e instanceof Error ? e.message : String(e),
    });
  }
  if (!buf.length) return jsonResp(502, { error: 'Edge TTS 返回空音频' });

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, buf, { contentType: 'audio/mpeg', upsert: true });
  if (upErr) {
    return jsonResp(500, { error: '写 Supabase Storage 失败', detail: upErr.message });
  }

  return jsonResp(200, { url: publicUrl, cached: false });
}
