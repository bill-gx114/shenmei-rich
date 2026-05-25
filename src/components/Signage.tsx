type Props = {
  tab: string;
  onTab: (id: string) => void;
  room: string;
  visitorNo: string;
  date: string;
};

const TABS = [
  { id: 'today', label: '今日展厅' },
  { id: 'archive', label: '馆藏' },
  { id: 'journal', label: '观察手账' },
];

export function Signage({ tab, onTab, room, visitorNo, date }: Props) {
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
        <span className="visitor">
          <span className="dot" /> 第 {visitorNo} 次到访
        </span>
      </div>
    </header>
  );
}
