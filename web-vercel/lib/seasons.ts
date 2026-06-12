// Registry of all seasons, so the build pipeline can serve any of them via
// ?season=N. Each season chains after the previous one (the build anchors its
// dates to the day after the latest existing daily work).

import { SEASON1, WEEK_THEMES, type SeasonWork } from './season1.js';
import { SEASON2, WEEK_THEMES2 } from './season2.js';

export type SeasonDef = { works: SeasonWork[]; themes: Record<number, string>; series: string };

export const SEASONS: Record<number, SeasonDef> = {
  1: { works: SEASON1, themes: WEEK_THEMES, series: 'season1' },
  2: { works: SEASON2, themes: WEEK_THEMES2, series: 'season2' },
};

export function seasonDef(n: number): SeasonDef {
  return SEASONS[n] ?? SEASONS[1];
}

// Theme for a work by title, searched across ALL seasons (used by the audio
// phase, which processes every daily work regardless of which season built it).
export function themeForTitle(title: string): string | undefined {
  for (const d of Object.values(SEASONS)) {
    const w = d.works.find((x) => x.title === title);
    if (w) return d.themes[w.week];
  }
  return undefined;
}
