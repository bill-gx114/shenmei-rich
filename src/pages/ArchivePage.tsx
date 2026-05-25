import { useState } from 'react';
import type { ArchiveWork } from '../lib/types';

const FILTERS = [
  { id: 'all', label: '全部' },
  { id: 'pinned', label: '★ 收藏' },
  { id: 'month', label: '本月' },
  { id: 'east', label: '东方' },
  { id: 'west', label: '西方' },
] as const;

function CollTile({ work, onClick }: { work: ArchiveWork; onClick: () => void }) {
  const [failed, setFailed] = useState(false);
  return (
    <article className={`coll-tile s-${work.span || 3}`} onClick={onClick}>
      <div className="thumb">
        {work.pinned && <div className="pin">★ 收藏</div>}
        {failed ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              background: `linear-gradient(135deg, hsl(${(parseInt(work.no) * 47) % 360}, 22%, 18%), hsl(${
                (parseInt(work.no) * 47 + 60) % 360
              }, 24%, 10%))`,
              fontFamily: 'var(--display)',
              fontStyle: 'italic',
              color: 'var(--ink-3)',
              fontSize: 14,
              letterSpacing: '0.2em',
            }}
          >
            № {work.no}
          </div>
        ) : (
          <img src={work.img} alt={work.title} loading="lazy" onError={() => setFailed(true)} />
        )}
      </div>
      <div className="info">
        <div className="no">
          No. {work.no} · {work.date}
        </div>
        <h4>{work.title}</h4>
        <div className="when">{work.artist}</div>
      </div>
    </article>
  );
}

type Props = {
  works: ArchiveWork[];
  onOpen: (w: ArchiveWork) => void;
  stats?: { visited: number; pinned: number; vocabulary: number };
};

export function ArchivePage({ works, onOpen, stats }: Props) {
  const [filter, setFilter] = useState<string>('all');
  const filtered = works.filter((w) => (filter === 'pinned' ? w.pinned : true));
  const s = stats ?? { visited: works.length, pinned: works.filter((w) => w.pinned).length, vocabulary: 0 };

  return (
    <div className="archive-wrap">
      <header className="archive-head">
        <div>
          <div className="lead">Archive · 馆藏</div>
          <h1>你的私人馆藏</h1>
        </div>
        <div className="stats">
          <div className="stat">
            <div className="v">{s.visited}</div>
            <div className="l">已观摩</div>
          </div>
          <div className="stat">
            <div className="v">{s.pinned}</div>
            <div className="l">收藏</div>
          </div>
          <div className="stat">
            <div className="v">{s.vocabulary}</div>
            <div className="l">累积新词</div>
          </div>
        </div>
      </header>

      <div className="archive-filters">
        {FILTERS.map((f) => (
          <button key={f.id} className={filter === f.id ? 'on' : ''} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="collection-wall">
        {filtered.map((w) => (
          <CollTile key={w.no} work={w} onClick={() => onOpen(w)} />
        ))}
      </div>
    </div>
  );
}
