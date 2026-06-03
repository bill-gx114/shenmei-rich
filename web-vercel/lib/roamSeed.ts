// The curated "全球漫游" landmark set — ~30 textbook-level works spread across
// continents and civilizations and across categories (画 / 建筑 / 雕塑 / 遗址).
// Each entry carries coordinates for the globe + a Wikipedia article reference
// the seeder uses to pull a REAL licensed image (originalimage.source) and a
// factual extract that grounds the AI appreciation. `no` is stable ('R001'…)
// and used as the idempotency key.
//
// Curation notes:
//  - artist = creator OR architect OR "—" for anonymous/ancient sites.
//  - year   = a human label ("公元前 447 年", "1503–1519"), not parsed.
//  - hint   = one steering phrase for the curator voice (what to make people see).
//  - wiki   = { lang, title } → https://<lang>.wikipedia.org/api/rest_v1/page/summary/<title>

export type RoamSeed = {
  no: string;
  title: string;
  titleEn: string;
  artist: string;
  year: string;
  category: '画' | '建筑' | '雕塑' | '遗址';
  country: string;
  place: string;
  lat: number;
  lng: number;
  wiki: { lang: 'en' | 'zh'; title: string };
  hint: string;
  /** Curated fallback image (Wikimedia Commons direct link) for the rare title
   *  whose Wikipedia summary AND PageImages both return nothing (e.g. R027). */
  image?: string;
};

