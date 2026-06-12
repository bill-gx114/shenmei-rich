// GET /api/season-build?auto=1              → phase 1: core + image (fast)
// GET /api/season-build?auto=1&phase=audio   → phase 2: the three voice scripts
// (append nothing for JSON instead of the self-refreshing HTML page.)
//
// Pre-generates the Season-1 curriculum (lib/season1.ts) into the works table as
// global daily works, ONE PER FUTURE DAY, revealed on schedule (no midnight gen).
//
// Why two phases: audio is the slow part (~12s/work). Generating core+audio
// together pushed a single invocation past Vercel's 60s ceiling → 504. So phase 1
// bakes the must-have content + image (each work ~8s, like the proven roam-seed),
// and phase 2 fills audio separately. Both are idempotent, time-boxed (well under
// 60s), resumable, and self-drive via ?auto=1.
//
// Scheduling anchor (phase 1, stable across batches): season works are tagged
// series='season1'; each work i gets exhibited_on = START + i days, no = BASENO + i,
// where START/BASENO are recovered from any built season work (date_i − i ; no_i − i),
// else computed as the day after the latest existing daily work.

import type { IncomingMessage, ServerResponse } from 'node:http';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SEASON1, WEEK_THEMES, type SeasonWork } from '../lib/season1.js';
import { generateCorePack, generateAudioScripts, VOICE_KEYS } from '../lib/curator.js';
import { wikiUrl } from '../lib/wikiLinks.js';
import { resolveDimensions } from '../lib/wikidata.js';
import { safeImg } from '../lib/imageUrl.js';

export const config = { maxDuration: 60 };

const SERIES = 'season1';
const CORE_BUDGET_MS = 38_000; // leaves headroom: worst case one more ~10s core then return
const AUDIO_BUDGET_MS = 32_000; // audio ~12s each; never start one that could exceed 60s
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

