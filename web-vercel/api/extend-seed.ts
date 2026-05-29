// Scheduled function: runs on the 1st of each month at 02:00 UTC.
// Asks DeepSeek to suggest 10 famous artworks that are NOT already in the
// seed_works table, validates each via Wikipedia, and inserts the valid ones.
//
// Required env vars (same as daily-curator):
//   VITE_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   DEEPSEEK_API_KEY
//
// Manual invoke for testing:
//   netlify functions:invoke extend-seed
// or via Netlify dashboard → Functions → extend-seed → Run.

// Schedule (1st of each month, 02:00 UTC) lives in vercel.json.
export const config = { runtime: 'edge' };

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SEED_WORKS } from '../lib/seed-works.js';

// How many candidates to ask DeepSeek for each run. Runs weekly (see
// vercel.json cron), so ~15/week × 4 ≈ 60 candidates/month; after Wikipedia
// rejections that nets ~40+ new works/month — comfortably ahead of the
// ~30/month the daily-curator consumes, so the rotation never repeats.
const CANDIDATE_COUNT = 15;

// ── DeepSeek prompt ──────────────────────────────────────────────────────
const SYSTEM_PROMPT = `你是"审美日课"的策展人，正在为每日展览扩充选品池。

任务：根据用户给的"已经收录的作品清单"，推荐 ${CANDIDATE_COUNT} 幅新作品。要求：

- **textbook 级别的全球知名画作或艺术品**（如蒙娜丽莎、神奈川冲浪里、富春山居图这种量级）
- 在 **en.wikipedia.org** 或 **zh.wikipedia.org** 上有独立条目
- 东西方、不同时代、不同媒材混搭
- **绝不重复**用户清单里已有的作品

每一条返回这样的对象（严格 JSON）：

{
  "title": "中文标题（如果作品本身有中文译名，否则用最常见译名）",
  "artist": "作者中文名（如有）",
  "artistRomaji": "作者罗马字 / 拼音 / 英文",
  "year": "约 1503-1519",
  "medium": "媒材",
  "size": "尺寸（如 \\"77 × 53 cm\\"）",
  "series": "系列名 或 null",
  "location": "现存地点",
  "wikipediaSlug": "Wikipedia 文章 slug（空格用下划线代替，如 \\"Mona_Lisa\\"）",
  "wikipediaLang": "en" 或 "zh" 或 "ja"（选最可能有该条目的语言）,
  "hint": "一句话讲清楚这幅作品在做什么、靠什么成立（25-40 字）"
}

返回 JSON：{ "candidates": [${CANDIDATE_COUNT} 个对象] }。只输出 JSON，不要其他文字。`;

type Candidate = {
  title: string;
  artist: string;
  artistRomaji: string;
  year: string;
  medium: string;
  size: string;
  series: string | null;
  location: string;
  wikipediaSlug: string;
  wikipediaLang: 'en' | 'zh' | 'ja';
  hint: string;
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

async function callDeepSeek(existingList: string): Promise<Candidate[]> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY 未配置');

  const r = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `已经收录的作品（按 "作品名 — 作者" 格式）：\n${existingList}\n\n请推荐 ${CANDIDATE_COUNT} 幅不在上面的名作。`,
        },
      ],
      temperature: 0.8,
      max_tokens: 8192,
      response_format: { type: 'json_object' },
    }),
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`DeepSeek (${r.status}): ${text.slice(0, 300)}`);
  }
  const data = (await r.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('DeepSeek 返回为空');
  const parsed = JSON.parse(content) as { candidates?: Candidate[] };
  return parsed.candidates ?? [];
}

const WIKI_UA = 'AestheticDaily/1.0 (https://github.com/bill-gx114/shenmei-rich; contact via github issues)';

type WikiProbe = { ok: boolean; status: number; hasImage: boolean };

