type Props = {
  tab: string;
  onTab: (id: string) => void;
  room: string;
  visitorNo: string;
  date: string;
  /** When provided, replaces the static "visitor count" pill with action buttons. */
  onNewWork?: () => void;
  onLogout?: () => void;
  /** Shown when user is anonymous — typically opens the login page. */
  onLogin?: () => void;
};

const TABS = [
  { id: 'today', label: '今日展厅' },
  { id: 'archive', label: '馆藏' },
  { id: 'journal', label: '观察手账' },
];

const ACTION_BTN: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--line-strong)',
  color: 'var(--ink-2)',
  fontFamily: 'var(--serif)',
  fontSize: 11.5,
  padding: '6px 12px',
  borderRadius: 999,
  letterSpacing: '0.1em',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

export function Signage({ tab, onTab, room, visitorNo, date, onNewWork, onLogout, onLogin }: Props) {
  const showActions = Boolean(onNewWork || onLogout || onLogin);
  return (
    <header className="signage">
      <div className="signage-l">
        <span className="crest">M</span>
        <span className="name">审美日课</span>
        <span style={{ color: 'var(--ink-5)' }}>·</span>
        <span className="room">{room}</span>
      </div>
      <nav className="signage-nav">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => onTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
      <div className="signage-r">
        <span className="date">{date}</span>
        {showActions ? (
          <>
            {onNewWork && (
              <button style={ACTION_BTN} onClick={onNewWork}>
                ＋ 新作品
              </button>
            )}
            {onLogout && (
              <button style={ACTION_BTN} onClick={onLogout}>
                退出
              </button>
            )}
            {onLogin && (
              <button style={ACTION_BTN} onClick={onLogin}>
                登录
              </button>
            )}
          </>
        ) : (
          <span className="visitor">
            <span className="dot" /> 第 {visitorNo} 次到访
          </span>
        )}
      </div>
    </header>
  );
}
