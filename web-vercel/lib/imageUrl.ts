// Normalize a Wikimedia image URL to a reliably-loadable 1600px thumbnail.
//
// Two failure modes we fix:
//  1. an oversized thumb (e.g. .../3840px-File.jpg) hits Wikimedia's thumb
//     render limit and never loads → cap the width to 1600.
//  2. a FULL-RESOLUTION original (.../commons/c/c5/File.jpg, no /thumb/) can be
//     tens of MB; loading many in a grid times out → convert to a 1600px thumb.
//
// Non-Wikimedia URLs (or anything we can't parse) are returned unchanged.

export function safeImg(url: string | null | undefined): string {
  const u = url ?? '';
  if (!u.includes('upload.wikimedia.org')) return u;

  if (u.includes('/thumb/')) {
    const m = /\/(\d+)px-/.exec(u);
    if (m && Number(m[1]) > 1600) return u.replace(/\/\d+px-/, '/1600px-');
    return u; // already ≤ 1600
  }

  // original → build the thumbnail path: insert /thumb and append /1600px-<file>
  const m = /^(https:\/\/upload\.wikimedia\.org\/wikipedia\/[^/]+)\/([0-9a-fA-F])\/([0-9a-fA-F]{2})\/(.+)$/.exec(u);
  if (!m) return u;
  const [, base, a, ab, file] = m;
  return `${base}/thumb/${a}/${ab}/${file}/1600px-${file}`;
}
