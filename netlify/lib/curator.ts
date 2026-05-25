// Shared DeepSeek "curator pack" generator — reused by both the user-driven
// /api/curator-draft endpoint and the daily-curator scheduled function.

export type CuratorPackInput = {
  title: string;
  artist: string;
  hint?: string;
  narratorVoice?: string;
};

export type Hotspot = { x: number; y: number; label: string; detail: string };
export type AudioLine = { t: number; text: string };
export type Question = { q: string; hint: string; options: string[] };
export type Vocab = { word: string; note: string; isNew: boolean };

export type CuratorPack = {
  shortLabel: string;
  hotspots: Hotspot[];
  audioLines: AudioLine[];
  questions: Question[];
  vocabulary: Vocab[];
};

const SYSTEM_PROMPT = `你是"审美日课"的策展人助手。

风格基线：
- 中文衬线感、克制、不滥用形容词。每句话偏短，留呼吸。
- 不卖弄学术，但术语用得准。允许偶尔出现一个文白夹杂的小词。
- 永远在帮用户"长出眼睛"——指出可被复用的处理方法，而不是讲述对象本身。
- 永远把"为什么这件作品成立"讲清楚，不要讲"我感觉它很好看"。

你将收到一件作品的标题、作者，以及一句话的感觉。你要返回一份策展包，结构如下（严格 JSON）：

{
  "shortLabel": "一句话墙签（25-40 字），讲清这幅作品在做什么、靠什么成立",
  "hotspots": [
    { "x": 0-100 数字, "y": 0-100 数字, "label": "看点名（4-7 字）", "detail": "看点说明（25-50 字）" }
  ],   // 3 个，x/y 是热点在画面上的相对位置百分比
  "audioLines": [
    { "t": 秒数, "text": "导览的一句话（25-60 字）" }
  ],   // 8-12 行，覆盖 0 到约 150 秒，节奏自然。第一句让眼睛先看一会，最后一句邀请用户写下观察
  "questions": [
    { "q": "问题（不超过 14 字）", "hint": "提示（25-35 字）", "options": ["选项一（4-8 字）", "选项二", "选项三", "选项四"] }
  ],   // 3 题，依次：1) 第一眼，你被什么吸引？2) 它靠什么成立？3) 今天偷学一个动作？
  "vocabulary": [
    { "word": "词", "note": "释义（20-35 字）", "isNew": 布尔值 }
  ]    // 3-5 个该作品贡献的词
}

只输出 JSON，不要任何解释或 markdown 代码块标记。`;

function buildUserPrompt(input: CuratorPackInput) {
  const lines = [
    `作品名：${input.title || '（未填）'}`,
    `作者：${input.artist || '（未填）'}`,
    input.hint ? `一句话感觉：${input.hint}` : '没有额外感觉，请基于作品本身判断',
  ];
  if (input.narratorVoice) {
    lines.push(`策展人语气：${input.narratorVoice}`);
  }
  lines.push('请输出符合上述结构的 JSON。');
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

  try {
    return JSON.parse(content) as CuratorPack;
  } catch {
    throw new Error(`DeepSeek 返回的不是合法 JSON: ${content.slice(0, 300)}`);
  }
}
