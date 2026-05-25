import { useState } from 'react';
import { Artwork } from '../components/Artwork';
import { WallLabel } from '../components/WallLabel';
import { AudioGuide } from '../components/AudioGuide';
import { Notebook } from '../components/Notebook';
import type { Tweaks, Work } from '../lib/types';

type Props = {
  work: Work;
  tweaks: Tweaks;
  onOpenViewer: () => void;
  onGoArchive: () => void;
  onSaveNotebook?: (answers: { chip: string; text: string }[]) => Promise<void> | void;
};

export function TodayPage({ work, tweaks, onOpenViewer, onGoArchive, onSaveNotebook }: Props) {
  const [showHotspots, setShowHotspots] = useState(tweaks.showHotspotsByDefault);
  const [focusedSpot, setFocusedSpot] = useState<number | null>(null);

  return (
    <div className="gallery-wrap">
      <header className="gallery-head">
        <div>
          <div className="lead">Today · 今日观摩</div>
          <h1>
            《{work.title}》<span className="accent">·</span>
            <span style={{ fontFamily: 'var(--display)', fontStyle: 'italic', fontSize: 38, color: 'var(--ink-2)' }}>
              {work.artistRomaji}
            </span>
          </h1>
        </div>
        <div className="meta">
          {work.room}
          <span className="num">
            No. {work.no} / {work.total}
          </span>
        </div>
      </header>

      <div className="exhibit">
        <div className="stage">
          <Artwork
            work={work}
            showHotspots={showHotspots}
            focusedSpot={focusedSpot}
            onSpotClick={setFocusedSpot}
          />
          <div className="floor" />
          <div className="stage-caption">
            <div className="hint">
              {focusedSpot != null
                ? work.hotspots[focusedSpot].detail
                : '试着点击画面上发亮的圆点 — 策展人为你指出三处看点'}
            </div>
            <div className="controls">
              <button className={showHotspots ? 'on' : ''} onClick={() => setShowHotspots((s) => !s)}>
                {showHotspots ? '·  看点已开  ·' : '看点'}
              </button>
              <button onClick={onOpenViewer}>放大细看</button>
            </div>
          </div>
        </div>

        <div className="right-col">
          <WallLabel work={work} />
          <AudioGuide guide={work.audioGuide} narratorVoice={tweaks.narratorVoice} />
        </div>
      </div>

      <Notebook work={work} onSave={onSaveNotebook} />

      <section className="corridor">
        <div className="arrow">↓ Next room</div>
        <h3>明日 · 第 029 间展厅</h3>
        <p>每天一幅。第二天的灯亮起前，你可以继续坐在这间展厅里，反复看，反复写。</p>
        <button className="btn-ghost" onClick={onGoArchive}>
          走进馆藏，看你过去的 27 间展厅 →
        </button>
      </section>
    </div>
  );
}
