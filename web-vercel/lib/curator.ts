// Shared DeepSeek "curator pack" generator — reused by both the user-driven
// /api/curator-draft endpoint and the daily-curator scheduled function.

export type CuratorPackInput = {
  title: string;
  artist: string;
  hint?: string;
};

export type Hotspot = { x: number; y: number; label: string; detail: string };
export type AudioLine = { t: number; text: string };
export type Question = { q: string; hint: string; options: string[] };
export type Vocab = { word: string; note: string; isNew: boolean };

export const VOICE_KEYS = ['清·克制', '专业·锐利', '诗意·散文'] as const;
export type VoiceKey = (typeof VOICE_KEYS)[number];

export type CuratorPack = {
  shortLabel: string;
  /** Personal-voice note shown next to the notebook. Per-work, not generic. */
  curatorNote: string;
  hotspots: Hotspot[];
  /** Three parallel script variants, keyed by narrator voice. */
  audioLines: Record<VoiceKey, AudioLine[]>;
  questions: Question[];
  vocabulary: Vocab[];
};

const SYSTEM_PROMPT = `你是"审美日课"的策展人助手。

风格基线（所有内容共通）：
- 中文衬线感、克制、不滥用形容词。
- 不卖弄学术，但术语用得准。
- 永远在帮用户"长出眼睛"——指出可被复用的处理方法，而不是讲述对象本身。
- 永远把"为什么这件作品成立"讲清楚，不要"我感觉它很好看"。

你将收到一件作品的标题、作者，以及一句话的感觉。你要返回一份策展包，**严格 JSON**，结构如下：

{
  "shortLabel": "一句话墙签（25-40 字），讲清这幅作品在做什么、靠什么成立",

  "curatorNote": "策展人留言（60-100 字），第一人称、口语、像跟朋友说话。**必须针对当前这一幅作品**——抓住它的一个具体处理（构图/色彩/光/质感/视线/某个细节），给出'今晚做一件事'式的可复用动作。允许用引号、破折号。避免空泛的形容词。",

  "hotspots": [
    { "x": 0-100 数字, "y": 0-100 数字, "label": "看点名（4-7 字）", "detail": "看点说明（25-50 字）" }
  ],   // 3 个

  "audioLines": {
    "清·克制": [{ "t": 秒数, "text": "..." }, ...],
    "专业·锐利": [{ "t": 秒数, "text": "..." }, ...],
    "诗意·散文": [{ "t": 秒数, "text": "..." }, ...]
  },
  // 每一档 8-12 行，覆盖 0 到约 150 秒。第一句让眼睛先看一会，最后一句邀请写下观察。
  // 三档要在用词与节奏上有明显区别，但都讲同一组观察点：
  //   清·克制：短句，留呼吸，每句 20-40 字，避免"我觉得 / 我们看到"这类口头话，像一位克制的展厅讲解员。
  //   专业·锐利：术语用得准（构图、色温、肌理、负空间），节奏更快，每句 25-45 字，直接给判断不绕弯。
  //   诗意·散文：句式更长，文白夹杂，允许偶有意象比喻，每句 35-60 字，但仍指向具体可复用的观察。

  "questions": [
    { "q": "问题（不超过 14 字）", "hint": "提示（25-35 字）", "options": ["选项一（4-8 字）", "选项二", "选项三", "选项四"] }
  ],   // 3 题，依次：1) 第一眼，你被什么吸引？2) 它靠什么成立？3) 今天偷学一个动作？

  "vocabulary": [
    { "word": "词", "note": "释义（20-35 字）", "isNew": 布尔值 }
  ]    // 3-5 个该作品贡献的词
}

只输出 JSON，不要任何解释或 markdown 代码块标记。三档脚本的 audioLines 顺序无所谓，但三个 key 必须都出现。`;

function buildUserPrompt(input: CuratorPackInput) {
  const lines = [
    `作品名：${input.title || '（未填）'}`,
    `作者：${input.artist || '（未填）'}`,
    input.hint ? `一句话感觉：${input.hint}` : '没有额外感觉，请基于作品本身判断',
    '请输出符合上述结构的 JSON。',
  ];
  return lines.join('\n');
}

export async function generateCuratorPack(input: CuratorPackInput): Promise<CuratorPack> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY 未配置');
  }

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
        { role: 'user', content: buildUserPrompt(input) },
      ],
      temperature: 0.7,
      // The full pack (3 voice scripts × ~10 lines + hotspots + questions +
      // vocabulary + notes) easily blows past the default 4096 output cap.
      // When that happens json_object mode still returns *valid* JSON but
      // silently closes the object early, dropping audioLines/questions/
      // vocabulary — exactly the "hotspots present, rest empty" bug we hit.
      // 8192 is deepseek-chat's output ceiling and fits the whole pack.
      max_tokens: 8192,
      response_format: { type: 'json_object' },
    }),
  });

  if (!r.ok) {
    const text = await r.text();
    throw new Error(`DeepSeek 调用失败 (${r.status}): ${text.slice(0, 300)}`);
  }

  const data = (await r.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('DeepSeek 返回为空');

  let parsed: CuratorPack;
  try {
    parsed = JSON.parse(content) as CuratorPack;
  } catch {
    throw new Error(`DeepSeek 返回的不是合法 JSON: ${content.slice(0, 300)}`);
  }

  // Be lenient if DeepSeek drops a voice variant: fall back to '清·克制'.
  if (!parsed.audioLines || Array.isArray(parsed.audioLines)) {
    // Older response shape — coerce.
    const lines = (parsed.audioLines as unknown as AudioLine[]) ?? [];
    parsed.audioLines = {
      '清·克制': lines,
      '专业·锐利': lines,
      '诗意·散文': lines,
    };
  } else {
    const fallback = parsed.audioLines['清·克制'] ?? [];
    for (const voice of VOICE_KEYS) {
      if (!Array.isArray(parsed.audioLines[voice]) || !parsed.audioLines[voice].length) {
        parsed.audioLines[voice] = fallback;
      }
    }
  }

  return parsed;
}
