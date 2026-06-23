// GET /api/learn-build?auto=1  → 把 lib/learnTopics.ts 里还没生成的专题用 AI 写成短文，
// 存进 learn_topics 表（客户端「研习」按 created_at 倒序展示，最新的带「新」徽标）。
// 幂等：已存在的 slug 跳过。时间盒 + auto 自循环，避免单次超过 Vercel 60s。
//
// 想让研习继续长：往 LEARN_BACKLOG 加条目，再访问本端点即可。

import type { IncomingMessage, ServerResponse } from 'node:http';
import { createClient } from '@supabase/supabase-js';
import { generateLearnArticle } from '../lib/curator.js';
import { LEARN_BACKLOG } from '../lib/learnTopics.js';

export const config = { maxDuration: 60 };
const BUDGET_MS = 45_000; // 每篇 ~5-10s；留足余量，超时即返回，靠 auto 续跑

function page(done: number, total: number, finished: boolean, log: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="${finished ? '999' : '2'}"></head>
<body style="font-family:system-ui;background:#0c0a08;color:#ece4d4;text-align:center;padding:40px">
<div style="font-size:13px;letter-spacing:.3em;color:#998c70">AESTHETIC DAILY · 研习生成</div>
<div style="font-size:42px;color:#ffd166">${done} / ${total}</div>
<p style="color:#d9c8a0">${finished ? '✅ 全部生成完毕。' : '生成中…本页每 2 秒自动续跑，保持打开即可。'}</p>
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
  const started = Date.now();

  const { data: rows, error } = await supabase.from('learn_topics').select('slug');
  if (error) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: '读取 learn_topics 失败', detail: error.message }));
    return;
  }
  const have = new Set(((rows ?? []) as Array<{ slug: string }>).map((r) => r.slug));
  const pending = LEARN_BACKLOG.filter((s) => !have.has(s.slug));
  const log: string[] = [];
  let made = 0;
  for (const s of pending) {
    if (Date.now() - started > BUDGET_MS) break;
    try {
      const art = await generateLearnArticle(s.title, s.angle);
      const ins = await supabase.from('learn_topics').insert({
        slug: s.slug,
        eyebrow: s.eyebrow,
        title: s.title,
        dek: art.dek,
        body: art.body,
      });
      if (ins.error) {
        log.push(`✗ ${s.title}: ${ins.error.message}`);
        continue;
      }
      made++;
      log.push(`✓ ${s.title}`);
    } catch (e) {
      log.push(`✗ ${s.title}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  const total = LEARN_BACKLOG.length;
  const doneTotal = have.size + made;
  const finished = doneTotal >= total || made === 0;
  if (auto) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(page(doneTotal, total, finished, log.join('\n')));
    return;
  }
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ ok: true, made, total, have: have.size, remaining: total - doneTotal, log }));
}
