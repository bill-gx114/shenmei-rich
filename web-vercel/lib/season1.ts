// 审美日课 · 第一季 (Season 1) — a pre-generated, themed 91-work curriculum.
// Instead of generating one work per night (fragile: cron skips, midnight
// truncation/timeout), the whole season is baked into the DB up front and
// revealed one per day. See api/season-build.ts.
//
// 13 weeks × 7 = 91, a progression of "viewing lenses": composition → light →
// colour → line → space → negative space (pivot east) → landscape scrolls →
// figures → texture/sculpture → narrative → symbol → modernity → synthesis.
//
// Already-shown daily works and the roam scrolls are excluded to avoid repeats.
// Factual metadata (year/medium/location) is filled by the AI from the grounding
// Wikipedia extract at build time, so we only curate WHAT, not every detail.

export type SeasonWork = {
  title: string;
  artist: string;
  /** Wikipedia article slug (auto-verified + search-fallback at build). */
  slug: string;
  /** Wikipedia language for the slug. Default 'en'. */
  lang?: 'en' | 'zh';
  region: 'east' | 'west';
  category: '画' | '雕' | '器';
  week: number;
};

export const WEEK_THEMES: Record<number, string> = {
  1: '构图与视觉重心',
  2: '光：方向、戏剧与体积',
  3: '色彩：冷暖、对比与调性',
  4: '线条与笔触',
  5: '空间与透视',
  6: '留白与负空间',
  7: '山水与长卷：可游可居',
  8: '人物与神态',
  9: '质感、材料与体量',
  10: '叙事与场面',
  11: '象征与隐喻',
  12: '现代性：抽象、平面与观念',
  13: '综合与回望',
};

