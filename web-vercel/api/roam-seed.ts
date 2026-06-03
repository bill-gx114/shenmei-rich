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
import { generateCorePack } from '../lib/curator.js';

export const config = { maxDuration: 60 };

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
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

async function fetchWiki(seed: RoamSeed): Promise<{ image: string | null; extract: string }> {
  const url = `https://${seed.wiki.lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(seed.wiki.title)}`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': WIKI_UA } });
    if (!r.ok) return { image: null, extract: '' };
    const d = (await r.json()) as WikiSummary;
    return {
      image: d.originalimage?.source ?? d.thumbnail?.source ?? null,
      extract: d.extract ?? '',
    };
  } catch {
    return { image: null, extract: '' };
  }
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
