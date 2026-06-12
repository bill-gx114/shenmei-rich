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

// Schedule (daily 00:00 UTC) is configured in vercel.json — Vercel Cron
// triggers this endpoint via HTTP GET.
export const config = { runtime: 'edge' };

import { createClient } from '@supabase/supabase-js';
import { SEED_WORKS, type SeedWork } from '../lib/seed-works.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { generateCorePack, generateAudioScripts, VOICE_KEYS } from '../lib/curator.js';
import { coordsForSeed } from '../lib/seedCoords.js';
import { coordsForLocation } from '../lib/museums.js';
import { wikiUrl, dailySourceUrl } from '../lib/wikiLinks.js';
import { safeImg } from '../lib/imageUrl.js';
import { envVar } from '../lib/env.js';

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

/**
 * First-run bootstrap: if seed_works is empty, copy the in-code SEED_WORKS
 * array into it. After this, the table is the source of truth and the in-code
 * array is only a fallback if the migration was never applied.
 */
async function ensureSeedTablePopulated(supabase: SupabaseClient): Promise<void> {
  const { count } = await supabase
    .from('seed_works')
    .select('id', { count: 'exact', head: true });
  if ((count ?? 0) > 0) return;
  const rows = SEED_WORKS.map((s, i) => ({
    wikipedia_slug: s.wikipediaSlug,
    wikipedia_lang: s.wikipediaLang,
    title: s.title,
    artist: s.artist,
    artist_romaji: s.artistRomaji,
    year: s.year,
    medium: s.medium,
    size: s.size,
    series: s.series ?? null,
    location: s.location,
    hint: s.hint,
    source: 'initial',
    order_index: i,
    region: s.region,
  }));
  await supabase.from('seed_works').insert(rows);
}

type SeedRow = {
  wikipedia_slug: string;
  wikipedia_lang: 'en' | 'zh' | 'ja';
  title: string;
  artist: string;
  artist_romaji: string | null;
  year: string | null;
  medium: string | null;
  size: string | null;
  series: string | null;
  location: string | null;
  hint: string;
  region: 'east' | 'west' | null;
};

function rowToSeed(r: SeedRow): SeedWork {
  return {
    wikipediaSlug: r.wikipedia_slug,
    wikipediaLang: r.wikipedia_lang,
    title: r.title,
    artist: r.artist,
    artistRomaji: r.artist_romaji ?? '',
    year: r.year ?? '',
    medium: r.medium ?? '',
    size: r.size ?? '',
    series: r.series ?? undefined,
    location: r.location ?? '',
    hint: r.hint,
    region: r.region ?? 'west',
  };
}

/**
 * Repair already-published global works that are missing audio_lines or
 * questions (the symptom of an earlier output-truncation bug). Regenerates
 * only the missing pieces so we don't disturb good data or burn tokens
 * needlessly. Capped at 10 works per call.
 */