export const SEASON1: SeasonWork[] = [
  // 第 1 周 · 构图与视觉重心
  { title: '最后的晚餐', artist: '达·芬奇', slug: 'The_Last_Supper_(Leonardo)', region: 'west', category: '画', week: 1 },
  { title: '大宫女', artist: '安格尔', slug: 'Grande_Odalisque', region: 'west', category: '画', week: 1 },
  { title: '阿尔诺芬尼夫妇像', artist: '扬·凡·艾克', slug: 'Arnolfini_Portrait', region: 'west', category: '画', week: 1 },
  { title: '拾穗者', artist: '米勒', slug: 'The_Gleaners', region: 'west', category: '画', week: 1 },
  { title: '梅杜萨之筏', artist: '籍里柯', slug: 'The_Raft_of_the_Medusa', region: 'west', category: '画', week: 1 },
  { title: '马拉之死', artist: '雅克-路易·大卫', slug: 'The_Death_of_Marat', region: 'west', category: '画', week: 1 },
  { title: '萨宾妇女的调停', artist: '雅克-路易·大卫', slug: 'The_Intervention_of_the_Sabine_Women', region: 'west', category: '画', week: 1 },
  // 第 2 周 · 光
  { title: '召唤圣马太', artist: '卡拉瓦乔', slug: 'The_Calling_of_Saint_Matthew', region: 'west', category: '画', week: 2 },
  { title: '蜡烛前的抹大拉', artist: '乔治·德·拉图尔', slug: 'Magdalene_with_the_Smoking_Flame', region: 'west', category: '画', week: 2 },
  { title: '夜巡', artist: '伦勃朗', slug: 'The_Night_Watch', region: 'west', category: '画', week: 2 },
  { title: '倒牛奶的女仆', artist: '维米尔', slug: 'The_Milkmaid_(Vermeer)', region: 'west', category: '画', week: 2 },
  { title: '杜尔普医生的解剖课', artist: '伦勃朗', slug: 'The_Anatomy_Lesson_of_Dr._Nicolaes_Tulp', region: 'west', category: '画', week: 2 },
  { title: '圣母之死', artist: '卡拉瓦乔', slug: 'Death_of_the_Virgin_(Caravaggio)', region: 'west', category: '画', week: 2 },
  { title: '自画像（两圆）', artist: '伦勃朗', slug: 'Self-Portrait_with_Two_Circles', region: 'west', category: '画', week: 2 },
  // 第 3 周 · 色彩
  { title: '红色的和谐', artist: '马蒂斯', slug: 'The_Dessert:_Harmony_in_Red', region: 'west', category: '画', week: 3 },
  { title: '舞蹈', artist: '马蒂斯', slug: 'Dance_(Matisse)', region: 'west', category: '画', week: 3 },
  { title: '戴帽的妇人', artist: '马蒂斯', slug: 'Woman_with_a_Hat', region: 'west', category: '画', week: 3 },
  { title: '大碗岛的星期日下午', artist: '修拉', slug: 'A_Sunday_on_La_Grande_Jatte', region: 'west', category: '画', week: 3 },
  { title: '黄·红·蓝', artist: '康定斯基', slug: 'Yellow-Red-Blue', region: 'west', category: '画', week: 3 },
  { title: '红黄蓝构成', artist: '蒙德里安', slug: 'Composition_with_Red,_Blue_and_Yellow', region: 'west', category: '画', week: 3 },
  { title: '桥上的少女', artist: '蒙克', slug: 'The_Girls_on_the_Bridge', region: 'west', category: '画', week: 3 },
  // 第 4 周 · 线条与笔触
  { title: '罗纳河上的星夜', artist: '梵高', slug: 'Starry_Night_Over_the_Rhône', region: 'west', category: '画', week: 4 },
  { title: '麦田群鸦', artist: '梵高', slug: 'Wheatfield_with_Crows', region: 'west', category: '画', week: 4 },
  { title: '吻', artist: '克里姆特', slug: 'The_Kiss_(Klimt)', region: 'west', category: '画', week: 4 },
  { title: '亚维农的少女', artist: '毕加索', slug: "Les_Demoiselles_d'Avignon", region: 'west', category: '画', week: 4 },
  { title: '哭泣的女人', artist: '毕加索', slug: 'Weeping_Woman', region: 'west', category: '画', week: 4 },
  { title: '百老汇爵士乐', artist: '蒙德里安', slug: 'Broadway_Boogie-Woogie', region: 'west', category: '画', week: 4 },
  { title: '大桥骤雨', artist: '歌川广重', slug: 'Sudden_Shower_over_Shin-Ōhashi_bridge_and_Atake', region: 'east', category: '画', week: 4 },
  // 第 5 周 · 空间与透视
  { title: '圣三位一体', artist: '马萨乔', slug: 'Holy_Trinity_(Masaccio)', region: 'west', category: '画', week: 5 },
  { title: '理想城市', artist: '弗朗切斯卡派', slug: 'Ideal_City', region: 'west', category: '画', week: 5 },
  { title: '宫娥', artist: '委拉斯开兹', slug: 'Las_Meninas', region: 'west', category: '画', week: 5 },
  { title: '鞭打基督', artist: '皮耶罗·德拉·弗朗切斯卡', slug: 'Flagellation_of_Christ_(Piero_della_Francesca)', region: 'west', category: '画', week: 5 },
  { title: '暴风雨', artist: '乔尔乔内', slug: 'The_Tempest_(Giorgione)', region: 'west', category: '画', week: 5 },
  { title: '万神殿内景', artist: '帕尼尼', slug: 'Interior_of_the_Pantheon,_Rome', region: 'west', category: '画', week: 5 },
  { title: '一条街道的神秘与忧郁', artist: '基里科', slug: 'Mystery_and_Melancholy_of_a_Street', region: 'west', category: '画', week: 5 },
  // 第 6 周 · 留白与负空间
  { title: '寒江独钓图', artist: '马远', slug: '寒江独钓图', lang: 'zh', region: 'east', category: '画', week: 6 },
  { title: '六柿图', artist: '牧溪', slug: 'Six_Persimmons', region: 'east', category: '画', week: 6 },
  { title: '泼墨仙人图', artist: '梁楷', slug: '泼墨仙人图', lang: 'zh', region: 'east', category: '画', week: 6 },
  { title: '太白行吟图', artist: '梁楷', slug: '太白行吟图', lang: 'zh', region: 'east', category: '画', week: 6 },
  { title: '枯木怪石图', artist: '苏轼', slug: '枯木怪石图', lang: 'zh', region: 'east', category: '画', week: 6 },
  { title: '墨葡萄图', artist: '徐渭', slug: '墨葡萄图', lang: 'zh', region: 'east', category: '画', week: 6 },
  { title: '容膝斋图', artist: '倪瓒', slug: '容膝斋图', lang: 'zh', region: 'east', category: '画', week: 6 },
  // 第 7 周 · 山水与长卷
  { title: '富春山居图', artist: '黄公望', slug: '富春山居图', lang: 'zh', region: 'east', category: '画', week: 7 },
  { title: '溪山行旅图', artist: '范宽', slug: '溪山行旅图', lang: 'zh', region: 'east', category: '画', week: 7 },
  { title: '早春图', artist: '郭熙', slug: '早春图', lang: 'zh', region: 'east', category: '画', week: 7 },
  { title: '万壑松风图', artist: '李唐', slug: '万壑松风图', lang: 'zh', region: 'east', category: '画', week: 7 },
  { title: '庐山高图', artist: '沈周', slug: '庐山高图', lang: 'zh', region: 'east', category: '画', week: 7 },
  { title: '鹊华秋色图', artist: '赵孟頫', slug: '鹊华秋色图', lang: 'zh', region: 'east', category: '画', week: 7 },
  { title: '渔庄秋霁图', artist: '倪瓒', slug: '渔庄秋霁图', lang: 'zh', region: 'east', category: '画', week: 7 },
  // 第 8 周 · 人物与神态
  { title: '簪花仕女图', artist: '周昉', slug: '簪花仕女图', lang: 'zh', region: 'east', category: '画', week: 8 },
  { title: '韩熙载夜宴图', artist: '顾闳中', slug: '韩熙载夜宴图', lang: 'zh', region: 'east', category: '画', week: 8 },
  { title: '步辇图', artist: '阎立本', slug: '步辇图', lang: 'zh', region: 'east', category: '画', week: 8 },
  { title: '抱银鼠的女子', artist: '达·芬奇', slug: 'Lady_with_an_Ermine', region: 'west', category: '画', week: 8 },
  { title: '教皇英诺森十世像', artist: '委拉斯开兹', slug: 'Portrait_of_Innocent_X', region: 'west', category: '画', week: 8 },
  { title: '拿破仑一世加冕', artist: '雅克-路易·大卫', slug: 'The_Coronation_of_Napoleon', region: 'west', category: '画', week: 8 },
  { title: '浪子回头', artist: '伦勃朗', slug: 'The_Return_of_the_Prodigal_Son_(Rembrandt)', region: 'west', category: '画', week: 8 },
  // 第 9 周 · 质感、材料与体量
  { title: '摩西像', artist: '米开朗基罗', slug: 'Moses_(Michelangelo)', region: 'west', category: '雕', week: 9 },
  { title: '圣特蕾莎的沉迷', artist: '贝尼尼', slug: 'Ecstasy_of_Saint_Teresa', region: 'west', category: '雕', week: 9 },
  { title: '普绪克被爱神唤醒', artist: '卡诺瓦', slug: "Psyche_Revived_by_Cupid's_Kiss", region: 'west', category: '雕', week: 9 },
  { title: '萨莫色雷斯的胜利女神', artist: '古希腊', slug: 'Winged_Victory_of_Samothrace', region: 'west', category: '雕', week: 9 },
  { title: '米洛的维纳斯', artist: '古希腊', slug: 'Venus_de_Milo', region: 'west', category: '雕', week: 9 },
  { title: '后母戊鼎', artist: '商代', slug: '后母戊鼎', lang: 'zh', region: 'east', category: '器', week: 9 },
  { title: '莲鹤方壶', artist: '春秋', slug: '莲鹤方壶', lang: 'zh', region: 'east', category: '器', week: 9 },
  // 第 10 周 · 叙事与场面
  { title: '1808年5月3日', artist: '戈雅', slug: 'The_Third_of_May_1808', region: 'west', category: '画', week: 10 },
  { title: '草地上的午餐', artist: '马奈', slug: "Le_Déjeuner_sur_l'herbe", region: 'west', category: '画', week: 10 },
  { title: '奥南的葬礼', artist: '库尔贝', slug: 'A_Burial_at_Ornans', region: 'west', category: '画', week: 10 },
  { title: '内战的预感', artist: '达利', slug: 'Soft_Construction_with_Boiled_Beans', region: 'west', category: '画', week: 10 },
  { title: '战争', artist: '亨利·卢梭', slug: 'War_(Rousseau)', region: 'west', category: '画', week: 10 },
  { title: '流民图', artist: '蒋兆和', slug: '流民图', lang: 'zh', region: 'east', category: '画', week: 10 },
  { title: '开国大典', artist: '董希文', slug: '开国大典_(油画)', lang: 'zh', region: 'east', category: '画', week: 10 },
  // 第 11 周 · 象征与隐喻
  { title: '春', artist: '波提切利', slug: 'Primavera_(Botticelli)', region: 'west', category: '画', week: 11 },
  { title: '人间乐园', artist: '博斯', slug: 'The_Garden_of_Earthly_Delights', region: 'west', category: '画', week: 11 },
  { title: '大使们', artist: '小荷尔拜因', slug: 'The_Ambassadors_(Holbein)', region: 'west', category: '画', week: 11 },
  { title: '记忆的永恒', artist: '达利', slug: 'The_Persistence_of_Memory', region: 'west', category: '画', week: 11 },
  { title: '形象的叛逆', artist: '马格利特', slug: 'The_Treachery_of_Images', region: 'west', category: '画', week: 11 },
  { title: '人子', artist: '马格利特', slug: 'The_Son_of_Man', region: 'west', category: '画', week: 11 },
  { title: '维尔图诺斯', artist: '阿尔钦博托', slug: 'Vertumnus_(Arcimboldo)', region: 'west', category: '画', week: 11 },
  // 第 12 周 · 现代性
  { title: '黑方块', artist: '马列维奇', slug: 'Black_Square_(painting)', region: 'west', category: '画', week: 12 },
  { title: '构成第八号', artist: '康定斯基', slug: 'Composition_VIII', region: 'west', category: '画', week: 12 },
  { title: '空间中连续的形', artist: '波丘尼', slug: 'Unique_Forms_of_Continuity_in_Space', region: 'west', category: '雕', week: 12 },
  { title: '泉', artist: '杜尚', slug: 'Fountain_(Duchamp)', region: 'west', category: '器', week: 12 },
  { title: '下楼梯的裸女2号', artist: '杜尚', slug: 'Nude_Descending_a_Staircase,_No._2', region: 'west', category: '画', week: 12 },
  { title: '玛丽莲双联画', artist: '安迪·沃霍尔', slug: 'Marilyn_Diptych', region: 'west', category: '画', week: 12 },
  { title: '一把和三把椅子', artist: '约瑟夫·科苏斯', slug: 'One_and_Three_Chairs', region: 'west', category: '器', week: 12 },
  // 第 13 周 · 综合与回望
  { title: '阿尔勒的卧室', artist: '梵高', slug: 'Bedroom_in_Arles', region: 'west', category: '画', week: 13 },
  { title: '睡莲', artist: '莫奈', slug: 'Water_Lilies_(Monet_series)', region: 'west', category: '画', week: 13 },
  { title: '圣维克多山', artist: '塞尚', slug: 'Mont_Sainte-Victoire_(Cézanne)', region: 'west', category: '画', week: 13 },
  { title: '玩纸牌者', artist: '塞尚', slug: 'The_Card_Players', region: 'west', category: '画', week: 13 },
  { title: '我们从何处来？我们是谁？我们往何处去？', artist: '高更', slug: 'Where_Do_We_Come_From?_What_Are_We?_Where_Are_We_Going?', region: 'west', category: '画', week: 13 },
  { title: '生命之舞', artist: '蒙克', slug: 'The_Dance_of_Life_(Munch)', region: 'west', category: '画', week: 13 },
  { title: '两个弗里达', artist: '弗里达·卡罗', slug: 'The_Two_Fridas', region: 'west', category: '画', week: 13 },
];
