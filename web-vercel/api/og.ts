// GET /api/og?h=<handle>
// Generates a 1200×630 share poster for a public profile — dark gallery wall,
// warm gold, the user's name + aesthetic-portrait pull-quote + stats. Used as
// the og:image so a shared /u/<handle> link renders a beautiful card people
// can also screenshot to 朋友圈.
//
// Written with createElement (no JSX) so the edge function builder needs no
// JSX-transform config. CJK glyphs: Satori ships only Latin fonts and a full
// CJK font is too big for the edge bundle, so we fetch a *subset* of Noto Serif
// SC from Google Fonts covering exactly the glyphs we draw.

import { ImageResponse } from '@vercel/og';
import { createElement as h } from 'react';

export const config = { runtime: 'edge' };

type ProfilePayload = {
  profile?: { displayName?: string; handle?: string };
  stats?: { streak?: number; vocabulary?: number; collection?: number };
  portrait?: string | null;
};

// Fetch a TTF subset for `text`. An old UA makes Google serve TTF (Satori
// can't parse woff2). Returns null on any failure so the caller can degrade.
async function loadFontSubset(text: string): Promise<ArrayBuffer | null> {
  try {
    const api = `https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@500&text=${encodeURIComponent(
      text,
    )}`;
    const css = await (
      await fetch(api, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MSIE 6.0; Windows NT 5.1)' },
      })
    ).text();
    const url = css.match(/src:\s*url\(([^)]+)\)\s*format/)?.[1];
    if (!url) return null;
    return await (await fetch(url)).arrayBuffer();
  } catch {
    return null;
  }
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const handle = (url.searchParams.get('h') ?? '').toLowerCase().trim();

  let data: ProfilePayload | null = null;
  try {
    const r = await fetch(`${url.origin}/api/profile?h=${encodeURIComponent(handle)}`);
    if (r.ok) data = (await r.json()) as ProfilePayload;
  } catch {
    /* ignore — render a generic card */
  }

  const name = data?.profile?.displayName ?? '一位观众';
  const s = data?.stats;
  const quoteRaw =
    data?.portrait?.trim() || '每天一幅名作，在画前停留三分钟，慢慢长出自己的眼睛。';
  const quote = quoteRaw.length > 56 ? quoteRaw.slice(0, 56) + '…' : quoteRaw;
  const statLine = s
    ? `连续 ${s.streak ?? 0} 天　·　${s.vocabulary ?? 0} 个词条　·　${s.collection ?? 0} 件馆藏`
    : '';

  const allText =
    name +
    quote +
    statLine +
    '审美日课AESTHETIC DAILY · 审美主页的@' +
    handle +
    'abcdefghijklmnopqrstuvwxyz0123456789—…審';
  const font = await loadFontSubset(allText);

  const gold = '#e7c067';
  const ink = '#f6ecd4';
  const ink2 = '#d9c8a0';
  const ink3 = '#998c70';

  const tree = h(
    'div',
    {
      style: {
        width: '1200px',
        height: '630px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '72px 80px',
        backgroundColor: '#0b0907',
        backgroundImage:
          'radial-gradient(900px 500px at 80% -10%, rgba(231,192,103,0.16), transparent), radial-gradient(700px 500px at 0% 110%, rgba(231,192,103,0.08), transparent)',
        fontFamily: 'Noto Serif SC',
        color: ink,
      },
    },
    // eyebrow
    h(
      'div',
      { style: { display: 'flex', alignItems: 'center', gap: '16px' } },
      h(
        'div',
        {
          style: {
            width: '40px',
            height: '40px',
            border: `1px solid ${gold}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: gold,
            fontSize: '24px',
          },
        },
        '審',
      ),
      h(
        'div',
        { style: { color: gold, fontSize: '22px', letterSpacing: '8px' } },
        '审美日课 · AESTHETIC DAILY',
      ),
    ),
    // center: name + handle + quote
    h(
      'div',
      { style: { display: 'flex', flexDirection: 'column' } },
      h('div', { style: { fontSize: '76px', lineHeight: 1.1, color: ink } }, `${name} 的审美主页`),
      h(
        'div',
        { style: { fontSize: '26px', color: ink3, marginTop: '14px', letterSpacing: '2px' } },
        `@${handle}`,
      ),
      h(
        'div',
        {
          style: {
            display: 'flex',
            fontSize: '32px',
            lineHeight: 1.6,
            color: ink2,
            marginTop: '36px',
            paddingLeft: '24px',
            borderLeft: `3px solid ${gold}`,
            maxWidth: '900px',
          },
        },
        quote,
      ),
    ),
    // bottom: stats
    h(
      'div',
      { style: { display: 'flex', color: gold, fontSize: '26px', letterSpacing: '2px' } },
      statLine,
    ),
  );

  return new ImageResponse(tree, {
    width: 1200,
    height: 630,
    fonts: font ? [{ name: 'Noto Serif SC', data: font, weight: 500, style: 'normal' }] : [],
  });
}
