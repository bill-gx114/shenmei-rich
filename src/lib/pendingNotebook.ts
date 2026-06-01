// Holds a notebook answer set across the login round-trip. An anonymous
// visitor can answer the three questions; when they hit "收入手账" we stash the
// answers here, send them to log in, and restore + auto-save on return — so no
// one ever loses what they wrote just because they weren't signed in yet.

type Answer = { chip: string; text: string };
type Pending = { workId: string; answers: Answer[] };

const KEY = 'sd_pending_notebook';

export function savePendingNotebook(workId: string, answers: Answer[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ workId, answers } satisfies Pending));
  } catch {
    /* storage unavailable — degrade silently */
  }
}

/** Returns the stashed answers iff they belong to `workId`. */
export function readPendingNotebook(workId: string): Answer[] | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Pending;
    return p.workId === workId && Array.isArray(p.answers) ? p.answers : null;
  } catch {
    return null;
  }
}

export function clearPendingNotebook(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}
