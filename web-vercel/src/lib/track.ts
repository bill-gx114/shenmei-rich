// Tiny fire-and-forget product analytics. Writes one row to the `events` table
// per interaction. Analytics must NEVER break the UX, so every path is guarded
// and nothing is awaited by callers.

import { supabase, isSupabaseConfigured } from './supabase';

let currentUserId: string | null = null;
let cachedSessionId: string | null = null;

// Keep the current user id in sync so track() can attribute events without an
// async lookup on every call.
if (isSupabaseConfigured) {
  supabase.auth.getSession().then(({ data }) => {
    currentUserId = data.session?.user?.id ?? null;
  });
  supabase.auth.onAuthStateChange((_event, session) => {
    currentUserId = session?.user?.id ?? null;
  });
}

function getSessionId(): string {
  if (cachedSessionId) return cachedSessionId;
  try {
    const KEY = 'sd_session_id';
    let v = sessionStorage.getItem(KEY);
    if (!v) {
      v = crypto.randomUUID();
      sessionStorage.setItem(KEY, v);
    }
    cachedSessionId = v;
  } catch {
    // sessionStorage/crypto unavailable — fall back to an ephemeral id.
    cachedSessionId = Math.random().toString(36).slice(2);
  }
  return cachedSessionId;
}

/**
 * Record a product event. Non-blocking and failure-silent.
 * @param name  event name, e.g. 'notebook_save'
 * @param props arbitrary JSON context
 */
export function track(name: string, props: Record<string, unknown> = {}): void {
  if (!isSupabaseConfigured) return;
  try {
    void supabase
      .from('events')
      .insert({
        owner_id: currentUserId,
        session_id: getSessionId(),
        name,
        props,
        path:
          typeof location !== 'undefined' ? location.pathname + location.search : null,
      })
      .then(() => {
        /* swallow result */
      });
  } catch {
    /* analytics must never throw into the UI */
  }
}
