// Serves /u/<handle> — the public profile URL. Returns the normal SPA
// index.html but with per-profile Open Graph / Twitter meta injected into
// <head>, so pasting the link into WeChat / iMessage / Twitter renders a rich
// preview card. Humans still get the full single-page app (it client-routes to
// the ProfilePage); crawlers read the injected tags.
//
// vercel.json rewrites `/u/:handle` → `/api/u?handle=:handle`.

export const config = { runtime: 'edge' };

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

type ProfilePayload = {
  profile?: { displayName?: string; handle?: string };
  stats?: { streak?: number; notes?: number; vocabulary?: number; collection?: number };
  portrait?: string | null;
  cover?: string | null;
};

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const handle = (url.searchParams.get('handle') ?? '').toLowerCase().trim();
  const origin = url.origin;

  // Always fetch the built SPA shell so humans get the working app.
  const shellRes = await fetch(`${origin}/index.html`, {
    headers: { 'User-Agent': 'sd-og-injector' },
  });
  let html = await shellRes.text();

  // Best-effort: pull the public profile to build the card. On any failure we
  // just serve the unmodified shell (the SPA will show "主页不存在").
  let data: ProfilePayload | null = null;
  if (handle) {
    try {
      const r = await fetch(`${origin}/api/profile?h=${encodeURIComponent(handle)}`);
      if (r.ok) data = (await r.json()) as ProfilePayload;
    } catch {
      /* ignore */
    }
  }

  const name = data?.profile?.displayName ?? '一位观众';
  const title = `${name} 的审美主页 · 审美日课`;
  const s = data?.stats;
  const desc =
    (data?.portrait && data.portrait.slice(0, 90)) ||
    (s
      ? `连续观看 ${s.streak ?? 0} 天 · ${s.vocabulary ?? 0} 个审美词条 · ${s.collection ?? 0} 件馆藏 —— 在审美日课，每天一幅名作，长出自己的眼睛。`
      : '在审美日课，每天一幅名作，长出自己的眼睛。');
  const image = data?.cover || `${origin}/og-default.png`;
  const pageUrl = `${origin}/u/${encodeURIComponent(handle)}`;

  const meta = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(desc)}" />`,
    `<meta property="og:type" content="profile" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(desc)}" />`,
    `<meta property="og:url" content="${esc(pageUrl)}" />`,
    `<meta property="og:site_name" content="审美日课" />`,
    image ? `<meta property="og:image" content="${esc(image)}" />` : '',
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(desc)}" />`,
    image ? `<meta name="twitter:image" content="${esc(image)}" />` : '',
  ]
    .filter(Boolean)
    .join('\n    ');

  // Replace the static <title>; if found, inject the meta block right after it.
  if (/<title>.*?<\/title>/s.test(html)) {
    html = html.replace(/<title>.*?<\/title>/s, meta);
  } else {
    html = html.replace(/<head>/i, `<head>\n    ${meta}`);
  }

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 's-maxage=60, stale-while-revalidate=300',
    },
  });
}
