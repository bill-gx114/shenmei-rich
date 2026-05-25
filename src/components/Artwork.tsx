import { useState } from 'react';
import { RedFujiSVG } from '../assets/RedFujiSVG';
import type { Work } from '../lib/types';

type Props = {
  work: Work;
  showHotspots: boolean;
  focusedSpot: number | null;
  onSpotClick: (i: number) => void;
};

export function Artwork({ work, showHotspots, focusedSpot, onSpotClick }: Props) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="frame">
      <div className="canvas">
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
                style={{ left: `${h.x}%`, top: `${h.y}%` }}
                onClick={() => onSpotClick(i)}
                aria-label={h.label}
              >
                <span className="tip">{h.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="plate">{work.series} · {work.no} of 46</div>
    </div>
  );
}
