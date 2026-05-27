// POST /api/tts  Body: { text, voice? }  → { url, cached }
//
// Proxies Microsoft Edge's neural TTS and caches each result in Supabase
// Storage by sha256(voice|text). Vercel Node serverless runtime — uses the
// `ws` package and sets the custom User-Agent / Origin headers Microsoft's
// endpoint requires.
//
// Uses the legacy (req, res) signature because Vercel's auto-detection of
// the Web-Fetch (Request, Response) form was leaving the function hanging
// in our case (cold-start timed out at 15s). The handler below sends via
// res.end() so the request lifecycle terminates correctly.

import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

const BUCKET = 'tts-cache';
const DEFAULT_VOICE = 'zh-CN-XiaoxiaoNeural';
const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
// MS added an anti-abuse handshake in mid-2024. Each ws connect now requires
// a Sec-MS-GEC token = sha256(ticks||TRUSTED_CLIENT_TOKEN) where ticks is the
// Win epoch nanosecond ticks rounded to a 5-min boundary. Algorithm comes
// straight from python edge-tts/drm.py.
const SEC_MS_GEC_VERSION = '1-130.0.2849.68';
const WIN_EPOCH_S = 11_644_473_600;

function secMsGecToken(): string {
  // 100-ns intervals (Windows ticks) since 1601-01-01 UTC, rounded to nearest
  // 5-minute window so the token is stable across a short request span.
  const seconds = Date.now() / 1000 + WIN_EPOCH_S;
  let ticks = BigInt(Math.floor(seconds * 1e9 / 100));
  const window = 3_000_000_000n; // 5 min in 100-ns units
  ticks -= ticks % window;
  const payload = `${ticks.toString()}${TRUSTED_CLIENT_TOKEN}`;
  return crypto.createHash('sha256').update(payload).digest('hex').toUpperCase();
}

function buildWsUrl(): string {
  const connectionId = crypto.randomBytes(16).toString('hex');
  const params = new URLSearchParams({
    TrustedClientToken: TRUSTED_CLIENT_TOKEN,
    'Sec-MS-GEC': secMsGecToken(),
    'Sec-MS-GEC-Version': SEC_MS_GEC_VERSION,
    ConnectionId: connectionId,
  });
  return `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?${params.toString()}`;
}

const WS_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
  Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
  'Sec-WebSocket-Extensions': 'permessage-deflate; client_max_window_bits',
  'Accept-Encoding': 'gzip, deflate, br',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
};

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function uuid32(): string {
  return crypto.randomBytes(16).toString('hex');
}

async function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.setEncoding('utf-8');
    req.on('data', (chunk: string) => {
      raw += chunk;
      if (raw.length > 8192) {
        reject(new Error('payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(raw || '{}') as T);
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
    req.on('error', (e) => reject(e));
  });
}

function synthesize(voice: string, text: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const reqId = uuid32();
    const ws = new WebSocket(buildWsUrl(), { headers: WS_HEADERS });
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

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  let body: { text?: string; voice?: string };
  try {
    body = await readJsonBody<{ text?: string; voice?: string }>(req);
  } catch (e) {
    return sendJson(res, 400, {
      error: '请求体不是合法 JSON',
      detail: e instanceof Error ? e.message : String(e),
    });
  }
  const text = (body.text ?? '').trim();
  if (!text) return sendJson(res, 400, { error: 'missing text' });
  if (text.length > 1000) return sendJson(res, 400, { error: 'text too long (>1000)' });
  const voice = body.voice || DEFAULT_VOICE;

  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return sendJson(res, 500, { error: 'Supabase 凭据未配置' });
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
    return sendJson(res, 200, { url: publicUrl, cached: true });
  }

  let buf: Buffer;
  try {
    buf = await synthesize(voice, text);
  } catch (e) {
    return sendJson(res, 502, {
      error: 'Edge TTS 合成失败',
      detail: e instanceof Error ? e.message : String(e),
    });
  }
  if (!buf.length) return sendJson(res, 502, { error: 'Edge TTS 返回空音频' });

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, buf, { contentType: 'audio/mpeg', upsert: true });
  if (upErr) {
    return sendJson(res, 500, { error: '写 Supabase Storage 失败', detail: upErr.message });
  }

  return sendJson(res, 200, { url: publicUrl, cached: false });
}

export const config = {
  maxDuration: 30,
};
