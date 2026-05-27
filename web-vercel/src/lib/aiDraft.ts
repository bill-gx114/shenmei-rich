// Client-side helper for the curator-draft Netlify Function.
// The function lives at /api/curator-draft (configured in
// netlify/functions/curator-draft.ts via `export const config`).

type AudioLine = { t: number; text: string };

/**
 * Server returns audioLines keyed by voice. The single-script admin form
 * doesn't expose voice variants, so we surface a flat `audioLines` array
 * (defaults to 清·克制) for the form to consume, while keeping
 * `audioLinesByVoice` available for callers that want the full pack.
 */
export type CuratorDraft = {
  shortLabel: string;
  curatorNote: string;
  hotspots: Array<{ x: number; y: number; label: string; detail: string }>;
  audioLines: AudioLine[];
  audioLinesByVoice: Record<string, AudioLine[]>;
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

  const raw = (await r.json()) as {
    shortLabel: string;
    curatorNote?: string;
    hotspots: CuratorDraft['hotspots'];
    audioLines: Record<string, AudioLine[]> | AudioLine[];
    questions: CuratorDraft['questions'];
    vocabulary: CuratorDraft['vocabulary'];
  };
  const byVoice: Record<string, AudioLine[]> = Array.isArray(raw.audioLines)
    ? { '清·克制': raw.audioLines }
    : raw.audioLines;
  const flat = byVoice['清·克制'] ?? Object.values(byVoice)[0] ?? [];
  return {
    shortLabel: raw.shortLabel,
    curatorNote: raw.curatorNote ?? '',
    hotspots: raw.hotspots,
    audioLines: flat,
    audioLinesByVoice: byVoice,
    questions: raw.questions,
    vocabulary: raw.vocabulary,
  };
}
