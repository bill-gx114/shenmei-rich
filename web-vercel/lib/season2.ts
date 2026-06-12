// 审美日课 · 第二季 (Season 2) — 主题：看什么（题材）。
// 接在季1 之后揭晓。13 周 × 7 = 91，一条「人 → 物与境 → 故事 → 身体与社会 →
// 死亡与梦 → 中国书画」的题材脉络。避开季1、漫游、已展出/选品池的作品。
// 已把现代版权/冷门、难以取得公版图的作品替换为更稳的公有领域名作。

import type { SeasonWork } from './season1.js';

export const WEEK_THEMES2: Record<number, string> = {
  1: '肖像：一张脸',
  2: '自画像：画家看自己',
  3: '风景：人退到画外',
  4: '静物：平凡之物',
  5: '日常生活：风俗画',
  6: '神话与寓言',
  7: '宗教叙事',
  8: '历史与权力',
  9: '身体',
  10: '劳动与社会',
  11: '死亡、时间与虚空',
  12: '梦境与潜意识',
  13: '中国书画：写意与气韵',
};

export const SEASON2: SeasonWork[] = [
  // 第 1 周 · 肖像
  { title: '教皇尤利乌斯二世像', artist: '拉斐尔', slug: 'Portrait_of_Pope_Julius_II', region: 'west', category: '画', week: 1 },
  { title: '蓝衣少年', artist: '庚斯博罗', slug: 'The_Blue_Boy', region: 'west', category: '画', week: 1 },
  { title: 'X夫人', artist: '萨金特', slug: 'Madame_X_(painting)', region: 'west', category: '画', week: 1 },
  { title: '卡斯蒂利奥内像', artist: '拉斐尔', slug: 'Portrait_of_Baldassare_Castiglione', region: 'west', category: '画', week: 1 },
  { title: '阅读的少女', artist: '弗拉戈纳尔', slug: 'A_Young_Girl_Reading', region: 'west', category: '画', week: 1 },
  { title: '加布里埃尔姐妹', artist: '枫丹白露画派', slug: "Gabrielle_d'Estrées_and_one_of_her_sisters", region: 'west', category: '画', week: 1 },
  { title: '见返美人图', artist: '菱川师宣', slug: '見返り美人図', lang: 'ja', region: 'east', category: '画', week: 1 },
  // 第 2 周 · 自画像
  { title: '自画像（草帽）', artist: '维瑞·勒布伦', slug: 'Self-portrait_in_a_Straw_Hat', region: 'west', category: '画', week: 2 },
  { title: '自画像（1500）', artist: '丢勒', slug: 'Self-Portrait_(Dürer,_Munich)', region: 'west', category: '画', week: 2 },
  { title: '割耳后的自画像', artist: '梵高', slug: 'Self-Portrait_with_Bandaged_Ear', region: 'west', category: '画', week: 2 },
  { title: '绝望的人', artist: '库尔贝', slug: 'The_Desperate_Man', region: 'west', category: '画', week: 2 },
  { title: '戴荆棘项链与蜂鸟的自画像', artist: '弗里达·卡罗', slug: 'Self-Portrait_with_Thorn_Necklace_and_Hummingbird', region: 'west', category: '画', week: 2 },
  { title: '自画像', artist: '索福尼斯巴·安圭索拉', slug: 'Self-portrait_(Anguissola)', region: 'west', category: '画', week: 2 },
  { title: '自画像', artist: '尼古拉·普桑', slug: 'Self-Portrait_(Poussin)', region: 'west', category: '画', week: 2 },
  // 第 3 周 · 风景
  { title: '雾海上的旅人', artist: '弗里德里希', slug: 'Wanderer_above_the_Sea_of_Fog', region: 'west', category: '画', week: 3 },
  { title: '干草堆', artist: '莫奈', slug: 'Haystacks_(Monet_series)', region: 'west', category: '画', week: 3 },
  { title: '战舰无畏号', artist: '透纳', slug: 'The_Fighting_Temeraire', region: 'west', category: '画', week: 3 },
  { title: '雪中猎人', artist: '老彼得·勃鲁盖尔', slug: 'The_Hunters_in_the_Snow', region: 'west', category: '画', week: 3 },
  { title: '麦田与柏树', artist: '梵高', slug: 'A_Wheatfield_with_Cypresses', region: 'west', category: '画', week: 3 },
  { title: '威尼斯大运河', artist: '卡纳莱托', slug: 'The_Grand_Canal_and_the_Church_of_the_Salute', region: 'west', category: '画', week: 3 },
  { title: '匡庐图', artist: '荆浩', slug: '匡庐图', lang: 'zh', region: 'east', category: '画', week: 3 },
  // 第 4 周 · 静物
  { title: '水果篮', artist: '卡拉瓦乔', slug: 'Basket_of_Fruit_(Caravaggio)', region: 'west', category: '画', week: 4 },
  { title: '鳐鱼', artist: '夏尔丹', slug: 'The_Ray_(Chardin)', region: 'west', category: '画', week: 4 },
  { title: '鸢尾花', artist: '梵高', slug: 'Irises_(painting)', region: 'west', category: '画', week: 4 },
  { title: '苹果与橘子', artist: '塞尚', slug: 'Apples_and_Oranges_(Cézanne)', region: 'west', category: '画', week: 4 },
  { title: '骷髅金字塔', artist: '塞尚', slug: 'Pyramid_of_Skulls', region: 'west', category: '画', week: 4 },
  { title: '写生珍禽图', artist: '黄筌', slug: '写生珍禽图', lang: 'zh', region: 'east', category: '画', week: 4 },
  { title: '墨竹图', artist: '文同', slug: '墨竹图', lang: 'zh', region: 'east', category: '画', week: 4 },
  // 第 5 周 · 日常生活
  { title: '农民的婚礼', artist: '老彼得·勃鲁盖尔', slug: 'The_Peasant_Wedding', region: 'west', category: '画', week: 5 },
  { title: '小街', artist: '维米尔', slug: 'The_Little_Street', region: 'west', category: '画', week: 5 },
  { title: '煎饼磨坊的舞会', artist: '雷诺阿', slug: 'Bal_du_moulin_de_la_Galette', region: 'west', category: '画', week: 5 },
  { title: '女神游乐厅的吧台', artist: '马奈', slug: 'A_Bar_at_the_Folies-Bergère', region: 'west', category: '画', week: 5 },
  { title: '阿尼埃尔的浴场', artist: '修拉', slug: 'Bathers_at_Asnières', region: 'west', category: '画', week: 5 },
  { title: '货郎图', artist: '李嵩', slug: '货郎图', lang: 'zh', region: 'east', category: '画', week: 5 },
  { title: '捣练图', artist: '张萱', slug: '捣练图', lang: 'zh', region: 'east', category: '画', week: 5 },
  // 第 6 周 · 神话与寓言
  { title: '酒神与阿里阿德涅', artist: '提香', slug: 'Bacchus_and_Ariadne', region: 'west', category: '画', week: 6 },
  { title: '田园合奏', artist: '提香', slug: 'Pastoral_Concert', region: 'west', category: '画', week: 6 },
  { title: '美惠三女神', artist: '拉斐尔', slug: 'The_Three_Graces_(Raphael)', region: 'west', category: '画', week: 6 },
  { title: '帕里斯的评判', artist: '鲁本斯', slug: 'The_Judgement_of_Paris_(Rubens,_London)', region: 'west', category: '画', week: 6 },
  { title: '农神吞噬其子', artist: '戈雅', slug: 'Saturn_Devouring_His_Son', region: 'west', category: '画', week: 6 },
  { title: '俄狄浦斯与斯芬克斯', artist: '安格尔', slug: 'Oedipus_and_the_Sphinx', region: 'west', category: '画', week: 6 },
  { title: '洛神赋图', artist: '顾恺之', slug: '洛神赋图', lang: 'zh', region: 'east', category: '画', week: 6 },
  // 第 7 周 · 宗教叙事
  { title: '哀悼基督', artist: '米开朗基罗', slug: 'Pietà_(Michelangelo)', region: 'west', category: '雕', week: 7 },
  { title: '根特祭坛画', artist: '凡·艾克兄弟', slug: 'Ghent_Altarpiece', region: 'west', category: '画', week: 7 },
  { title: '圣母领报', artist: '弗拉·安吉利科', slug: 'Annunciation_(Fra_Angelico,_San_Marco)', region: 'west', category: '画', week: 7 },
  { title: '下十字架', artist: '凡·德·维登', slug: 'Descent_from_the_Cross_(van_der_Weyden)', region: 'west', category: '画', week: 7 },
  { title: '以马忤斯的晚餐', artist: '卡拉瓦乔', slug: 'Supper_at_Emmaus_(London)', region: 'west', category: '画', week: 7 },
  { title: '西斯廷圣母', artist: '拉斐尔', slug: 'Sistine_Madonna', region: 'west', category: '画', week: 7 },
  { title: '朝元仙仗图', artist: '武宗元', slug: '朝元仙仗图', lang: 'zh', region: 'east', category: '画', week: 7 },
  // 第 8 周 · 历史与权力
  { title: '荷拉斯兄弟之誓', artist: '雅克-路易·大卫', slug: 'Oath_of_the_Horatii', region: 'west', category: '画', week: 8 },
  { title: '布雷达的投降', artist: '委拉斯开兹', slug: 'The_Surrender_of_Breda', region: 'west', category: '画', week: 8 },
  { title: '1808年5月2日', artist: '戈雅', slug: 'The_Second_of_May_1808', region: 'west', category: '画', week: 8 },
  { title: '希阿岛的屠杀', artist: '德拉克洛瓦', slug: 'The_Massacre_at_Chios', region: 'west', category: '画', week: 8 },
  { title: '雅法的鼠疫病人', artist: '格罗', slug: 'Bonaparte_Visiting_the_Plague_Victims_of_Jaffa', region: 'west', category: '画', week: 8 },
  { title: '历代帝王图', artist: '阎立本', slug: '历代帝王图', lang: 'zh', region: 'east', category: '画', week: 8 },
  { title: '长江万里图', artist: '夏圭', slug: '长江万里图', lang: 'zh', region: 'east', category: '画', week: 8 },
  // 第 9 周 · 身体
  { title: '乌尔比诺的维纳斯', artist: '提香', slug: 'Venus_of_Urbino', region: 'west', category: '画', week: 9 },
  { title: '镜前的维纳斯', artist: '委拉斯开兹', slug: 'Rokeby_Venus', region: 'west', category: '画', week: 9 },
  { title: '泉', artist: '安格尔', slug: 'The_Source_(Ingres)', region: 'west', category: '画', week: 9 },
  { title: '奥林匹亚', artist: '马奈', slug: 'Olympia_(Manet)', region: 'west', category: '画', week: 9 },
  { title: '土耳其浴室', artist: '安格尔', slug: 'The_Turkish_Bath', region: 'west', category: '画', week: 9 },
  { title: '沉睡的吉普赛人', artist: '亨利·卢梭', slug: 'The_Sleeping_Gypsy', region: 'west', category: '画', week: 9 },
  { title: '青铜时代', artist: '罗丹', slug: 'The_Age_of_Bronze', region: 'west', category: '雕', week: 9 },
  // 第 10 周 · 劳动与社会
  { title: '石工', artist: '库尔贝', slug: 'The_Stonebreakers', region: 'west', category: '画', week: 10 },
  { title: '晚钟', artist: '米勒', slug: 'The_Angelus_(painting)', region: 'west', category: '画', week: 10 },
  { title: '三等车厢', artist: '杜米埃', slug: 'The_Third-Class_Carriage', region: 'west', category: '画', week: 10 },
  { title: '伏尔加河上的纤夫', artist: '列宾', slug: 'Barge_Haulers_on_the_Volga', region: 'west', category: '画', week: 10 },
  { title: '第四等级', artist: '佩利扎·达·沃尔佩多', slug: 'The_Fourth_Estate_(painting)', region: 'west', category: '画', week: 10 },
  { title: '播种者', artist: '梵高', slug: 'The_Sower_(Van_Gogh)', region: 'west', category: '画', week: 10 },
  { title: '刨地板的工人', artist: '卡耶博特', slug: 'The_Floor_Scrapers', region: 'west', category: '画', week: 10 },
  // 第 11 周 · 死亡、时间与虚空
  { title: '阿尔卡迪亚的牧人', artist: '普桑', slug: 'Et_in_Arcadia_ego', region: 'west', category: '画', week: 11 },
  { title: '人生虚空的寓言', artist: '哈尔曼·斯滕维克', slug: 'Still_Life:_An_Allegory_of_the_Vanities_of_Human_Life', region: 'west', category: '画', week: 11 },
  { title: '死亡之岛', artist: '勃克林', slug: 'Isle_of_the_Dead_(painting)', region: 'west', category: '画', week: 11 },
  { title: '死神的胜利', artist: '老彼得·勃鲁盖尔', slug: 'The_Triumph_of_Death', region: 'west', category: '画', week: 11 },
  { title: '墓中的基督', artist: '小荷尔拜因', slug: 'The_Body_of_the_Dead_Christ_in_the_Tomb', region: 'west', category: '画', week: 11 },
  { title: '破碎的脊柱', artist: '弗里达·卡罗', slug: 'The_Broken_Column', region: 'west', category: '画', week: 11 },
  { title: '骷髅幻戏图', artist: '李嵩', slug: '骷髅幻戏图', lang: 'zh', region: 'east', category: '画', week: 11 },
  // 第 12 周 · 梦境与潜意识
  { title: '梦魇', artist: '富塞利', slug: 'The_Nightmare', region: 'west', category: '画', week: 12 },
  { title: '梦', artist: '亨利·卢梭', slug: 'The_Dream_(Rousseau)', region: 'west', category: '画', week: 12 },
  { title: '戈尔孔达', artist: '马格利特', slug: 'Golconda_(painting)', region: 'west', category: '画', week: 12 },
  { title: '十字圣约翰的基督', artist: '达利', slug: 'Christ_of_Saint_John_of_the_Cross', region: 'west', category: '画', week: 12 },
  { title: '爱之歌', artist: '基里科', slug: 'The_Song_of_Love', region: 'west', category: '画', week: 12 },
  { title: '我与村庄', artist: '夏加尔', slug: 'I_and_the_Village', region: 'west', category: '画', week: 12 },
  { title: '雨后的欧洲', artist: '马克斯·恩斯特', slug: 'Europe_after_the_Rain_II', region: 'west', category: '画', week: 12 },
  // 第 13 周 · 中国书画
  { title: '五马图', artist: '李公麟', slug: '五马图', lang: 'zh', region: 'east', category: '画', week: 13 },
  { title: '瑞鹤图', artist: '赵佶', slug: '瑞鶴圖', lang: 'zh', region: 'east', category: '画', week: 13 },
  { title: '芙蓉锦鸡图', artist: '赵佶', slug: '芙蓉锦鸡图', lang: 'zh', region: 'east', category: '画', week: 13 },
  { title: '听琴图', artist: '赵佶', slug: '听琴图', lang: 'zh', region: 'east', category: '画', week: 13 },
  { title: '潇湘图', artist: '董源', slug: '潇湘图', lang: 'zh', region: 'east', category: '画', week: 13 },
  { title: '渔父图', artist: '吴镇', slug: '渔父图_(吴镇)', lang: 'zh', region: 'east', category: '画', week: 13 },
  { title: '富春大岭图', artist: '黄公望', slug: '富春大岭图', lang: 'zh', region: 'east', category: '画', week: 13 },
];
