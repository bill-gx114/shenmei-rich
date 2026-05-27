import { useEffect, useState } from 'react';
import { Artwork } from '../components/Artwork';
import { WallLabel } from '../components/WallLabel';
import { AudioGuide } from '../components/AudioGuide';
import { Notebook } from '../components/Notebook';
import type { Hotspot, Tweaks, Work } from '../lib/types';

type Props = {
  work: Work;
  tweaks: Tweaks;
  onOpenViewer: () => void;
  onGoArchive: () => void;
  /** Past works count, excluding today. Drives the "走进馆藏" CTA. */
  pastCount: number;
  /** 'today' (default) shows the "tomorrow's room" corridor. 'past' shows
      a "back to today's exhibit" CTA instead. */
  mode?: 'today' | 'past';
  onBackToToday?: () => void;
  onSaveNotebook?: (answers: { chip: string; text: string }[]) => Promise<void> | void;
  /** When provided, the user is allowed to edit hotspots for this work. */
  onSaveHotspots?: (hotspots: Hotspot[]) => Promise<void>;
};

function nextRoomLabel(currentNo: string): string {
  const n = parseInt(currentNo, 10);
  if (Number.isNaN(n)) return '—';
  return String(n + 1).padStart(currentNo.length, '0');
}

const FIELD: React.CSSProperties = {
  background: 'transparent',
  border: 0,
  borderBottom: '1px solid var(--line-strong)',
  color: 'var(--ink)',
  padding: '6px 0',
  fontFamily: 'var(--serif)',
  fontSize: 14,
  letterSpacing: '0.02em',
  outline: 'none',
  width: '100%',
};

export function TodayPage({
  work,
  tweaks,
  onOpenViewer,
  onGoArchive,
  pastCount,
  mode = 'today',
  onBackToToday,
  onSaveNotebook,
  onSaveHotspots,
}: Props) {
  const [showHotspots, setShowHotspots] = useState(tweaks.showHotspotsByDefault);
  const [focusedSpot, setFocusedSpot] = useState<number | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [draftHotspots, setDraftHotspots] = useState<Hotspot[]>(work.hotspots);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  // Reset the draft whenever the underlying work changes (e.g., refresh
  // after save, or a new daily work loaded).
  useEffect(() => {
    setDraftHotspots(work.hotspots);
    setEditMode(false);
    setFocusedSpot(null);
    setSaveErr(null);
  }, [work.id, work.hotspots]);

  const canEdit = Boolean(onSaveHotspots);
  // While editing, the Artwork shows the draft; otherwise the saved version.
  const displayedWork: Work = editMode
    ? { ...work, hotspots: draftHotspots }
    : work;

  const enterEdit = () => {
    setDraftHotspots(work.hotspots);
    setEditMode(true);
    setShowHotspots(true);
    setFocusedSpot(null);
    setSaveErr(null);
  };

  const cancelEdit = () => {
    setEditMode(false);
    setDraftHotspots(work.hotspots);
    setFocusedSpot(null);
    setSaveErr(null);
  };

  const save = async () => {
    if (!onSaveHotspots) return;
    setSaving(true);
    setSaveErr(null);
    try {
      await onSaveHotspots(draftHotspots);
      setEditMode(false);
      setFocusedSpot(null);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const updateFocusedHotspot = (patch: Partial<Hotspot>) => {
    if (focusedSpot == null) return;
    setDraftHotspots((arr) => arr.map((h, i) => (i === focusedSpot ? { ...h, ...patch } : h)));
  };

  const deleteFocusedHotspot = () => {
    if (focusedSpot == null) return;
    setDraftHotspots((arr) => arr.filter((_, i) => i !== focusedSpot));
    setFocusedSpot(null);
  };

  return (
    <div className="gallery-wrap">
      <header className="gallery-head">
        <div>
          <div className="lead">
            {mode === 'past' ? 'Archive · 回看' : 'Today · 今日观摩'}
          </div>
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
            work={displayedWork}
            showHotspots={showHotspots}
            focusedSpot={focusedSpot}
            onSpotClick={setFocusedSpot}
            editMode={editMode}
            onHotspotsChange={(next) => setDraftHotspots(next)}
          />
          <div className="floor" />
          <div className="stage-caption">
            <div className="hint" style={editMode ? { flex: 1 } : undefined}>
              {editMode ? (
                focusedSpot != null && displayedWork.hotspots[focusedSpot] ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <input
                      style={{ ...FIELD, fontSize: 14, color: 'var(--gold)', fontStyle: 'italic' }}
                      value={displayedWork.hotspots[focusedSpot].label}
                      placeholder="看点名称"
                      onChange={(e) => updateFocusedHotspot({ label: e.target.value })}
                    />
                    <textarea
                      style={{ ...FIELD, minHeight: 36, color: 'var(--ink-2)', resize: 'vertical' }}
                      value={displayedWork.hotspots[focusedSpot].detail}
                      placeholder="说明"
                      onChange={(e) => updateFocusedHotspot({ detail: e.target.value })}
                    />
                  </div>
                ) : (
                  <span style={{ color: 'var(--ink-4)' }}>
                    拖动黄点改位置 · 点画面空白处加一个新点 · 点已有点编辑文字
                  </span>
                )
              ) : focusedSpot != null ? (
                work.hotspots[focusedSpot].detail
              ) : (
                '试着点击画面上发亮的圆点 — 策展人为你指出三处看点'
              )}
              {saveErr && (
                <div style={{ color: '#c97a55', fontSize: 12, marginTop: 8 }}>{saveErr}</div>
              )}
            </div>
            <div className="controls">
              {editMode ? (
                <>
                  {focusedSpot != null && (
                    <button onClick={deleteFocusedHotspot}>删除此点</button>
                  )}
                  <button onClick={cancelEdit} disabled={saving}>
                    取消
                  </button>
                  <button className="on" onClick={save} disabled={saving}>
                    {saving ? '保存中…' : '保存'}
                  </button>
                </>
              ) : (
                <>
                  <button className={showHotspots ? 'on' : ''} onClick={() => setShowHotspots((s) => !s)}>
                    {showHotspots ? '·  看点已开  ·' : '看点'}
                  </button>
                  <button onClick={onOpenViewer}>放大细看</button>
                  {canEdit && <button onClick={enterEdit}>调看点</button>}
                </>
              )}
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
        {mode === 'past' ? (
          <>
            <div className="arrow">← Back</div>
            <h3>回到今日展厅</h3>
            <p>这间展厅你随时可以再回来。今日的画，仍然挂在它的位置。</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              {onBackToToday && (
                <button className="btn-primary" onClick={onBackToToday}>
                  回到今日展厅 →
                </button>
              )}
              {pastCount > 0 && (
                <button className="btn-ghost" onClick={onGoArchive}>
                  回馆藏挑别的
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="arrow">↓ Next room</div>
            <h3>明日 · 第 {nextRoomLabel(work.no)} 间展厅</h3>
            <p>每天一幅。第二天的灯亮起前，你可以继续坐在这间展厅里，反复看，反复写。</p>
            {pastCount > 0 ? (
              <button className="btn-ghost" onClick={onGoArchive}>
                走进馆藏，看你过去的 {pastCount} 间展厅 →
              </button>
            ) : (
              <div style={{ color: 'var(--ink-4)', fontSize: 12.5, fontStyle: 'italic', fontFamily: 'var(--display)' }}>
                ——这是你的第一间展厅——
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
