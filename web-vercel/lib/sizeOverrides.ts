// Hand-curated dimensions for famous works that Wikidata doesn't carry as
// structured height/width — used ONLY as a fallback when the Wikidata lookup
// returns nothing. Deliberately limited to works whose dimensions are canonical
// / widely cited; uncertain or version-dependent works are left blank rather
// than guessed (no fabrication — same principle as letting the AI never invent
// facts). Keyed by the work's Chinese title.

export const SIZE_OVERRIDES: Record<string, string> = {
  清明上河图: '24.8 × 528.7 cm',
  富春山居图: '33 × 636.9 cm', // 无用师卷
  哭泣的女人: '60.8 × 50 cm',
  两个弗里达: '173.5 × 173.5 cm',
  黑方块: '79.5 × 79.5 cm',
  '黄·红·蓝': '127 × 200 cm',
  构成第八号: '140 × 201 cm',
  战争: '114 × 195 cm',
  后母戊鼎: '通高 133 cm',
  大桥骤雨: '约 34 × 24 cm',

  // —— 季2 补：单一传世版本、广泛著录的铁证级尺寸 ——
  // 西方
  X夫人: '208.6 × 109.9 cm',
  第四等级: '293 × 545 cm',
  伏尔加河上的纤夫: '131.5 × 281 cm',
  阿尼埃尔的浴场: '201 × 300 cm',
  我与村庄: '192.1 × 151.4 cm',
  戈尔孔达: '81 × 100 cm',
  绝望的人: '45 × 54 cm', // 库尔贝自画像
  刨地板的工人: '102 × 146.5 cm',
  死神的胜利: '117 × 162 cm', // 老布吕赫尔，普拉多
  墓中的基督: '30.5 × 200 cm', // 小荷尔拜因
  阿尔卡迪亚的牧人: '85 × 121 cm', // 普桑，卢浮宫第二版
  破碎的脊柱: '40 × 30.7 cm', // 卡罗
  十字圣约翰的基督: '205 × 116 cm', // 达利
  // 中国书画
  洛神赋图: '27.1 × 572.8 cm', // 故宫宋摹本
  瑞鹤图: '51 × 138.2 cm', // 徽宗，辽博
  芙蓉锦鸡图: '81.5 × 53.6 cm', // 徽宗，故宫
  听琴图: '147.2 × 51.3 cm', // 徽宗，故宫
  步辇图: '38.5 × 129.6 cm', // 阎立本，故宫
  写生珍禽图: '41.5 × 70.8 cm', // 黄筌，故宫
  捣练图: '37 × 145.3 cm', // 张萱宋摹，波士顿
  富春大岭图: '74.2 × 36 cm', // 黄公望，南博
  墨葡萄图: '165.7 × 64.5 cm', // 徐渭，故宫
  庐山高图: '193.8 × 98.1 cm', // 沈周，台北
  渔庄秋霁图: '96 × 47 cm', // 倪瓒，上博
  容膝斋图: '74.7 × 35.5 cm', // 倪瓒，台北
  太白行吟图: '81.2 × 30.4 cm', // 梁楷，东京国立
  泼墨仙人图: '48.7 × 27.7 cm', // 梁楷，台北
  五马图: '26.9 × 204.5 cm', // 李公麟，东京国立
  潇湘图: '50 × 141.4 cm', // 董源，故宫
  莲鹤方壶: '通高 126 cm', // 河南博物院
};
