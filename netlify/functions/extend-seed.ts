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

import type { Config } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

// ── DeepSeek prompt ──────────────────────────────────────────────────────
const SYSTEM_PROMPT = `你是"审美日课"的策展人，正在为每日展览扩充选品池。

任务：根据用户给的"已经收录的作品清单"，推荐 10 幅新作品。要求：

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

返回 JSON：{ "candidates": [10 个对象] }。只输出 JSON，不要其他文字。`;

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
          content: `已经收录的作品（按 "作品名 — 作者" 格式）：\n${existingList}\n\n请推荐 10 幅不在上面的名作。`,
        },
      ],
      temperature: 0.8,
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

async function wikiHasImage(slug: string, lang: string): Promise<boolean> {
  try {
    const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}`;
    const r = await fetch(url, {
      headers: { 'User-Agent': '审美日课/1.0 (https://github.com/)' },
    });
    if (!r.ok) return false;
    const data = (await r.json()) as {
      originalimage?: { source: string };
      thumbnail?: { source: string };
    };
    return Boolean(data.originalimage?.source || data.thumbnail?.source);
  } catch {
    return false;
  }
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
  const accepted: Array<Candidate & { order_index: number }> = [];
  const rejected: Array<{ title: string; reason: string }> = [];
  let nextIdx = nextOrderIndex;

  for (const c of candidates) {
    if (!c.title || !c.artist || !c.wikipediaSlug || !c.wikipediaLang || !c.hint) {
      rejected.push({ title: c.title ?? '(unknown)', reason: 'missing required field' });
      continue;
    }
    if (!['en', 'zh', 'ja'].includes(c.wikipediaLang)) {
      rejected.push({ title: c.title, reason: `unsupported lang: ${c.wikipediaLang}` });
      continue;
    }
    const key = `${c.title}|${c.artist}`;
    if (existingKeys.has(key)) {
      rejected.push({ title: c.title, reason: 'already in seed list' });
      continue;
    }
    const hasImage = await wikiHasImage(c.wikipediaSlug, c.wikipediaLang);
    if (!hasImage) {
      // Try without underscores (DeepSeek sometimes returns "Mona Lisa" instead of "Mona_Lisa")
      const altSlug = c.wikipediaSlug.replace(/ /g, '_');
      const altHasImage = altSlug !== c.wikipediaSlug && (await wikiHasImage(altSlug, c.wikipediaLang));
      if (!altHasImage) {
        rejected.push({ title: c.title, reason: 'Wikipedia 找不到图' });
        continue;
      }
      c.wikipediaSlug = altSlug;
    }
    existingKeys.add(key); // guard against duplicates within this batch too
    accepted.push({ ...c, order_index: nextIdx++ });
  }

  if (accepted.length === 0) {
    return jsonResponse(200, {
      ok: true,
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

  return jsonResponse(200, {
    ok: true,
    added: accepted.length,
    titles: accepted.map((c) => c.title),
    rejected,
  });
};

// 1st of every month at 02:00 UTC (= 10:00 Beijing). Two hours after the
// daily-curator slot so the two never compete for the same DB session.
export const config: Config = {
  schedule: '0 2 1 * *',
};
