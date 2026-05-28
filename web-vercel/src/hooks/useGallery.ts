import { useCallback, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type {
  ArchiveWork,
  ConstellationWord,
  Pattern,
  Work,
} from '../lib/types';
import { CONSTELLATION, PAST_WORKS, PATTERNS, TODAY_WORK } from '../lib/mock';

type LoadState<T> = { data: T | null; loading: boolean; error: string | null };

function todayISO() {
  // Use the browser's local timezone, not UTC — otherwise Chinese users in
  // the morning hit UTC's "yesterday" and the daily exhibit (stored with
  // Beijing date) doesn't match.
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function publicImageUrl(imagePath: string | null): string {
  if (!imagePath) return '';
  if (imagePath.startsWith('http')) return imagePath;
  const { data } = supabase.storage.from('works').getPublicUrl(imagePath);
  return data.publicUrl;
}

/** Given a `works` row, fetch all its child rows and assemble a full Work. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function hydrateWork(w: any): Promise<Work> {
  const [hot, lines, qs, vocab] = await Promise.all([
    supabase.from('hotspots').select('*').eq('work_id', w.id).order('order_index'),
    supabase.from('audio_lines').select('*').eq('work_id', w.id).order('voice').order('order_index'),
    supabase.from('questions').select('*').eq('work_id', w.id).order('order_index'),
    supabase.from('vocabulary').select('*').eq('work_id', w.id),
  ]);

  const variants: Record<string, Array<{ t: number; text: string }>> = {};
  for (const l of lines.data ?? []) {
    const v = (l.voice as string) || '清·克制';
    if (!variants[v]) variants[v] = [];
    variants[v].push({ t: l.t, text: l.text });
  }
  let lastT = 0;
  for (const arr of Object.values(variants)) {
    const t = arr[arr.length - 1]?.t ?? 0;
    if (t > lastT) lastT = t;
  }
  const duration = lastT + 18;

  return {
    id: w.id,
    ownerId: w.owner_id,
    no: w.no,
    total: w.total ?? 365,
    title: w.title,
    artist: w.artist,
    artistRomaji: w.artist_romaji ?? '',
    year: w.year ?? '',
    medium: w.medium ?? '',
    size: w.size ?? '',
    series: w.series ?? '',
    location: w.location ?? '',
    room: w.room ?? '',
    shortLabel: w.short_label ?? '',
    curatorNote: w.curator_note ?? null,
    image: publicImageUrl(w.image_path),
    hotspots: (hot.data ?? []).map((h) => ({
      x: Number(h.x),
      y: Number(h.y),
      label: h.label,
      detail: h.detail,
    })),
    audioGuide: { duration, variants },
    questions: (qs.data ?? []).map((q) => ({
      q: q.q,
      hint: q.hint ?? '',
      options: q.options ?? [],
    })),
    vocabulary: (vocab.data ?? []).map((v) => ({
      word: v.word,
      note: v.note ?? '',
      isNew: !!v.is_new,
    })),
  };
}

async function fetchTodayWork(): Promise<Work | null> {
  // Prefer the user's own work for today; fall back to the global daily work
  // published by the cron. RLS already filters to (mine | global), so we just
  // need to order so that NULL owner_id (= global) comes last.
  const { data: works, error } = await supabase
    .from('works')
    .select('*')
    .eq('exhibited_on', todayISO())
    .order('owner_id', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  if (!works || !works.length) return null;
  return hydrateWork(works[0]);
}

async function fetchWorkById(id: string): Promise<Work | null> {
  const { data: w, error } = await supabase.from('works').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!w) return null;
  return hydrateWork(w);
}

export function useWorkById(id: string | undefined): LoadState<Work> & { refresh: () => void } {
  const [state, setState] = useState<LoadState<Work>>({
    data: null,
    loading: Boolean(id) && isSupabaseConfigured,
    error: null,
  });

  const load = useCallback(() => {
    if (!isSupabaseConfigured || !id) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    fetchWorkById(id)
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((err: Error) => setState({ data: null, loading: false, error: err.message }));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, refresh: load };
}

export function useTodayWork(): LoadState<Work> & { refresh: () => void } {
  const [state, setState] = useState<LoadState<Work>>({
    data: isSupabaseConfigured ? null : TODAY_WORK,
    loading: isSupabaseConfigured,
    error: null,
  });

  const load = useCallback(() => {
    if (!isSupabaseConfigured) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    fetchTodayWork()
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((err: Error) => setState({ data: null, loading: false, error: err.message }));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, refresh: load };
}

async function fetchArchive(): Promise<ArchiveWork[]> {
  const [worksRes, pinsRes] = await Promise.all([
    supabase
      .from('works')
      .select('id, no, exhibited_on, title, artist, image_path, short_label, region')
      .order('exhibited_on', { ascending: false }),
    supabase.from('user_pins').select('work_id'),
  ]);
  if (worksRes.error) throw worksRes.error;
  const pinnedSet = new Set((pinsRes.data ?? []).map((r) => r.work_id as string));
  return (worksRes.data ?? []).map((w, i) => {
    const d = new Date(w.exhibited_on);
    return {
      id: w.id,
      no: w.no,
      exhibitedOn: w.exhibited_on,
      date: `${d.getMonth() + 1}月${d.getDate()}日`,
      title: w.title,
      artist: w.artist,
      img: publicImageUrl(w.image_path),
      span: [3, 4, 3, 5, 2, 4, 3, 5, 2, 3, 4][i % 11],
      pinned: pinnedSet.has(w.id),
      keywords: [],
      reflection: w.short_label ?? '',
      region: (w.region as 'east' | 'west' | null) ?? null,
    } as ArchiveWork;
  });
}

export async function isPinned(workId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const { data } = await supabase
    .from('user_pins')
    .select('work_id')
    .eq('work_id', workId)
    .maybeSingle();
  return !!data;
}

export async function togglePin(workId: string, currentlyPinned: boolean): Promise<boolean> {
  if (!isSupabaseConfigured) return currentlyPinned;
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('未登录');
  if (currentlyPinned) {
    const { error } = await supabase
      .from('user_pins')
      .delete()
      .eq('owner_id', user.id)
      .eq('work_id', workId);
    if (error) throw error;
    return false;
  } else {
    const { error } = await supabase
      .from('user_pins')
      .insert({ owner_id: user.id, work_id: workId });
    if (error) throw error;
    return true;
  }
}

/** Reactive pin state for the active work — re-fetches whenever workId changes. */
export function usePinState(workId?: string): {
  pinned: boolean;
  toggle: () => Promise<void>;
} {
  const [pinned, setPinned] = useState(false);
  useEffect(() => {
    if (!workId) {
      setPinned(false);
      return;
    }
    let cancelled = false;
    isPinned(workId).then((p) => {
      if (!cancelled) setPinned(p);
    });
    return () => {
      cancelled = true;
    };
  }, [workId]);
  return {
    pinned,
    toggle: async () => {
      if (!workId) return;
      const next = await togglePin(workId, pinned);
      setPinned(next);
    },
  };
}

export function useArchive(): LoadState<ArchiveWork[]> & { refresh: () => void } {
  const [state, setState] = useState<LoadState<ArchiveWork[]>>({
    data: isSupabaseConfigured ? null : PAST_WORKS,
    loading: isSupabaseConfigured,
    error: null,
  });

  const load = useCallback(() => {
    if (!isSupabaseConfigured) return;
    setState((s) => ({ ...s, loading: true }));
    fetchArchive()
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((err: Error) => setState({ data: null, loading: false, error: err.message }));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, refresh: load };
}

type JournalData = {
  /** Works recently observed by THIS user (joined from notebook_entries). */
  recentEntries: ArchiveWork[];
  constellation: ConstellationWord[];
  patterns: Pattern[];
  stats: {
    /** Longest streak of consecutive days with at least one notebook entry,
     *  ending today or yesterday. */
    streak: number;
    /** Total distinct keywords logged. */
    vocabulary: number;
    /** Total notebook entries (= works the user has answered). */
    notes: number;
    /** Heuristic pattern count (currently = top-N keyword count). */
    patterns: number;
  };
  /** True when the viewer is logged in. Anonymous → page should show CTA. */
  hasUser: boolean;
};

const EMPTY_JOURNAL: JournalData = {
  recentEntries: [],
  constellation: [],
  patterns: [],
  stats: { streak: 0, vocabulary: 0, notes: 0, patterns: 0 },
  hasUser: false,
};

/** Compute consecutive-day streak ending today or yesterday. */
function computeStreak(savedAtList: string[]): number {
  if (!savedAtList.length) return 0;
  const days = new Set<string>();
  for (const ts of savedAtList) {
    const d = new Date(ts);
    days.add(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`);
  }
  // Walk backwards from today; allow a 1-day grace (user might not have done
  // today yet but did yesterday).
  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  const today = new Date();
  let cursor = new Date(today);
  if (!days.has(dayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(dayKey(cursor))) return 0;
  }
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

async function fetchJournal(): Promise<JournalData> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) return EMPTY_JOURNAL;

  // Pull everything user-scoped in parallel. RLS already restricts each table
  // to owner_id = auth.uid(); we still add explicit .eq for defense in depth.
  const [conRes, entriesRes] = await Promise.all([
    supabase
      .from('v_user_constellation')
      .select('*')
      .eq('owner_id', user.id)
      .order('count', { ascending: false }),
    supabase
      .from('notebook_entries')
      .select('saved_at, work_id, answers, works(no, exhibited_on, title, artist, image_path, region, short_label)')
      .eq('owner_id', user.id)
      .order('saved_at', { ascending: false }),
  ]);

  const constellation: ConstellationWord[] = (conRes.data ?? []).map((row) => ({
    w: row.keyword,
    count: row.count,
    from: row.last_used_at
      ? new Date(row.last_used_at).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
      : '',
    isNew: !!row.is_new,
  }));

  const patterns: Pattern[] = constellation.slice(0, 3).map((c) => ({
    title: `"${c.w}"出现 ${c.count} 次`,
    freq: c.count >= 5 ? '高频' : '稳步上升',
    desc: `你在多次记录里反复使用了"${c.w}"。这是你正在形成的一个判断维度。`,
    from: c.from,
  }));

  const entries = entriesRes.data ?? [];
  const recentEntries: ArchiveWork[] = entries.slice(0, 5).map((e, i) => {
    // The Supabase join returns the related row as either an object or array
    // depending on relationship; handle both.
    const wRaw = (e as { works: unknown }).works;
    const w = (Array.isArray(wRaw) ? wRaw[0] : wRaw) as
      | { no: string; exhibited_on: string; title: string; artist: string; image_path: string | null; region: 'east' | 'west' | null; short_label: string | null }
      | null;
    const d = w?.exhibited_on ? new Date(w.exhibited_on) : new Date(e.saved_at);
    // Pull keywords this user used on this work (best-effort; only chips/text
    // we wrote to keyword_uses).
    const ans = (e.answers as Array<{ chip?: string; text?: string }> | null) ?? [];
    const keywords = ans.map((a) => a.chip).filter((x): x is string => !!x);
    return {
      id: e.work_id,
      no: w?.no ?? '—',
      exhibitedOn: w?.exhibited_on,
      date: `${d.getMonth() + 1}月${d.getDate()}日`,
      title: w?.title ?? '（已删除作品）',
      artist: w?.artist ?? '',
      img: publicImageUrl(w?.image_path ?? null),
      span: [3, 4, 3, 5, 2][i % 5],
      pinned: false,
      keywords,
      reflection: w?.short_label ?? '',
      region: w?.region ?? null,
    };
  });

  const streak = computeStreak(entries.map((e) => e.saved_at as string));

  return {
    recentEntries,
    constellation,
    patterns,
    stats: {
      streak,
      vocabulary: constellation.length,
      notes: entries.length,
      patterns: patterns.length,
    },
    hasUser: true,
  };
}

export function useJournal(): LoadState<JournalData> & { refresh: () => void } {
  const [state, setState] = useState<LoadState<JournalData>>({
    data: isSupabaseConfigured
      ? null
      : {
          recentEntries: PAST_WORKS,
          constellation: CONSTELLATION,
          patterns: PATTERNS,
          stats: {
            streak: PAST_WORKS.length,
            vocabulary: CONSTELLATION.length,
            notes: PAST_WORKS.length,
            patterns: PATTERNS.length,
          },
          hasUser: true,
        },
    loading: isSupabaseConfigured,
    error: null,
  });

  const load = useCallback(() => {
    if (!isSupabaseConfigured) return;
    setState((s) => ({ ...s, loading: true }));
    fetchJournal()
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((err: Error) => setState({ data: null, loading: false, error: err.message }));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, refresh: load };
}

/**
 * Extract keyword hits from notebook answers:
 *  - every non-empty chip (the user explicitly picked it)
 *  - every vocabulary word that appears as a substring in any answer text
 * De-duplicated.
 */
function extractKeywords(
  answers: { chip: string; text: string }[],
  vocabulary: { word: string }[],
): string[] {
  const hits = new Set<string>();
  for (const a of answers) {
    if (a.chip && a.chip.trim()) hits.add(a.chip.trim());
  }
  const allText = answers.map((a) => a.text || '').join(' ');
  for (const v of vocabulary) {
    if (v.word && allText.includes(v.word)) hits.add(v.word);
  }
  return [...hits];
}

export async function saveNotebookEntry(
  workId: string,
  answers: { chip: string; text: string }[],
  vocabulary: { word: string }[] = [],
) {
  if (!isSupabaseConfigured) return;
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('未登录');
  const { error } = await supabase.from('notebook_entries').upsert(
    {
      owner_id: user.id,
      work_id: workId,
      answers,
      saved_at: new Date().toISOString(),
    },
    { onConflict: 'owner_id,work_id' },
  );
  if (error) throw error;

  // Replace this user's keyword hits for this work, derived from current answers.
  // We delete first so editing answers (removing a chip) doesn't leave stale rows.
  const keywords = extractKeywords(answers, vocabulary);
  const { error: delErr } = await supabase
    .from('keyword_uses')
    .delete()
    .eq('owner_id', user.id)
    .eq('work_id', workId);
  if (delErr) throw delErr;
  if (keywords.length > 0) {
    const rows = keywords.map((keyword) => ({
      owner_id: user.id,
      work_id: workId,
      keyword,
    }));
    const { error: insErr } = await supabase.from('keyword_uses').insert(rows);
    if (insErr) throw insErr;
  }
}

export async function fetchNotebookEntry(workId: string) {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from('notebook_entries')
    .select('answers, saved_at')
    .eq('work_id', workId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type NotebookEntryState = {
  answers: { chip: string; text: string }[] | null;
  savedAt: string | null;
};

/**
 * Loads this user's notebook entry for the given work so the form can be
 * prefilled when revisiting an already-answered work.
 */
export function useNotebookEntry(workId?: string): NotebookEntryState & { reload: () => void } {
  const [state, setState] = useState<NotebookEntryState>({ answers: null, savedAt: null });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!workId) {
      setState({ answers: null, savedAt: null });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const entry = await fetchNotebookEntry(workId);
        if (cancelled) return;
        if (!entry) {
          setState({ answers: null, savedAt: null });
          return;
        }
        const ans = (entry.answers as { chip: string; text: string }[]) ?? null;
        const savedAt = entry.saved_at
          ? new Date(entry.saved_at).toLocaleDateString('zh-CN', {
              month: 'long',
              day: 'numeric',
            })
          : null;
        setState({ answers: ans, savedAt });
      } catch {
        if (!cancelled) setState({ answers: null, savedAt: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workId, version]);
  return { ...state, reload: () => setVersion((v) => v + 1) };
}