export const ROAM_SEEDS: RoamSeed[] = [
  // ── 欧洲 ───────────────────────────────────────────────────────────────
  { no: 'R001', title: '蒙娜丽莎', titleEn: 'Mona Lisa', artist: '列奥纳多·达·芬奇', year: '1503–1519', category: '画', country: '法国', place: '巴黎 · 卢浮宫', lat: 48.8606, lng: 2.3376, wiki: { lang: 'en', title: 'Mona_Lisa' }, hint: '看晕涂法如何让轮廓化进空气里，让微笑悬在确定与不确定之间' },
  { no: 'R002', title: '星月夜', titleEn: 'The Starry Night', artist: '文森特·梵高', year: '1889', category: '画', country: '美国', place: '纽约 · MoMA', lat: 40.7614, lng: -73.9776, wiki: { lang: 'en', title: 'The_Starry_Night' }, hint: '看笔触本身如何变成流动的能量，让静止的夜空旋转起来' },
  { no: 'R003', title: '戴珍珠耳环的少女', titleEn: 'Girl with a Pearl Earring', artist: '约翰内斯·维米尔', year: '约 1665', category: '画', country: '荷兰', place: '海牙 · 莫瑞泰斯', lat: 52.0801, lng: 4.3139, wiki: { lang: 'en', title: 'Girl_with_a_Pearl_Earring' }, hint: '看一束侧光与一个回眸如何用最少的信息制造最大的悬念' },
  { no: 'R004', title: '夜巡', titleEn: 'The Night Watch', artist: '伦勃朗', year: '1642', category: '画', country: '荷兰', place: '阿姆斯特丹 · 国立博物馆', lat: 52.3600, lng: 4.8852, wiki: { lang: 'en', title: 'The_Night_Watch' }, hint: '看伦勃朗如何用一束戏剧光把一张集体合影变成一个事件' },
  { no: 'R005', title: '维纳斯的诞生', titleEn: 'The Birth of Venus', artist: '桑德罗·波提切利', year: '约 1485', category: '画', country: '意大利', place: '佛罗伦萨 · 乌菲齐', lat: 43.7687, lng: 11.2556, wiki: { lang: 'en', title: 'The_Birth_of_Venus' }, hint: '看流畅的线条与轻盈的体重感如何托起一个不属于地心引力的世界' },
  { no: 'R006', title: '呐喊', titleEn: 'The Scream', artist: '爱德华·蒙克', year: '1893', category: '画', country: '挪威', place: '奥斯陆 · 国家美术馆', lat: 59.9162, lng: 10.7376, wiki: { lang: 'en', title: 'The_Scream' }, hint: '看天空与人脸如何用同一种波纹颤抖，把内心的声音画成风景' },
  { no: 'R007', title: '格尔尼卡', titleEn: 'Guernica', artist: '巴勃罗·毕加索', year: '1937', category: '画', country: '西班牙', place: '马德里 · 索菲亚王后', lat: 40.4080, lng: -3.6946, wiki: { lang: 'en', title: 'Guernica_(Picasso)' }, hint: '看黑白灰如何拒绝美化暴力，用破碎的形体直接刺向神经' },
  { no: 'R008', title: '西斯廷天顶画', titleEn: 'Sistine Chapel ceiling', artist: '米开朗基罗', year: '1508–1512', category: '画', country: '梵蒂冈', place: '梵蒂冈 · 西斯廷礼拜堂', lat: 41.9029, lng: 12.4545, wiki: { lang: 'en', title: 'Sistine_Chapel_ceiling' }, hint: '看两根即将触碰的手指之间那道留白，如何承载整个创世的张力' },
  { no: 'R009', title: '圣家族大教堂', titleEn: 'Sagrada Família', artist: '安东尼·高迪', year: '1882 至今', category: '建筑', country: '西班牙', place: '巴塞罗那', lat: 41.4036, lng: 2.1744, wiki: { lang: 'en', title: 'Sagrada_Família' }, hint: '看石头如何模仿森林生长，让结构本身变成一片向上的树林' },
  { no: 'R010', title: '帕特农神庙', titleEn: 'Parthenon', artist: '伊克提诺斯 / 卡利克拉特', year: '公元前 447–432', category: '建筑', country: '希腊', place: '雅典 · 卫城', lat: 37.9715, lng: 23.7267, wiki: { lang: 'en', title: 'Parthenon' }, hint: '看那些"笔直"的线条其实都被刻意做成微曲，只为骗过你的眼睛显得更直' },
  { no: 'R011', title: '万神殿', titleEn: 'Pantheon', artist: '—（古罗马）', year: '约公元 126', category: '建筑', country: '意大利', place: '罗马', lat: 41.8986, lng: 12.4769, wiki: { lang: 'en', title: 'Pantheon,_Rome' }, hint: '看穹顶正中那个洞，如何让一束移动的阳光成为这座建筑真正的主角' },
  { no: 'R012', title: '阿尔罕布拉宫', titleEn: 'Alhambra', artist: '—（纳斯里王朝）', year: '13–14 世纪', category: '建筑', country: '西班牙', place: '格拉纳达', lat: 37.1761, lng: -3.5881, wiki: { lang: 'en', title: 'Alhambra' }, hint: '看水、光与几何纹样如何被组织成一座可以漫步其中的数学' },
  { no: 'R013', title: '圣瓦西里大教堂', titleEn: "Saint Basil's Cathedral", artist: '—', year: '1555–1561', category: '建筑', country: '俄罗斯', place: '莫斯科 · 红场', lat: 55.7525, lng: 37.6231, wiki: { lang: 'en', title: "Saint_Basil's_Cathedral" }, hint: '看一组各不相同的洋葱顶如何用色彩与扭转拼成一团燃烧的篝火' },
  { no: 'R014', title: '大卫', titleEn: 'David', artist: '米开朗基罗', year: '1501–1504', category: '雕塑', country: '意大利', place: '佛罗伦萨 · 学院美术馆', lat: 43.7770, lng: 11.2594, wiki: { lang: 'en', title: 'David_(Michelangelo)' }, hint: '看放大的右手与紧绷的颈部血管，如何把"动作之前的一瞬"凝固在石头里' },
  { no: 'R015', title: '思想者', titleEn: 'The Thinker', artist: '奥古斯特·罗丹', year: '1904', category: '雕塑', country: '法国', place: '巴黎 · 罗丹博物馆', lat: 48.8553, lng: 2.3158, wiki: { lang: 'en', title: 'The_Thinker' }, hint: '看全身的肌肉如何都在用力——思考在罗丹这里是一件耗尽体力的事' },
  // ── 东亚 ───────────────────────────────────────────────────────────────
  { no: 'R016', title: '神奈川冲浪里', titleEn: 'The Great Wave off Kanagawa', artist: '葛饰北斋', year: '约 1831', category: '画', country: '日本', place: '东京 · 江户', lat: 35.6762, lng: 139.6503, wiki: { lang: 'en', title: 'The_Great_Wave_off_Kanagawa' }, hint: '看巨浪的爪牙与远处渺小的富士山如何在同一画面里争夺你的视线' },
  { no: 'R017', title: '清明上河图', titleEn: 'Along the River During the Qingming Festival', artist: '张择端', year: '北宋', category: '画', country: '中国', place: '北京 · 故宫博物院', lat: 39.9163, lng: 116.3972, wiki: { lang: 'zh', title: '清明上河图' }, hint: '看散点透视如何让你像走路一样横向"读"完一座城的一天' },
  { no: 'R018', title: '千里江山图', titleEn: 'A Thousand Li of Rivers and Mountains', artist: '王希孟', year: '北宋 1113', category: '画', country: '中国', place: '北京 · 故宫博物院', lat: 39.9163, lng: 116.3972, wiki: { lang: 'zh', title: '千里江山图' }, hint: '看石青石绿如何在十八岁少年的笔下，把山水画成一片矿物的光' },
  { no: 'R019', title: '兵马俑', titleEn: 'Terracotta Army', artist: '—（秦代工匠）', year: '公元前 3 世纪', category: '雕塑', country: '中国', place: '西安 · 临潼', lat: 34.3853, lng: 109.2785, wiki: { lang: 'en', title: 'Terracotta_Army' }, hint: '看每一张脸都不重复——批量生产里藏着对"个体"的执拗' },
  { no: 'R020', title: '莫高窟', titleEn: 'Mogao Caves', artist: '—（历代僧侣画工）', year: '4–14 世纪', category: '遗址', country: '中国', place: '敦煌', lat: 40.0357, lng: 94.8094, wiki: { lang: 'en', title: 'Mogao_Caves' }, hint: '看千年间不同朝代的色彩与飞天，如何在同一面墙上层层叠成一部时间的书' },
  { no: 'R021', title: '故宫', titleEn: 'Forbidden City', artist: '—（明代营造）', year: '1406–1420', category: '建筑', country: '中国', place: '北京', lat: 39.9163, lng: 116.3972, wiki: { lang: 'en', title: 'Forbidden_City' }, hint: '看中轴线如何用一进又一进的院落，把"权力"翻译成一种行走的节奏' },
  // ── 南亚 / 东南亚 ───────────────────────────────────────────────────────
  { no: 'R022', title: '泰姬陵', titleEn: 'Taj Mahal', artist: '—（莫卧儿宫廷）', year: '1632–1653', category: '建筑', country: '印度', place: '阿格拉', lat: 27.1751, lng: 78.0421, wiki: { lang: 'en', title: 'Taj_Mahal' }, hint: '看完美的对称与倒影如何把一座陵墓变成一首关于"永恒"的几何诗' },
  { no: 'R023', title: '吴哥窟', titleEn: 'Angkor Wat', artist: '—（高棉帝国）', year: '12 世纪', category: '遗址', country: '柬埔寨', place: '暹粒', lat: 13.4125, lng: 103.8670, wiki: { lang: 'en', title: 'Angkor_Wat' }, hint: '看五座塔尖与护城河如何把整座神庙造成一个微缩的宇宙模型' },
  // ── 非洲 / 中东 ─────────────────────────────────────────────────────────
  { no: 'R024', title: '吉萨大金字塔', titleEn: 'Great Pyramid of Giza', artist: '—（古埃及）', year: '约公元前 2560', category: '建筑', country: '埃及', place: '吉萨', lat: 29.9792, lng: 31.1342, wiki: { lang: 'en', title: 'Great_Pyramid_of_Giza' }, hint: '看四千五百年前的人如何只用最简单的几何，逼近一种近乎抽象的纯粹' },
  // ── 美洲 ───────────────────────────────────────────────────────────────
  { no: 'R025', title: '自由女神像', titleEn: 'Statue of Liberty', artist: '巴托尔迪', year: '1886', category: '雕塑', country: '美国', place: '纽约', lat: 40.6892, lng: -74.0445, wiki: { lang: 'en', title: 'Statue_of_Liberty' }, hint: '看高举的火炬与脚下断裂的锁链，如何把一个抽象概念铸成可见的姿态' },
  { no: 'R026', title: '流水别墅', titleEn: 'Fallingwater', artist: '弗兰克·劳埃德·赖特', year: '1935', category: '建筑', country: '美国', place: '宾夕法尼亚', lat: 39.9064, lng: -79.4686, wiki: { lang: 'en', title: 'Fallingwater' }, hint: '看悬挑的水平板如何让房子像从崖壁里长出来，与瀑布共用一套节奏' },
  { no: 'R027', title: '马丘比丘', titleEn: 'Machu Picchu', artist: '—（印加帝国）', year: '15 世纪', category: '遗址', country: '秘鲁', place: '库斯科', lat: -13.1631, lng: -72.5450, wiki: { lang: 'en', title: 'Machu_Picchu' }, hint: '看石墙的边缘如何顺着山势退让，让人造的几何与山体长成一体', image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Machu_Picchu,_Peru.jpg' },
  { no: 'R028', title: '摩艾石像', titleEn: 'Moai', artist: '—（拉帕努伊人）', year: '13–16 世纪', category: '雕塑', country: '智利', place: '复活节岛', lat: -27.1127, lng: -109.3497, wiki: { lang: 'en', title: 'Moai' }, hint: '看夸张的长脸与下垂的眼睑，如何用极简的体块制造出沉默的纪念性' },
  // ── 大洋洲 ─────────────────────────────────────────────────────────────
  { no: 'R029', title: '悉尼歌剧院', titleEn: 'Sydney Opera House', artist: '约恩·乌松', year: '1973', category: '建筑', country: '澳大利亚', place: '悉尼', lat: -33.8568, lng: 151.2153, wiki: { lang: 'en', title: 'Sydney_Opera_House' }, hint: '看那一组"贝壳"如何来自同一个球面的切片——自由的造型背后是严格的几何' },
  { no: 'R030', title: '古根海姆博物馆', titleEn: 'Guggenheim Museum Bilbao', artist: '弗兰克·盖里', year: '1997', category: '建筑', country: '西班牙', place: '毕尔巴鄂', lat: 43.2687, lng: -2.9340, wiki: { lang: 'en', title: 'Guggenheim_Museum_Bilbao' }, hint: '看钛金属表皮如何随光与天气不断改变形状，让一栋建筑像液体一样流动' },
];

/** Marker colour per category, used by the globe. */
export const CATEGORY_COLOR: Record<RoamSeed['category'], string> = {
  画: '#e7c067',
  建筑: '#7fb5d6',
  雕塑: '#c98f6a',
  遗址: '#9bbd7a',
};
