// GET /api/season-build?auto=1   → open once, the page self-refreshes and drives
//                                   the whole season to completion (recommended).
// GET /api/season-build           → process one time-boxed batch, return JSON.
// GET /api/season-build?audio=0    → skip audio (faster text-only pass).
//
// Pre-generates the Season-1 curriculum (lib/season1.ts) into the works table as
// global daily works, ONE PER FUTURE DAY, so the app reveals them on schedule
// with no midnight generation. Idempotent + time-boxed + resumable.
//
// Scheduling anchor (stable across batches):
//   • Season works are tagged series='season1' so we can tell them apart from
//     cron-published works even when titles overlap.
//   • Each season work i gets exhibited_on = START + i days, no = BASENO + i.
//   • START/BASENO are recovered from any already-built season work
//     (date_i − i ; no_i − i); on the very first run they're computed as the day
//     AFTER the latest existing daily work (so it dovetails with what's shown).

import type { IncomingMessage, ServerResponse } from 'node:http';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SEASON1, WEEK_THEMES, type SeasonWork } from '../lib/season1.js';
import { generateCorePack, generateAudioScripts, VOICE_KEYS } from '../lib/curator.js';

export const config = { maxDuration: 60 };

const SERIES = 'season1';
const TIME_BUDGET_MS = 45_000;
const CONCURRENCY = 3;
const MEDIUM_FALLBACK: Record<string, string> = { 画: '绘画', 雕: '雕塑', 器: '器物' };

const WIKI_UA = 'shenmei-daily/1.0 (https://shenmei-rich.vercel.app)';

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function beijingTodayISO(): string {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}
function pad(n: number): string {
  return String(n).padStart(3, '0');
}