async function backfillIncompleteWorks(supabase: SupabaseClient): Promise<Response> {
  const { data: works, error } = await supabase
    .from('works')
    .select(
      'id, no, title, artist, short_label, audio_lines:audio_lines(count), questions:questions(count), vocabulary:vocabulary(count)',
    )
    .is('owner_id', null)
    .eq('kind', 'daily')
    // Only repair REVEALED works. Pre-seeded season works (future dates) are
    // already complete and would otherwise crowd out today's work from the
    // newest-first scan window, leaving a genuinely-broken today unrepaired.
    .lte('exhibited_on', beijingTodayISO())
    .order('exhibited_on', { ascending: false })
    .limit(60);
  if (error) {
    return jsonResponse(500, { error: '读取 works 失败', detail: error.message });
  }

  type Row = {
    id: string;
    no: string;
    title: string;
    artist: string;
    short_label: string | null;
    audio_lines: Array<{ count: number }>;
    questions: Array<{ count: number }>;
    vocabulary: Array<{ count: number }>;
  };
  const incomplete = ((works ?? []) as Row[]).filter(
    (w) => (w.audio_lines[0]?.count ?? 0) === 0 || (w.questions[0]?.count ?? 0) === 0,
  );

  const repaired: Array<{ no: string; title: string; fixed: string[]; errors: string[] }> = [];
  for (const w of incomplete.slice(0, 10)) {
    const fixed: string[] = [];
    const errs: string[] = [];
    const input = { title: w.title, artist: w.artist, hint: w.short_label ?? undefined };

    // Missing questions → regenerate the whole core pack (also fills hotspots/
    // vocabulary if those were dropped too).
    if ((w.questions[0]?.count ?? 0) === 0) {
      try {
        const core = await generateCorePack(input);
        if (core.questions?.length) {
          const r = await supabase.from('questions').insert(
            core.questions.map((q, i) => ({
              work_id: w.id,
              q: q.q,
              hint: q.hint,
              options: q.options,
              order_index: i,
            })),
          );
          if (r.error) errs.push(`questions: ${r.error.message}`);
          else fixed.push(`questions×${core.questions.length}`);
        }
        if ((w.vocabulary[0]?.count ?? 0) === 0 && core.vocabulary?.length) {
          const r = await supabase.from('vocabulary').insert(
            core.vocabulary.map((v) => ({
              work_id: w.id,
              word: v.word,
              note: v.note,
              is_new: v.isNew,
            })),
          );
          if (r.error) errs.push(`vocabulary: ${r.error.message}`);
          else fixed.push(`vocabulary×${core.vocabulary.length}`);
        }
      } catch (e) {
        errs.push(`core: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // Missing audio → regenerate the three voice scripts.
    if ((w.audio_lines[0]?.count ?? 0) === 0) {
      const audioLines = await generateAudioScripts(input);
      const rows: Array<{
        work_id: string;
        t: number;
        text: string;
        order_index: number;
        voice: string;
      }> = [];
      for (const voice of VOICE_KEYS) {
        (audioLines?.[voice] ?? []).forEach((l, i) => {
          rows.push({ work_id: w.id, t: l.t, text: l.text, order_index: i, voice });
        });
      }
      if (rows.length) {
        const r = await supabase.from('audio_lines').insert(rows);
        if (r.error) errs.push(`audio_lines: ${r.error.message}`);
        else fixed.push(`audio×${rows.length}`);
      } else {
        errs.push('audio_lines: 仍生成为空');
      }
    }

    repaired.push({ no: w.no, title: w.title, fixed, errors: errs });
  }

  return jsonResponse(200, {
    ok: true,
    mode: 'backfill',
    scanned: works?.length ?? 0,
    incomplete: incomplete.length,
    repaired,
  });
}

// ── main ─────────────────────────────────────────────────────────────────
export default async (req: Request) => {
  const supabaseUrl = envVar('VITE_SUPABASE_URL') ?? envVar('SUPABASE_URL');
  const serviceKey = envVar('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse(500, {
      error:
        'Supabase 服务端凭据未配置：需要 VITE_SUPABASE_URL（或 SUPABASE_URL）+ SUPABASE_SERVICE_ROLE_KEY',
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Self-healing backfill: `?backfill=1` repairs already-published global
  // works that are missing audio or questions (e.g. from an earlier truncation
  // bug). Self-limiting — only touches incomplete global works, capped.
  const url = new URL(req.url);
  if (url.searchParams.get('backfill') === '1') {
    return backfillIncompleteWorks(supabase);
  }

  // `?coords=1` — backfill lat/lng on published daily works so they can be
  // pinned onto the 全球漫游 globe (Model C). Matches each work to its seed
  // coordinate by title; no AI calls.
  if (url.searchParams.get('coords') === '1') {
    const { data: rows, error } = await supabase
      .from('works')
      .select('id, no, title, lat, location')
      .eq('kind', 'daily')
      .is('owner_id', null);
    if (error) return jsonResponse(500, { error: '读取 works 失败', detail: error.message });
    const fixed: string[] = [];
    const unmatched: string[] = [];
    for (const w of rows ?? []) {
      if (w.lat != null) continue; // already has coordinates
      // Title-based seed map first, then the museum gazetteer on the AI-filled
      // `location` (covers the 91 season works without hand-tagging).
      const c = coordsForSeed(null, w.title as string) ?? coordsForLocation(w.location as string);
      if (!c) {
        unmatched.push(`${w.title}${w.location ? ' @ ' + w.location : ''}`);
        continue;
      }
      await supabase.from('works').update({ lat: c.lat, lng: c.lng }).eq('id', w.id);
      fixed.push(w.title as string);
    }
    return jsonResponse(200, { ok: true, mode: 'coords', fixedCount: fixed.length, fixed, unmatched });
  }

  // `?source=1` — backfill the Wikipedia "deeper reading" link on daily/season
  // works (matched by title). No AI calls.
  if (url.searchParams.get('source') === '1') {
    const { data: rows, error } = await supabase
      .from('works')
      .select('id, title, source_url')
      .eq('kind', 'daily')
      .is('owner_id', null);
    if (error) return jsonResponse(500, { error: '读取 works 失败', detail: error.message });
    // Fallback map from the seed_works TABLE (covers DB-only seeds added by
    // extend-seed that aren't in the in-code lists, e.g. 拿破仑越过阿尔卑斯山).
    const { data: seeds } = await supabase
      .from('seed_works')
      .select('title, wikipedia_slug, wikipedia_lang');
    const tableMap = new Map(
      (seeds ?? []).map((s) => [s.title as string, wikiUrl(s.wikipedia_lang as string, s.wikipedia_slug as string)]),
    );
    const fixed: string[] = [];
    const unmatched: string[] = [];
    for (const w of rows ?? []) {
      if (w.source_url) continue;
      const u = dailySourceUrl(w.title as string) ?? tableMap.get(w.title as string) ?? null;
      if (!u) {
        unmatched.push(w.title as string);
        continue;
      }
      await supabase.from('works').update({ source_url: u }).eq('id', w.id);
      fixed.push(w.title as string);
    }
    return jsonResponse(200, { ok: true, mode: 'source', fixedCount: fixed.length, unmatched });
  }

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

  // 2. Make sure the seed table has data (bootstraps from in-code SEED_WORKS
  //    on the very first run, after migration 0004 created the empty table).
  await ensureSeedTablePopulated(supabase);

  // Load all seeds, ordered by their original publish order.
  const { data: seedRows, error: seedErr } = await supabase
    .from('seed_works')
    .select('*')
    .order('order_index', { ascending: true })
    .order('created_at', { ascending: true });
  if (seedErr) {
    return jsonResponse(500, { error: '读取 seed_works 失败', detail: seedErr.message });
  }
  if (!seedRows || seedRows.length === 0) {
    return jsonResponse(500, { error: 'seed_works 表为空，无法挑选作品' });
  }

  // Pick today's seed deterministically based on how many global works have
  // been published so far. As new seeds get appended (via extend-seed or
  // manual SQL), the rotation naturally extends.
  const { count, error: countErr } = await supabase
    .from('works')
    .select('id', { count: 'exact', head: true })
    .is('owner_id', null);
  if (countErr) {
    return jsonResponse(500, { error: '统计已发作品失败', detail: countErr.message });
  }

  const total = count ?? 0;
  const idx = total % seedRows.length;
  const seed = rowToSeed(seedRows[idx] as SeedRow);
  const no = String(total + 1).padStart(3, '0');

  // 3. Fetch a public-domain image from Wikipedia (best-effort). Normalize to a
  // 1600px thumb, then mirror it into our own Storage so the gallery never
  // depends on Wikimedia hotlinking (which gets rate-limited at scale).
  const imageUrlRaw = await fetchWikipediaImage(seed);
  const cappedUrl = imageUrlRaw ? safeImg(imageUrlRaw) : imageUrlRaw;
  let imageUrl = cappedUrl;
  if (cappedUrl) {
    try {
      const ir = await fetch(cappedUrl, { headers: { 'User-Agent': 'shenmei-daily/1.0' } });
      if (ir.ok) {
        const ct = ir.headers.get('content-type') ?? 'image/jpeg';
        const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg';
        const buf = await ir.arrayBuffer();
        const up = await supabase.storage
          .from('works')
          .upload(`mirror/${no}.${ext}`, buf, { contentType: ct, upsert: true });
        if (!up.error) imageUrl = supabase.storage.from('works').getPublicUrl(`mirror/${no}.${ext}`).data.publicUrl;
      }
    } catch {
      /* keep the Wikimedia URL if mirroring fails */
    }
  }

  // 4. Have DeepSeek write the CORE pack (label + note + hotspots + questions
  //    + vocabulary). This is the small, must-have interactive content — it's
  //    generated and persisted FIRST so a later audio failure/timeout can't
  //    take the questions down with it.
  const curatorInput = { title: seed.title, artist: seed.artist, hint: seed.hint };
  let core;
  try {
    core = await generateCorePack(curatorInput);
  } catch (err) {
    return jsonResponse(502, {
      error: '生成核心策展包失败',
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  // 5. Insert work + core child rows via service role (RLS bypassed).
  const coords = coordsForSeed(seed.wikipediaSlug, seed.title);
  const { data: work, error: workErr } = await supabase
    .from('works')
    .insert({
      owner_id: null,
      no,
      exhibited_on: today,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      title: seed.title,
      artist: seed.artist,
      artist_romaji: seed.artistRomaji,
      year: seed.year,
      medium: seed.medium,
      size: seed.size,
      series: seed.series ?? null,
      location: seed.location,
      region: seed.region,
      room: `今日展厅 · No. ${no}`,
      short_label: core.shortLabel,
      curator_note: core.curatorNote ?? null,
      image_path: imageUrl,
      source_url: wikiUrl(seed.wikipediaLang, seed.wikipediaSlug),
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

  if (core.hotspots?.length) {
    const rows = core.hotspots.map((h, i) => ({
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
  if (core.questions?.length) {
    const rows = core.questions.map((q, i) => ({
      work_id: workId,
      q: q.q,
      hint: q.hint,
      options: q.options,
      order_index: i,
    }));
    const r = await supabase.from('questions').insert(rows);
    if (r.error) errors.push(`questions: ${r.error.message}`);
  } else {
    errors.push('questions: pack 里没有题目');
  }
  if (core.vocabulary?.length) {
    const rows = core.vocabulary.map((v) => ({
      work_id: workId,
      word: v.word,
      note: v.note,
      is_new: v.isNew,
    }));
    const r = await supabase.from('vocabulary').insert(rows);
    if (r.error) errors.push(`vocabulary: ${r.error.message}`);
  }

  // 6. Audio scripts — generated in a SEPARATE DeepSeek call AFTER the core
  //    content is safely persisted, so a truncation/timeout here can't drop
  //    the questions. Flatten the three voice variants into one insert keyed
  //    by (voice, order_index) so the frontend can fetch per-voice.
  const audioLines = await generateAudioScripts(curatorInput);
  const audioRows: Array<{
    work_id: string;
    t: number;
    text: string;
    order_index: number;
    voice: string;
  }> = [];
  for (const voice of VOICE_KEYS) {
    const lines = audioLines?.[voice] ?? [];
    lines.forEach((l, i) => {
      audioRows.push({ work_id: workId, t: l.t, text: l.text, order_index: i, voice });
    });
  }
  if (audioRows.length) {
    const r = await supabase.from('audio_lines').insert(audioRows);
    if (r.error) errors.push(`audio_lines: ${r.error.message}`);
  } else {
    errors.push('audio_lines: 语音脚本生成为空（DeepSeek 截断或返回空，已重试一次）');
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

