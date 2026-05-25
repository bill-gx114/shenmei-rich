import { supabase } from './supabase';
import type { Hotspot } from './types';

export async function saveHotspots(workId: string, hotspots: Hotspot[]): Promise<void> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) throw new Error('未登录，无法保存');

  const r = await fetch('/api/save-hotspots', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ workId, hotspots }),
  });

  if (!r.ok) {
    let msg = `保存失败 (${r.status})`;
    try {
      const body = (await r.json()) as { error?: string; detail?: string };
      if (body.error) msg = body.error + (body.detail ? ` · ${body.detail}` : '');
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
}
