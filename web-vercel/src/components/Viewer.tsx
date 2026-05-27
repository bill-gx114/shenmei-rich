import { useEffect, useState } from 'react';
import { RedFujiSVG } from '../assets/RedFujiSVG';
import type { Work } from '../lib/types';

type Props = {
  work: Work;
  onClose: () => void;
};

export function Viewer({ work, onClose }: Props) {
  const [zoom, setZoom] = useState(1);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(3, z + 0.25));
      if (e.key === '-') setZoom((z) => Math.max(0.5, z - 0.25));
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  return (
    <div
      className="viewer"
      onClick={(e) => {
        if ((e.target as HTMLElement).classList.contains('viewer')) onClose();
      }}
    >
      <div className="v-canvas">
        <button className="v-close" onClick={onClose} aria-label="关闭">
          ×
        </button>
        {failed || !work.image ? (
          <div style={{ width: '70%', maxHeight: '85%', transform: `scale(${zoom})`, transition: 'transform 0.3s' }}>
            <RedFujiSVG />
          </div>
        ) : (
          <img
            src={work.image}
            alt={work.title}
            style={{ transform: `scale(${zoom})` }}
            onError={() => setFailed(true)}
          />
        )}
        <div className="v-zoomctrl">
          <button onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}>−</button>
          <button
            onClick={() => setZoom(1)}
            style={{
              width: 'auto',
              padding: '0 14px',
              fontSize: 12,
              fontFamily: 'var(--mono)',
              color: 'var(--ink-3)',
            }}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button onClick={() => setZoom((z) => Math.min(3, z + 0.25))}>+</button>
        </div>
      </div>
      <aside className="v-side">
        <div
          className="kicker"
          style={{
            fontSize: 10.5,
            letterSpacing: '0.32em',
            textTransform: 'uppercase',
            color: 'var(--ink-4)',
            marginBottom: 16,
          }}
        >
          Catalogue · {work.no}
        </div>
        <h2
          style={{
            fontFamily: 'var(--serif)',
            fontWeight: 400,
            fontSize: 32,
            margin: '0 0 8px',
            letterSpacing: '0.04em',
          }}
        >
          {work.title}
        </h2>
        <div
          style={{
            fontFamily: 'var(--display)',
            fontStyle: 'italic',
            fontSize: 19,
            color: 'var(--ink-2)',
            marginBottom: 28,
          }}
        >
          {work.artist} · <em>{work.artistRomaji}</em>
        </div>
        <p
          style={{
            fontFamily: 'var(--serif)',
            fontSize: 15,
            lineHeight: 1.95,
            color: 'var(--ink-2)',
            letterSpacing: '0.02em',
            marginBottom: 28,
          }}
        >
          {work.shortLabel}
        </p>
        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 20, marginBottom: 24 }}>
          <div
            style={{
              color: 'var(--ink-4)',
              fontSize: 11,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              marginBottom: 18,
            }}
          >
            策展人指出 · curator notes
          </div>
          {work.hotspots.map((h, i) => (
            <div key={i} style={{ marginBottom: 18, display: 'flex', gap: 14 }}>
              <div
                style={{
                  flexShrink: 0,
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'var(--gold-tint)',
                  border: '1px solid var(--gold)',
                  color: 'var(--gold)',
                  display: 'grid',
                  placeItems: 'center',
                  fontFamily: 'var(--display)',
                  fontStyle: 'italic',
                  fontSize: 14,
                }}
              >
                {i + 1}
              </div>
              <div>
                <div style={{ fontFamily: 'var(--serif)', color: 'var(--ink)', fontSize: 15, marginBottom: 4 }}>
                  {h.label}
                </div>
                <div style={{ fontFamily: 'var(--serif)', color: 'var(--ink-3)', fontSize: 13, lineHeight: 1.7 }}>
                  {h.detail}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div
          style={{
            fontFamily: 'var(--display)',
            fontStyle: 'italic',
            color: 'var(--ink-4)',
            fontSize: 13,
            letterSpacing: '0.06em',
          }}
        >
          按 + / − 缩放 · 按 Esc 关闭
        </div>
      </aside>
    </div>
  );
}
