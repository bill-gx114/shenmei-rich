// POST /api/save-hotspots
// Body: { workId, hotspots: [{ x, y, label, detail }] }
// Headers: Authorization: Bearer <user JWT>
//
// Authorization rules:
//   - Owner of the work can update its hotspots
//   - For global works (owner_id IS NULL), only users whose email matches
//     ADMIN_EMAIL env var can update
//
// Implementation: we use the user's JWT to identify them via Supabase, then
// switch to the service-role client to perform the actual delete/insert
// (service role bypasses RLS, which is necessary for global works).

import { createClient } from '@supabase/supabase-js';

type HotspotInput = {
  x: number;
  y: number;
  label: string;
  detail: string;
};

type SaveRequest = {
  workId?: string;
  hotspots?: HotspotInput[];
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export default async (req: Request) => {
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return jsonResponse(500, { error: 'Supabase 凭据未配置' });
  }

  // 1. Identify the caller from their JWT.
  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!jwt) return jsonResponse(401, { error: '未登录' });

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return jsonResponse(401, { error: '登录信息无效' });
  }
  const user = userData.user;

  // 2. Parse body.
  let body: SaveRequest;
  try {
    body = (await req.json()) as SaveRequest;
  } catch {
    return jsonResponse(400, { error: '请求体不是合法 JSON' });
  }
  const workId = body.workId;
  const hotspots = body.hotspots;
  if (!workId || !Array.isArray(hotspots)) {
    return jsonResponse(400, { error: '缺少 workId 或 hotspots' });
  }

  // 3. Authorization check: load the work via service role (we need to read
  //    owner_id even when it's a global work the user can't normally see RLS-wise).
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: work, error: workErr } = await admin
    .from('works')
    .select('id, owner_id')
    .eq('id', workId)
    .maybeSingle();
  if (workErr) return jsonResponse(500, { error: '读取作品失败', detail: workErr.message });
  if (!work) return jsonResponse(404, { error: '作品不存在' });

  const isOwner = work.owner_id === user.id;
  const isAdminForGlobal =
    work.owner_id === null && adminEmail && user.email === adminEmail;

  if (!isOwner && !isAdminForGlobal) {
    if (work.owner_id === null && !adminEmail) {
      return jsonResponse(403, {
        error: '此作品是全站共享作品，但服务端未配置 ADMIN_EMAIL，无人可编辑。',
      });
    }
    return jsonResponse(403, { error: '无权编辑此作品的看点' });
  }

  // 4. Validate hotspot shape.
  const cleaned = hotspots.map((h, i) => {
    const x = Number(h.x);
    const y = Number(h.y);
    if (Number.isNaN(x) || Number.isNaN(y)) throw new Error(`hotspot[${i}] x/y 不是数字`);
    return {
      work_id: workId,
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
      label: String(h.label ?? '').slice(0, 200),
      detail: String(h.detail ?? '').slice(0, 1000),
      order_index: i,
    };
  });

  // 5. Replace: delete existing rows, insert new.
  const { error: delErr } = await admin.from('hotspots').delete().eq('work_id', workId);
  if (delErr) return jsonResponse(500, { error: '删除旧看点失败', detail: delErr.message });

  if (cleaned.length) {
    const { error: insErr } = await admin.from('hotspots').insert(cleaned);
    if (insErr) {
      return jsonResponse(500, { error: '写入新看点失败', detail: insErr.message });
    }
  }

  return jsonResponse(200, { ok: true, count: cleaned.length });
};

export const config = { path: '/api/save-hotspots' };
