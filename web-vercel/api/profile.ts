// GET /api/profile?h=<handle>
// Public, no-auth read of a user's shareable "审美主页". Uses the service role
// but exposes ONLY whitelisted fields, and ONLY when the profile is public.
// (Deliberately not an RLS-exposed view — we learned from the constellation
// leak to assemble public data explicitly server-side.)

import type { IncomingMessage, ServerResponse } from 'node:http';
import { createClient } from '@supabase/supabase-js';

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  // Cache at the edge briefly — public data, fine to serve slightly stale.
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
  res.end(JSON.stringify(body));
}

function publicImageUrl(supabaseUrl: string, imagePath: string | null): string {
  if (!imagePath) return '';
  if (imagePath.startsWith('http')) return imagePath;
  return `${supabaseUrl}/storage/v1/object/public/works/${imagePath}`;
}

/** Consecutive-day streak counting back from the most recent active date. */
function computeStreak(dates: string[]): number {
  const set = new Set(dates.filter(Boolean));
  if (!set.size) return 0;
  const latest = [...set].sort().reverse()[0];
  const cursor = new Date(latest + 'T00:00:00Z');
  let streak = 0;
  for (;;) {
    const key = cursor.toISOString().slice(0, 10);
    if (set.has(key)) {
      streak++;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    } else break;
  }
  return streak;
}

type WorkJoin = { no: string; title: string; image_path: string | null; exhibited_on: string };
function firstWork(j: unknown): WorkJoin | null {
  if (!j) return null;
  return (Array.isArray(j) ? j[0] : j) as WorkJoin;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });

  const url = new URL(req.url ?? '', 'http://localhost');
  const handle = (url.searchParams.get('h') ?? '').toLowerCase().trim();
  if (!handle) return sendJson(res, 400, { error: '缺少 handle' });

  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return sendJson(res, 500, { error: 'Supabase 凭据未配置' });

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profile } = await admin
    .from('profiles')
    .select('owner_id, handle, display_name, is_public')
    .eq('handle', handle)
    .maybeSingle();

  if (!profile || !profile.is_public) {
    return sendJson(res, 404, { error: '主页不存在或未公开' });
  }

  const ownerId = profile.owner_id as string;

  const [entriesRes, conRes, insightRes, pinsRes] = await Promise.all([
    admin
      .from('notebook_entries')
      .select('saved_at, works(no, title, image_path, exhibited_on)')
      .eq('owner_id', ownerId)
      .order('saved_at', { ascending: false }),
    admin
      .from('v_user_constellation')
      .select('keyword, count')
      .eq('owner_id', ownerId)
      .order('count', { ascending: false })
      .limit(24),
    admin.from('user_insights').select('portrait, tendencies').eq('owner_id', ownerId).maybeSingle(),
    admin
      .from('user_pins')
      .select('work_id, works(no, title, image_path, exhibited_on)')
      .eq('owner_id', ownerId),
  ]);

  const entries = entriesRes.data ?? [];
  const exhibitedDates = entries
    .map((e) => firstWork((e as { works: unknown }).works)?.exhibited_on)
    .filter((d): d is string => Boolean(d));

  const dictionary = (conRes.data ?? []).map((r) => ({
    w: r.keyword as string,
    count: r.count as number,
  }));

  const collection = (pinsRes.data ?? [])
    .map((p) => firstWork((p as { works: unknown }).works))
    .filter((w): w is WorkJoin => Boolean(w))
    .sort((a, b) => (a.exhibited_on < b.exhibited_on ? 1 : -1))
    .map((w) => ({
      no: w.no,
      title: w.title,
      img: publicImageUrl(supabaseUrl, w.image_path),
    }));

  const insight = insightRes.data as
    | { portrait: string | null; tendencies: Array<{ title: string; desc: string }> | null }
    | null;

  // Images for the share poster: pinned works first, then recently observed
  // works as fallback, deduped — so the card always has real art to show.
  const recentImgs = entries
    .map((e) => firstWork((e as { works: unknown }).works))
    .filter((w): w is WorkJoin => Boolean(w))
    .map((w) => publicImageUrl(supabaseUrl, w.image_path));
  const images: string[] = [];
  for (const src of [...collection.map((c) => c.img), ...recentImgs]) {
    if (src && !images.includes(src)) images.push(src);
    if (images.length >= 4) break;
  }
  const cover = images[0] ?? '';

  return sendJson(res, 200, {
    ok: true,
    profile: { displayName: profile.display_name ?? '一位观众', handle: profile.handle },
    stats: {
      streak: computeStreak(exhibitedDates),
      notes: entries.length,
      vocabulary: dictionary.length,
      collection: collection.length,
    },
    portrait: insight?.portrait ?? null,
    tendencies: insight?.tendencies ?? [],
    dictionary,
    collection,
    images,
    cover,
  });
}
