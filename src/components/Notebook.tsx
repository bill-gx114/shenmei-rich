import { useEffect, useState } from 'react';
import type { Work } from '../lib/types';

type Answer = { chip: string; text: string };

type Props = {
  work: Work;
  initialAnswers?: Answer[];
  initialSavedAt?: string | null;
  onSave?: (answers: Answer[]) => Promise<void> | void;
};

const NUMERALS = ['一', '二', '三', '四', '五'];

export function Notebook({ work, initialAnswers, initialSavedAt, onSave }: Props) {
  const [answers, setAnswers] = useState<Answer[]>(
    () => initialAnswers ?? work.questions.map(() => ({ chip: '', text: '' })),
  );
  const [savedAt, setSavedAt] = useState<string | null>(initialSavedAt ?? null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialAnswers) setAnswers(initialAnswers);
  }, [initialAnswers]);

  const set = (i: number, patch: Partial<Answer>) =>
    setAnswers((a) => a.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  const completed = answers.filter((a) => a.text.trim() || a.chip).length;

  const handleSave = async () => {
    if (completed < work.questions.length) return;
    setSaving(true);
    try {
      await onSave?.(answers);
      setSavedAt(new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="notebook">
      <div className="nb-side">
        {work.questions.map((q, i) => (
          <div className="nb-block" key={i}>
            <label>
              <span className="n">{NUMERALS[i]} —</span>
              {q.q}
            </label>
            <div className="chips">
              {q.options.map((opt) => (
                <button
                  key={opt}
                  className={`chip ${answers[i].chip === opt ? 'on' : ''}`}
                  onClick={() => set(i, { chip: opt, text: answers[i].text || opt })}
                >
                  {opt}
                </button>
              ))}
            </div>
            <input
              value={answers[i].text}
              placeholder={q.hint}
              onChange={(e) => set(i, { text: e.target.value })}
            />
          </div>
        ))}
        <div className="nb-actions">
          <div className="nb-status">
            {savedAt ? (
              <>
                已收入 <span className="ok">{savedAt}</span> 的手账
              </>
            ) : (
              <>
                完成 {completed} / {work.questions.length} 题 · 可以反复回看修改
              </>
            )}
          </div>
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={completed < work.questions.length || saving}
            style={
              completed < work.questions.length || saving
                ? { opacity: 0.45, cursor: 'not-allowed' }
                : undefined
            }
          >
            {savedAt ? '已收入手账' : saving ? '正在收入…' : '收入手账'}
          </button>
        </div>
      </div>

      <aside className="nb-side">
        <div className="dictionary">
          <h3>今日新词</h3>
          <div className="sub">点击收入审美词典</div>
          <div className="words">
            {work.vocabulary.map((v) => (
              <div key={v.word} className={`word ${v.isNew ? 'new' : ''}`} title={v.note}>
                {v.word}
                {v.isNew && <span className="badge">新</span>}
              </div>
            ))}
          </div>
        </div>
        {work.curatorNote && (
          <div className="dictionary" style={{ background: 'transparent' }}>
            <h3>策展人留言</h3>
            <div className="sub">curator's note</div>
            <p
              style={{
                fontFamily: 'var(--serif)',
                fontSize: 14,
                color: 'var(--ink-2)',
                lineHeight: 1.85,
                margin: 0,
                fontStyle: 'italic',
              }}
            >
              "{work.curatorNote}"
            </p>
          </div>
        )}
      </aside>
    </section>
  );
}