async function wikiHasImage(slug: string, lang: string): Promise<WikiProbe> {
  try {
    const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}`;
    const r = await fetch(url, { headers: { 'User-Agent': WIKI_UA } });
    if (!r.ok) return { ok: false, status: r.status, hasImage: false };
    const data = (await r.json()) as {
      originalimage?: { source: string };
      thumbnail?: { source: string };
    };
    const hasImage = Boolean(data.originalimage?.source || data.thumbnail?.source);
    return { ok: true, status: r.status, hasImage };
  } catch {
    return { ok: false, status: 0, hasImage: false };
  }
}

async function wikiSearchTop(lang: 'en' | 'zh' | 'ja', q: string): Promise<string[]> {
  try {
    const url = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srlimit=3&format=json&srsearch=${encodeURIComponent(q)}`;
    const r = await fetch(url, { headers: { 'User-Agent': WIKI_UA } });
    if (!r.ok) {
      console.log(`[wiki-search] ${lang} "${q}" → HTTP ${r.status}`);
      return [];
    }
    const d = (await r.json()) as { query?: { search?: Array<{ title: string }> } };
    const titles = (d.query?.search ?? []).map((s) => s.title.replace(/ /g, '_'));
    console.log(`[wiki-search] ${lang} "${q}" → ${titles.length ? titles.join(', ') : '(no results)'}`);
    return titles;
  } catch (e) {
    console.log(`[wiki-search] ${lang} "${q}" → throw: ${e instanceof Error ? e.message : e}`);
    return [];
  }
}

// Find a working (slug, lang) for a candidate title — tries the AI's guess
// first, then multi-lingual Wikipedia search with several query forms.
async function findWorkingSlug(
  title: string,
  artist: string,
  artistRomaji: string,
  hintedSlug: string,
  hintedLang: 'en' | 'zh' | 'ja',
): Promise<{ slug: string; lang: 'en' | 'zh' | 'ja' } | null> {
  const tried: Array<{ slug: string; lang: 'en' | 'zh' | 'ja' }> = [];
  const push = (slug: string, lang: 'en' | 'zh' | 'ja') => {
    if (!slug) return;
    if (tried.find((c) => c.slug === slug && c.lang === lang)) return;
    tried.push({ slug, lang });
  };

  // 1. AI's guess + simple variations.
  push(hintedSlug, hintedLang);
  push(hintedSlug.replace(/ /g, '_'), hintedLang);
  for (const lang of (['en', 'zh', 'ja'] as const).filter((l) => l !== hintedLang)) {
    push(hintedSlug, lang);
  }

  // 2. Search fallback — try multiple query forms in zh + en.
  //    Chinese names are best resolved in zh.wp; English/romaji in en.wp.
  const queries: Array<{ lang: 'en' | 'zh' | 'ja'; q: string }> = [];
  if (title) queries.push({ lang: 'zh', q: `${title} ${artist}`.trim() });
  if (title) queries.push({ lang: 'zh', q: title });
  if (artistRomaji) queries.push({ lang: 'en', q: `${artistRomaji} ${title}`.trim() });
  if (artistRomaji && artist) queries.push({ lang: 'en', q: `${artistRomaji}` });

  for (const { lang, q } of queries) {
    if (!q.trim()) continue;
    const results = await wikiSearchTop(lang, q);
    for (const slug of results) push(slug, lang);
  }

  // 3. Probe each candidate for an actual image.
  const probeLog: string[] = [];
  for (const c of tried) {
    const probe = await wikiHasImage(c.slug, c.lang);
    probeLog.push(`${c.lang}/${c.slug}=${probe.status}${probe.hasImage ? '+img' : ''}`);
    if (probe.hasImage) {
      console.log(`[wiki-probe] "${title}" → HIT ${c.lang}/${c.slug} (probes: ${probeLog.join(' | ')})`);
      return c;
    }
  }
  console.log(`[wiki-probe] "${title}" → MISS (${tried.length} tried: ${probeLog.join(' | ')})`);
  return null;
}

async function ensureSeedTablePopulated(supabase: SupabaseClient): Promise<number> {
  const { count } = await supabase.from('seed_works').select('id', { count: 'exact', head: true });
  if ((count ?? 0) > 0) return 0;
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
  }));
  const { error } = await supabase.from('seed_works').insert(rows);
  if (error) {
    console.error('[extend-seed] bootstrap insert failed:', error.message);
    return 0;
  }
  console.log(`[extend-seed] bootstrapped seed_works with ${rows.length} initial rows`);
  return rows.length;
}

