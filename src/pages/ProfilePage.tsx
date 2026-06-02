import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePublicProfile } from '../hooks/useProfile';
import { shareLink } from '../lib/share';

export function ProfilePage() {
  const { handle } = useParams<{ handle: string }>();
  const nav = useNavigate();
  const { data, loading, error } = usePublicProfile(handle);
  const [toast, setToast] = useState<string | null>(null);

  const onShare = async () => {
    const url = `${location.origin}/u/${handle}`;
    const r = await shareLink({
      url,
      title: `${data?.profile.displayName ?? ''} 的审美主页`,
      text: data?.portrait ?? '在审美日课，长出自己的眼睛。',
      context: 'profile_public',
    });
    if (r === 'copied') {
      setToast('链接已复制');
      setTimeout(() => setToast(null), 1800);
    }
  };

  if (loading) {
    return (
      <div className="profile-wrap" style={{ textAlign: 'center', paddingTop: 120 }}>
        <div className="lead">Loading · 正在开灯…</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="profile-wrap" style={{ textAlign: 'center', paddingTop: 100 }}>
        <h1 style={{ fontFamily: 'var(--serif)', fontWeight: 300, fontSize: 32 }}>
          这个审美主页不存在或未公开
        </h1>
        <p style={{ color: 'var(--ink-3)', margin: '14px 0 28px' }}>{error}</p>
        <button className="btn-primary" onClick={() => nav('/')}>
          去审美日课看看
        </button>
      </div>
    );
  }

  const { profile, stats, portrait, tendencies, dictionary, collection } = data;

  return (
    <div className="profile-wrap">
      <header className="profile-head">
        <div className="lead">审美主页 · Aesthetic profile</div>
        <h1>{profile.displayName}</h1>
        <div className="profile-handle">@{profile.handle}</div>
        <button className="profile-share" onClick={onShare}>
          ↗ 分享这张审美名片
        </button>
      </header>

      <div className="journal-stats profile-stats">
        <div className="cell">
          <div className="v">{stats.streak}</div>
          <div className="l">连续打卡</div>
        </div>
        <div className="cell">
          <div className="v">{stats.notes}</div>
          <div className="l">观察笔记</div>
        </div>
        <div className="cell">
          <div className="v">{stats.vocabulary}</div>
          <div className="l">审美词典</div>
        </div>
        <div className="cell">
          <div className="v">{stats.collection}</div>
          <div className="l">馆藏精选</div>
        </div>
      </div>

      {portrait && (
        <section className="journal-section">
          <h2>
            正在形成的判断 <span className="small">aesthetic portrait · AI</span>
          </h2>
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
            {portrait}
          </p>
          {tendencies.map((t, i) => (
            <article className="pattern-card" key={i}>
              <div className="h">
                <div className="ttl">{t.title}</div>
                <div className="freq">倾向</div>
              </div>
              <p className="desc">{t.desc}</p>
            </article>
          ))}
        </section>
      )}

      {dictionary.length > 0 && (
        <section className="journal-section">
          <h2>
            审美词典 <span className="small">{dictionary.length} 词</span>
          </h2>
          <div className="gloss-grid">
            {dictionary.map((d) => (
              <div className="gloss-chip" key={d.w} style={{ cursor: 'default' }}>
                <span className="gloss-chip-term">{d.w}</span>
                <span className="gloss-chip-count">{d.count}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {collection.length > 0 && (
        <section className="journal-section">
          <h2>
            馆藏精选 <span className="small">{collection.length} 件</span>
          </h2>
          <div className="profile-collection">
            {collection.map((c) => (
              <figure className="pc-item" key={c.no}>
                {c.img ? <img src={c.img} alt={c.title} loading="lazy" /> : <div className="pc-ph" />}
                <figcaption>{c.title}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      <footer className="profile-foot">
        <p>这是一张「审美日课」的审美名片 —— 每天一幅名作，长出自己的眼睛。</p>
        <button className="btn-primary" onClick={() => nav('/')}>
          也来记录我的观看 →
        </button>
      </footer>

      {toast && <div className="share-toast">{toast}</div>}
    </div>
  );
}
