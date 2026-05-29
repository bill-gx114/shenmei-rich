import { useCallback, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export type Tendency = { title: string; desc: string };

export type InsightState = {
  portrait: string | null;
  tendencies: Tendency[];
  entryCount: number;
  /** Minimum entries needed before an insight is generated. */
  need?: number;
  loading: boolean;
  error: string | null;
};

const EMPTY: InsightState = {
  portrait: null,
  tendencies: [],
  entryCount: 0,
  loading: false,
  error: null,
};

/**
 * Fetches the user's AI aesthetic portrait from /api/insight. The endpoint
 * caches server-side and only re-runs DeepSeek when the user has answered
 * new works since last time, so calling this on every Journal view is cheap.
 *
 * `version` lets callers force a re-fetch (e.g. after a new notebook save).
 */
export function useInsight(enabled: boolean, version = 0): InsightState {
  const [state, setState] = useState<InsightState>({ ...EMPTY, loading: enabled });

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !enabled) {
      setState(EMPTY);
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) {
        setState(EMPTY);
        return;
      }
      const r = await fetch('/api/insight', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await r.json()) as Partial<InsightState> & { need?: number };
      if (!r.ok) throw new Error((data as { error?: string }).error ?? `请求失败 ${r.status}`);
      setState({
        portrait: data.portrait ?? null,
        tendencies: data.tendencies ?? [],
        entryCount: data.entryCount ?? 0,
        need: data.need,
        loading: false,
        error: null,
      });
    } catch (e) {
      setState({ ...EMPTY, loading: false, error: e instanceof Error ? e.message : String(e) });
    }
  }, [enabled, version]);

  useEffect(() => {
    load();
  }, [load]);

  return state;
}
