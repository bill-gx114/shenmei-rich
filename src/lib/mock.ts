import type { Work, ArchiveWork, Pattern, ConstellationWord } from './types';

export const TODAY_WORK: Work = {
  no: '028',
  total: 365,
  title: '凯风快晴',
  artist: '葛饰北斋',
  artistRomaji: 'Katsushika Hokusai',
  year: '约 1830–1832',
  medium: '木版画 · 锦绘',
  size: '25.5 × 38.0 cm',
  series: '《富岳三十六景》',
  location: '现存大英博物馆等',
  room: '西馆 · 第 03 展厅',
  shortLabel:
    '夏末清晨数分钟内，富士山在南风中转为赤铜色。北斋以最少元素完成一次"气象"的捕获。',
  image:
    'https://upload.wikimedia.org/wikipedia/commons/3/3c/Red_Fuji_southern_wind_clear_morning.jpg',
  hotspots: [
    { x: 48, y: 58, label: '稳定大三角', detail: '山体几乎吃掉画面三分之二，构图的底气来自这道压住地平线的斜边。' },
    { x: 30, y: 12, label: '横置卷云', detail: '云不是装饰；它的横向节奏抵消了三角形的尖锐，让画面"喘气"。' },
    { x: 70, y: 78, label: '林麓肌理', detail: '基底处仅以极细线密集表达森林，把"远"留给眼睛去填。' },
  ],
  audioGuide: {
    duration: 168,
    lines: [
      { t: 0, text: '欢迎来到今日展厅。你面前是葛饰北斋《富岳三十六景》之一——《凯风快晴》。' },
      { t: 9, text: '先用十秒看一眼整体。不要急于读说明，让眼睛先于头脑。' },
      { t: 20, text: '准备好之后，注意构图——富士山被处理成一个稳定的大三角，几乎压满画面三分之二。' },
      { t: 33, text: '这是一种"敢于占满"的勇气。多数业余处理会留出过多空间，反而削弱主体。' },
      { t: 46, text: '再看色彩。只有三种：天空的群青、山体的赭红、林麓的深绿。' },
      { t: 58, text: '其中赭红只在清晨南风的几分钟里出现。日文里称作"凯风"——这个标题，是一次时机的记录。' },
      { t: 75, text: '把视线移到顶端。云不是装饰，它的横向节奏抵消了三角形的尖锐，让画面"喘气"。' },
      { t: 91, text: '再到底部。林麓只用极细的线密集表达，没有一棵树是清楚的，但你知道那是森林。' },
      { t: 105, text: '北斋没有画细节。他用最少的元素，建立了一个气象。' },
      { t: 117, text: '这是浮世绘最珍贵的地方——把瞬息的、可被忽略的，做成可以反复回看的东西。' },
      { t: 132, text: '今天可以偷学的动作：选定一个主体，敢于压满；色彩控制在三种以内；让细节退到肌理。' },
      { t: 150, text: '现在请你回到画前，再看三十秒，然后写下你的观察。' },
    ],
  },
  questions: [
    {
      q: '第一眼，你被什么吸引？',
      hint: '不必是"最美的"——是最先勾住眼睛的那一点。',
      options: ['山体的赭红', '稳定的三角形', '横置的卷云', '画面的简洁'],
    },
    {
      q: '它靠什么成立？',
      hint: '试着指出一个可被复用的处理方法。',
      options: ['主体压满画面', '色彩限制在三色', '细节退到肌理', '主次极度分明'],
    },
    {
      q: '今天偷学一个动作？',
      hint: '一个你今晚就能在自己的工作中试用的动作。',
      options: ['敢于让主体占 2/3', '把色彩限制为三色', '让背景做减法', '记录一个"时机"'],
    },
  ],
  vocabulary: [
    { word: '凯风', note: '南方的暖风。山色短暂转红的气象条件。', isNew: true },
    { word: '大三角', note: '稳定、向上、可压满。最古老的构图骨架之一。', isNew: false },
    { word: '减法', note: '不是少，是"剩下的都必要"。', isNew: false },
    { word: '气象', note: '不是描绘对象，而是捕捉一个瞬态。', isNew: true },
    { word: '锦绘', note: '多色套印的浮世绘版画工艺。', isNew: true },
  ],
};

