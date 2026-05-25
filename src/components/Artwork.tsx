import { useRef, useState } from 'react';
import { RedFujiSVG } from '../assets/RedFujiSVG';
import type { Hotspot, Work } from '../lib/types';

type Props = {
  work: Work;
  showHotspots: boolean;
  focusedSpot: number | null;
  onSpotClick: (i: number) => void;
  editMode?: boolean;
  /** Required iff editMode === true. */
  onHotspotsChange?: (next: Hotspot[]) => void;
};

export function Artwork({
  work,
  showHotspots,
  focusedSpot,
  onSpotClick,
  editMode = false,
  onHotspotsChange,
}: Props) {
  const [failed, setFailed] = useState(false);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef<number | null>(null);

  const startDrag = (i: number, e: React.PointerEvent) => {
    if (!editMode || !onHotspotsChange) return;
    e.stopPropagation();
    e.preventDefault();
    draggingRef.current = i;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const move = (ev: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, ((ev.clientX - r.left) / r.width) * 100));
      const y = Math.max(0, Math.min(100, ((ev.clientY - r.top) / r.height) * 100));
      onHotspotsChange(
        work.hotspots.map((h, idx) => (idx === i ? { ...h, x, y } : h)),
      );
    };
    const up = () => {
      draggingRef.current = null;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (!editMode || !onHotspotsChange) return;
    const target = e.target as HTMLElement;
    // Ignore clicks on hotspots themselves.
    if (target.closest('.hotspot')) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    onHotspotsChange([
      ...work.hotspots,
      { x, y, label: '新看点', detail: '点我编辑文字' },
    ]);
    // Auto-focus the new one so the user can immediately edit it.
    onSpotClick(work.hotspots.length);
  };

  return (
    <div className="frame">
      <div
        ref={canvasRef}
        className="canvas"
        onClick={handleCanvasClick}
        style={editMode ? { cursor: 'crosshair' } : undefined}
      >
        {failed || !work.image ? (
          <RedFujiSVG />
        ) : (
          <img src={work.image} alt={work.title} onError={() => setFailed(true)} />
        )}
        {showHotspots && (
          <div className="hotspots">
            {work.hotspots.map((h, i) => (
              <button
                key={i}
                className={`hotspot ${focusedSpot === i ? 'on' : ''}`}
                style={{
                  left: `${h.x}%`,
                  top: `${h.y}%`,
                  cursor: editMode ? 'grab' : 'pointer',
                  // While being dragged, suppress the hover-tip animation that
                  // otherwise reads strangely under a moving cursor.
                  touchAction: editMode ? 'none' : undefined,
                }}
                onPointerDown={(e) => startDrag(i, e)}
                onClick={(e) => {
                  e.stopPropagation();
                  onSpotClick(i);
                }}
                aria-label={h.label}
              >
                <span className="tip">{h.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="plate">
        {work.series} · {work.no} of 46
      </div>
    </div>
  );
}
