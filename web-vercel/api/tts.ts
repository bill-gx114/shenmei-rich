// POST /api/tts
// Body: { text: string, voice?: string }
// Returns: { url: string, cached: boolean }
//
// Proxies Microsoft Edge's neural TTS (zh-CN-XiaoxiaoNeural by default) and
// caches each result in Supabase Storage by sha256(voice|text). Subsequent
// requests for the same line return the cached URL instantly.
//
// Uses Node.js runtime — msedge-tts ships a WebSocket client that needs the
// `ws` package, which the Edge runtime does not provide. Cold start ~1-2s,
// per synthesis 1-3s; with cache, follow-up plays are instant.

import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const BUCKET = 'tts-cache';
const DEFAULT_VOICE = 'zh-CN-XiaoxiaoNeural';

function jsonResp(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

async function synthesizeToBuffer(voice: string, text: string): Promise<Buffer> {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const { audioStream } = tts.toStream(text);
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    audioStream.on('data', (c: Buffer) => chunks.push(c));
    audioStream.on('close', () => {
      tts.close();
      resolve(Buffer.concat(chunks));
    });
    audioStream.on('error', (e: Error) => {
      tts.close();
      reject(e);
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

  // Cache key — first 16 hex chars of sha256(voice|text) is plenty (16^16 keys).
  const hash = crypto.createHash('sha256').update(`${voice}|${text}`).digest('hex').slice(0, 24);
  const path = `${voice}/${hash}.mp3`;
  const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = publicUrlData.publicUrl;

  // Check cache (HEAD via list — Supabase has no head endpoint; this is cheap).
  const { data: existing } = await supabase.storage
    .from(BUCKET)
    .list(voice, { search: `${hash}.mp3`, limit: 1 });
  if ((existing ?? []).some((f) => f.name === `${hash}.mp3`)) {
    return jsonResp(200, { url: publicUrl, cached: true });
  }

  // Synthesize fresh.
  let buf: Buffer;
  try {
    buf = await synthesizeToBuffer(voice, text);
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