// ── main ─────────────────────────────────────────────────────────────────
export default async () => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse(500, { error: 'Supabase 凭据未配置' });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 0. If seed_works is empty (fresh setup), bootstrap with the initial 30
  //    first — otherwise DeepSeek will happily re-suggest works that the
  //    daily-curator will later try to insert from the in-code SEED_WORKS,
  //    causing duplicate-key conflicts.
  const bootstrapped = await ensureSeedTablePopulated(supabase);

  // 1. Read all existing seeds (title + artist for dedup + prompt context).
  const { data: existing, error: readErr } = await supabase
    .from('seed_works')
    .select('title, artist, order_index')
    .order('order_index', { ascending: true });
  if (readErr) {
    return jsonResponse(500, { error: '读取 seed_works 失败', detail: readErr.message });
  }
  const existingKeys = new Set((existing ?? []).map((r) => `${r.title}|${r.artist}`));
  const existingListPrompt = (existing ?? [])
    .map((r) => `- ${r.title} — ${r.artist}`)
    .join('\n');
  const nextOrderIndex = ((existing ?? []).at(-1)?.order_index ?? -1) + 1;
  console.log(`[extend-seed] existing seeds: ${existing?.length ?? 0}, next index: ${nextOrderIndex}`);

  // 2. Ask DeepSeek for candidates.
  let candidates: Candidate[];
  try {
    candidates = await callDeepSeek(existingListPrompt || '（暂无）');
  } catch (err) {
    return jsonResponse(502, {
      error: 'DeepSeek 调用失败',
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  // 3. Validate each candidate (not duplicate, Wikipedia has image).
  console.log(`[extend-seed] DeepSeek returned ${candidates.length} candidates`);
  const accepted: Array<Candidate & { order_index: number }> = [];
  const rejected: Array<{ title: string; reason: string }> = [];
  let nextIdx = nextOrderIndex;

  for (const c of candidates) {
    if (!c.title || !c.artist || !c.wikipediaSlug || !c.wikipediaLang || !c.hint) {
      rejected.push({ title: c.title ?? '(unknown)', reason: 'missing required field' });
      console.log(`[extend-seed] REJECT ${c.title ?? '(unknown)'}: missing field`);
      continue;
    }
    if (!['en', 'zh', 'ja'].includes(c.wikipediaLang)) {
      rejected.push({ title: c.title, reason: `unsupported lang: ${c.wikipediaLang}` });
      console.log(`[extend-seed] REJECT ${c.title}: bad lang ${c.wikipediaLang}`);
      continue;
    }
    const key = `${c.title}|${c.artist}`;
    if (existingKeys.has(key)) {
      rejected.push({ title: c.title, reason: 'already in seed list' });
      console.log(`[extend-seed] REJECT ${c.title}: duplicate of existing`);
      continue;
    }
    const resolved = await findWorkingSlug(
      c.title,
      c.artist,
      c.artistRomaji,
      c.wikipediaSlug,
      c.wikipediaLang,
    );
    if (!resolved) {
      rejected.push({
        title: c.title,
        reason: `Wikipedia 找不到图（tried slug=${c.wikipediaSlug} lang=${c.wikipediaLang} + search fallback）`,
      });
      console.log(`[extend-seed] REJECT ${c.title}: no Wikipedia image found`);
      continue;
    }
    if (resolved.slug !== c.wikipediaSlug || resolved.lang !== c.wikipediaLang) {
      console.log(
        `[extend-seed] resolved ${c.title}: ${c.wikipediaLang}/${c.wikipediaSlug} → ${resolved.lang}/${resolved.slug}`,
      );
    }
    c.wikipediaSlug = resolved.slug;
    c.wikipediaLang = resolved.lang;
    existingKeys.add(key);
    accepted.push({ ...c, order_index: nextIdx++ });
    console.log(`[extend-seed] ACCEPT ${c.title} (${c.artist})`);
  }

  if (accepted.length === 0) {
    console.log(`[extend-seed] DONE bootstrapped=${bootstrapped} added=0 rejected=${rejected.length}`);
    return jsonResponse(200, {
      ok: true,
      bootstrapped,
      added: 0,
      rejected,
      message: '本次没有合格的新候选',
    });
  }

  // 4. Insert accepted ones.
  const rows = accepted.map((c) => ({
    wikipedia_slug: c.wikipediaSlug,
    wikipedia_lang: c.wikipediaLang,
    title: c.title,
    artist: c.artist,
    artist_romaji: c.artistRomaji || null,
    year: c.year || null,
    medium: c.medium || null,
    size: c.size || null,
    series: c.series || null,
    location: c.location || null,
    hint: c.hint,
    source: 'ai',
    order_index: c.order_index,
  }));

  const { error: insErr } = await supabase.from('seed_works').insert(rows);
  if (insErr) {
    return jsonResponse(500, {
      error: '写入 seed_works 失败',
      detail: insErr.message,
    });
  }

  console.log(
    `[extend-seed] DONE bootstrapped=${bootstrapped} added=${accepted.length} rejected=${rejected.length}`,
  );
  return jsonResponse(200, {
    ok: true,
    bootstrapped,
    added: accepted.length,
    titles: accepted.map((c) => c.title),
    rejected,
  });
};

