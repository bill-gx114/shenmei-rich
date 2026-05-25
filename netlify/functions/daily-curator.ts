// Scheduled function: runs daily at 00:00 UTC (= 08:00 Beijing) and publishes
// a global daily artwork that every user sees.
//
// Idempotent: if today's global work already exists, returns early without
// touching the DB.
//
// Required env vars (Netlify dashboard → Site configuration → Environment
// variables):
//
//   VITE_SUPABASE_URL              — Supabase project URL
//   SUPABASE_SERVICE_ROLE_KEY      — service role key (bypasses RLS)
//   DEEPSEEK_API_KEY               — DeepSeek API key
//
// Manual invocation for testing:
//
//   netlify functions:invoke daily-curator         (locally)
//   or in Netlify dashboard → Functions → daily-curator → Run

import type { Config } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { SEED_WORKS, type SeedWork } from '../lib/seed-works.js';
import { generateCuratorPack, VOICE_KEYS } from '../lib/curator.js';

// ── helpers ──────────────────────────────────────────────────────────────
function beijingTodayISO(): string {
  // Beijing = UTC+8. We just need the calendar date in CST.
  const now = new Date();
  const beijing = new Date(now.getTime() + 8 * 3600 * 1000);
  return beijing.toISOString().slice(0, 10);
}

type WikiSummary = {
  originalimage?: { source: string };
  thumbnail?: { source: string };
};

async function fetchSummaryImage(lang: string, slug: string): Promise<string | null> {
  try {
    const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}`;
    const r = await fetch(url, {
      headers: { 'User-Agent': '审美日课/1.0 (https://github.com/)' },
    });
    if (!r.ok) return null;
    const data = (await r.json()) as WikiSummary;
    return data.originalimage?.source ?? data.thumbnail?.source ?? null;
  } catch {
    return null;
  }
}

async function searchWikipediaSlug(lang: string, query: string): Promise<string | null> {
  try {
    const url = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srlimit=1&format=json&origin=*&srsearch=${encodeURIComponent(query)}`;
    const r = await fetch(url, {
      headers: { 'User-Agent': '审美日课/1.0 (https://github.com/)' },
    });
    if (!r.ok) return null;
    const data = (await r.json()) as { query?: { search?: Array<{ title: string }> } };
    const title = data.query?.search?.[0]?.title;
    return title ? title.replace(/ /g, '_') : null;
  } catch {
    return null;
  }
}

