// Coordinates for the daily-exhibition seed works, so a published daily work
// can be pinned onto the 全球漫游 globe as part of "你的日课足迹" (Model C: the
// globe is the museum's world map — curated landmarks + your daily journey).
//
// Convention matches the roam landmarks: the coordinate is WHERE THE WORK LIVES
// (its museum / site), i.e. where you'd go to stand in front of it. Keyed by
// wikipediaSlug (stable; for the Chinese scrolls the slug IS the Chinese title).
//
// Any seed without an entry here simply won't appear on the globe (its daily
// work still shows in 今日展厅 / 馆藏 as normal).

import { SEED_WORKS } from './seed-works.js';

export const SEED_COORDS: Record<string, { lat: number; lng: number }> = {
  Fine_Wind_Clear_Morning: { lat: 51.5194, lng: -0.127 }, // 大英博物馆
  'Fine_Wind,_Clear_Morning': { lat: 51.5194, lng: -0.127 },
  Mona_Lisa: { lat: 48.8606, lng: 2.3376 }, // 卢浮宫
  The_Starry_Night: { lat: 40.7614, lng: -73.9776 }, // MoMA
  The_Great_Wave_off_Kanagawa: { lat: 51.5194, lng: -0.127 }, // 大英博物馆
  Girl_with_a_Pearl_Earring: { lat: 52.0801, lng: 4.3139 }, // 莫瑞泰斯
  The_Scream: { lat: 59.9162, lng: 10.7376 }, // 奥斯陆国家美术馆
  Liberty_Leading_the_People: { lat: 48.8606, lng: 2.3376 }, // 卢浮宫
  The_Birth_of_Venus: { lat: 43.7687, lng: 11.2556 }, // 乌菲兹
  The_School_of_Athens: { lat: 41.9039, lng: 12.4547 }, // 梵蒂冈使徒宫
  The_Night_Watch: { lat: 52.36, lng: 4.8852 }, // 阿姆斯特丹国立博物馆
  'Impression,_Sunrise': { lat: 48.8593, lng: 2.2667 }, // 玛摩丹
  A_Sunday_on_La_Grande_Jatte: { lat: 41.8796, lng: -87.6237 }, // 芝加哥艺术博物馆
  The_Persistence_of_Memory: { lat: 40.7614, lng: -73.9776 }, // MoMA
  'Guernica_(Picasso)': { lat: 40.408, lng: -3.6946 }, // 索菲娅王后
  Nighthawks: { lat: 41.8796, lng: -87.6237 }, // 芝加哥
  'Composition_with_Red,_Blue_and_Yellow': { lat: 47.37, lng: 8.5485 }, // 苏黎世美术馆
  American_Gothic: { lat: 41.8796, lng: -87.6237 }, // 芝加哥
  'Water_Lilies_(Monet_series)': { lat: 48.8638, lng: 2.3226 }, // 橘园
  The_Basket_of_Apples: { lat: 41.8796, lng: -87.6237 }, // 芝加哥
  'Sunflowers_(Van_Gogh_series)': { lat: 51.5089, lng: -0.1283 }, // 伦敦国家美术馆
  富春山居图: { lat: 25.1023, lng: 121.5485 }, // 台北故宫
  千里江山图: { lat: 39.9163, lng: 116.3972 }, // 北京故宫
  清明上河图: { lat: 39.9163, lng: 116.3972 },
  韩熙载夜宴图: { lat: 39.9163, lng: 116.3972 },
  簪花仕女图: { lat: 41.8057, lng: 123.4315 }, // 辽宁省博物馆
  五牛图: { lat: 39.9163, lng: 116.3972 },
  步辇图: { lat: 39.9163, lng: 116.3972 },
  洛神赋图: { lat: 39.9163, lng: 116.3972 },
  The_Treachery_of_Images: { lat: 34.0639, lng: -118.3592 }, // LACMA
  Las_Meninas: { lat: 40.4138, lng: -3.6921 }, // 普拉多
  // Season works whose AI `location` was empty but have a clear home (keyed by
  // Chinese title; coordsForSeed checks the title too).
  万神殿内景: { lat: 41.8986, lng: 12.4769 }, // 罗马万神殿
  大桥骤雨: { lat: 35.6762, lng: 139.6503 }, // 江户/东京
  玩纸牌者: { lat: 48.86, lng: 2.3266 }, // 奥赛
  内战的预感: { lat: 39.9656, lng: -75.181 }, // 费城艺术博物馆
  空间中连续的形: { lat: 40.7614, lng: -73.9776 }, // MoMA
  '自画像（两圆）': { lat: 51.5717, lng: -0.1676 }, // 伦敦肯伍德府
};

const titleToSlug = new Map(SEED_WORKS.map((s) => [s.title, s.wikipediaSlug]));

/** Resolve coordinates by wikipediaSlug first, then by (Chinese) title. */
export function coordsForSeed(
  slug?: string | null,
  title?: string | null,
): { lat: number; lng: number } | null {
  if (slug && SEED_COORDS[slug]) return SEED_COORDS[slug];
  if (title) {
    if (SEED_COORDS[title]) return SEED_COORDS[title];
    const sl = titleToSlug.get(title);
    if (sl && SEED_COORDS[sl]) return SEED_COORDS[sl];
  }
  return null;
}
