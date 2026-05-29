// POST /api/insight   Header: Authorization: Bearer <user JWT>
// → { portrait: string | null, tendencies: [{title,desc}], entryCount, cached }
//
// Generates a personalized "aesthetic portrait" from the user's notebook
// answers + keyword constellation via DeepSeek. Cached in user_insights and
// only regenerated when the user has answered new works since last time
// (compares entry_count) — so repeat Journal views cost nothing.
//
// Node serverless runtime + legacy (req,res) signature (same proven setup as
// /api/tts). Uses service role + verifies the caller's JWT to get their id.

import type { IncomingMessage, ServerResponse } from 'node:http';
import { createClient } from '@supabase/supabase-js';

const MIN_ENTRIES = 3; // below this, not enough signal — skip generation.

type Tendency = { title: string; desc: string };

const SYSTEM_PROMPT = `你是"审美日课"的策展人，正在根据一位用户的观察记录，为 TA 写一份"审美肖像"。

你会收到：这位用户最近在画前答的题（包含 TA 选择的角度标签和写下的话）、以及 TA 反复使用的关键词及频次。

请基于这些**真实证据**（不要编造 TA 没表达过的东西），输出严格 JSON：

{
  "portrait": "一段 80-130 字的第二人称审美肖像。点出 TA 反复被什么吸引、正在形成怎样的判断偏好（偏结构/偏叙事/偏色彩/偏留白/偏东方/偏写实…），语气克制、具体、像一位懂 TA 的策展人。引用 1-2 个具体关键词或作品作为依据。不要空泛夸奖。",
  "tendencies": [
    { "title": "倾向名（4-10 字）", "desc": "30-50 字，解释这条倾向，并引用具体关键词/作品为证" }
  ]
}

tendencies 给 2-4 条，按证据强弱排序。只输出 JSON，不要任何额外文字。`;

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

type EntryRow = {
  answers: Array<{ chip?: string; text?: string }> | null;
  works: unknown;
};

async function generate(
  apiKey: string,
  entries: EntryRow[],
  constellation: Array<{ keyword: string; count: number }>,
): Promise<{ portrait: string; tendencies: Tendency[] }> {
  // Build a compact evidence digest for the model.
  const obs = entries
    .slice(0, 30)
    .map((e) => {
      const wRaw = (e as { works: unknown }).works;
      const w = (Array.isArray(wRaw) ? wRaw[0] : wRaw) as
        | { title?: string; artist?: string; region?: string }
        | null;
      const ans = (e.answers ?? [])
        .map((a) => [a.chip, a.text].filter(Boolean).join('：'))
        .filter(Boolean)
        .join(' / ');
      return `《${w?.title ?? '?'}》(${w?.region === 'east' ? '东方' : w?.region === 'west' ? '西方' : '—'})：${ans || '（未写）'}`;
    })
    .join('\n');
  const kw = constellation
    .slice(0, 20)
    .map((c) => `${c.keyword}×${c.count}`)
    .join('、');

  const userPrompt = `这位用户的观察记录（作品：TA 的答案）：\n${obs}\n\n反复使用的关键词（词×次数）：${kw || '（暂无）'}\n\n请输出审美肖像 JSON。`;

  const r = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`DeepSeek (${r.status}): ${t.slice(0, 200)}`);
  }
  const data = (await r.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('DeepSeek 返回为空');
  const parsed = JSON.parse(content) as { portrait?: string; tendencies?: Tendency[] };
  return {
    portrait: parsed.portrait ?? '',
    tendencies: Array.isArray(parsed.tendencies) ? parsed.tendencies.slice(0, 4) : [],
  };
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  const authHeader = req.headers['authorization'] || '';
  const token = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  const jwt = token.replace(/^Bearer\s+/i, '').trim();
  if (!jwt) return sendJson(res, 401, { error: '未登录' });

  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!supabaseUrl || !serviceKey) return sendJson(res, 500, { error: 'Supabase 凭据未配置' });
  if (!apiKey) return sendJson(res, 500, { error: 'DEEPSEEK_API_KEY 未配置' });

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Verify the caller and get their user id.
  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  const user = userData?.user;
  if (userErr || !user) return sendJson(res, 401, { error: '登录态无效' });

  // Read this user's notebook entries (with the work joined) + constellation.
  const [entriesRes, conRes, cacheRes] = await Promise.all([
    admin
      .from('notebook_entries')
      .select('answers, works(title, artist, region)')
      .eq('owner_id', user.id)
      .order('saved_at', { ascending: false }),
    admin.from('v_user_constellation').select('keyword, count').eq('owner_id', user.id),
    admin.from('user_insights').select('*').eq('owner_id', user.id).maybeSingle(),
  ]);

  const entries = (entriesRes.data ?? []) as EntryRow[];
  const entryCount = entries.length;

  if (entryCount < MIN_ENTRIES) {
    return sendJson(res, 200, {
      portrait: null,
      tendencies: [],
      entryCount,
      need: MIN_ENTRIES,
      cached: false,
    });
  }

  // Cache hit: same number of entries as last generation → reuse.
  const cache = cacheRes.data as
    | { portrait: string; tendencies: Tendency[]; entry_count: number }
    | null;
  if (cache && cache.entry_count === entryCount && cache.portrait) {
    return sendJson(res, 200, {
      portrait: cache.portrait,
      tendencies: cache.tendencies ?? [],
      entryCount,
      cached: true,
    });
  }

  // Generate fresh.
  let result: { portrait: string; tendencies: Tendency[] };
  try {
    result = await generate(
      apiKey,
      entries,
      (conRes.data ?? []) as Array<{ keyword: string; count: number }>,
    );
  } catch (e) {
    return sendJson(res, 502, {
      error: 'AI 洞察生成失败',
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  await admin.from('user_insights').upsert(
    {
      owner_id: user.id,
      portrait: result.portrait,
      tendencies: result.tendencies,
      entry_count: entryCount,
      generated_at: new Date().toISOString(),
    },
    { onConflict: 'owner_id' },
  );

  return sendJson(res, 200, {
    portrait: result.portrait,
    tendencies: result.tendencies,
    entryCount,
    cached: false,
  });
}

export const config = { maxDuration: 30 };