// Search a Wikipedia for a title, return the first matching article slug.
async function searchSlug(lang: string, query: string): Promise<string | null> {
  try {
    const u = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srlimit=1&format=json&origin=*&srsearch=${encodeURIComponent(query)}`;
    const r = await fetch(u, { headers: { 'User-Agent': WIKI_UA } });
    if (!r.ok) return null;
    const d = (await r.json()) as { query?: { search?: Array<{ title: string }> } };
    const t = d.query?.search?.[0]?.title;
    return t ? t.replace(/ /g, '_') : null;
  } catch {
    return null;
  }
}

// Last-resort: search Wikimedia Commons' File namespace directly and return a
// stable Special:FilePath link to the first image file found.
async function commonsFile(query: string): Promise<string | null> {
  try {
    const u = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srnamespace=6&srlimit=5&format=json&origin=*&srsearch=${encodeURIComponent(query)}`;
    const r = await fetch(u, { headers: { 'User-Agent': WIKI_UA } });
    if (!r.ok) return null;
    const d = (await r.json()) as { query?: { search?: Array<{ title: string }> } };
    for (const hit of d.query?.search ?? []) {
      const name = hit.title.replace(/^File:/, '');
      if (/\.(jpe?g|png|tiff?|webp)$/i.test(name)) {
        return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(name)}?width=1600`;
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Robust image resolution: exact slug → English article → search on its own lang
// → search the other lang → Commons file search. (Chinese paintings often
// resolve only via a zh search or Commons; retries also rescue transient fails.)
async function resolveImage(w: SeasonWork): Promise<string | null> {
  const own = w.lang ?? 'en';
  const other = own === 'zh' ? 'en' : 'zh';
  const direct = await fetchWiki(own, w.slug);
  if (direct.image) return direct.image;
  // Curated English article (reliable for Chinese works whose zh page lacks an image).
  if (w.en) {
    const enHit = await fetchWiki('en', w.en);
    if (enHit.image) return enHit.image;
    const enSlug = await searchSlug('en', w.en.replace(/_/g, ' '));
    if (enSlug) {
      const { image } = await fetchWiki('en', enSlug);
      if (image) return image;
    }
  }
  for (const [lang, query] of [
    [own, w.title],
    [own, `${w.title} ${w.artist}`],
    [other, w.title],
  ] as Array<[string, string]>) {
    const slug = await searchSlug(lang, query);
    if (!slug) continue;
    const { image } = await fetchWiki(lang, slug);
    if (image) return image;
  }
  // Final fallback: Wikimedia Commons file search (en title, then Chinese title).
  for (const q of [w.en?.replace(/_/g, ' '), `${w.title} ${w.artist}`, w.title]) {
    if (!q) continue;
    const img = await commonsFile(q);
    if (img) return img;
  }
  return null;
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

// Phase 1: core content + image (NO audio).
async function buildCore(
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
      source_url: wikiUrl(w.lang ?? 'en', w.slug),
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
  return { no, title: w.title, ok: true, errors };
}

// Phase 2: the three voice scripts for one already-built work.
async function buildAudio(
  supabase: SupabaseClient,
  workId: string,
  no: string,
  title: string,
  artist: string,
  hint: string | undefined,
): Promise<BuildResult> {
  const audio = await generateAudioScripts({ title, artist, hint });
  const rows: Array<{ work_id: string; t: number; text: string; order_index: number; voice: string }> = [];
  for (const voice of VOICE_KEYS) {
    (audio?.[voice] ?? []).forEach((l, i) => rows.push({ work_id: workId, t: l.t, text: l.text, order_index: i, voice }));
  }
  if (!rows.length) return { no, title, ok: false, errors: ['audio: 生成为空'] };
  const r = await supabase.from('audio_lines').insert(rows);
  if (r.error) return { no, title, ok: false, errors: [`audio_lines: ${r.error.message}`] };
  return { no, title, ok: true, errors: [] };
}

function htmlPage(label: string, builtTotal: number, total: number, remaining: number, recent: BuildResult[]): string {
  const done = remaining === 0;
  const refresh = done ? '' : '<meta http-equiv="refresh" content="2">';
  const log = recent.map((b) => `${b.no} ${b.title} ${b.ok ? '✓' : '✗ ' + b.errors.join('; ')}`).join('\n');
  return `<!doctype html><html><head><meta charset="utf-8">${refresh}<title>${label}</title></head>
<body style="background:#0b0907;color:#e7c067;font-family:'Songti SC',serif;text-align:center;padding:56px 20px;line-height:1.8">
<div style="font-size:13px;letter-spacing:.3em;color:#998c70">AESTHETIC DAILY · SEASON 1</div>
<h1 style="font-weight:300;letter-spacing:.05em">${label}</h1>
<div style="font-size:42px;color:#ffd166">${builtTotal} / ${total}</div>
<p style="color:#d9c8a0">${done ? '✅ 本阶段全部就绪。' : '生成中…本页每 2 秒自动续跑，保持打开即可。'}</p>
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
  const phaseParam = url.searchParams.get('phase');
  const phase =
    phaseParam === 'audio'
      ? 'audio'
      : phaseParam === 'images'
        ? 'images'
        : phaseParam === 'size'
          ? 'size'
          : phaseParam === 'imgcap'
            ? 'imgcap'
            : phaseParam === 'mirror'
              ? 'mirror'
              : 'core';
  const titleIndex = new Map(SEASON1.map((w, i) => [w.title, i]));
  const byTitle = new Map(SEASON1.map((w) => [w.title, w]));
  const started = Date.now();
  const done: BuildResult[] = [];

  // ── Image repair: fill image_path for season works missing it ──────────────
  if (phase === 'images') {
    const { data: rows, error } = await supabase
      .from('works')
      .select('id, no, title, image_path')
      .eq('kind', 'daily')
      .eq('series', SERIES);
    if (error) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: '读取 works 失败', detail: error.message }));
      return;
    }
    const all = (rows ?? []) as Array<{ id: string; no: string; title: string; image_path: string | null }>;
    const missing = all.filter((r) => !r.image_path);
    for (const r of missing) {
      if (Date.now() - started > CORE_BUDGET_MS) break;
      const w = byTitle.get(r.title);
      if (!w) continue;
      const image = await resolveImage(w);
      if (image) {
        await supabase.from('works').update({ image_path: image }).eq('id', r.id);
        done.push({ no: r.no, title: r.title, ok: true, errors: [] });
      } else {
        done.push({ no: r.no, title: r.title, ok: false, errors: ['无可用图'] });
      }
    }
    const withImageAfter = all.length - missing.length + done.filter((d) => d.ok).length;
    const remaining = all.length - withImageAfter;
    if (auto) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(htmlPage('第一季 · 补图', withImageAfter, all.length, remaining, done));
      return;
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: true, phase, withImage: withImageAfter, totalBuilt: all.length, remaining, stillEmpty: done.filter((d) => !d.ok).map((d) => d.no + ' ' + d.title), results: done }));
    return;
  }

  // ── Mirror images into our own Supabase Storage ───────────────────────────
  // Hotlinking many Wikimedia images at once gets rate-limited/blocked → mass
  // placeholders. Download each (server-side, not throttled like browser
  // hotlinks) and serve from our own bucket. Idempotent, time-boxed, auto.
  if (phase === 'mirror') {
    const { data: rows, error } = await supabase
      .from('works')
      .select('id, no, title, image_path')
      .in('kind', ['daily', 'roam'])
      .is('owner_id', null);
    if (error) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: '读取 works 失败', detail: error.message }));
      return;
    }
    const STORAGE_MARK = '/storage/v1/object/public/works/mirror/';
    const all = (rows ?? []) as Array<{ id: string; no: string; title: string; image_path: string | null }>;
    const alreadyMirrored = all.filter((r) => r.image_path?.includes(STORAGE_MARK)).length;
    const todo = all.filter((r) => r.image_path && !r.image_path.includes(STORAGE_MARK));
    const log: BuildResult[] = [];
    for (const r of todo) {
      if (Date.now() - started > 42_000) break;
      try {
        const resp = await fetch(r.image_path as string, { headers: { 'User-Agent': WIKI_UA } });
        if (!resp.ok) {
          log.push({ no: r.no, title: r.title, ok: false, errors: [`下载 ${resp.status}`] });
          continue;
        }
        const ct = resp.headers.get('content-type') ?? 'image/jpeg';
        const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg';
        const buf = await resp.arrayBuffer();
        const path = `mirror/${r.no}.${ext}`;
        const up = await supabase.storage.from('works').upload(path, buf, { contentType: ct, upsert: true });
        if (up.error) {
          log.push({ no: r.no, title: r.title, ok: false, errors: [`上传 ${up.error.message}`] });
          continue;
        }
        const pub = supabase.storage.from('works').getPublicUrl(path).data.publicUrl;
        await supabase.from('works').update({ image_path: pub }).eq('id', r.id);
        log.push({ no: r.no, title: r.title, ok: true, errors: [] });
      } catch (e) {
        log.push({ no: r.no, title: r.title, ok: false, errors: [e instanceof Error ? e.message : String(e)] });
      }
    }
    const okNow = log.filter((d) => d.ok).length;
    const doneTotal = alreadyMirrored + okNow;
    const displayRemaining = okNow > 0 ? all.length - doneTotal : 0; // stop if a sweep mirrors nothing
    if (auto) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(htmlPage('作品 · 图片镜像', doneTotal, all.length, displayRemaining, log));
      return;
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: true, mode: 'mirror', mirrored: doneTotal, total: all.length, thisBatch: okNow, failed: log.filter((d) => !d.ok) }));
    return;
  }

  // ── Image normalization: convert huge originals + oversized thumbs to a
  // reliable 1600px thumbnail (see lib/imageUrl.ts). Pure string op, no fetch.
  if (phase === 'imgcap') {
    const { data: rows, error } = await supabase
      .from('works')
      .select('id, no, title, image_path')
      .in('kind', ['daily', 'roam'])
      .is('owner_id', null);
    if (error) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: '读取 works 失败', detail: error.message }));
      return;
    }
    const all = (rows ?? []) as Array<{ id: string; no: string; title: string; image_path: string | null }>;
    const fixed: string[] = [];
    for (const r of all) {
      const ip = r.image_path ?? '';
      const next = safeImg(ip);
      if (!next || next === ip) continue;
      await supabase.from('works').update({ image_path: next }).eq('id', r.id);
      fixed.push(`${r.no} ${r.title}`);
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: true, mode: 'imgcap', fixedCount: fixed.length, fixed }));
    return;
  }

  // ── Size repair: fill `size` from Wikidata (structured dims) ───────────────
  // Season works were inserted without size (it isn't in the prose extract).
  // Resolve from each work's Wikipedia article → Wikidata height/width. Covers
  // daily + roam (both global). No AI.
  if (phase === 'size') {
    const { data: rows, error } = await supabase
      .from('works')
      .select('id, no, title, size, source_url')
      .in('kind', ['daily', 'roam'])
      .is('owner_id', null);
    if (error) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: '读取 works 失败', detail: error.message }));
      return;
    }
    type Row = { id: string; no: string; title: string; size: string | null; source_url: string | null };
    const all = (rows ?? []) as Row[];
    const missing = all.filter((r) => !r.size && r.source_url);
    const log: BuildResult[] = [];
    for (const r of missing) {
      if (Date.now() - started > CORE_BUDGET_MS) break;
      const dims = await resolveDimensions(r.source_url);
      if (dims) {
        await supabase.from('works').update({ size: dims }).eq('id', r.id);
        log.push({ no: r.no, title: `${r.title} · ${dims}`, ok: true, errors: [] });
      } else {
        log.push({ no: r.no, title: r.title, ok: false, errors: ['无尺寸数据'] });
      }
    }
    const fixedNow = log.filter((d) => d.ok).length;
    const haveAfter = all.length - missing.length + fixedNow;
    // Works that returned "no dims" are terminal (buildings/sites, or not in
    // Wikidata). Once a whole sweep recovers nothing, stop — otherwise the page
    // would loop forever re-querying the same un-recoverable works.
    const realRemaining = missing.length - fixedNow;
    const displayRemaining = fixedNow > 0 ? realRemaining : 0;
    if (auto) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(htmlPage('作品 · 尺寸回填', haveAfter, all.length, displayRemaining, log));
      return;
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(
      JSON.stringify({
        ok: true,
        phase,
        fixed: log.filter((d) => d.ok).length,
        stillEmpty: log.filter((d) => !d.ok).map((d) => `${d.no} ${d.title}`),
        results: log,
      }),
    );
    return;
  }

  // ── Phase 2: audio (all daily works, old + season) ─────────────────────────
  // To REGENERATE with a changed prompt: ?phase=audio&reset=1 clears existing
  // audio (fast, no AI), then ?phase=audio&auto=1 refills (idempotent, stops at
  // full). ?only=<no> regenerates a single work (force-deletes first) for sampling.
  if (phase === 'audio') {
    const reset = url.searchParams.get('reset') === '1';
    const only = url.searchParams.get('only');
    const { data: rows, error } = await supabase
      .from('works')
      .select('id, no, title, artist, short_label, audio_lines:audio_lines(count)')
      .eq('kind', 'daily')
      .is('owner_id', null);
    if (error) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: '读取 works 失败', detail: error.message }));
      return;
    }
    type Row = {
      id: string; no: string; title: string; artist: string;
      short_label: string | null; audio_lines: Array<{ count: number }>;
    };
    const all = (rows ?? []) as Row[];

    // reset: wipe audio so the subsequent fill regenerates everything.
    if (reset) {
      const ids = (only ? all.filter((r) => r.no === only) : all).map((r) => r.id);
      if (ids.length) await supabase.from('audio_lines').delete().in('work_id', ids);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ ok: true, mode: 'audio-reset', cleared: ids.length }));
      return;
    }

    const hintFor = (r: Row) => {
      const sw = byTitle.get(r.title);
      return sw ? WEEK_THEMES[sw.week] : r.short_label ?? undefined;
    };
    const targets = only
      ? all.filter((r) => r.no === only)
      : all.filter((r) => (r.audio_lines[0]?.count ?? 0) === 0);
    for (const r of targets) {
      if (!only && Date.now() - started > AUDIO_BUDGET_MS) break;
      if (only) await supabase.from('audio_lines').delete().eq('work_id', r.id); // force re-sample
      done.push(await buildAudio(supabase, r.id, r.no, r.title, r.artist, hintFor(r)));
    }
    const missingCount = all.filter((r) => (r.audio_lines[0]?.count ?? 0) === 0).length;
    const withAudioAfter = all.length - missingCount + done.filter((d) => d.ok).length;
    const remaining = only ? 0 : all.length - withAudioAfter;
    if (auto) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(htmlPage('日课 · 语音重写', withAudioAfter, all.length, remaining, done));
      return;
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: true, phase, withAudio: withAudioAfter, total: all.length, remaining, results: done }));
    return;
  }

  // ── Phase 1: core + image ──────────────────────────────────────────────────
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
  for (const { w, i } of todo) {
    if (Date.now() - started > CORE_BUDGET_MS) break;
    done.push(await buildCore(supabase, w, pad(baseNo + i), addDaysISO(startDate, i)));
  }

  const builtTotalAfter = builtSeason.length + done.filter((d) => d.ok).length;
  const remaining = SEASON1.length - builtTotalAfter;
  if (auto) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(htmlPage('第一季 · 内容预生成', builtTotalAfter, SEASON1.length, remaining, done));
    return;
  }
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(
    JSON.stringify({
      ok: true,
      phase,
      startDate,
      builtThisBatch: done.length,
      builtTotal: builtTotalAfter,
      remaining,
      results: done,
      note:
        remaining > 0
          ? '内容还没生成完，请继续（或用 ?auto=1）。完成后再跑 ?auto=1&phase=audio 补语音。'
          : '内容全部就绪，接着跑 ?auto=1&phase=audio 生成语音。',
    }),
  );
}
