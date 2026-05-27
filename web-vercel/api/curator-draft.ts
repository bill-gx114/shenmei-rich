// POST /api/curator-draft
// Body: { title, artist, hint?, narratorVoice? }
// Generates a structured "curator pack" via DeepSeek for the admin form.
// Shared logic lives in ../lib/curator.ts so the daily-curator cron uses
// the same prompt.

import { generateCuratorPack, type CuratorPackInput } from '../lib/curator.js';

export const config = { runtime: 'edge' };

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  let body: CuratorPackInput;
  try {
    body = (await req.json()) as CuratorPackInput;
  } catch {
    return jsonResponse(400, { error: '请求体不是合法 JSON' });
  }

  if (!body.title?.trim() && !body.artist?.trim() && !body.hint?.trim()) {
    return jsonResponse(400, { error: '至少填写"作品名 / 作者 / 一句话感觉"中的一个' });
  }

  try {
    const pack = await generateCuratorPack(body);
    return jsonResponse(200, pack);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('DEEPSEEK_API_KEY')) {
      return jsonResponse(500, {
        error: 'DEEPSEEK_API_KEY 未配置。请在 Vercel 项目的 Environment Variables 里加上这个变量。',
      });
    }
    return jsonResponse(502, { error: message });
  }
};

