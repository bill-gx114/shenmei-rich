import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AudioGuideData } from '../lib/types';
import { TTSPlayer, isTTSSupported, narratorVoiceToRate, onVoicesReady } from '../lib/tts';

type Props = {
  guide: AudioGuideData;
  narratorVoice: string;
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

export function AudioGuide({ guide, narratorVoice, onLineChange }: Props) {
  const { lines, duration } = guide;
  const supported = isTTSSupported();

  const [playing, setPlaying] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [speed, setSpeed] = useState(1);
  const scriptRef = useRef<HTMLDivElement | null>(null);
  const lineRefs = useRef<(HTMLParagraphElement | null)[]>([]);

  const player = useMemo(() => new TTSPlayer(), []);

  useEffect(() => {
    player.setLines(lines.map((l) => l.text));
  }, [player, lines]);

  useEffect(() => {
    const baseRate = narratorVoiceToRate(narratorVoice);
    player.setRate(baseRate * speed);
  }, [player, narratorVoice, speed]);

  useEffect(() => {
    player.setOptions({
      lang: 'zh-CN',
      rate: narratorVoiceToRate(narratorVoice) * speed,
      onLineStart: (i) => setActiveIdx(i),
      onComplete: () => {
        setPlaying(false);
        setActiveIdx(lines.length - 1);
      },
    });
    return () => player.cancel();
  }, [player, narratorVoice, speed, lines.length]);

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
    const target = el.offsetTop - c.clientHeight / 2 + el.clientHeight / 2;
    c.scrollTo({ top: target, behavior: 'smooth' });
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
          {[0.8, 1, 1.25].map((s) => (
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
