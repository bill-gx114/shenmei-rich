import { useCallback, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export type MyProfile = {
  handle: string | null;
  displayName: string | null;
  isPublic: boolean;
};

export type PublicProfile = {
  profile: { displayName: string; handle: string };
  stats: { streak: number; notes: number; vocabulary: number; collection: number };
  portrait: string | null;
  tendencies: { title: string; desc: string }[];
  dictionary: { w: string; count: number }[];
  collection: { no: string; title: string; img: string }[];
  cover: string;
};

const EMPTY: MyProfile = { handle: null, displayName: null, isPublic: false };

/** Read + edit the signed-in user's own profile row. */
export function useMyProfile(enabled: boolean): {
  profile: MyProfile;
  loading: boolean;
  save: (patch: Partial<MyProfile>) => Promise<{ ok: boolean; error?: string }>;
  refresh: () => void;
} {
  const [profile, setProfile] = useState<MyProfile>(EMPTY);
  const [loading, setLoading] = useState(enabled);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !enabled) {
      setProfile(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) {
      setProfile(EMPTY);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('profiles')
      .select('handle, display_name, is_public')
      .eq('owner_id', user.id)
      .maybeSingle();
    setProfile({
      handle: data?.handle ?? null,
      displayName: data?.display_name ?? null,
      isPublic: data?.is_public ?? false,
    });
    setLoading(false);
  }, [enabled]);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(
    async (patch: Partial<MyProfile>): Promise<{ ok: boolean; error?: string }> => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return { ok: false, error: '未登录' };
      const next = { ...profile, ...patch };
      const handle = next.handle ? next.handle.toLowerCase().trim() : null;
      if (handle && !/^[a-z0-9][a-z0-9-]{2,23}$/.test(handle)) {
        return { ok: false, error: 'handle 需 3–24 位，仅小写字母 / 数字 / 短横线' };
      }
      const { error } = await supabase.from('profiles').upsert(
        {
          owner_id: user.id,
          handle,
          display_name: next.displayName,
          is_public: next.isPublic,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'owner_id' },
      );
      if (error) {
        // 23505 = unique violation (handle taken)
        if (error.code === '23505') return { ok: false, error: '这个 handle 已被占用，换一个吧' };
        return { ok: false, error: error.message };
      }
      setProfile(next);
      return { ok: true };
    },
    [profile],
  );

  return { profile, loading, save, refresh: load };
}

/** Fetch a public profile by handle (no auth — hits /api/profile). */
export function usePublicProfile(handle: string | undefined): {
  data: PublicProfile | null;
  loading: boolean;
  error: string | null;
} {
  const [state, setState] = useState<{
    data: PublicProfile | null;
    loading: boolean;
    error: string | null;
  }>({ data: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    if (!handle) {
      setState({ data: null, loading: false, error: '缺少 handle' });
      return;
    }
    setState({ data: null, loading: true, error: null });
    fetch(`/api/profile?h=${encodeURIComponent(handle)}`)
      .then(async (r) => {
        const body = await r.json();
        if (cancelled) return;
        if (!r.ok) {
          setState({ data: null, loading: false, error: body.error ?? '加载失败' });
        } else {
          setState({ data: body as PublicProfile, loading: false, error: null });
        }
      })
      .catch((e) => {
        if (!cancelled) setState({ data: null, loading: false, error: String(e) });
      });
    return () => {
      cancelled = true;
    };
  }, [handle]);

  return state;
}