async function pageImage(lang: string, title: string): Promise<string | null> {
  try {
    const u = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=pageimages&piprop=original|thumbnail&pithumbsize=1200&format=json&origin=*&titles=${encodeURIComponent(title)}`;
    const r = await fetch(u, { headers: { 'User-Agent': WIKI_UA } });
    if (!r.ok) return null;
    const d = (await r.json()) as {
      query?: { pages?: Record<string, { original?: { source: string }; thumbnail?: { source: string } }> };
    };
    for (const p of Object.values(d.query?.pages ?? {})) {
      const src = p.original?.source ?? p.thumbnail?.source;
      if (src) return src;
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchWiki(lang: string, slug: string): Promise<{ image: string | null; extract: string }> {
  let image: string | null = null;
  let extract = '';
  try {
    const r = await fetch(
      `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}`,
      { headers: { 'User-Agent': WIKI_UA } },
    );
    if (r.ok) {
      const d = (await r.json()) as {
        originalimage?: { source: string };
        thumbnail?: { source: string };
        extract?: string;
      };
      image = d.originalimage?.source ?? d.thumbnail?.source ?? null;
      extract = d.extract ?? '';
    }
  } catch {
    /* fall through */
  }
  if (!image) image = await pageImage(lang, slug);
  return { image, extract };
}

type BuildResult = { no: string; title: string; ok: boolean; errors: string[] };

async function buildOne(
  supabase: SupabaseClient,
  w: SeasonWork,
  no: string,
  exhibitedOn: string,
): Promise<BuildResult> {
  const errors: string[] = [];
  const { image, extract } = await fetchWiki(w.lang ?? 'en', w.slug);
  const theme = WEEK_THEMES[w.week] ?? '';
  const input = { title: w.title, artist: w.artist, hint: theme, context: extract || undefined };

  let core;
  try {
    core = await generateCorePack(input);
  } catch (e) {
    return { no, title: w.title, ok: false, errors: [`core: ${e instanceof Error ? e.message : String(e)}`] };
  }

  const { data: work, error: workErr } = await supabase
    .from('works')
    .insert({
      owner_id: null,
      kind: 'daily',
      series: SERIES,
      no,
      exhibited_on: exhibitedOn,
      title: w.title,
      artist: w.artist,
      year: core.year || null,
      medium: core.medium || MEDIUM_FALLBACK[w.category] || null,
      location: core.location || null,
      region: w.region,
      category: w.category,
      room: `今日展厅 · No. ${no}`,
      short_label: core.shortLabel,
      curator_note: core.curatorNote ?? null,
      image_path: image,
      total: 365,
    })
    .select('id')
    .single();
  if (workErr) return { no, title: w.title, ok: false, errors: [`works: ${workErr.message}`] };
  const workId = work.id as string;

  if (core.hotspots?.length) {
    const r = await supabase.from('hotspots').insert(
      core.hotspots.map((h, i) => ({ work_id: workId, x: h.x, y: h.y, label: h.label, detail: h.detail, order_index: i })),
    );
    if (r.error) errors.push(`hotspots: ${r.error.message}`);
  }
  if (core.questions?.length) {
    const r = await supabase.from('questions').insert(
      core.questions.map((q, i) => ({ work_id: workId, q: q.q, hint: q.hint, options: q.options, order_index: i })),
    );
    if (r.error) errors.push(`questions: ${r.error.message}`);
  }
  if (core.vocabulary?.length) {
    const r = await supabase.from('vocabulary').insert(
      core.vocabulary.map((v) => ({ work_id: workId, word: v.word, note: v.note, is_new: v.isNew })),
    );
    if (r.error) errors.push(`vocabulary: ${r.error.message}`);
  }

  // Audio (best-effort; if it comes back empty the daily self-heal can fill it
  // the day this work is revealed).
  const wantAudio = true;
  if (wantAudio) {
    const audio = await generateAudioScripts(input);
    const rows: Array<{ work_id: string; t: number; text: string; order_index: number; voice: string }> = [];
    for (const voice of VOICE_KEYS) {
      (audio?.[voice] ?? []).forEach((l, i) => rows.push({ work_id: workId, t: l.t, text: l.text, order_index: i, voice }));
    }
    if (rows.length) {
      const r = await supabase.from('audio_lines').insert(rows);
      if (r.error) errors.push(`audio_lines: ${r.error.message}`);
    }
  }

  return { no, title: w.title, ok: true, errors };
}

function htmlPage(builtTotal: number, remaining: number, recent: BuildResult[]): string {
  const done = remaining === 0;
  const refresh = done ? '' : '<meta http-equiv="refresh" content="2">';
  const log = recent
    .map((b) => `${b.no} ${b.title} ${b.ok ? '✓' : '✗ ' + b.errors.join('; ')}`)
    .join('\n');
  return `<!doctype html><html><head><meta charset="utf-8">${refresh}<title>第一季预生成</title></head>
<body style="background:#0b0907;color:#e7c067;font-family:'Songti SC',serif;text-align:center;padding:56px 20px;line-height:1.8">
<div style="font-size:13px;letter-spacing:.3em;color:#998c70">AESTHETIC DAILY · SEASON 1</div>
<h1 style="font-weight:300;letter-spacing:.05em">第一季 · 内容预生成</h1>
<div style="font-size:42px;color:#ffd166">${builtTotal} / ${SEASON1.length}</div>
<p style="color:#d9c8a0">${done ? '✅ 全部就绪，可以关闭本页。' : '生成中…本页每 2 秒自动续跑，保持打开即可（约十几分钟）。'}</p>
<pre style="color:#8f8268;font-size:12px;text-align:left;max-width:560px;margin:24px auto;white-space:pre-wrap">${log || '正在启动…'}</pre>
</body></html>`;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    res.statusCode = 500;
    res.end('Supabase 服务端凭据未配置');
    return;
  }
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const url = new URL(req.url ?? '', 'http://localhost');
  const auto = url.searchParams.get('auto') === '1';

  // Load existing daily works (to recover the anchor + skip built season works).
  const { data: dailyRows, error } = await supabase
    .from('works')
    .select('no, title, exhibited_on, series')
    .eq('kind', 'daily')
    .is('owner_id', null);
  if (error) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: '读取 works 失败', detail: error.message }));
    return;
  }
  const rows = dailyRows ?? [];
  const titleIndex = new Map(SEASON1.map((w, i) => [w.title, i]));

  // Built season works (by our series tag) → skip set + anchor recovery.
  const builtSeason = rows.filter((r) => r.series === SERIES && titleIndex.has(r.title as string));
  const builtTitles = new Set(builtSeason.map((r) => r.title as string));

  let startDate: string;
  let baseNo: number;
  if (builtSeason.length) {
    const ref = builtSeason[0];
    const idx = titleIndex.get(ref.title as string)!;
    startDate = addDaysISO(ref.exhibited_on as string, -idx);
    baseNo = (parseInt(ref.no as string, 10) || idx + 1) - idx;
  } else {
    // Fresh: start the day after the latest existing daily work (or today).
    let maxDate = beijingTodayISO();
    let maxNo = 0;
    for (const r of rows) {
      if ((r.exhibited_on as string) > maxDate) maxDate = r.exhibited_on as string;
      const n = parseInt(r.no as string, 10);
      if (!Number.isNaN(n) && n > maxNo) maxNo = n;
    }
    startDate = addDaysISO(maxDate, 1);
    baseNo = maxNo + 1;
  }

  const todo = SEASON1.map((w, i) => ({ w, i })).filter(({ w }) => !builtTitles.has(w.title));

  // Time-boxed, concurrent batch.
  const started = Date.now();
  const done: BuildResult[] = [];
  let ptr = 0;
  while (ptr < todo.length && Date.now() - started < TIME_BUDGET_MS) {
    const chunk = todo.slice(ptr, ptr + CONCURRENCY);
    ptr += CONCURRENCY;
    const results = await Promise.all(
      chunk.map(({ w, i }) => buildOne(supabase, w, pad(baseNo + i), addDaysISO(startDate, i))),
    );
    done.push(...results);
  }

  const builtTotalAfter = builtSeason.length + done.filter((d) => d.ok).length;
  const remaining = SEASON1.length - builtTotalAfter;

  if (auto) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(htmlPage(builtTotalAfter, remaining, done));
    return;
  }
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(
    JSON.stringify({
      ok: true,
      startDate,
      builtThisBatch: done.length,
      builtTotal: builtTotalAfter,
      remaining,
      results: done,
      note: remaining > 0 ? '还有未生成的，请再次调用（或用 ?auto=1 自动跑完）。' : '第一季全部就绪。',
    }),
  );
}
