// GET /api/roam-seed         → seed roam landmarks until ~50s elapsed
// GET /api/roam-seed?only=R001  → (re)seed a single landmark
//
// Service-role, idempotent. For each landmark in ROAM_SEEDS that isn't already
// a work (matched by `no`), this:
//   1. pulls its Wikipedia REST summary → a REAL licensed image + a factual
//      `extract` (grounding so the AI doesn't invent attributions),
//   2. asks DeepSeek for the core curator pack (label + appreciation note +
//      observation hotspots + questions + vocabulary), grounded on the extract,
//   3. inserts a works row with kind='roam' (+ lat/lng/category) and its
//      child rows.
//
// Generating ~30 packs sequentially exceeds any single function budget, so we
// process until ~50s elapse and report `remaining`; call again to continue
// (skips already-seeded landmarks). Audio is intentionally skipped for roam —
// the globe detail panel is text + image, not a guided audio tour.

import type { IncomingMessage, ServerResponse } from 'node:http';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ROAM_SEEDS, type RoamSeed } from '../lib/roamSeed.js';
import { generateCorePack, generateAudioScripts, VOICE_KEYS } from '../lib/curator.js';
import { wikiUrl, roamSourceUrl } from '../lib/wikiLinks.js';

export const config = { maxDuration: 60 };
const AUDIO_BUDGET_MS = 32_000;

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function sendAudioPage(res: ServerResponse, built: number, total: number, remaining: number, log: string[]) {
  const done = remaining === 0;
  const refresh = done ? '' : '<meta http-equiv="refresh" content="2">';
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html><html><head><meta charset="utf-8">${refresh}<title>漫游语音生成</title></head>
<body style="background:#0b0907;color:#e7c067;font-family:'Songti SC',serif;text-align:center;padding:56px 20px;line-height:1.8">
<div style="font-size:13px;letter-spacing:.3em;color:#998c70">GLOBAL ROAMING · AUDIO</div>
<h1 style="font-weight:300">全球漫游 · 语音生成</h1>
<div style="font-size:42px;color:#ffd166">${built} / ${total}</div>
<p style="color:#d9c8a0">${done ? '✅ 全部地标已配齐语音。' : '生成中…本页每 2 秒自动续跑，保持打开即可。'}</p>
<pre style="color:#8f8268;font-size:12px;text-align:left;max-width:560px;margin:24px auto;white-space:pre-wrap">${log.join('\n') || '正在启动…'}</pre>
</body></html>`);
}

type WikiSummary = {
  originalimage?: { source: string };
  thumbnail?: { source: string };
  extract?: string;
};

// NOTE: ASCII-only User-Agent. This runs on the Node serverless runtime whose
// undici fetch validates header values as ByteString — a non-ASCII (Chinese)
// UA throws "Cannot convert argument to a ByteString", which silently made
// every image fetch fail and left image_path empty. (The edge-runtime
// daily-curator tolerates a Chinese UA; this one does not.)
const WIKI_UA = 'shenmei-daily/1.0 (https://shenmei-rich.vercel.app)';

// Fallback lead-image lookup via the PageImages API — more reliable than the
// REST summary for some titles (notably places/sites like Machu Picchu, whose
// summary returns no originalimage).
async function pageImage(lang: string, title: string): Promise<string | null> {
  try {
    const u = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=pageimages&piprop=original|thumbnail&pithumbsize=1200&format=json&origin=*&titles=${encodeURIComponent(title)}`;
    const r = await fetch(u, { headers: { 'User-Agent': WIKI_UA } });
    if (!r.ok) return null;
    const d = (await r.json()) as {
      query?: { pages?: Record<string, { original?: { source: string }; thumbnail?: { source: string } }> };
    };
    const pages = d.query?.pages ?? {};
    for (const p of Object.values(pages)) {
      const src = p.original?.source ?? p.thumbnail?.source;
      if (src) return src;
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchWiki(seed: RoamSeed): Promise<{ image: string | null; extract: string }> {
  const url = `https://${seed.wiki.lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(seed.wiki.title)}`;
  let extract = '';
  let image: string | null = null;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': WIKI_UA } });
    if (r.ok) {
      const d = (await r.json()) as WikiSummary;
      image = d.originalimage?.source ?? d.thumbnail?.source ?? null;
      extract = d.extract ?? '';
    }
  } catch {
    /* fall through to PageImages */
  }
  if (!image) image = await pageImage(seed.wiki.lang, seed.wiki.title);
  if (!image && seed.image) image = seed.image; // curated fallback
  return { image, extract };
}

async function seedOne(
  supabase: SupabaseClient,
  seed: RoamSeed,
): Promise<{ no: string; title: string; ok: boolean; errors: string[] }> {
  const errors: string[] = [];
  const { image, extract } = await fetchWiki(seed);

  let core;
  try {
    core = await generateCorePack({
      title: seed.title,
      artist: seed.artist,
      hint: seed.hint,
      context: extract || undefined,
    });
  } catch (e) {
    return { no: seed.no, title: seed.title, ok: false, errors: [`core: ${e instanceof Error ? e.message : String(e)}`] };
  }

  const { data: work, error: workErr } = await supabase
    .from('works')
    .insert({
      owner_id: null,
      kind: 'roam',
      no: seed.no,
      // exhibited_on is required but meaningless for roam; use a fixed sentinel
      // so roam rows never collide with the daily one-per-day uniqueness.
      exhibited_on: '2000-01-01',
      title: seed.title,
      artist: seed.artist,
      artist_romaji: seed.titleEn,
      year: seed.year,
      medium: seed.category,
      category: seed.category,
      lat: seed.lat,
      lng: seed.lng,
      location: `${seed.country} · ${seed.place}`,
      room: `全球漫游 · ${seed.country}`,
      short_label: core.shortLabel,
      curator_note: core.curatorNote ?? null,
      image_path: image,
      source_url: wikiUrl(seed.wiki.lang, seed.wiki.title),
      total: ROAM_SEEDS.length,
    })
    .select('id')
    .single();
  if (workErr) {
    return { no: seed.no, title: seed.title, ok: false, errors: [`works: ${workErr.message}`] };
  }
  const workId = work.id as string;

  if (core.hotspots?.length) {
    const r = await supabase.from('hotspots').insert(
      core.hotspots.map((hsp, i) => ({
        work_id: workId,
        x: hsp.x,
        y: hsp.y,
        label: hsp.label,
        detail: hsp.detail,
        order_index: i,
      })),
    );
    if (r.error) errors.push(`hotspots: ${r.error.message}`);
  }
  if (core.questions?.length) {
    const r = await supabase.from('questions').insert(
      core.questions.map((q, i) => ({
        work_id: workId,
        q: q.q,
        hint: q.hint,
        options: q.options,
        order_index: i,
      })),
    );
    if (r.error) errors.push(`questions: ${r.error.message}`);
  }
  if (core.vocabulary?.length) {
    const r = await supabase.from('vocabulary').insert(
      core.vocabulary.map((v) => ({ work_id: workId, word: v.word, note: v.note, is_new: v.isNew })),
    );
    if (r.error) errors.push(`vocabulary: ${r.error.message}`);
  }

  return { no: seed.no, title: seed.title, ok: true, errors };
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return sendJson(res, 500, { error: 'Supabase 服务端凭据未配置' });
  }
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const url = new URL(req.url ?? '', 'http://localhost');
  const only = url.searchParams.get('only');

  // ?source=1 — backfill the Wikipedia "deeper reading" link on roam works.
  if (url.searchParams.get('source') === '1') {
    const { data: rows, error } = await supabase
      .from('works')
      .select('id, no, source_url')
      .eq('kind', 'roam');
    if (error) return sendJson(res, 500, { error: '查询失败', detail: error.message });
    let fixed = 0;
    const unmatched: string[] = [];
    for (const r of rows ?? []) {
      if (r.source_url) continue;
      const u = roamSourceUrl(r.no as string);
      if (!u) {
        unmatched.push(r.no as string);
        continue;
      }
      await supabase.from('works').update({ source_url: u }).eq('id', r.id);
      fixed++;
    }
    return sendJson(res, 200, { ok: true, mode: 'source', fixed, unmatched });
  }

  // ?audio=1 — generate the three voice scripts for roam landmarks missing them
  // (roam was seeded without audio). Time-boxed; ?auto=1 self-refreshes.
  if (url.searchParams.get('audio') === '1') {
    const auto = url.searchParams.get('auto') === '1';
    const reset = url.searchParams.get('reset') === '1';
    const onlyAudio = url.searchParams.get('only');
    const { data: rows, error } = await supabase
      .from('works')
      .select('id, no, title, artist, audio_lines:audio_lines(count)')
      .eq('kind', 'roam');
    if (error) return sendJson(res, 500, { error: '查询失败', detail: error.message });
    type Row = { id: string; no: string; title: string; artist: string; audio_lines: Array<{ count: number }> };
    const all = (rows ?? []) as Row[];
    const seedByNo = new Map(ROAM_SEEDS.map((s) => [s.no, s]));
    // reset: wipe roam audio so the next fill regenerates with the new prompt.
    if (reset) {
      const ids = (onlyAudio ? all.filter((r) => r.no === onlyAudio) : all).map((r) => r.id);
      if (ids.length) await supabase.from('audio_lines').delete().in('work_id', ids);
      return sendJson(res, 200, { ok: true, mode: 'audio-reset', cleared: ids.length });
    }
    const missing = onlyAudio
      ? all.filter((r) => r.no === onlyAudio)
      : all.filter((r) => (r.audio_lines[0]?.count ?? 0) === 0);
    const started = Date.now();
    const log: string[] = [];
    let madeOk = 0;
    for (const r of missing) {
      if (!onlyAudio && Date.now() - started > AUDIO_BUDGET_MS) break;
      if (onlyAudio) await supabase.from('audio_lines').delete().eq('work_id', r.id); // force re-sample
      const seed = seedByNo.get(r.no);
      const audio = await generateAudioScripts({ title: r.title, artist: r.artist, hint: seed?.hint });
      const lines: Array<{ work_id: string; t: number; text: string; order_index: number; voice: string }> = [];
      for (const voice of VOICE_KEYS) {
        (audio?.[voice] ?? []).forEach((l, i) => lines.push({ work_id: r.id, t: l.t, text: l.text, order_index: i, voice }));
      }
      if (lines.length) {
        const ins = await supabase.from('audio_lines').insert(lines);
        if (ins.error) log.push(`${r.no} ${r.title} ✗ ${ins.error.message}`);
        else { madeOk++; log.push(`${r.no} ${r.title} ✓`); }
      } else {
        log.push(`${r.no} ${r.title} ✗ 语音生成为空`);
      }
    }
    const withAudioAfter = all.length - missing.length + madeOk;
    const remaining = all.length - withAudioAfter;
    if (auto) return sendAudioPage(res, withAudioAfter, all.length, remaining, log);
    return sendJson(res, 200, { ok: true, mode: 'audio', withAudio: withAudioAfter, total: all.length, remaining, log });
  }

  // ?images=1 — repair roam works whose image_path is empty by re-fetching the
  // Wikipedia image only (no AI regeneration). Fixes the Chinese-UA bug above.
  if (url.searchParams.get('images') === '1') {
    const { data: rows, error } = await supabase
      .from('works')
      .select('id, no, image_path')
      .eq('kind', 'roam');
    if (error) return sendJson(res, 500, { error: '查询失败', detail: error.message });
    const bySeedNo = new Map(ROAM_SEEDS.map((s) => [s.no, s]));
    const fixed: Array<{ no: string; image: string | null }> = [];
    for (const w of rows ?? []) {
      if (w.image_path) continue; // already has an image
      const seed = bySeedNo.get(w.no as string);
      if (!seed) continue;
      const { image } = await fetchWiki(seed);
      if (image) {
        await supabase.from('works').update({ image_path: image }).eq('id', w.id);
        fixed.push({ no: w.no as string, image });
      } else {
        fixed.push({ no: w.no as string, image: null });
      }
    }
    return sendJson(res, 200, {
      ok: true,
      mode: 'images',
      repaired: fixed.filter((f) => f.image).length,
      stillEmpty: fixed.filter((f) => !f.image).map((f) => f.no),
      results: fixed,
    });
  }

  // Which `no`s already exist → skip them (idempotent).
  const { data: existingRows, error: exErr } = await supabase
    .from('works')
    .select('no')
    .eq('kind', 'roam');
  if (exErr) return sendJson(res, 500, { error: '查询已有漫游作品失败', detail: exErr.message });
  const have = new Set((existingRows ?? []).map((r) => r.no as string));

  let todo = ROAM_SEEDS.filter((s) => !have.has(s.no));
  if (only) todo = ROAM_SEEDS.filter((s) => s.no === only);

  const started = Date.now();
  const done: Array<{ no: string; title: string; ok: boolean; errors: string[] }> = [];
  for (const seed of todo) {
    if (!only && Date.now() - started > 50_000) break; // leave headroom before maxDuration
    done.push(await seedOne(supabase, seed));
  }

  const remaining = only ? 0 : Math.max(0, todo.length - done.length);
  return sendJson(res, 200, {
    ok: true,
    seededNow: done.length,
    remaining,
    total: ROAM_SEEDS.length,
    alreadyHad: have.size,
    results: done,
    note: remaining > 0 ? '还有未播种的地标，请再次调用本接口继续。' : '全部地标已就绪。',
  });
}
