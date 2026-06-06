// Wikipedia "deeper reading" links per work, built from the in-code seed lists.
// Used by generators (to store source_url at creation) and by the ?source=1
// backfills (to fill existing rows, matched by title / no).

import { SEASON1 } from './season1.js';
import { SEED_WORKS } from './seed-works.js';
import { ROAM_SEEDS } from './roamSeed.js';

export function wikiUrl(lang: string, slug: string): string {
  return `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(slug)}`;
}

// Daily/season works are matched by their (unique enough) Chinese title.
const dailyByTitle = new Map<string, string>();
for (const w of SEED_WORKS) dailyByTitle.set(w.title, wikiUrl(w.wikipediaLang, w.wikipediaSlug));
for (const w of SEASON1) dailyByTitle.set(w.title, wikiUrl(w.lang ?? 'en', w.slug)); // season wins on conflict

export function dailySourceUrl(title: string): string | null {
  return dailyByTitle.get(title) ?? null;
}

// Roam landmarks are matched by their stable `no` (R001…).
const roamByNo = new Map<string, string>();
for (const s of ROAM_SEEDS) roamByNo.set(s.no, wikiUrl(s.wiki.lang, s.wiki.title));

export function roamSourceUrl(no: string): string | null {
  return roamByNo.get(no) ?? null;
}
