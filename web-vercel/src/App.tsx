import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useSearchParams } from 'react-router-dom';
import { Signage } from './components/Signage';
import { Viewer } from './components/Viewer';
import { TweaksPanel, TweakSection, TweakSlider, TweakRadio, TweakToggle } from './components/TweaksPanel';
import { RequireAuth } from './components/AuthGate';
import { LoginPage } from './pages/LoginPage';
import { TodayPage } from './pages/TodayPage';
import { ArchivePage } from './pages/ArchivePage';
import { JournalPage } from './pages/JournalPage';
import { AdminNewWorkPage } from './pages/AdminNewWorkPage';
import { WorkDetailPage } from './pages/WorkDetailPage';
import { TweaksProvider, useTweaks } from './hooks/useTweaks';
import {
  useTodayWork,
  useArchive,
  useJournal,
  saveNotebookEntry,
  useNotebookEntry,
  usePinState,
} from './hooks/useGallery';
import { saveHotspots } from './lib/saveHotspots';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { useSession } from './hooks/useSession';
import type { Session } from '@supabase/supabase-js';
import type { Work } from './lib/types';

const NARRATOR_VOICES = ['清·克制', '专业·锐利', '诗意·散文'];
const FRAME_OPTIONS: Array<'mat' | 'thin' | 'none'> = ['mat', 'thin', 'none'];

// Single-source-of-truth admin email (matched against logged-in user). Public
// — it's just an email, not a secret. The actual permission check happens
// server-side in /api/save-hotspots; this flag only controls whether the UI
// affordance shows.
const ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL as string | undefined)?.toLowerCase();

function formatDate(d: Date) {
  return `${d.getFullYear()} · ${String(d.getMonth() + 1).padStart(2, '0')} · ${String(d.getDate()).padStart(2, '0')}`;
}

/** UI gate for the "调看点" button. The real auth happens server-side. */
function canEditHotspots(session: Session | null, work: Work): boolean {
  if (!session?.user) return false;
  // Own work → always editable
  if (work.ownerId && work.ownerId === session.user.id) return true;
  // Global work → only admin
  if (work.ownerId == null && ADMIN_EMAIL && session.user.email?.toLowerCase() === ADMIN_EMAIL) {
    return true;
  }
  return false;
}

function MuseumShell() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') ?? 'today';
  const setTab = (next: string) => {
    if (next === 'today') {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ tab: next }, { replace: true });
    }
  };
  const [viewerOpen, setViewerOpen] = useState(false);
  const [tweaks] = useTweaks();
  const today = useTodayWork();
  const archive = useArchive();
  const journal = useJournal();
  const nav = useNavigate();

  const todayWork = today.data;
  const archiveWorks = archive.data ?? [];
  const journalData = journal.data;
  const notebookEntry = useNotebookEntry(todayWork?.id);
  const pin = usePinState(todayWork?.id);

  const { configured, session } = useSession();

  return (
    <div className="museum">
      <Signage
        tab={tab}
        onTab={setTab}
        room={todayWork?.room ?? '— 暂未开馆 —'}
        visitorNo={todayWork?.no ?? '000'}
        date={formatDate(new Date())}
        onNewWork={configured && session ? () => nav('/new') : undefined}
        onLogout={
          configured && session
            ? async () => {
                await supabase.auth.signOut();
              }
            : undefined
        }
        onLogin={configured && !session ? () => nav('/login?returnTo=/') : undefined}
      />

      {tab === 'today' && (todayWork ? (
        <TodayPage
          work={todayWork}
          tweaks={tweaks}
          onOpenViewer={() => setViewerOpen(true)}
          onGoArchive={() => setTab('archive')}
          pastCount={Math.max(0, archiveWorks.length - (todayWork ? 1 : 0))}
          onSaveNotebook={
            todayWork.id
              ? session
                ? (answers) => saveNotebookEntry(todayWork.id!, answers, todayWork.vocabulary)
                : () => nav('/login?returnTo=/')
              : undefined
          }
          notebookInitial={notebookEntry}
          onNotebookSaved={notebookEntry.reload}
          pinned={pin.pinned}
          onTogglePin={
            todayWork.id
              ? session
                ? async () => {
                    await pin.toggle();
                    archive.refresh();
                  }
                : () => nav('/login?returnTo=/')
              : undefined
          }
          onSaveHotspots={
            todayWork.id && canEditHotspots(session, todayWork)
              ? async (hs) => {
                  await saveHotspots(todayWork.id!, hs);
                  today.refresh();
                }
              : undefined
          }
        />
      ) : (
        <EmptyToday loading={today.loading} error={today.error} onAddWork={() => nav('/new')} />
      ))}
      {tab === 'archive' && (
        <ArchivePage
          works={archiveWorks}
          onOpen={(w) => {
            if (w.id) nav(`/work/${w.id}`);
          }}
          stats={{
            visited: archiveWorks.length,
            pinned: archiveWorks.filter((w) => w.pinned).length,
            vocabulary: journalData?.constellation.length ?? 0,
          }}
        />
      )}
      {tab === 'journal' && journalData && (
        <JournalPage
          works={journalData.works}
          constellation={journalData.constellation}
          patterns={journalData.patterns}
        />
      )}

      {viewerOpen && todayWork && <Viewer work={todayWork} onClose={() => setViewerOpen(false)} />}
    </div>
  );
}

