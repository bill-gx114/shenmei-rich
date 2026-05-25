export type TTSStatus = 'idle' | 'speaking' | 'paused' | 'done';

export type TTSOptions = {
  /** Rate multiplier (1.0 = normal browser default). */
  rate?: number;
  /** Language tag passed to SpeechSynthesisUtterance, e.g. "zh-CN". */
  lang?: string;
  /** Called when a line starts (before it begins speaking). */
  onLineStart?: (index: number) => void;
  /** Called when a line ends — index is the line that just finished. */
  onLineEnd?: (index: number) => void;
  /** Called when the entire script finishes (after last onLineEnd). */
  onComplete?: () => void;
};

/**
 * Sequential speech-synthesis driver — speaks a list of lines one at a time,
 * exposing the active index so a transcript can highlight in sync. Wraps the
 * brittle SpeechSynthesis API: keeps a single Utterance "in flight," handles
 * tab-throttle bugs by re-querying the voice list, and stays cancel-safe.
 */
export class TTSPlayer {
  private lines: string[] = [];
  private idx = -1;
  private status: TTSStatus = 'idle';
  private rate = 1;
  private lang = 'zh-CN';
  private opts: TTSOptions = {};
  private current: SpeechSynthesisUtterance | null = null;
  /** Guards against firing onend for an utterance we already cancelled. */
  private generation = 0;

  setLines(lines: string[]) {
    this.lines = lines;
  }

  setRate(rate: number) {
    this.rate = rate;
    if (this.current) this.current.rate = rate;
  }

  setOptions(opts: TTSOptions) {
    this.opts = opts;
    if (opts.rate != null) this.rate = opts.rate;
    if (opts.lang) this.lang = opts.lang;
  }

  getStatus(): TTSStatus {
    return this.status;
  }

  getIndex(): number {
    return this.idx;
  }

  /** Start (or restart) from the given line index. */
  play(from: number = Math.max(0, this.idx)) {
    if (!('speechSynthesis' in window)) return;
    if (!this.lines.length) return;
    this.cancel();
    this.idx = Math.min(from, this.lines.length - 1);
    this.status = 'speaking';
    this.speakCurrent();
  }

  pause() {
    if (!('speechSynthesis' in window)) return;
    if (this.status !== 'speaking') return;
    window.speechSynthesis.pause();
    this.status = 'paused';
  }

  resume() {
    if (!('speechSynthesis' in window)) return;
    if (this.status === 'paused') {
      window.speechSynthesis.resume();
      this.status = 'speaking';
    } else if (this.status === 'idle' || this.status === 'done') {
      this.play(this.idx < 0 ? 0 : this.idx);
    }
  }

  /** Stop and clear current utterance — leaves index where it was. */
  cancel() {
    this.generation++;
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.current = null;
    if (this.status === 'speaking' || this.status === 'paused') {
      this.status = 'idle';
    }
  }

  /** Move to a specific line. If currently playing, restart speech there. */
  seek(idx: number) {
    const wasPlaying = this.status === 'speaking';
    this.cancel();
    this.idx = Math.max(0, Math.min(this.lines.length - 1, idx));
    if (wasPlaying) this.play(this.idx);
  }

  private pickVoice(): SpeechSynthesisVoice | null {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;
    const exact = voices.find((v) => v.lang === this.lang);
    if (exact) return exact;
    const prefix = this.lang.split('-')[0];
    return voices.find((v) => v.lang?.startsWith(prefix)) ?? null;
  }

  private speakCurrent() {
    if (this.idx < 0 || this.idx >= this.lines.length) {
      this.status = 'done';
      this.opts.onComplete?.();
      return;
    }
    const text = this.lines[this.idx];
    const u = new SpeechSynthesisUtterance(text);
    u.lang = this.lang;
    u.rate = this.rate;
    const voice = this.pickVoice();
    if (voice) u.voice = voice;
    const gen = ++this.generation;
    u.onend = () => {
      if (gen !== this.generation) return;
      const finished = this.idx;
      this.opts.onLineEnd?.(finished);
      if (this.idx >= this.lines.length - 1) {
        this.status = 'done';
        this.current = null;
        this.opts.onComplete?.();
        return;
      }
      this.idx++;
      this.speakCurrent();
    };
    u.onerror = () => {
      if (gen !== this.generation) return;
      this.status = 'idle';
      this.current = null;
    };
    this.current = u;
    this.opts.onLineStart?.(this.idx);
    window.speechSynthesis.speak(u);
  }
}

/**
 * Voices load asynchronously in Chrome — register a callback that fires once
 * the voice list is populated (or immediately if it already is). Returns an
 * unsubscribe function.
 */
export function onVoicesReady(cb: () => void): () => void {
  if (!('speechSynthesis' in window)) return () => undefined;
  if (window.speechSynthesis.getVoices().length) {
    cb();
    return () => undefined;
  }
  const handler = () => {
    if (window.speechSynthesis.getVoices().length) cb();
  };
  window.speechSynthesis.addEventListener('voiceschanged', handler);
  return () => window.speechSynthesis.removeEventListener('voiceschanged', handler);
}

/** Map the user-facing narrator voice label to a speech rate multiplier. */
export function narratorVoiceToRate(voice: string): number {
  switch (voice) {
    case '专业·锐利':
      return 1.1;
    case '诗意·散文':
      return 0.85;
    case '清·克制':
    default:
      return 0.95;
  }
}

export function isTTSSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}
