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
  const w = works[0];

  const [hot, lines, qs, vocab] = await Promise.all([
    supabase.from('hotspots').select('*').eq('work_id', w.id).order('order_index'),
    supabase.from('audio_lines').select('*').eq('work_id', w.id).order('order_index'),
    supabase.from('questions').select('*').eq('work_id', w.id).order('order_index'),
    supabase.from('vocabulary').select('*').eq('work_id', w.id),
  ]);

  const duration =
    (lines.data?.[lines.data.length - 1]?.t ?? 0) + 18;

  return {
    id: w.id,
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
    image: publicImageUrl(w.image_path),
    hotspots: (hot.data ?? []).map((h) => ({
      x: Number(h.x),
      y: Number(h.y),
      label: h.label,
      detail: h.detail,
    })),
    audioGuide: {
      duration,
      lines: (lines.data ?? []).map((l) => ({ t: l.t, text: l.text })),
    },
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
  const { data, error } = await supabase
    .from('works')
    .select('id, no, exhibited_on, title, artist, image_path, pinned, short_label')
    .order('exhibited_on', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((w, i) => {
    const d = new Date(w.exhibited_on);
    return {
      no: w.no,
      date: `${d.getMonth() + 1}月${d.getDate()}日`,
      title: w.title,
      artist: w.artist,
      img: publicImageUrl(w.image_path),
      span: [3, 4, 3, 5, 2, 4, 3, 5, 2, 3, 4][i % 11],
      pinned: !!w.pinned,
      keywords: [],
      reflection: w.short_label ?? '',
    } as ArchiveWork;
  });
}

export function useArchive(): LoadState<ArchiveWork[]> {
  const [state, setState] = useState<LoadState<ArchiveWork[]>>({
    data: isSupabaseConfigured ? null : PAST_WORKS,
    loading: isSupabaseConfigured,
    error: null,
  });

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    fetchArchive()
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((err: Error) => setState({ data: null, loading: false, error: err.message }));
  }, []);

  return state;
}

type JournalData = {
  works: ArchiveWork[];
  constellation: ConstellationWord[];
  patterns: Pattern[];
};

async function fetchJournal(): Promise<JournalData> {
  const [archive, conRes] = await Promise.all([
    fetchArchive(),
    supabase.from('v_user_constellation').select('*').order('count', { ascending: false }),
  ]);
  const constellation: ConstellationWord[] = (conRes.data ?? []).map((row) => ({
    w: row.keyword,
    count: row.count,
    from: row.last_used_at
      ? new Date(row.last_used_at).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
      : '',
    isNew: !!row.is_new,
  }));
  // Patterns are heuristic for now: take top 3 keywords, build a sentence.
  const patterns: Pattern[] = constellation.slice(0, 3).map((c) => ({
    title: `"${c.w}"出现 ${c.count} 次`,
    freq: c.count >= 5 ? '高频' : '稳步上升',
    desc: `你在多次记录里反复使用了"${c.w}"。这是你正在形成的一个判断维度。`,
    from: c.from,
  }));
  return { works: archive, constellation, patterns };
}

export function useJournal(): LoadState<JournalData> {
  const [state, setState] = useState<LoadState<JournalData>>({
    data: isSupabaseConfigured
      ? null
      : { works: PAST_WORKS, constellation: CONSTELLATION, patterns: PATTERNS },
    loading: isSupabaseConfigured,
    error: null,
  });

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    fetchJournal()
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((err: Error) => setState({ data: null, loading: false, error: err.message }));
  }, []);

  return state;
}

export async function saveNotebookEntry(workId: string, answers: { chip: string; text: string }[]) {
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
