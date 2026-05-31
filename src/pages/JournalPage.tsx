import { useState } from 'react';
import type { ArchiveWork, ConstellationWord } from '../lib/types';
import { useInsight } from '../hooks/useInsight';

type Stats = { streak: number; vocabulary: number; notes: number; patterns: number };

type Props = {
  recentEntries: ArchiveWork[];
  constellation: ConstellationWord[];
  stats: Stats;
  hasUser: boolean;
  /** Bumped after a notebook save so the AI insight re-fetches. */
  insightVersion?: number;
  onLogin?: () => void;
  /** Jump to a work's detail page (from a dictionary entry's source list). */
  onOpenWork?: (workId: string) => void;
};

/** One expandable dictionary entry: term → definition + source artworks. */
function GlossaryEntry({
  word,
  onOpenWork,
}: {
  word: ConstellationWord;
  onOpenWork?: (workId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const sources = word.sources ?? [];
  const expandable = Boolean(word.note) || sources.length > 0;

  return (
    <article className={`gloss-entry${open ? ' open' : ''}`}>
      <button
        className="gloss-head"
        onClick={() => expandable && setOpen((o) => !o)}
        style={{ cursor: expandable ? 'pointer' : 'default' }}
      >
        <span className="gloss-term">
          {word.w}
          {word.isNew && <span className="gloss-new">new</span>}
        </span>
        <span className="gloss-meta">
          <span className="gloss-count">{word.count} 次</span>
          {expandable && <span className="gloss-caret">{open ? '−' : '+'}</span>}
        </span>
      </button>
      {open && (
        <div className="gloss-body">
          {word.note && <p className="gloss-def">{word.note}</p>}
          {sources.length > 0 && (
            <>
              <div className="gloss-label">你在这些画里圈出过它</div>
              <div className="gloss-sources">
                {sources.map((s) => (
                  <button
                    key={s.workId}
                    className="gloss-source"
                    onClick={() => onOpenWork?.(s.workId)}
                    title={`${s.title} · ${s.date}`}
                  >
                    {s.img ? (
                      <img src={s.img} alt={s.title} loading="lazy" />
                    ) : (
                      <div className="gloss-source-ph" />
                    )}
                    <span className="gloss-source-title">{s.title}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </article>
  );
}

export function JournalPage({
  recentEntries,
  constellation,
  stats,
  hasUser,
  insightVersion = 0,
  onLogin,
  onOpenWork,
}: Props) {
  const insight = useInsight(hasUser, insightVersion);
  const entries = recentEntries.map((w) => {
    const m = w.date.match(/(\d+)月(\d+)日/);
    return { ...w, month: m?.[1] ?? '—', day: m?.[2] ?? '—' };
  });

  return (
    <div className="journal-wrap">
      <header className="journal-head">
        <div className="lead">Notebook · 观察手账</div>
        <h1>你正在长出的眼睛</h1>
        <div className="sub">— 收集的不是图片，而是你逐渐稳定下来的判断。</div>
      </header>

      {!hasUser ? (
        <div
          style={{
            border: '1px solid var(--line)',
            padding: '60px 40px',
            textAlign: 'center',
            background: 'var(--bg-1)',
            marginTop: 40,
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--serif)',
              fontWeight: 300,
              fontSize: 28,
              margin: '0 0 14px',
              color: 'var(--ink)',
            }}
          >
            登录后开始记录你的观察
          </h2>
          <p style={{ color: 'var(--ink-3)', maxWidth: 460, margin: '0 auto 24px' }}>
            每天在画前答三题，你选过的关键词会聚成「审美词典」，重复出现的会沉淀为「你正在形成的判断」。这里只有你能看到自己的记录。
          </p>
          <button className="btn-primary" onClick={onLogin}>
            登录
          </button>
        </div>
      ) : (
        <>
          <div className="journal-stats">
            <div className="cell">
              <div className="v">{stats.streak}</div>
              <div className="l">连续打卡</div>
            </div>
            <div className="cell">
              <div className="v">{stats.vocabulary}</div>
              <div className="l">审美词典</div>
            </div>
            <div className="cell">
              <div className="v">{stats.notes}</div>
              <div className="l">观察笔记</div>
            </div>
            <div className="cell">
              <div className="v">{stats.patterns}</div>
              <div className="l">已成模式</div>
            </div>
          </div>

          <section className="journal-section">
            <h2>
              近七日观察 <span className="small">latest reflections</span>
            </h2>
            {entries.length === 0 ? (
              <p style={{ color: 'var(--ink-3)', fontFamily: 'var(--serif)' }}>
                还没收入手账。打开今日展厅，答完三题就会出现在这里。
              </p>
            ) : (
              <div className="entries">
                {entries.map((e) => (
                  <article className="entry" key={e.no + e.date}>
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
            )}
          </section>

          <section className="journal-section">
            <h2>
              审美词典 <span className="small">your glossary · {constellation.length} 词</span>
            </h2>
            {constellation.length === 0 ? (
              <p style={{ color: 'var(--ink-3)', fontFamily: 'var(--serif)' }}>
                还没有词条 —— 答题时选的 chip 会自动收入这里。点开每个词，能看到它的释义，以及你在哪些画里圈出过它。
              </p>
            ) : (
              <div className="glossary">
                {constellation.map((c) => (
                  <GlossaryEntry key={c.w} word={c} onOpenWork={onOpenWork} />
                ))}
              </div>
            )}
          </section>

          <section className="journal-section">
            <h2>
              你正在形成的判断 <span className="small">aesthetic portrait · AI</span>
            </h2>

            {insight.loading ? (
              <p style={{ color: 'var(--ink-3)', fontFamily: 'var(--serif)', fontStyle: 'italic' }}>
                策展人正在为你写审美肖像…
              </p>
            ) : insight.portrait ? (
              <>
                <p
                  style={{
                    fontFamily: 'var(--serif)',
                    fontSize: 16,
                    lineHeight: 2,
                    color: 'var(--ink-2)',
                    margin: '0 0 28px',
                    paddingLeft: 16,
                    borderLeft: '2px solid var(--gold-soft)',
                  }}
                >
                  {insight.portrait}
                </p>
                {insight.tendencies.map((t, i) => (
                  <article className="pattern-card" key={i}>
                    <div className="h">
                      <div className="ttl">{t.title}</div>
                      <div className="freq">倾向</div>
                    </div>
                    <p className="desc">{t.desc}</p>
                  </article>
                ))}
              </>
            ) : (
              <p style={{ color: 'var(--ink-3)', fontFamily: 'var(--serif)' }}>
                {insight.error
                  ? `暂时生成不了（${insight.error}）`
                  : `再答几道题（已 ${insight.entryCount}/${insight.need ?? 3}），策展人就能为你总结正在形成的审美判断。`}
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