export const PAST_WORKS: ArchiveWork[] = [
  {
    no: '027', date: '5月24日', title: '清水混凝土楼梯', artist: '安藤忠雄式',
    img: 'https://images.unsplash.com/photo-1545158535-c3f7168c28b6?w=900&auto=format&fit=crop',
    span: 4, pinned: false,
    keywords: ['折线', '材质', '光的切片'],
    reflection: '楼梯用连续的折线与粗粝的混凝土材质形成力量感。光从侧面切入，结构边缘变得清楚。',
  },
  {
    no: '026', date: '5月23日', title: '窗边植物角', artist: '室内 · 无名',
    img: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=900&auto=format&fit=crop',
    span: 3, pinned: true,
    keywords: ['留白', '晨光', '陶瓷'],
    reflection: '植物轮廓打破室内直线，窗光让叶片变成半透明焦点。',
  },
  {
    no: '025', date: '5月22日', title: '雨后柏油', artist: '街拍 · Tokyo',
    img: 'https://images.unsplash.com/photo-1519181245277-cffeb31da2e3?w=900&auto=format&fit=crop',
    span: 5, pinned: false,
    keywords: ['反光', '低饱和', '霓虹'],
    reflection: '湿地面把霓虹拉长成色条。在低饱和的城市里，反光是一种"作弊式"的色彩。',
  },
  {
    no: '024', date: '5月21日', title: '蒙德里安《构成 II》', artist: 'Piet Mondrian',
    img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Mondrian_CompRYB.jpg/700px-Mondrian_CompRYB.jpg',
    span: 3, pinned: false,
    keywords: ['网格', '原色', '比例'],
    reflection: '只有红黄蓝，但因为色块大小不等，画面在静止里有运动。',
  },
  {
    no: '023', date: '5月20日', title: '青花缠枝纹瓶', artist: '明 · 永乐',
    img: 'https://images.unsplash.com/photo-1578500494198-246f612d3b3d?w=900&auto=format&fit=crop',
    span: 2, pinned: false,
    keywords: ['钴蓝', '纹样', '器形'],
    reflection: '纹样在器形上像绷紧的歌。',
  },
  {
    no: '022', date: '5月19日', title: '路易斯·巴拉甘 红墙', artist: 'Luis Barragán',
    img: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=900&auto=format&fit=crop',
    span: 4, pinned: true,
    keywords: ['赤色', '体块', '阴影'],
    reflection: '建筑像一种被涂色的雕塑。光给阴影命名。',
  },
  {
    no: '021', date: '5月18日', title: '京都町家小院', artist: '日本 · 民居',
    img: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=900&auto=format&fit=crop',
    span: 3, pinned: false,
    keywords: ['木质', '苔藓', '比例'],
    reflection: '所有材料都在变老。新与旧用同一种节奏老去。',
  },
  {
    no: '020', date: '5月17日', title: '霍珀《夜游者》局部', artist: 'Edward Hopper',
    img: 'https://images.unsplash.com/photo-1605379399843-5870eea9b74e?w=900&auto=format&fit=crop',
    span: 5, pinned: false,
    keywords: ['夜', '玻璃', '孤独'],
    reflection: '光从店里漏出来，把夜变成可以观看的东西。',
  },
  {
    no: '019', date: '5月16日', title: '吉野山樱花远景', artist: '自然 · 春',
    img: 'https://images.unsplash.com/photo-1522383225653-ed111181a951?w=900&auto=format&fit=crop',
    span: 2, pinned: false,
    keywords: ['群', '粉灰', '云感'],
    reflection: '远看不是花，是一团粉色的云。',
  },
  {
    no: '018', date: '5月15日', title: '空厨房早晨', artist: '生活 · 自摄',
    img: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=900&auto=format&fit=crop',
    span: 3, pinned: false,
    keywords: ['白', '台面', '反光'],
    reflection: '没有人，但每件器物都在等待被拿起。',
  },
  {
    no: '017', date: '5月14日', title: '塞尚静物苹果', artist: 'Paul Cézanne',
    img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/Paul_C%C3%A9zanne_-_The_Basket_of_Apples_-_1926.252_-_Art_Institute_of_Chicago.jpg/900px-Paul_C%C3%A9zanne_-_The_Basket_of_Apples_-_1926.252_-_Art_Institute_of_Chicago.jpg',
    span: 4, pinned: false,
    keywords: ['体积', '色面', '扭曲'],
    reflection: '苹果不是圆的，是用色面拼出来的。看久了才发现桌沿是歪的。',
  },
];

export const PATTERNS: Pattern[] = [
  {
    title: '"减法"出现 9 次',
    freq: '本月最高频',
    desc: '你反复在不同案例里指出："剩下的都必要"。从北斋的天空到巴拉甘的红墙，你正在被极简打动。',
    from: '凯风快晴 · 红墙 · 京都小院 · 空厨房',
  },
  {
    title: '对"瞬态"敏感',
    freq: '稳步上升',
    desc: '你在记录中开始频繁用"清晨""刚下完雨""短暂的"——你在意作品对时机的捕捉，而不是对象本身。',
    from: '凯风快晴 · 雨后柏油 · 空厨房',
  },
  {
    title: '色彩控制偏好低饱和',
    freq: '本月趋势',
    desc: '你倾向于赞美低饱和、控制色数（≤3）的画面，对高饱和大色块保留意见。',
    from: '雨后柏油 · 青花瓶 · 樱花远景',
  },
];

export const CONSTELLATION: ConstellationWord[] = [
  { w: '留白', count: 12, from: '5/23 窗边植物角等' },
  { w: '减法', count: 9, from: '5/25 凯风快晴等' },
  { w: '大三角', count: 1, from: '5/25 凯风快晴', isNew: true },
  { w: '低饱和', count: 7, from: '5/22 雨后柏油等' },
  { w: '气象', count: 1, from: '5/25 凯风快晴', isNew: true },
  { w: '凯风', count: 1, from: '5/25 凯风快晴', isNew: true },
  { w: '锦绘', count: 1, from: '5/25 凯风快晴', isNew: true },
  { w: '晨光', count: 4, from: '5/23 窗边植物角等' },
  { w: '木质', count: 5, from: '5/21 京都小院等' },
  { w: '比例', count: 6, from: '5/24 楼梯等' },
  { w: '阴影', count: 4, from: '5/19 红墙等' },
  { w: '反光', count: 3, from: '5/22 雨后柏油' },
  { w: '钴蓝', count: 2, from: '5/20 青花瓶' },
  { w: '体块', count: 3, from: '5/19 红墙' },
  { w: '纹样', count: 2, from: '5/20 青花瓶' },
  { w: '焦点', count: 5, from: '5/23 植物角' },
];
