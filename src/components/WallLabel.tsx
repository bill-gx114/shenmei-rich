import type { Work } from '../lib/types';

export function WallLabel({ work }: { work: Work }) {
  return (
    <aside className="label">
      <div className="kicker">Catalogue · {work.no}</div>
      <h2>{work.title}</h2>
      <div className="artist">
        {work.artist} · <em>{work.artistRomaji}</em>
      </div>
      <dl>
        <dt>年代</dt>
        <dd>{work.year}</dd>
        <dt>媒材</dt>
        <dd>{work.medium}</dd>
        <dt>尺寸</dt>
        <dd>{work.size}</dd>
        <dt>系列</dt>
        <dd>{work.series}</dd>
        <dt>馆藏</dt>
        <dd>{work.location}</dd>
      </dl>
    </aside>
  );
}
