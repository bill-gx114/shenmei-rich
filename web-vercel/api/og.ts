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
import { createElement as h, type ReactElement } from 'react';

export const config = { runtime: 'edge' };

type ProfilePayload = {
  profile?: { displayName?: string; handle?: string };
  stats?: { streak?: number; vocabulary?: number; collection?: number };
  portrait?: string | null;
  images?: string[];
};

// Load our self-hosted Noto Serif SC subset (GB2312 level-1 common Hanzi +
// Latin + punctuation, instanced to wght 500, ~1.5MB TTF). Google Fonts only
// serves woff2 now, which Satori can't decode — so we ship our own TTF.
// Rendered PNGs are cached immutable, so the font fetch only happens on cold
// renders. Returns null on failure so the caller can degrade gracefully.
async function loadFont(origin: string): Promise<ArrayBuffer | null> {
  try {
    const buf = await (await fetch(`${origin}/fonts/notoserifsc-500-sub.ttf`)).arrayBuffer();
    return buf.byteLength > 0 ? buf : null;
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
    data?.portrait?.trim() ||
    '每天一幅名作，在画前停留三分钟——慢慢长出自己的眼睛，沉淀出别人替代不了的审美判断。';
  const quote = quoteRaw.length > 62 ? quoteRaw.slice(0, 62) + '…' : quoteRaw;
  const images = (data?.images ?? []).filter(Boolean).slice(0, 3);
  const hero = images[0] ?? '';

  const font = await loadFont(url.origin);

  const gold = '#e7c067';
  const goldSoft = 'rgba(231,192,103,0.30)';
  const ink = '#f6ecd4';
  const ink2 = '#cdbd97';
  const ink3 = '#8f8268';

  const statCell = (n: number | undefined, label: string) =>
    h(
      'div',
      { style: { display: 'flex', flexDirection: 'column' } },
      h(
        'div',
        { style: { fontSize: '54px', color: gold, lineHeight: 1, fontFamily: 'Noto Serif SC' } },
        String(n ?? 0),
      ),
      h(
        'div',
        { style: { fontSize: '17px', color: ink3, marginTop: '10px', letterSpacing: '3px' } },
        label,
      ),
    );

  const leftWidth = hero ? 740 : 1200;

  const leftCol = h(
    'div',
    {
      style: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: `${leftWidth}px`,
        height: '630px',
        padding: '62px 60px',
        fontFamily: 'Noto Serif SC',
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
        '审',
      ),
      h(
        'div',
        { style: { color: gold, fontSize: '20px', letterSpacing: '7px' } },
        '审美日课 · AESTHETIC DAILY',
      ),
    ),
    // identity + quote
    h(
      'div',
      { style: { display: 'flex', flexDirection: 'column' } },
      h(
        'div',
        { style: { display: 'flex', alignItems: 'baseline' } },
        h('div', { style: { fontSize: '60px', lineHeight: 1.1, color: ink } }, name),
        h(
          'div',
          { style: { fontSize: '26px', color: ink3, marginLeft: '18px' } },
          '的审美主页',
        ),
      ),
      h(
        'div',
        { style: { fontSize: '22px', color: ink3, marginTop: '10px', letterSpacing: '2px' } },
        `@${handle}`,
      ),
      h(
        'div',
        {
          style: {
            display: 'flex',
            fontSize: '27px',
            lineHeight: 1.7,
            color: ink2,
            marginTop: '30px',
            paddingLeft: '22px',
            borderLeft: `3px solid ${gold}`,
          },
        },
        quote,
      ),
    ),
    // stats
    h(
      'div',
      { style: { display: 'flex', gap: '56px' } },
      statCell(s?.streak, '连续打卡'),
      statCell(s?.vocabulary, '审美词典'),
      statCell(s?.collection, '馆藏精选'),
    ),
  );

  const heroCol = hero
    ? h(
        'div',
        { style: { display: 'flex', width: '460px', height: '630px', position: 'relative' } },
        h('img', {
          src: hero,
          width: 460,
          height: 630,
          style: { width: '460px', height: '630px', objectFit: 'cover' },
        }),
        // gold hairline seam against the text column
        h('div', {
          style: { position: 'absolute', left: '0px', top: '0px', bottom: '0px', width: '2px', backgroundColor: gold },
        }),
        // subtle darkening so the wall reads continuous
        h('div', {
          style: {
            position: 'absolute',
            left: '0px',
            top: '0px',
            right: '0px',
            bottom: '0px',
            backgroundImage:
              'linear-gradient(90deg, rgba(11,9,7,0.55), rgba(11,9,7,0) 22%, rgba(11,9,7,0) 80%, rgba(11,9,7,0.35))',
          },
        }),
      )
    : null;

  const children: ReactElement[] = [leftCol];
  if (heroCol) children.push(heroCol);
  // gold mat frame on top of everything
  children.push(
    h('div', {
      style: {
        position: 'absolute',
        top: '18px',
        left: '18px',
        right: '18px',
        bottom: '18px',
        border: `1px solid ${goldSoft}`,
      },
    }),
  );

  const tree = h(
    'div',
    {
      style: {
        width: '1200px',
        height: '630px',
        display: 'flex',
        position: 'relative',
        backgroundColor: '#0b0907',
        backgroundImage:
          'radial-gradient(900px 520px at 78% -12%, rgba(231,192,103,0.16), transparent), radial-gradient(680px 480px at -5% 115%, rgba(231,192,103,0.08), transparent)',
        color: ink,
      },
    },
    ...children,
  );

  return new ImageResponse(tree, {
    width: 1200,
    height: 630,
    fonts: font ? [{ name: 'Noto Serif SC', data: font, weight: 500, style: 'normal' }] : [],
    // The poster reflects live stats, so don't cache it for a year (the
    // @vercel/og default). Short edge cache + SWR keeps it fresh as the user
    // answers more works.
    headers: {
      'cache-control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400',
    },
  });
}
