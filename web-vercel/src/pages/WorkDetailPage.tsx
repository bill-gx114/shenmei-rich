import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TodayPage } from './TodayPage';
import { Viewer } from '../components/Viewer';
import { useWorkById, saveNotebookEntry, useArchive, useNotebookEntry } from '../hooks/useGallery';
import { useTweaks } from '../hooks/useTweaks';
import { useSession } from '../hooks/useSession';
import { saveHotspots } from '../lib/saveHotspots';
import type { Work } from '../lib/types';

const ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL as string | undefined)?.toLowerCase();

function canEditHotspots(
  userId: string | undefined,
  userEmail: string | undefined,
  work: Work | null,
): boolean {
  if (!userId || !work) return false;
  if (work.ownerId === userId) return true;
  if (work.ownerId == null && ADMIN_EMAIL && userEmail?.toLowerCase() === ADMIN_EMAIL) return true;
  return false;
}

export function WorkDetailPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { data: work, loading, error, refresh } = useWorkById(id);
  const archive = useArchive();
  const [tweaks] = useTweaks();
  const [viewerOpen, setViewerOpen] = useState(false);
  const { session } = useSession();

  if (loading) {
    return (
      <div
        className="gallery-wrap"
        style={{ display: 'grid', placeItems: 'center', minHeight: 400, color: 'var(--ink-3)' }}
      >
        <div style={{ fontFamily: 'var(--display)', fontStyle: 'italic', letterSpacing: '0.3em' }}>
          —— 正在开灯 ——
        </div>
      </div>
    );
  }

  if (error || !work) {
    return (
      <div
        className="gallery-wrap"
        style={{ display: 'grid', placeItems: 'center', minHeight: 400, textAlign: 'center' }}
      >
        <div>
          <h1
            style={{
              fontFamily: 'var(--serif)',
              fontWeight: 300,
              fontSize: 32,
              margin: '0 0 14px',
              letterSpacing: '0.04em',
            }}
          >
            找不到这间展厅
          </h1>
          <p style={{ color: 'var(--ink-3)', marginBottom: 18 }}>
            {error ?? '这幅作品可能已被收走，或者链接打错了。'}
          </p>
          <button className="btn-primary" onClick={() => nav('/')}>
            回到今日展厅
          </button>
        </div>
      </div>
    );
  }

  const archiveWorks = archive.data ?? [];
  const pastCount = Math.max(0, archiveWorks.length - 1);

  const editable = canEditHotspots(session?.user.id, session?.user.email ?? undefined, work);
  const notebookEntry = useNotebookEntry(work.id);

  return (
    <>
      <TodayPage
        work={work}
        tweaks={tweaks}
        mode="past"
        pastCount={pastCount}
        onOpenViewer={() => setViewerOpen(true)}
        onGoArchive={() => nav('/?tab=archive')}
        onBackToToday={() => nav('/')}
        notebookInitial={notebookEntry}
        onNotebookSaved={notebookEntry.reload}
        onSaveNotebook={
          work.id ? (answers) => saveNotebookEntry(work.id!, answers, work.vocabulary) : undefined
        }
        onSaveHotspots={
          work.id && editable
            ? async (hs) => {
                await saveHotspots(work.id!, hs);
                refresh();
              }
            : undefined
        }
      />
      {viewerOpen && <Viewer work={work} onClose={() => setViewerOpen(false)} />}
    </>
  );
}
