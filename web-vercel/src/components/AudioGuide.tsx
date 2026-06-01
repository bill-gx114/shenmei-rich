import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AudioGuideData } from '../lib/types';
import { TTSPlayer, isTTSSupported, narratorVoiceToRate, onVoicesReady } from '../lib/tts';
import { EdgeTTSPlayer, narratorVoiceToEdgeVoice } from '../lib/tts-edge';
import { track } from '../lib/track';

type Props = {
  guide: AudioGuideData;
  narratorVoice: string;
  /** 'edge' = neural via /api/tts, 'system' = browser SpeechSynthesis. */
  ttsEngine?: 'edge' | 'system';
  /** Specific system TTS voice (SpeechSynthesisVoice.name). '' = auto-pick. */
  voiceName?: string;
  onLineChange?: (idx: number) => void;
};

function fmtTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M3 1.5 L14 8 L3 14.5 Z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <rect x="3" y="2" width="3.5" height="12" />
      <rect x="9.5" y="2" width="3.5" height="12" />
    </svg>
  );
}

export function AudioGuide({
  guide,
  narratorVoice,
  ttsEngine = 'edge',
  voiceName = '',
  onLineChange,
}: Props) {
  // Pick the script that matches the current narrator voice; if a work was
  // created before multi-voice support (no variant for the chosen voice),
  // fall back to '清·克制', then to whatever exists.
  const variants = guide.variants ?? {};
  const lines =
    variants[narratorVoice] ??
    variants['清·克制'] ??
    Object.values(variants)[0] ??
    [];
  const { duration } = guide;
  // Edge TTS works in any modern browser (HTMLAudioElement); system TTS
  // depends on speechSynthesis.
  const supported = ttsEngine === 'edge' ? true : isTTSSupported();

  const [playing, setPlaying] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [speed, setSpeed] = useState(1);
  const scriptRef = useRef<HTMLDivElement | null>(null);
  const lineRefs = useRef<(HTMLParagraphElement | null)[]>([]);

  // Re-create the player whenever the engine changes so we never play through
  // a stale instance. Each player exposes the same minimal surface.
  const player = useMemo(() => {
    return ttsEngine === 'edge' ? new EdgeTTSPlayer() : new TTSPlayer();
  }, [ttsEngine]);

  useEffect(() => {
    player.setLines(lines.map((l) => l.text));
  }, [player, lines]);

  useEffect(() => {
    const baseRate = narratorVoiceToRate(narratorVoice);
    player.setRate(baseRate * speed);
  }, [player, narratorVoice, speed]);

  useEffect(() => {
    const opts = {
      lang: 'zh-CN' as const,
      voiceName,
      edgeVoice: narratorVoiceToEdgeVoice(narratorVoice),
      rate: narratorVoiceToRate(narratorVoice) * speed,
      onLineStart: (i: number) => setActiveIdx(i),
      onComplete: () => {
        setPlaying(false);
        setActiveIdx(lines.length - 1);
      },
    };
    // Both players accept this options shape; Edge player ignores voiceName,
    // system player ignores edgeVoice.
    (player as TTSPlayer | EdgeTTSPlayer).setOptions(opts);
    return () => player.cancel();
  }, [player, narratorVoice, voiceName, speed, lines.length]);

  // When voiceName or engine changes mid-playback, stop so user can re-play.
  useEffect(() => {
    player.cancel();
    setPlaying(false);
    setActiveIdx(-1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceName, ttsEngine, player]);

  // When the narrator voice changes, the active script lines change too. Stop
  // any in-progress playback so the user can press play to hear the new voice
  // from the beginning — leaving the old utterance running would speak the
  // wrong words.
  useEffect(() => {
    player.cancel();
    setPlaying(false);
    setActiveIdx(-1);
    // narratorVoice intentionally drives this; we don't want to reset on
    // every speed change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [narratorVoice, player]);

  useEffect(() => {
    const off = onVoicesReady(() => {});
    return off;
  }, []);

  useEffect(() => () => player.cancel(), [player]);

  useEffect(() => {
    if (activeIdx < 0) return;
    const c = scriptRef.current;
    const el = lineRefs.current[activeIdx];
    if (!c || !el) return;
    // Use bounding rects so this works even when the container has no
    // explicit `position` (offsetParent would otherwise be the body and the
    // math drifts). The visual goal: the active line's vertical center sits
    // at the container's vertical center.
    const cRect = c.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const lineTopWithinViewport = elRect.top - cRect.top;
    const target =
      c.scrollTop + lineTopWithinViewport - c.clientHeight / 2 + elRect.height / 2;
    const max = c.scrollHeight - c.clientHeight;
    c.scrollTo({ top: Math.max(0, Math.min(max, target)), behavior: 'smooth' });
    onLineChange?.(activeIdx);
  }, [activeIdx, onLineChange]);

  const togglePlay = () => {
    if (!supported) return;
    if (playing) {
      player.cancel();
      setPlaying(false);
    } else {
      const start = activeIdx < 0 || activeIdx >= lines.length - 1 ? 0 : activeIdx;
      if (activeIdx < 0) setActiveIdx(0);
      player.play(start);
      setPlaying(true);
      track('audio_play', { voice: narratorVoice, engine: ttsEngine });
    }
  };

  const handleScrub = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      const p = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
      const target = Math.min(lines.length - 1, Math.floor(p * lines.length));
      setActiveIdx(target);
      if (playing) {
        player.seek(target);
      } else {
        player.cancel();
      }
    },
    [player, lines.length, playing],
  );

  const progressDisplay = activeIdx < 0 ? 0 : lines[activeIdx]?.t ?? 0;
  const progressFraction = activeIdx < 0 ? 0 : (activeIdx + 1) / lines.length;

  return (
    <div className="guide">
      <div className="guide-bar">
        <button
          className="guide-play"
          onClick={togglePlay}
          aria-label={playing ? '暂停' : '播放'}
          disabled={!supported}
          title={supported ? undefined : '当前浏览器不支持语音合成'}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <div className="guide-prog">
          <div className="guide-track" onClick={handleScrub}>
            <div className="fill" style={{ width: `${progressFraction * 100}%` }} />
            <div className="knob" style={{ left: `${progressFraction * 100}%` }} />
          </div>
          <div className="guide-time">
            {fmtTime(progressDisplay)} / {fmtTime(duration)}
          </div>
        </div>
        <div className="guide-speed">
          {[0.75, 1, 1.5].map((s) => (
            <button key={s} className={speed === s ? 'on' : ''} onClick={() => setSpeed(s)}>
              {s}×
            </button>
          ))}
        </div>
      </div>
      <div className="guide-script" ref={scriptRef}>
        <div className="guide-narrator">
          <span className="dot" />
          <span>策展人 · {narratorVoice || '清·克制'}</span>
        </div>
        {lines.map((line, i) => (
          <p
            key={i}
            ref={(el) => {
              lineRefs.current[i] = el;
            }}
            className={`guide-line ${i === activeIdx ? 'now' : i < activeIdx ? 'past' : 'future'}`}
          >
            {line.text}
          </p>
        ))}
        <div className="guide-end">— 导览结束 —</div>
        {!supported && (
          <p style={{ marginTop: 16, color: 'var(--ink-4)', fontSize: 12, fontStyle: 'italic' }}>
            当前浏览器不支持 Web Speech API，无法朗读。
          </p>
        )}
      </div>
    </div>
  );
}
