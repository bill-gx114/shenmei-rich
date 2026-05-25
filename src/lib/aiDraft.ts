// Client-side helper for the curator-draft Netlify Function.
// The function lives at /api/curator-draft (configured in
// netlify/functions/curator-draft.ts via `export const config`).

export type CuratorDraft = {
  shortLabel: string;
  hotspots: Array<{ x: number; y: number; label: string; detail: string }>;
  audioLines: Array<{ t: number; text: string }>;
  questions: Array<{ q: string; hint: string; options: string[] }>;
  vocabulary: Array<{ word: string; note: string; isNew: boolean }>;
};

export type DraftInput = {
  title: string;
  artist: string;
  hint?: string;
  narratorVoice?: string;
};

export async function draftCuratorPack(input: DraftInput): Promise<CuratorDraft> {
  const r = await fetch('/api/curator-draft', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!r.ok) {
    let detail = '';
    try {
      const body = (await r.json()) as { error?: string; detail?: string };
      detail = body.error ? `${body.error}${body.detail ? ` · ${body.detail}` : ''}` : '';
    } catch {
      detail = await r.text();
    }
    if (r.status === 404) {
      throw new Error(
        'AI 接口未启动。本地需要用 `netlify dev` 启动；线上需要在 Netlify 配置 DEEPSEEK_API_KEY 后重新部署。',
      );
    }
    throw new Error(detail || `请求失败 (${r.status})`);
  }

  return (await r.json()) as CuratorDraft;
}
