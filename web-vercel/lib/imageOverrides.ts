// 按作品「编号 no」指定的图片源 URL 覆盖表（no 在 works 表中唯一且稳定；标题可能重名，故不以标题作键）。
//
// 为什么需要：自动取图（Wikipedia / Commons 取搜索首条）偶尔抓错文件——同名照片、
// 电影海报、地图等。发现错图时，把【正确的图片源 URL】写到这里，mirror 阶段会改从这里
// 下载并覆盖 Storage 对象（并把 image_path 标记 ?ov=1，只覆盖一次，幂等）。
// 值会先过 wikimediaDownloadUrl() 再服务端 fetch，任何可直接下载的 URL 均可：
// Commons / en.wiki 的 Special:FilePath、博物馆 CDN 直链等。
//
// 也可临时单件覆盖：GET /api/season-build?phase=imgset&no=<编号>&src=<图片URL>
//   （省略 src 时，回退到本表里该 no 的值。）
// 2026-06-23 全量体检：222 件中 34 件配图抓错，下列 32 条为已核实的正确图源。

export const IMAGE_OVERRIDES: Record<string, string> = {
  '059': 'https://commons.wikimedia.org/wiki/Special:FilePath/Wassily%20kandinsky%2C%20giallo-rosso-blu%2C%20weimar%201925%20%28centre%20pompidou%29.jpg?width=1600', // 康定斯基·黄·红·蓝
  '061': 'https://commons.wikimedia.org/wiki/Special:FilePath/Edvard%20Munch%20-%20The%20Girls%20on%20the%20Bridge%2C%20Hamburger%20Kunsthalle%20%281901%29.jpg?width=1600', // 蒙克·桥上的少女
  '066': 'https://en.wikipedia.org/wiki/Special:FilePath/Picasso%20The%20Weeping%20Woman%20Tate%20identifier%20T05010%2010.jpg', // 毕加索·哭泣的女人
  '074': 'https://commons.wikimedia.org/wiki/Special:FilePath/Giovanni%20Paolo%20Panini%20-%20Interior%20of%20the%20Pantheon%2C%20Rome%20-%20Google%20Art%20Project.jpg?width=1600', // 帕尼尼·万神殿内景
  '081': 'https://commons.wikimedia.org/wiki/Special:FilePath/%E5%BE%90%E6%B8%AD%E6%B0%B4%E5%A2%A8%E8%91%A1%E8%90%84%E5%9B%BE%E8%BD%B4.png?width=1600', // 徐渭·墨葡萄图
  '082': 'https://commons.wikimedia.org/wiki/Special:FilePath/Ni%20Zan.%20The%20Rongxi%20Studio.1372.%2074%2C7x35%2C3.%20National%20Palace%20Museum%2C%20Taipei.jpg?width=1600', // 倪瓒·容膝斋图
  '083': 'https://commons.wikimedia.org/wiki/Special:FilePath/%E5%AF%8C%E6%98%A5%E5%B1%B1%E5%B1%85%E5%9C%96%28%E7%84%A1%E7%94%A8%E5%B8%AB%E5%8D%B7%29.jpg?width=1600', // 黄公望·富春山居图
  '087': 'https://commons.wikimedia.org/wiki/Special:FilePath/Lofty%20Mt.Lu%20by%20Shen%20Zhou.jpg?width=1600', // 沈周·庐山高图
  '089': 'https://commons.wikimedia.org/wiki/Special:FilePath/%E5%80%AA%E7%93%92%20%E6%B8%94%E5%BA%84%E7%A7%8B%E9%9C%81%E5%9B%BE%E8%BD%B4.jpg?width=1600', // 倪瓒·渔庄秋霁图
  '090': 'https://commons.wikimedia.org/wiki/Special:FilePath/Zhou%20Fang.%20Court%20Ladies%20Wearing%20Flowered%20Headdresses.%20%2846x180%29%20Liaoning%20Provincial%20Museum%2C%20Shenyang..jpg?width=1600', // 周昉·簪花仕女图
  '092': 'https://commons.wikimedia.org/wiki/Special:FilePath/%E9%98%8E%E7%AB%8B%E6%9C%AC%E6%AD%A5%E8%BE%87%E5%9B%BE%E5%8D%B7.png?width=1600', // 阎立本·步辇图
  '108': 'https://commons.wikimedia.org/wiki/Special:FilePath/Le%20Guerre%20%28War%29%20by%20Henri%20Rousseau%2C%20c.%201894%2C%20oil%20on%20canvas%20-%20The%20Carnival%20of%20Being%20%28Alfred%20Jarry%20at%20the%20Morgan%29%20-%20Morgan%20Library%20%26%20Museum%20-%20New%20York%20City%20-%20DSC06832.jpg?width=1600', // 亨利·卢梭·战争
  '110': 'https://en.wikipedia.org/wiki/Special:FilePath/Founding%20Ceremony%20original.jpeg', // 董希文·开国大典
  '119': 'https://commons.wikimedia.org/wiki/Special:FilePath/Kandinsky%20-%20Composition%208%2C%20July%201923.jpg?width=1600', // 康定斯基·构成第八号
  '134': 'https://commons.wikimedia.org/wiki/Special:FilePath/Sargent%20MadameX.jpeg?width=1600', // 萨金特·X夫人
  '142': 'https://commons.wikimedia.org/wiki/Special:FilePath/Gustave%20Courbet%20-%20Le%20D%C3%A9sesp%C3%A9r%C3%A9%20%281843%29.jpg?width=1600', // 库尔贝·绝望的人
  '144': 'https://commons.wikimedia.org/wiki/Special:FilePath/Sofonisba%20Anguissola%20-%20Self-Portrait%20-%20c.%201556.jpg?width=1600', // 索福尼斯巴·安圭索拉·自画像
  '145': 'https://commons.wikimedia.org/wiki/Special:FilePath/Poussin%20-%20Autoportrait%2C%201650%2C%20INV%207302%20%3B%20MR%202329.jpg?width=1600', // 尼古拉·普桑·自画像
  '159': 'https://commons.wikimedia.org/wiki/Special:FilePath/%E5%85%83%20%E6%9F%AF%E4%B9%9D%E6%80%9D%20%E8%87%A8%E6%96%87%E5%90%8C%E5%A2%A8%E7%AB%B9%E5%9C%96%20%E8%BB%B8-Bamboo%20after%20Wen%20Tong%20MET%20DT2770.jpg?width=1600', // 文同·墨竹图
  '172': 'https://commons.wikimedia.org/wiki/Special:FilePath/Oedipus%20and%20the%20Sphinx%20by%20Ingres%2C%20RF%20218%20%2814%202012-06-29%29.jpg?width=1600', // 安格尔·俄狄浦斯与斯芬克斯
  '177': 'https://commons.wikimedia.org/wiki/Special:FilePath/El%20Descendimiento%2C%20by%20Rogier%20van%20der%20Weyden%2C%20from%20Prado%20in%20Google%20Earth.jpg?width=1600', // 凡·德·维登·下十字架
  '187': 'https://commons.wikimedia.org/wiki/Special:FilePath/%E9%95%BF%E6%B1%9F%E4%B8%87%E9%87%8C%E5%9B%BE.jpg?width=1600', // 夏圭·长江万里图
  '200': 'https://commons.wikimedia.org/wiki/Special:FilePath/Vincent%20van%20Gogh%20-%20Le%20Semeur%20dans%20un%20champ%20de%20bl%C3%A9%20au%20soleil%20couchant%20%281888%29.jpg?width=1600', // 梵高·播种者
  '202': 'https://commons.wikimedia.org/wiki/Special:FilePath/Les%20Bergers%20d%27Arcadie%20-%20Nicolas%20Poussin%20-%20Mus%C3%A9e%20du%20Louvre%20Peintures%20INV%207300%20%3B%20MR%202339.jpg?width=1600', // 普桑·阿尔卡迪亚的牧人
  '206': 'https://commons.wikimedia.org/wiki/Special:FilePath/The%20Body%20of%20the%20Dead%20Christ%20in%20the%20Tomb%20%28Holbein%20der%20J%C3%BCngere%29%20Basel.jpg?width=1600', // 小荷尔拜因·墓中的基督
  '216': 'https://commons.wikimedia.org/wiki/Special:FilePath/%E5%8C%97%E5%AE%8B%20%E6%9D%8E%E5%85%AC%E9%BA%9F%20%E4%BA%94%E9%A9%AC%E5%9B%BE.jpg?width=1600', // 李公麟·五马图
  '217': 'https://commons.wikimedia.org/wiki/Special:FilePath/Auspicious%20Cranes.jpg?width=1600', // 赵佶·瑞鹤图
  '218': 'https://commons.wikimedia.org/wiki/Special:FilePath/%E8%B5%B5%E4%BD%B6%E8%8A%99%E8%93%89%E9%94%A6%E9%B8%A1%E5%9B%BE%E8%BD%B4.png?width=1600', // 赵佶·芙蓉锦鸡图
  '219': 'https://commons.wikimedia.org/wiki/Special:FilePath/%E8%B5%B5%E4%BD%B6%E5%90%AC%E7%90%B4%E5%9B%BE%E8%BD%B4.png?width=1600', // 赵佶·听琴图
  '220': 'https://commons.wikimedia.org/wiki/Special:FilePath/%E8%91%A3%E6%BA%90%E6%BD%87%E6%B9%98%E5%9B%BE%E5%8D%B7.png?width=1600', // 董源·潇湘图
  '222': 'http://www.chinaonlinemuseum.com/resources/Painting/HuangGongwang/fuchun-range.jpg', // 黄公望·富春大岭图
  'R017': 'https://commons.wikimedia.org/wiki/Special:FilePath/Along%20the%20River%20During%20the%20Qingming%20Festival%20%28Qing%20Court%20Version%29.jpg?width=1600', // 张择端·清明上河图
};

// 仍缺正确图源（Commons/维基均无，需手动补：把图按「编号.后缀」存好后用 imgset 或本表指定）：
//   180 武宗元·朝元仙仗图（真迹失踪；网上仅书格网盘 / JS 画廊，无直链）
//   215 马克斯·恩斯特·雨后的欧洲（版权作品，无自由图源）
