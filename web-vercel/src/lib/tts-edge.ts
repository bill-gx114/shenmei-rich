/**
 * Backend-driven TTS player using Microsoft Edge neural voices.
 *
 * For each line of the script we POST /api/tts and get back a Supabase
 * Storage URL pointing to a cached mp3. We play it via a single HTMLAudio
 * element, listening to 'ended' to advance. Playback rate is applied
 * client-side via `audio.playbackRate` (Edge TTS API doesn't need to know).
 *
 * To hide synthesis latency on first play we prefetch the next line's URL
 * while the current one is playing — the second hit is essentially free
 * after caching.
 */

import type { TTSOptions, TTSStatus } from './tts';

const VOICE_MAP: Record<string, string> = {
  '清·克制': 'zh-CN-XiaoxiaoNeural',
  '专业·锐利': 'zh-CN-YunxiNeural',
  '诗意·散文': 'zh-CN-XiaoyiNeural',
};

export function narratorVoiceToEdgeVoice(narrator: string): string {
  return VOICE_MAP[narrator] ?? 'zh-CN-XiaoxiaoNeural';
}

export class EdgeTTSPlayer {
  private lines: string[] = [];
  private idx = -1;
  private status: TTSStatus = 'idle';
  private rate = 1;
  private voice = 'zh-CN-XiaoxiaoNeural';
  private opts: TTSOptions = {};
  private audio: HTMLAudioElement | null = null;
  private prefetched = new Map<string, string>(); // key = `${voice}|${text}` → url
  /** Increments on every cancel/play to ignore stale fetch results. */
  private generation = 0;

  setLines(lines: string[]) {
    this.lines = lines;
  }

  setRate(rate: number) {
    this.rate = rate;
    if (this.audio) this.audio.playbackRate = rate;
  }

  setOptions(opts: TTSOptions & { edgeVoice?: string }) {
    this.opts = opts;
    if (opts.rate != null) this.rate = opts.rate;
    if (opts.edgeVoice) this.voice = opts.edgeVoice;
  }

  setVoice(v: string) {
    this.voice = v;
  }

  getStatus(): TTSStatus {
    return this.status;
  }

  getIndex(): number {
    return this.idx;
  }

  play(from: number = Math.max(0, this.idx)) {
    if (!this.lines.length) return;
    this.cancel();
    this.idx = Math.min(from, this.lines.length - 1);
    this.status = 'speaking';
    this.speakCurrent();
  }

  pause() {
    if (this.status !== 'speaking' || !this.audio) return;
    this.audio.pause();
    this.status = 'paused';
  }

  resume() {
    if (this.status === 'paused' && this.audio) {
      this.audio.play().catch(() => undefined);
      this.status = 'speaking';
    } else if (this.status === 'idle' || this.status === 'done') {
      this.play(this.idx < 0 ? 0 : this.idx);
    }
  }

  cancel() {
    this.generation++;
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
      this.audio.load();
      this.audio = null;
    }
    if (this.status === 'speaking' || this.status === 'paused') {
      this.status = 'idle';
    }
  }

  seek(idx: number) {
    const wasPlaying = this.status === 'speaking';
    this.cancel();
    this.idx = Math.max(0, Math.min(this.lines.length - 1, idx));
    if (wasPlaying) this.play(this.idx);
  }

  /** Fetch the audio URL for a line; uses in-memory map to dedupe. */
  private async fetchUrl(text: string): Promise<string> {
    const key = `${this.voice}|${text}`;
    const cached = this.prefetched.get(key);
    if (cached) return cached;
    const r = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice: this.voice }),
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      throw new Error(`/api/tts ${r.status}: ${detail.slice(0, 200)}`);
    }
    const data = (await r.json()) as { url?: string; error?: string };
    if (!data.url) throw new Error(data.error ?? 'TTS endpoint returned no URL');
    this.prefetched.set(key, data.url);
    return data.url;
  }

  private prefetchNext() {
    const next = this.idx + 1;
    if (next >= this.lines.length) return;
    const text = this.lines[next];
    const key = `${this.voice}|${text}`;
    if (this.prefetched.has(key)) return;
    // Fire-and-forget; errors will surface when we actually try to play.
    this.fetchUrl(text).catch(() => undefined);
  }

  private async speakCurrent() {
    if (this.idx < 0 || this.idx >= this.lines.length) {
      this.status = 'done';
      this.opts.onComplete?.();
      return;
    }
    const gen = this.generation;
    const text = this.lines[this.idx];
    this.opts.onLineStart?.(this.idx);

    let url: string;
    try {
      url = await this.fetchUrl(text);
    } catch (e) {
      if (gen !== this.generation) return;
      this.status = 'idle';
      console.error('[edge-tts]', e);
      return;
    }
    if (gen !== this.generation) return; // user cancelled while fetching

    const audio = new Audio(url);
    audio.playbackRate = this.rate;
    audio.preload = 'auto';
    audio.onended = () => {
      if (gen !== this.generation) return;
      const finished = this.idx;
      this.opts.onLineEnd?.(finished);
      if (this.idx >= this.lines.length - 1) {
        this.status = 'done';
        this.audio = null;
        this.opts.onComplete?.();
        return;
      }
      this.idx++;
      this.speakCurrent();
    };
    audio.onerror = () => {
      if (gen !== this.generation) return;
      this.status = 'idle';
      this.audio = null;
    };
    this.audio = audio;
    audio.play().catch(() => undefined);

    // Hide latency for the line after this one.
    this.prefetchNext();
  }
}
