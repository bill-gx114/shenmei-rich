import { useCallback, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type {
  ArchiveWork,
  ConstellationWord,
  Pattern,
  RoamPlace,
  Work,
  WordSource,
} from '../lib/types';
import { CONSTELLATION, PAST_WORKS, PATTERNS, TODAY_WORK } from '../lib/mock';
import { track } from '../lib/track';

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
    sourceUrl: w.source_url ?? null,
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

async function queryTodayWork(): Promise<Work | null> {
  // Prefer the user's own work for today; fall back to the global daily work
  // published by the cron. RLS already filters to (mine | global), so we just
  // need to order so that NULL owner_id (= global) comes last.
  const { data: works, error } = await supabase
    .from('works')
    .select('*')
    .eq('exhibited_on', todayISO())
    .eq('kind', 'daily')
    .order('owner_id', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  if (!works || !works.length) return null;
  return hydrateWork(works[0]);
}

// Self-heal: only one trigger per page load, so concurrent visitors / re-renders
// don't fire the (idempotent, but slow) generator repeatedly.
let selfHealAttempted = false;
let audioHealAttempted = false;

/** True when a work has no audio script in any voice. */
function audioEmpty(w: Work): boolean {
  const variants = w.audioGuide?.variants ?? {};
  return Object.values(variants).every((arr) => !arr || arr.length === 0);
}

async function fetchTodayWork(): Promise<Work | null> {
  const existing = await queryTodayWork();
  if (existing) {
    // The daily generator occasionally drops the (heavy) audio step while the
    // rest of the pack lands. The missing-work self-heal below won't catch this
    // (the work exists), so trigger the idempotent backfill — fire-and-forget so
    // we don't block this render; everyone after the first viewer gets audio.
    if (!existing.ownerId && audioEmpty(existing) && !audioHealAttempted) {
      audioHealAttempted = true;
      void fetch('/api/daily-curator?backfill=1').catch(() => {});
    }
    return existing;
  }

  // No work for today. The daily cron (Vercel Hobby tier) doesn't guarantee
  // exact timing and can occasionally be skipped, so we lazily trigger the
  // generator on first read. /api/daily-curator is idempotent — if today's
  // work already exists it returns early — so this is safe to call.
  if (selfHealAttempted) return null;
  selfHealAttempted = true;
  try {
    const r = await fetch('/api/daily-curator', { method: 'GET' });
    if (!r.ok) return null;
    // Generation finished (or was already done) — re-query once.
    return await queryTodayWork();
  } catch {
    return null;
  }
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

type ArchiveRow = {
  id: string;
  no: string;
  exhibited_on: string;
  title: string;
  artist: string;
  image_path: string | null;
  short_label: string | null;
  region: 'east' | 'west' | null;
  kind?: string | null;
  category?: string | null;
  location?: string | null;
};

async function fetchArchive(): Promise<ArchiveWork[]> {
  const [worksRes, pinsRes] = await Promise.all([
    // The archive timeline is the daily exhibition only — roam landmarks are
    // not part of the 365-day calendar, so they don't flood it here.
    supabase
      .from('works')
      .select('id, no, exhibited_on, title, artist, image_path, short_label, region')
      .eq('kind', 'daily')
      // Season works are pre-seeded with FUTURE dates; never reveal them early.
      .lte('exhibited_on', todayISO())
      .order('exhibited_on', { ascending: false }),
    supabase.from('user_pins').select('work_id'),
  ]);
  if (worksRes.error) throw worksRes.error;
  const pinnedSet = new Set((pinsRes.data ?? []).map((r) => r.work_id as string));

  // …but a roam landmark you've COLLECTED should appear in 馆藏. Fetch just the
  // pinned roam works and fold them in (marked pinned, tagged by category).
  let pinnedRoam: ArchiveRow[] = [];
  if (pinnedSet.size) {
    const { data } = await supabase
      .from('works')
      .select('id, no, exhibited_on, title, artist, image_path, short_label, region, category, location')
      .eq('kind', 'roam')
      .in('id', [...pinnedSet]);
    pinnedRoam = (data ?? []) as ArchiveRow[];
  }

  const all: ArchiveRow[] = [...((worksRes.data ?? []) as ArchiveRow[]), ...pinnedRoam];
  return all.map((w, i) => {
    const isRoam = pinnedRoam.some((r) => r.id === w.id);
    const d = new Date(w.exhibited_on);
    return {
      id: w.id,
      no: w.no,
      exhibitedOn: w.exhibited_on,
      date: isRoam ? `漫游 · ${w.location ?? ''}` : `${d.getMonth() + 1}月${d.getDate()}日`,
      title: w.title,
      artist: w.artist,
      img: publicImageUrl(w.image_path),
      span: [3, 4, 3, 5, 2, 4, 3, 5, 2, 3, 4][i % 11],
      pinned: pinnedSet.has(w.id),
      keywords: [],
      reflection: w.short_label ?? '',
      region: (w.region as 'east' | 'west' | null) ?? null,
      roam: isRoam,
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

// ── 全球漫游 (Global Roaming) ───────────────────────────────────────────────

// The globe shows BOTH curated roam landmarks (base layer) AND daily works that
// have coordinates (your journey layer) — Model C. roam works always have
// lat/lng; daily works only after the coords backfill, so `.not('lat','is',null)`
// naturally includes all roam + only the located daily works.
async function fetchRoamPlaces(): Promise<RoamPlace[]> {
  const today = todayISO();
  // Two queries so future works NEVER leak their content over the network:
  //  • revealed (roam + daily ≤ today): full content.
  //  • locked (daily > today): coordinates + reveal date ONLY — shown as a dim
  //    "待开放" dot. (roam uses a 2000-01-01 sentinel so it's always revealed.)
  const [revealedRes, lockedRes] = await Promise.all([
    supabase
      .from('works')
      .select(
        'id, no, title, artist, artist_romaji, year, category, location, room, lat, lng, image_path, short_label, curator_note, source_url, kind, exhibited_on, hotspots(label, detail, order_index)',
      )
      .in('kind', ['roam', 'daily'])
      .not('lat', 'is', null)
      .lte('exhibited_on', today)
      .order('no', { ascending: true }),
    supabase
      .from('works')
      .select('id, no, lat, lng, exhibited_on')
      .eq('kind', 'daily')
      .not('lat', 'is', null)
      .gt('exhibited_on', today),
  ]);
  const { data, error } = revealedRes;
  if (error) throw error;
  if (lockedRes.error) throw lockedRes.error;
  const locked: RoamPlace[] = (
    (lockedRes.data ?? []) as Array<{ id: string; no: string; lat: number | string; lng: number | string; exhibited_on: string }>
  )
    .map((w) => ({
      id: w.id,
      no: w.no,
      title: '',
      titleEn: '',
      artist: '',
      year: '',
      category: '',
      place: '',
      lat: Number(w.lat),
      lng: Number(w.lng),
      image: '',
      shortLabel: '',
      curatorNote: '',
      points: [],
      kind: 'daily' as const,
      exhibitedOn: w.exhibited_on ?? undefined,
      locked: true,
    }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  type Row = {
    id: string;
    no: string;
    title: string;
    artist: string;
    artist_romaji: string | null;
    year: string | null;
    category: string | null;
    location: string | null;
    room: string | null;
    lat: number | string | null;
    lng: number | string | null;
    image_path: string | null;
    short_label: string | null;
    curator_note: string | null;
    source_url: string | null;
    kind: 'roam' | 'daily' | null;
    exhibited_on: string | null;
    hotspots: Array<{ label: string; detail: string; order_index: number }> | null;
  };
  const revealed = ((data ?? []) as Row[])
    .map((w) => ({
      id: w.id,
      no: w.no,
      title: w.title,
      titleEn: w.artist_romaji ?? '',
      artist: w.artist,
      year: w.year ?? '',
      category: w.category ?? '',
      // roam stores "国家 · 馆" in location; daily stores its museum in location
      // and a "今日展厅" room — prefer location, fall back to room.
      place: w.location || w.room || '',
      lat: Number(w.lat),
      lng: Number(w.lng),
      image: publicImageUrl(w.image_path),
      shortLabel: w.short_label ?? '',
      curatorNote: w.curator_note ?? '',
      points: (w.hotspots ?? [])
        .slice()
        .sort((a, b) => a.order_index - b.order_index)
        .map((h) => ({ label: h.label, detail: h.detail })),
      sourceUrl: w.source_url ?? undefined,
      kind: (w.kind ?? 'daily') as 'roam' | 'daily',
      exhibitedOn: w.exhibited_on ?? undefined,
      locked: false,
    }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  return [...revealed, ...locked];
}

export function useRoamPlaces(): LoadState<RoamPlace[]> & { refresh: () => void } {
  const [state, setState] = useState<LoadState<RoamPlace[]>>({
    data: null,
    loading: isSupabaseConfigured,
    error: null,
  });
  const load = useCallback(() => {
    if (!isSupabaseConfigured) {
      setState({ data: [], loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    fetchRoamPlaces()
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((err: Error) => setState({ data: null, loading: false, error: err.message }));
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return { ...state, refresh: load };
}

/** The set of work ids this user has collected (pinned) — for bulk UIs. */
export async function fetchPinnedWorkIds(): Promise<Set<string>> {
  if (!isSupabaseConfigured) return new Set();
  const { data } = await supabase.from('user_pins').select('work_id');
  return new Set((data ?? []).map((r) => r.work_id as string));
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

/**
 * Compute consecutive-day streak ending today or yesterday.
 *
 * Input is the list of `exhibited_on` (the date the work was on display),
 * not `saved_at` (when the user last clicked Save). Reason: notebook_entries
 * is upserted by (owner_id, work_id), so re-editing an old day's answers
 * moves saved_at forward — using saved_at would silently erase that day from
 * the streak. exhibited_on is stable: "you observed the work shown on day X."
 */
function computeStreak(exhibitedOnList: Array<string | null | undefined>): number {
  const days = new Set<string>();
  for (const iso of exhibitedOnList) {
    if (!iso) continue;
    // exhibited_on is stored as 'YYYY-MM-DD' — use directly, no Date parsing
    // (which would re-introduce timezone shifts).
    days.add(iso.slice(0, 10));
  }
  if (!days.size) return 0;
  const dayKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
  const [conRes, entriesRes, usesRes, vocabRes] = await Promise.all([
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
    // Every keyword hit this user logged, with the artwork it came from — so
    // each dictionary word can link back to the paintings where you used it.
    supabase
      .from('keyword_uses')
      .select('keyword, work_id, works(no, title, image_path, exhibited_on)')
      .eq('owner_id', user.id),
    // Curator definitions. vocabulary is per-work; we fold it into a word→note
    // map so a dictionary entry can show what the term actually means.
    supabase.from('vocabulary').select('word, note'),
  ]);

  // word → curator definition (first non-empty wins).
  const noteByWord = new Map<string, string>();
  for (const v of (vocabRes.data ?? []) as Array<{ word: string; note: string | null }>) {
    if (v.word && v.note && !noteByWord.has(v.word)) noteByWord.set(v.word, v.note);
  }

  // word → list of source artworks (deduped by work).
  type UseRow = {
    keyword: string;
    work_id: string;
    works: { no: string; title: string; image_path: string | null; exhibited_on: string } | Array<{ no: string; title: string; image_path: string | null; exhibited_on: string }> | null;
  };
  const sourcesByWord = new Map<string, WordSource[]>();
  for (const u of (usesRes.data ?? []) as UseRow[]) {
    const wRaw = u.works;
    const w = Array.isArray(wRaw) ? wRaw[0] : wRaw;
    if (!w) continue;
    const list = sourcesByWord.get(u.keyword) ?? [];
    if (list.some((s) => s.workId === u.work_id)) continue;
    const d = new Date(w.exhibited_on);
    list.push({
      workId: u.work_id,
      no: w.no,
      title: w.title,
      img: publicImageUrl(w.image_path),
      date: `${d.getMonth() + 1}月${d.getDate()}日`,
    });
    sourcesByWord.set(u.keyword, list);
  }

  const constellation: ConstellationWord[] = (conRes.data ?? []).map((row) => ({
    w: row.keyword,
    count: row.count,
    from: row.last_used_at
      ? new Date(row.last_used_at).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
      : '',
    isNew: !!row.is_new,
    note: noteByWord.get(row.keyword),
    sources: sourcesByWord.get(row.keyword) ?? [],
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

  const streak = computeStreak(
    entries.map((e) => {
      const wRaw = (e as { works: unknown }).works;
      const w = (Array.isArray(wRaw) ? wRaw[0] : wRaw) as { exhibited_on?: string } | null;
      return w?.exhibited_on;
    }),
  );

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

  // Which of the three questions got a real answer (chip or free text) — lets
  // us see which questions are skipped, and the conversion to a saved entry.
  const answeredFlags = answers.map((a) => Boolean((a.chip && a.chip.trim()) || (a.text && a.text.trim())));
  track('notebook_save', {
    workId,
    total: answers.length,
    answered: answeredFlags.filter(Boolean).length,
    answeredIndices: answeredFlags.map((ok, i) => (ok ? i : -1)).filter((i) => i >= 0),
    keywords,
  });
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
