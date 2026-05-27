import type { ArchiveWork, ConstellationWord, Pattern } from '../lib/types';

type Props = {
  works: ArchiveWork[];
  constellation: ConstellationWord[];
  patterns: Pattern[];
  stats?: { streak: number; vocabulary: number; notes: number; patterns: number };
};

export function JournalPage({ works, constellation, patterns, stats }: Props) {
  const entries = works.slice(0, 5).map((w) => {
    const m = w.date.match(/(\d+)月(\d+)日/);
    return { ...w, month: m?.[1] ?? '—', day: m?.[2] ?? '—' };
  });

  const s = stats ?? {
    streak: works.length,
    vocabulary: constellation.length,
    notes: works.length * 3,
    patterns: patterns.length,
  };

  return (
    <div className="journal-wrap">
      <header className="journal-head">
        <div className="lead">Notebook · 观察手账</div>
        <h1>你正在长出的眼睛</h1>
        <div className="sub">— 收集的不是图片，而是你逐渐稳定下来的判断。</div>
      </header>

      <div className="journal-stats">
        <div className="cell">
          <div className="v">{s.streak}</div>
          <div className="l">连续打卡</div>
        </div>
        <div className="cell">
          <div className="v">{s.vocabulary}</div>
          <div className="l">审美词典</div>
        </div>
        <div className="cell">
          <div className="v">{s.notes}</div>
          <div className="l">观察笔记</div>
        </div>
        <div className="cell">
          <div className="v">{s.patterns}</div>
          <div className="l">已成模式</div>
        </div>
      </div>

      <section className="journal-section">
        <h2>
          近七日观察 <span className="small">latest reflections</span>
        </h2>
        <div className="entries">
          {entries.map((e) => (
            <article className="entry" key={e.no}>
              <div className="date">
                <span className="month">
                  {e.month}/{e.day}
                </span>
                No. {e.no}
              </div>
              <div>
                <h4>{e.title}</h4>
                <div className="artist">{e.artist}</div>
                <p className="reflection">{e.reflection}</p>
                <div className="tags">
                  {e.keywords.map((k) => (
                    <span className="tag" key={k}>
                      #{k}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="journal-section">
        <h2>
          审美词典 <span className="small">vocabulary constellation · {constellation.length} 词</span>
        </h2>
        <div className="constellation">
          {constellation.map((c) => (
            <div className="con-word" key={c.w}>
              <div className="w">
                {c.w}
                {c.isNew && (
                  <span
                    style={{
                      color: 'var(--gold)',
                      fontSize: 11,
                      marginLeft: 6,
                      fontFamily: 'var(--display)',
                      fontStyle: 'italic',
                    }}
                  >
                    new
                  </span>
                )}
              </div>
              <div className="count">出现 {c.count} 次</div>
              <div className="from">最近 · {c.from}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="journal-section">
        <h2>
          你正在形成的判断 <span className="small">patterns observed</span>
        </h2>
        {patterns.map((p, i) => (
          <article className="pattern-card" key={i}>
            <div className="h">
              <div className="ttl">{p.title}</div>
              <div className="freq">{p.freq}</div>
            </div>
            <p className="desc">{p.desc}</p>
            <div className="from">出处：{p.from}</div>
          </article>
        ))}
      </section>
    </div>
  );
}
