import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { draftCuratorPack, type CuratorDraft } from '../lib/aiDraft';

type HotspotInput = { x: string; y: string; label: string; detail: string };
type LineInput = { t: string; text: string };
type QuestionInput = { q: string; hint: string; options: string };
type VocabInput = { word: string; note: string; isNew: boolean };

const emptyHotspot = (): HotspotInput => ({ x: '50', y: '50', label: '', detail: '' });
const emptyLine = (): LineInput => ({ t: '0', text: '' });
const emptyQ = (): QuestionInput => ({ q: '', hint: '', options: '' });
const emptyVocab = (): VocabInput => ({ word: '', note: '', isNew: false });

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const FIELD_STYLE: React.CSSProperties = {
  background: 'transparent',
  border: 0,
  borderBottom: '1px solid var(--line-strong)',
  color: 'var(--ink)',
  padding: '10px 0',
  fontFamily: 'var(--serif)',
  fontSize: 15,
  letterSpacing: '0.02em',
  outline: 'none',
  width: '100%',
};

const SECTION_STYLE: React.CSSProperties = {
  borderTop: '1px solid var(--line)',
  paddingTop: 28,
  marginTop: 28,
};

const SECTION_LABEL: React.CSSProperties = {
  fontFamily: 'var(--display)',
  fontStyle: 'italic',
  color: 'var(--gold)',
  letterSpacing: '0.3em',
  textTransform: 'uppercase',
  fontSize: 12,
  marginBottom: 18,
};

function L({ children }: { children: React.ReactNode }) {
  return (
    <label
      style={{
        display: 'block',
        fontFamily: 'var(--serif)',
        color: 'var(--ink-3)',
        fontSize: 11.5,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        marginBottom: 6,
      }}
    >
      {children}
    </label>
  );
}

