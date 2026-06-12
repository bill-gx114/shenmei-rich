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
};
