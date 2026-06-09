// Resolve a work's physical dimensions from Wikidata (structured data), not from
// the Wikipedia prose extract (which rarely states size) and NOT from the LLM
// (which would hallucinate). Given the work's Wikipedia article URL we already
// store, we fetch its Wikidata QID, then read height (P2048) / width (P2049) /
// length (P2043) / diameter (P2386) claims with their units.

const UA = 'shenmei-daily/1.0 (https://shenmei-rich.vercel.app)';

const UNIT_LABEL: Record<string, string> = {
  Q174728: 'cm',
  Q11573: 'm',
  Q174789: 'mm',
  Q218593: 'in',
  Q3710: 'ft',
};

function parseWikiUrl(sourceUrl: string | null | undefined): { lang: string; title: string } | null {
  const m = /^https?:\/\/([a-z-]+)\.wikipedia\.org\/wiki\/(.+)$/.exec(sourceUrl ?? '');
  if (!m) return null;
  return { lang: m[1], title: decodeURIComponent(m[2]) };
}

async function qidFor(lang: string, title: string): Promise<string | null> {
  try {
    const u = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=pageprops&ppprop=wikibase_item&format=json&origin=*&titles=${encodeURIComponent(title)}`;
    const r = await fetch(u, { headers: { 'User-Agent': UA } });
    if (!r.ok) return null;
    const d = (await r.json()) as { query?: { pages?: Record<string, { pageprops?: { wikibase_item?: string } }> } };
    for (const p of Object.values(d.query?.pages ?? {})) {
      if (p.pageprops?.wikibase_item) return p.pageprops.wikibase_item;
    }
    return null;
  } catch {
    return null;
  }
}

function fmtNum(amount: string): string {
  const n = parseFloat(amount);
  if (!Number.isFinite(n)) return amount.replace(/^\+/, '');
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
}

type ClaimVal = { amount?: string; unit?: string };

async function dimsFromQid(qid: string): Promise<string | null> {
  try {
    const u = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=claims&format=json&origin=*`;
    const r = await fetch(u, { headers: { 'User-Agent': UA } });
    if (!r.ok) return null;
    const d = (await r.json()) as {
      entities?: Record<string, { claims?: Record<string, Array<{ mainsnak?: { datavalue?: { value?: ClaimVal } } }>> }>;
    };
    const claims = d.entities?.[qid]?.claims ?? {};
    const val = (p: string): { n: string; u: string } | null => {
      const v = claims[p]?.[0]?.mainsnak?.datavalue?.value;
      if (!v?.amount) return null;
      const unitQ = (v.unit ?? '').split('/').pop() ?? '';
      return { n: fmtNum(v.amount), u: UNIT_LABEL[unitQ] ?? '' };
    };
    const h = val('P2048'); // height
    const w = val('P2049'); // width
    const l = val('P2043'); // length
    const dia = val('P2386'); // diameter
    const unit = h?.u || w?.u || l?.u || dia?.u || 'cm';
    if (h && w) return `${h.n} × ${w.n} ${unit}`;
    if (h) return `高 ${h.n} ${h.u || unit}`;
    if (w) return `宽 ${w.n} ${w.u || unit}`;
    if (l) return `长 ${l.n} ${l.u || unit}`;
    if (dia) return `直径 ${dia.n} ${dia.u || unit}`;
    return null;
  } catch {
    return null;
  }
}

/** Returns a display string like "162 × 128 cm", or null if unavailable. */
export async function resolveDimensions(sourceUrl: string | null | undefined): Promise<string | null> {
  const p = parseWikiUrl(sourceUrl);
  if (!p) return null;
  const qid = await qidFor(p.lang, p.title);
  if (!qid) return null;
  return dimsFromQid(qid);
}