async function fetchWikipediaImage(seed: SeedWork): Promise<string | null> {
  // 1. Try the configured slug.
  const direct = await fetchSummaryImage(seed.wikipediaLang, seed.wikipediaSlug);
  if (direct) return direct;

  // 2. Fallback: search by "title artist" in en.wikipedia (more reliable than
  //    zh/ja for art), take the first hit, fetch its summary.
  const searchQuery = `${seed.title} ${seed.artist}`;
  for (const lang of ['en', seed.wikipediaLang]) {
    const slug = await searchWikipediaSlug(lang, searchQuery);
    if (!slug) continue;
    const img = await fetchSummaryImage(lang, slug);
    if (img) return img;
  }

  return null;
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

// ── main ─────────────────────────────────────────────────────────────────
export default async () => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse(500, {
      error:
        'Supabase 服务端凭据未配置：需要 VITE_SUPABASE_URL（或 SUPABASE_URL）+ SUPABASE_SERVICE_ROLE_KEY',
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const today = beijingTodayISO();

  // 1. Idempotency: already published today?
  const { data: existing, error: existErr } = await supabase
    .from('works')
    .select('id, title')
    .eq('exhibited_on', today)
    .is('owner_id', null)
    .maybeSingle();
  if (existErr) {
    return jsonResponse(500, { error: '查询已发作品失败', detail: existErr.message });
  }
  if (existing) {
    return jsonResponse(200, {
      skipped: true,
      reason: 'already published',
      date: today,
      title: existing.title,
    });
  }

  // 2. Pick today's seed deterministically based on how many global works
  //    have been published so far.
  const { count, error: countErr } = await supabase
    .from('works')
    .select('id', { count: 'exact', head: true })
    .is('owner_id', null);
  if (countErr) {
    return jsonResponse(500, { error: '统计已发作品失败', detail: countErr.message });
  }

  const total = count ?? 0;
  const idx = total % SEED_WORKS.length;
  const seed = SEED_WORKS[idx];
  const no = String(total + 1).padStart(3, '0');

  // 3. Fetch a public-domain image from Wikipedia (best-effort).
  const imageUrl = await fetchWikipediaImage(seed);

  // 4. Have DeepSeek write the curator pack.
  let pack;
  try {
    pack = await generateCuratorPack({
      title: seed.title,
      artist: seed.artist,
      hint: seed.hint,
    });
  } catch (err) {
    return jsonResponse(502, {
      error: '生成策展包失败',
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  // 5. Insert work + child rows via service role (RLS bypassed).
  const { data: work, error: workErr } = await supabase
    .from('works')
    .insert({
      owner_id: null,
      no,
      exhibited_on: today,
      title: seed.title,
      artist: seed.artist,
      artist_romaji: seed.artistRomaji,
      year: seed.year,
      medium: seed.medium,
      size: seed.size,
      series: seed.series ?? null,
      location: seed.location,
      room: `今日展厅 · No. ${no}`,
      short_label: pack.shortLabel,
      image_path: imageUrl,
      total: 365,
    })
    .select('id')
    .single();
  if (workErr) {
    return jsonResponse(500, { error: '写入 works 失败', detail: workErr.message });
  }
  const workId = work.id as string;

  // Child rows. Each failure is non-fatal — log and continue, the user can
  // see what made it through.
  const errors: string[] = [];

  if (pack.hotspots?.length) {
    const rows = pack.hotspots.map((h, i) => ({
      work_id: workId,
      x: h.x,
      y: h.y,
      label: h.label,
      detail: h.detail,
      order_index: i,
    }));
    const r = await supabase.from('hotspots').insert(rows);
    if (r.error) errors.push(`hotspots: ${r.error.message}`);
  }
  // pack.audioLines is now keyed by voice. Flatten into one big insert with
  // (voice, order_index) per row so the frontend can fetch per-voice.
  const audioRows: Array<{
    work_id: string;
    t: number;
    text: string;
    order_index: number;
    voice: string;
  }> = [];
  for (const voice of VOICE_KEYS) {
    const lines = pack.audioLines?.[voice] ?? [];
    lines.forEach((l, i) => {
      audioRows.push({
        work_id: workId,
        t: l.t,
        text: l.text,
        order_index: i,
        voice,
      });
    });
  }
  if (audioRows.length) {
    const r = await supabase.from('audio_lines').insert(audioRows);
    if (r.error) errors.push(`audio_lines: ${r.error.message}`);
  }
  if (pack.questions?.length) {
    const rows = pack.questions.map((q, i) => ({
      work_id: workId,
      q: q.q,
      hint: q.hint,
      options: q.options,
      order_index: i,
    }));
    const r = await supabase.from('questions').insert(rows);
    if (r.error) errors.push(`questions: ${r.error.message}`);
  }
  if (pack.vocabulary?.length) {
    const rows = pack.vocabulary.map((v) => ({
      work_id: workId,
      word: v.word,
      note: v.note,
      is_new: v.isNew,
    }));
    const r = await supabase.from('vocabulary').insert(rows);
    if (r.error) errors.push(`vocabulary: ${r.error.message}`);
  }

  return jsonResponse(200, {
    ok: true,
    date: today,
    no,
    title: seed.title,
    artist: seed.artist,
    work_id: workId,
    image: imageUrl,
    childErrors: errors,
  });
};

// 00:00 UTC every day == 08:00 Beijing. Netlify uses standard cron syntax.
export const config: Config = {
  schedule: '0 0 * * *',
};