function EmptyToday({
  loading,
  error,
  onAddWork,
}: {
  loading: boolean;
  error: string | null;
  onAddWork: () => void;
}) {
  return (
    <div
      className="gallery-wrap"
      style={{ display: 'grid', placeItems: 'center', minHeight: 480, textAlign: 'center' }}
    >
      <div>
        <div
          style={{
            fontFamily: 'var(--display)',
            fontStyle: 'italic',
            color: 'var(--gold)',
            letterSpacing: '0.32em',
            textTransform: 'uppercase',
            fontSize: 12,
            marginBottom: 14,
          }}
        >
          Empty room · 空展厅
        </div>
        <h1
          style={{
            fontFamily: 'var(--serif)',
            fontWeight: 300,
            fontSize: 36,
            margin: '0 0 14px',
            letterSpacing: '0.04em',
          }}
        >
          {loading ? '正在开灯…' : error ? '加载失败' : '今天还没有作品'}
        </h1>
        {!loading && (
          <>
            <p
              style={{
                color: 'var(--ink-3)',
                fontFamily: 'var(--serif)',
                maxWidth: 420,
                margin: '0 auto 24px',
              }}
            >
              {error ?? '加一幅画进来——上传图片、写下你的看点和导览，今日展厅就开张了。'}
            </p>
            <button className="btn-primary" onClick={onAddWork}>
              录入今日作品
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function AppTweaks() {
  const [tweaks, setTweak] = useTweaks();
  return (
    <TweaksPanel title="Tweaks · 展厅设置">
      <TweakSection label="策展人" />
      <TweakRadio
        label="语气"
        value={tweaks.narratorVoice}
        options={NARRATOR_VOICES}
        onChange={(v) => setTweak('narratorVoice', v)}
      />
      <TweakSection label="展厅" />
      <TweakSlider
        label="聚光强度"
        value={tweaks.spotlight}
        min={20}
        max={100}
        unit="%"
        onChange={(v) => setTweak('spotlight', v)}
      />
      <TweakSlider
        label="文字大小"
        value={tweaks.textScale}
        min={85}
        max={120}
        unit="%"
        onChange={(v) => setTweak('textScale', v)}
      />
      <TweakRadio
        label="画框"
        value={tweaks.frame}
        options={FRAME_OPTIONS}
        onChange={(v) => setTweak('frame', v)}
      />
      <TweakToggle
        label="默认显示看点"
        value={tweaks.showHotspotsByDefault}
        onChange={(v) => setTweak('showHotspotsByDefault', v)}
      />
    </TweaksPanel>
  );
}

/**
 * Applies Tweaks values to global CSS variables on every change. Lives INSIDE
 * <TweaksProvider> so it can consume the shared state. Rendered once so the
 * styles apply on every route (today / new / work/:id).
 */
function TweaksSideEffects() {
  const [tweaks] = useTweaks();
  useEffect(() => {
    const root = document.documentElement;
    const spot = Math.max(0.2, tweaks.spotlight / 100);
    root.style.setProperty('--spot', String(spot));
    root.style.fontSize = `${14 * (tweaks.textScale / 100)}px`;
    root.classList.toggle('frame-none', tweaks.frame === 'none');
    root.classList.toggle('frame-thin', tweaks.frame === 'thin');
  }, [tweaks]);
  return null;
}

export default function App() {
  // Suppress the supabase-not-configured noise from blocking the dev experience.
  void isSupabaseConfigured;

  return (
    <TweaksProvider>
      <TweaksSideEffects />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MuseumShell />} />
          <Route path="/work/:id" element={<WorkDetailPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/new"
            element={
              <RequireAuth>
                <AdminNewWorkPage />
              </RequireAuth>
            }
          />
        </Routes>
        <AppTweaks />
      </BrowserRouter>
    </TweaksProvider>
  );
}
