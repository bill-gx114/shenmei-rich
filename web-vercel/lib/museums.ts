// A small gazetteer of museums/sites, used to place a daily work on the globe
// WITHOUT hand-tagging each one: we match the AI-filled `location` text (e.g.
// "巴黎卢浮宫", "北京故宫博物院") against these keyword sets and take the coords.
// First matching entry wins, so order more-specific keys before generic ones.

export type Museum = { keys: string[]; lat: number; lng: number };

export const MUSEUMS: Museum[] = [
  // 法国
  { keys: ['卢浮'], lat: 48.8606, lng: 2.3376 },
  { keys: ['奥赛'], lat: 48.86, lng: 2.3266 },
  { keys: ['橘园'], lat: 48.8638, lng: 2.3226 },
  { keys: ['玛摩丹', '马摩丹'], lat: 48.8593, lng: 2.2667 },
  { keys: ['蓬皮杜'], lat: 48.8607, lng: 2.3522 },
  { keys: ['罗丹'], lat: 48.8553, lng: 2.3158 },
  // 英国
  { keys: ['大英博物馆'], lat: 51.5194, lng: -0.127 },
  { keys: ['伦敦国家美术馆', '英国国家美术馆', '国家美术馆'], lat: 51.5089, lng: -0.1283 },
  { keys: ['泰特', 'Tate'], lat: 51.5076, lng: -0.0994 },
  { keys: ['科陶德', '考陶德'], lat: 51.5115, lng: -0.1172 },
  // 意大利 / 梵蒂冈
  { keys: ['乌菲兹', '乌菲齐'], lat: 43.7687, lng: 11.2556 },
  { keys: ['学院美术馆', '学院画廊'], lat: 43.777, lng: 11.2594 },
  { keys: ['圣玛利亚感恩', '感恩修道院', '感恩教堂'], lat: 45.4659, lng: 9.1709 },
  { keys: ['梵蒂冈', '西斯廷', '使徒宫'], lat: 41.9064, lng: 12.4536 },
  { keys: ['乌尔比诺', '马尔凯'], lat: 43.7239, lng: 12.6365 },
  // 西班牙
  { keys: ['普拉多'], lat: 40.4138, lng: -3.6921 },
  { keys: ['索菲娅', '索菲亚'], lat: 40.408, lng: -3.6946 },
  // 荷兰
  { keys: ['阿姆斯特丹国立', '荷兰国立', '国立博物馆'], lat: 52.36, lng: 4.8852 },
  { keys: ['莫瑞泰斯', '毛里茨', '莫里茨'], lat: 52.0801, lng: 4.3139 },
  { keys: ['梵高博物馆'], lat: 52.3584, lng: 4.8811 },
  { keys: ['库勒慕勒', '克勒勒-米勒'], lat: 52.0938, lng: 5.8186 },
  // 北欧
  { keys: ['蒙克'], lat: 59.9061, lng: 10.7553 },
  { keys: ['奥斯陆', '挪威国家'], lat: 59.9162, lng: 10.7376 },
  // 中欧 / 东欧 / 俄
  { keys: ['苏黎世'], lat: 47.37, lng: 8.5485 },
  { keys: ['贝尔维德雷', '美景宫'], lat: 48.1916, lng: 16.3809 },
  { keys: ['艺术史博物馆', '维也纳艺术史'], lat: 48.2038, lng: 16.3614 },
  { keys: ['新绘画陈列馆', '慕尼黑'], lat: 48.1486, lng: 11.57 },
  { keys: ['埃尔米塔', '冬宫'], lat: 59.9398, lng: 30.3146 },
  { keys: ['比利时皇家', '布鲁塞尔'], lat: 50.8417, lng: 4.3573 },
  // 美国
  { keys: ['现代艺术博物馆', 'MoMA', '纽约现代'], lat: 40.7614, lng: -73.9776 },
  { keys: ['大都会'], lat: 40.7794, lng: -73.9632 },
  { keys: ['芝加哥'], lat: 41.8796, lng: -87.6237 },
  { keys: ['费城'], lat: 39.9656, lng: -75.181 },
  { keys: ['洛杉矶郡', 'LACMA'], lat: 34.0639, lng: -118.3592 },
  { keys: ['国家美术馆（华盛顿）', '华盛顿'], lat: 38.8913, lng: -77.02 },
  // 墨西哥
  { keys: ['墨西哥'], lat: 19.4204, lng: -99.1819 },
  // 中国大陆 / 港台
  { keys: ['北京故宫', '故宫博物院'], lat: 39.9163, lng: 116.3972 },
  { keys: ['台北故宫', '台北'], lat: 25.1023, lng: 121.5485 },
  { keys: ['辽宁省博物馆', '辽宁'], lat: 41.8057, lng: 123.4315 },
  { keys: ['上海博物馆'], lat: 31.2286, lng: 121.4757 },
  { keys: ['中国国家博物馆', '国家博物馆'], lat: 39.9055, lng: 116.3976 },
  { keys: ['河南博物院', '河南'], lat: 34.7657, lng: 113.6655 },
  { keys: ['浙江省博物馆', '浙江'], lat: 30.2562, lng: 120.1536 },
  { keys: ['中国美术馆'], lat: 39.925, lng: 116.4073 },
  { keys: ['大德寺', '京都'], lat: 35.0429, lng: 135.7456 },
  { keys: ['故宫'], lat: 39.9163, lng: 116.3972 }, // generic 故宫 fallback (after Taipei)
  // ── city-level fallbacks (placed LAST so specific museums win) ────────────
  { keys: ['凡尔赛'], lat: 48.8049, lng: 2.1204 },
  { keys: ['佛罗伦萨', '新圣母'], lat: 43.7731, lng: 11.2497 },
  { keys: ['克拉科夫', '恰尔托雷斯基'], lat: 50.0625, lng: 19.9416 },
  { keys: ['斯德哥尔摩'], lat: 59.3293, lng: 18.0686 },
  { keys: ['特列季亚科夫', '莫斯科'], lat: 55.7415, lng: 37.6208 },
  { keys: ['波士顿'], lat: 42.3394, lng: -71.0938 },
  { keys: ['罗马'], lat: 41.9028, lng: 12.4964 }, // catches the Rome churches
];

/** Find coordinates for a location string by keyword match. */
export function coordsForLocation(location?: string | null): { lat: number; lng: number } | null {
  if (!location) return null;
  for (const m of MUSEUMS) {
    if (m.keys.some((k) => location.includes(k))) return { lat: m.lat, lng: m.lng };
  }
  return null;
}
