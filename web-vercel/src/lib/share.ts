// Elegant cross-platform sharing. On mobile (and any browser that supports it)
// this opens the native share sheet — WeChat, iMessage, etc. Everywhere else it
// falls back to copying the link to the clipboard.

import { track } from './track';

export type ShareResult = 'shared' | 'copied' | 'failed';

export async function shareLink(opts: {
  url: string;
  title?: string;
  text?: string;
  context?: string;
}): Promise<ShareResult> {
  const { url, title, text, context } = opts;

  // Native share sheet (mobile-first).
  const nav = navigator as Navigator & {
    share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
  };
  if (typeof nav.share === 'function') {
    try {
      await nav.share({ title, text, url });
      track('share', { method: 'native', context });
      return 'shared';
    } catch (e) {
      // User cancelled the sheet — not an error, don't fall through to copy.
      if (e instanceof Error && e.name === 'AbortError') return 'failed';
    }
  }

  // Fallback: copy to clipboard.
  try {
    await navigator.clipboard.writeText(url);
    track('share', { method: 'copy', context });
    return 'copied';
  } catch {
    track('share', { method: 'failed', context });
    return 'failed';
  }
}