export function AdminNewWorkPage() {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [no, setNo] = useState('028');
  const [exhibitedOn, setExhibitedOn] = useState(todayISO());
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [artistRomaji, setArtistRomaji] = useState('');
  const [year, setYear] = useState('');
  const [medium, setMedium] = useState('');
  const [size, setSize] = useState('');
  const [series, setSeries] = useState('');
  const [location, setLocation] = useState('');
  const [room, setRoom] = useState('');
  const [shortLabel, setShortLabel] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const [aiHint, setAiHint] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState<string | null>(null);

  const [hotspots, setHotspots] = useState<HotspotInput[]>([emptyHotspot()]);
  const [lines, setLines] = useState<LineInput[]>([emptyLine()]);
  const [questions, setQuestions] = useState<QuestionInput[]>([emptyQ(), emptyQ(), emptyQ()]);
  const [vocab, setVocab] = useState<VocabInput[]>([emptyVocab()]);

  const hasDraftContent = () =>
    shortLabel.trim() ||
    hotspots.some((h) => h.label.trim() || h.detail.trim()) ||
    lines.some((l) => l.text.trim()) ||
    questions.some((q) => q.q.trim() || q.options.trim()) ||
    vocab.some((v) => v.word.trim());

  const applyDraft = (d: CuratorDraft) => {
    setShortLabel(d.shortLabel || '');
    setHotspots(
      (d.hotspots ?? []).length
        ? d.hotspots.map((h) => ({
            x: String(h.x ?? 50),
            y: String(h.y ?? 50),
            label: h.label ?? '',
            detail: h.detail ?? '',
          }))
        : [emptyHotspot()],
    );
    setLines(
      (d.audioLines ?? []).length
        ? d.audioLines.map((l) => ({ t: String(l.t ?? 0), text: l.text ?? '' }))
        : [emptyLine()],
    );
    setQuestions(
      (d.questions ?? []).length
        ? d.questions.map((q) => ({
            q: q.q ?? '',
            hint: q.hint ?? '',
            options: (q.options ?? []).join('，'),
          }))
        : [emptyQ(), emptyQ(), emptyQ()],
    );
    setVocab(
      (d.vocabulary ?? []).length
        ? d.vocabulary.map((v) => ({
            word: v.word ?? '',
            note: v.note ?? '',
            isNew: !!v.isNew,
          }))
        : [emptyVocab()],
    );
  };

  const onAiDraft = async () => {
    setAiErr(null);
    if (!title.trim() && !artist.trim() && !aiHint.trim()) {
      setAiErr('至少填一下"作品名 / 作者 / 一句话感觉"');
      return;
    }
    if (
      hasDraftContent() &&
      !window.confirm('已有手填内容，AI 起稿会覆盖动态字段（墙签短语 / 看点 / 导览 / 题目 / 新词）。继续？')
    )
      return;
    setAiBusy(true);
    try {
      const draft = await draftCuratorPack({ title, artist, hint: aiHint });
      applyDraft(draft);
    } catch (e) {
      setAiErr(e instanceof Error ? e.message : String(e));
    } finally {
      setAiBusy(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      setErr('未配置 Supabase（VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 缺失）');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error('未登录');

      let imagePath: string | null = null;
      if (file) {
        const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
        const path = `${user.id}/${exhibitedOn}-${no}.${ext}`;
        const up = await supabase.storage.from('works').upload(path, file, { upsert: true });
        if (up.error) throw up.error;
        imagePath = path;
      }

      const { data: work, error: workErr } = await supabase
        .from('works')
        .insert({
          owner_id: user.id,
          no,
          exhibited_on: exhibitedOn,
          title,
          artist,
          artist_romaji: artistRomaji || null,
          year: year || null,
          medium: medium || null,
          size: size || null,
          series: series || null,
          location: location || null,
          room: room || null,
          short_label: shortLabel || null,
          image_path: imagePath,
        })
        .select('id')
        .single();
      if (workErr) throw workErr;
      const workId = work.id;

      const hotspotRows = hotspots
        .filter((h) => h.label.trim())
        .map((h, i) => ({
          work_id: workId,
          x: Number(h.x) || 0,
          y: Number(h.y) || 0,
          label: h.label,
          detail: h.detail,
          order_index: i,
        }));
      const lineRows = lines
        .filter((l) => l.text.trim())
        .map((l, i) => ({
          work_id: workId,
          t: Number(l.t) || 0,
          text: l.text,
          order_index: i,
        }));
      const questionRows = questions
        .filter((q) => q.q.trim())
        .map((q, i) => ({
          work_id: workId,
          q: q.q,
          hint: q.hint,
          options: q.options
            .split(/[,，、]/)
            .map((s) => s.trim())
            .filter(Boolean),
          order_index: i,
        }));
      const vocabRows = vocab
        .filter((v) => v.word.trim())
        .map((v) => ({
          work_id: workId,
          word: v.word,
          note: v.note,
          is_new: v.isNew,
        }));

      if (hotspotRows.length) {
        const { error } = await supabase.from('hotspots').insert(hotspotRows);
        if (error) throw error;
      }
      if (lineRows.length) {
        const { error } = await supabase.from('audio_lines').insert(lineRows);
        if (error) throw error;
      }
      if (questionRows.length) {
        const { error } = await supabase.from('questions').insert(questionRows);
        if (error) throw error;
      }
      if (vocabRows.length) {
        const { error } = await supabase.from('vocabulary').insert(vocabRows);
        if (error) throw error;
      }

      nav('/');
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="gallery-wrap" style={{ maxWidth: 920 }}>
      <header className="gallery-head">
        <div>
          <div className="lead">New work · 录入今日作品</div>
          <h1 style={{ fontSize: 38 }}>新挂一幅画</h1>
        </div>
        <div className="meta">
          <button type="button" className="btn-ghost" onClick={() => nav('/')}>
            ← 返回展厅
          </button>
        </div>
      </header>

      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div>
            <L>编号</L>
            <input style={FIELD_STYLE} value={no} onChange={(e) => setNo(e.target.value)} required />
          </div>
          <div>
            <L>展出日期</L>
            <input
              style={FIELD_STYLE}
              type="date"
              value={exhibitedOn}
              onChange={(e) => setExhibitedOn(e.target.value)}
              required
            />
          </div>
          <div>
            <L>作品名</L>
            <input style={FIELD_STYLE} value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div>
            <L>作者</L>
            <input style={FIELD_STYLE} value={artist} onChange={(e) => setArtist(e.target.value)} required />
          </div>
          <div>
            <L>作者罗马字 / 拼音</L>
            <input style={FIELD_STYLE} value={artistRomaji} onChange={(e) => setArtistRomaji(e.target.value)} />
          </div>
          <div>
            <L>年代</L>
            <input style={FIELD_STYLE} value={year} onChange={(e) => setYear(e.target.value)} />
          </div>
          <div>
            <L>媒材</L>
            <input style={FIELD_STYLE} value={medium} onChange={(e) => setMedium(e.target.value)} />
          </div>
          <div>
            <L>尺寸</L>
            <input style={FIELD_STYLE} value={size} onChange={(e) => setSize(e.target.value)} />
          </div>
          <div>
            <L>系列</L>
            <input style={FIELD_STYLE} value={series} onChange={(e) => setSeries(e.target.value)} />
          </div>
          <div>
            <L>馆藏地点</L>
            <input style={FIELD_STYLE} value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div>
            <L>展厅</L>
            <input
              style={FIELD_STYLE}
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="西馆 · 第 03 展厅"
            />
          </div>
          <div>
            <L>图片文件</L>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              style={{ color: 'var(--ink-3)', fontSize: 13 }}
            />
          </div>
        </div>

        <div
          style={{
            ...SECTION_STYLE,
            background: 'linear-gradient(180deg, rgba(231,192,103,0.04), transparent)',
            padding: '24px 24px 22px',
            border: '1px solid var(--line)',
            marginTop: 28,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
            <div style={{ ...SECTION_LABEL, marginBottom: 0 }}>AI 起稿 · DeepSeek</div>
            <div
              style={{
                fontFamily: 'var(--serif)',
                color: 'var(--ink-4)',
                fontSize: 11.5,
                letterSpacing: '0.06em',
              }}
            >
              基于作品名 / 作者 / 一句话感觉，生成墙签 · 看点 · 导览脚本 · 三题 · 新词
            </div>
          </div>
          <L>一句话感觉（可空）</L>
          <input
            style={FIELD_STYLE}
            value={aiHint}
            onChange={(e) => setAiHint(e.target.value)}
            placeholder="例：清晨南风把山染红，几乎只用三种颜色，构图大胆压满"
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14 }}>
            <button
              type="button"
              className="btn-primary"
              onClick={onAiDraft}
              disabled={aiBusy}
              style={aiBusy ? { opacity: 0.5, cursor: 'wait' } : undefined}
            >
              {aiBusy ? '正在起稿…' : '✦ 让 AI 起稿'}
            </button>
            {aiErr && (
              <div style={{ color: '#c97a55', fontSize: 12, fontFamily: 'var(--serif)' }}>{aiErr}</div>
            )}
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <L>墙签简述</L>
          <textarea
            style={{ ...FIELD_STYLE, minHeight: 70 }}
            value={shortLabel}
            onChange={(e) => setShortLabel(e.target.value)}
            placeholder="一句话讲清这幅作品在做什么"
          />
        </div>

        <RepeatGroup
          title="看点（hotspots）"
          items={hotspots}
          add={() => setHotspots((a) => [...a, emptyHotspot()])}
          remove={(i) => setHotspots((a) => a.filter((_, idx) => idx !== i))}
          render={(h, i) => (
            <div style={{ display: 'grid', gridTemplateColumns: '60px 60px 1fr', gap: 12, alignItems: 'end' }}>
              <div>
                <L>x %</L>
                <input
                  style={FIELD_STYLE}
                  value={h.x}
                  onChange={(e) =>
                    setHotspots((a) => a.map((x, idx) => (idx === i ? { ...x, x: e.target.value } : x)))
                  }
                />
              </div>
              <div>
                <L>y %</L>
                <input
                  style={FIELD_STYLE}
                  value={h.y}
                  onChange={(e) =>
                    setHotspots((a) => a.map((x, idx) => (idx === i ? { ...x, y: e.target.value } : x)))
                  }
                />
              </div>
              <div>
                <L>名称</L>
                <input
                  style={FIELD_STYLE}
                  value={h.label}
                  onChange={(e) =>
                    setHotspots((a) => a.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)))
                  }
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <L>说明</L>
                <textarea
                  style={{ ...FIELD_STYLE, minHeight: 50 }}
                  value={h.detail}
                  onChange={(e) =>
                    setHotspots((a) => a.map((x, idx) => (idx === i ? { ...x, detail: e.target.value } : x)))
                  }
                />
              </div>
            </div>
          )}
        />

        <RepeatGroup
          title="导览脚本（audio lines）"
          items={lines}
          add={() => setLines((a) => [...a, emptyLine()])}
          remove={(i) => setLines((a) => a.filter((_, idx) => idx !== i))}
          render={(l, i) => (
            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 12, alignItems: 'end' }}>
              <div>
                <L>秒</L>
                <input
                  style={FIELD_STYLE}
                  value={l.t}
                  onChange={(e) =>
                    setLines((a) => a.map((x, idx) => (idx === i ? { ...x, t: e.target.value } : x)))
                  }
                />
              </div>
              <div>
                <L>台词</L>
                <textarea
                  style={{ ...FIELD_STYLE, minHeight: 50 }}
                  value={l.text}
                  onChange={(e) =>
                    setLines((a) => a.map((x, idx) => (idx === i ? { ...x, text: e.target.value } : x)))
                  }
                />
              </div>
            </div>
          )}
        />

        <RepeatGroup
          title="手账三题（questions）"
          items={questions}
          add={() => setQuestions((a) => [...a, emptyQ()])}
          remove={(i) => setQuestions((a) => a.filter((_, idx) => idx !== i))}
          render={(q, i) => (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <L>问题</L>
                <input
                  style={FIELD_STYLE}
                  value={q.q}
                  onChange={(e) =>
                    setQuestions((a) => a.map((x, idx) => (idx === i ? { ...x, q: e.target.value } : x)))
                  }
                />
              </div>
              <div>
                <L>提示</L>
                <input
                  style={FIELD_STYLE}
                  value={q.hint}
                  onChange={(e) =>
                    setQuestions((a) => a.map((x, idx) => (idx === i ? { ...x, hint: e.target.value } : x)))
                  }
                />
              </div>
              <div>
                <L>候选选项（用逗号或顿号分隔）</L>
                <input
                  style={FIELD_STYLE}
                  value={q.options}
                  onChange={(e) =>
                    setQuestions((a) => a.map((x, idx) => (idx === i ? { ...x, options: e.target.value } : x)))
                  }
                  placeholder="选项一, 选项二, 选项三"
                />
              </div>
            </div>
          )}
        />

        <RepeatGroup
          title="新词（vocabulary）"
          items={vocab}
          add={() => setVocab((a) => [...a, emptyVocab()])}
          remove={(i) => setVocab((a) => a.filter((_, idx) => idx !== i))}
          render={(v, i) => (
            <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 80px', gap: 12, alignItems: 'end' }}>
              <div>
                <L>词</L>
                <input
                  style={FIELD_STYLE}
                  value={v.word}
                  onChange={(e) =>
                    setVocab((a) => a.map((x, idx) => (idx === i ? { ...x, word: e.target.value } : x)))
                  }
                />
              </div>
              <div>
                <L>释义</L>
                <input
                  style={FIELD_STYLE}
                  value={v.note}
                  onChange={(e) =>
                    setVocab((a) => a.map((x, idx) => (idx === i ? { ...x, note: e.target.value } : x)))
                  }
                />
              </div>
              <label
                style={{
                  fontFamily: 'var(--serif)',
                  color: 'var(--ink-3)',
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  paddingBottom: 12,
                }}
              >
                <input
                  type="checkbox"
                  checked={v.isNew}
                  onChange={(e) =>
                    setVocab((a) => a.map((x, idx) => (idx === i ? { ...x, isNew: e.target.checked } : x)))
                  }
                />
                新词
              </label>
            </div>
          )}
        />

        {err && (
          <div style={{ color: '#c97a55', fontSize: 13, fontFamily: 'var(--serif)' }}>{err}</div>
        )}

        <div style={{ ...SECTION_STYLE, display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? '正在挂画…' : '挂上墙'}
          </button>
        </div>
      </form>
    </div>
  );
}

function RepeatGroup<T>({
  title,
  items,
  add,
  remove,
  render,
}: {
  title: string;
  items: T[];
  add: () => void;
  remove: (i: number) => void;
  render: (item: T, i: number) => React.ReactNode;
}) {
  return (
    <div style={SECTION_STYLE}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={SECTION_LABEL}>{title}</div>
        <button type="button" className="btn-ghost" onClick={add} style={{ fontSize: 11 }}>
          ＋ 添加一条
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {items.map((it, i) => (
          <div key={i} style={{ position: 'relative', paddingRight: 60 }}>
            {render(it, i)}
            {items.length > 1 && (
              <button
                type="button"
                onClick={() => remove(i)}
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  background: 'transparent',
                  border: '1px solid var(--line-strong)',
                  color: 'var(--ink-3)',
                  borderRadius: 999,
                  padding: '4px 10px',
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                删除
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
