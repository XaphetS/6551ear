// lib/coin-names.js — 代币/代币化股票 symbol → 中文名映射
// 纯信号播报时念中文名更自然；未收录的保留原样（英文代码）

(function (root) {
  'use strict';

  const COIN_NAMES_ZH = {
    // ---- 主流代币 ----
    'BTC': '比特币', 'ETH': '以太坊', 'SOL': '索拉纳', 'BNB': '币安币',
    'XRP': '瑞波', 'ADA': '艾达', 'DOGE': '狗狗币', 'AVAX': '雪崩',
    'DOT': '波卡', 'LINK': '链环', 'LTC': '莱特币', 'BCH': '比特现金',
    'ETC': '以太经典', 'UNI': '优尼', 'AAVE': '阿维', 'TRX': '波场',
    'TON': '通', 'ATOM': '阿童木', 'NEAR': '尼尔', 'SUI': '水',
    'APT': '阿普托斯', 'ARB': '阿比', 'OP': '奥普', 'POL': '波尔',
    'MATIC': '马蹄', 'INJ': '英杰', 'SEI': '赛', 'TIA': '提亚',
    'PEPE': '佩佩', 'SHIB': '柴犬', 'WIF': '维夫', 'BONK': '邦克',
    'JUP': '木星', 'PYTH': '皮斯', 'RNDR': '渲染', 'RENDER': '渲染',
    'GRT': '图表', 'LDO': '丽都', 'ENA': '艾娜', 'EIGEN': '艾根',
    'WLD': '世界币', 'TAO': '道', 'MKR': '马克尔', 'CRV': '曲线',
    'SNX': '合成', 'COMP': '复合', 'ONDO': '昂多', 'HYPE': '海佩',
    'FIL': '文件币', 'ICP': '网络计算机', 'STRK': '斯特克',
    'GRIFFAIN': '格里芬', 'VIRTUAL': '虚拟协议', 'AI16Z': 'AI16Z',
    'FARTCOIN': '放屁币', 'POPCAT': '波普猫', 'PNUT': '花生',
    'USDT': '泰达', 'USDC': 'USD币', 'DAI': '代',

    // ---- 代币化股票（XYZ- 前缀已剥离后的 symbol）----
    'META': 'Meta', 'NVDA': '英伟达', 'TSLA': '特斯拉', 'AAPL': '苹果',
    'AMZN': '亚马逊', 'GOOGL': '谷歌', 'MSFT': '微软', 'AMD': 'AMD',
    'INTC': '英特尔', 'MU': '美光', 'AVGO': '博通', 'TSM': '台积电',
    'QCOM': '高通', 'ARM': 'ARM', 'ASML': '阿斯麦', 'SMCI': '超微电脑',
    'COIN': 'Coinbase', 'MSTR': '微策略', 'PLTR': 'Palantir', 'NFLX': '奈飞',
    'NKE': '耐克', 'DIS': '迪士尼', 'KO': '可口可乐', 'PEP': '百事',
    'JPM': '摩根大通', 'GS': '高盛', 'BAC': '美银', 'WMT': '沃尔玛',
    'XOM': '埃克森美孚', 'CVX': '雪佛龙', 'BA': '波音', 'CAT': '卡特彼勒',

    // ---- 指数 / 大宗 / 外汇 ----
    'SP500': '标普500', 'SPX': '标普500', 'QQQ': '纳指100', 'NDX': '纳指100',
    'DIA': '道指', 'DXY': '美元指数', 'VIX': '恐慌指数',
    'CL': '原油', 'OIL': '原油', 'GOLD': '黄金', 'SILVER': '白银',
    'EUR': '欧元', 'JPY': '日元', 'GBP': '英镑', 'AUD': '澳元'
  };

  function coinToZh(symbol) {
    if (!symbol) return '';
    let s = String(symbol).toUpperCase().trim();
    // XYZ- 前缀 = Backpack 代币化股票，剥掉后念股票名
    if (s.startsWith('XYZ-')) s = s.slice(4);
    return COIN_NAMES_ZH[s] || symbol; // 未收录保留原代码
  }

  // ---- 消息源 → 中文名映射（播报时念中文更自然）----
  const SOURCE_NAMES_ZH = {
    'Reuters': '路透社', 'Bloomberg': '彭博', 'CNBC': 'CNBC', 'CNN': 'CNN',
    'BBC': 'BBC', 'FT': '金融时报', 'Financial Times': '金融时报',
    'Coindesk': 'CoinDesk', 'Cointelegraph': '币电报', 'The Block': 'The Block',
    'Decrypt': 'Decrypt', 'Blockworks': 'Blockworks', 'TechCrunch': 'TechCrunch',
    'The Verge': 'The Verge', 'Wired': 'Wired', 'Business Insider': '商业内幕',
    'Politico': 'Politico', 'jin10': '金十', 'Jin10': '金十',
    'Twitter': '推特', 'Twitter Profile': '推特', 'Truth Social': '真相社交',
    '6551News': '6551', '6551Tradfi': '6551', 'Kyodo': '共同社',
    'Translation': '翻译', 'PRNewswire': '美通社', 'Business Wire': '商业电讯',
    'GlobeNewswire': '环球通讯社', 'Coinbase': 'Coinbase', 'Binance': '币安',
    'USTR': '美贸易代表署', 'Treasury': '美财政部', 'ECB': '欧央行',
    'TASS': '塔斯社', 'Interfax': '国际文传电讯', 'Weibo': '微博',
    'Telegraph': '电讯报', 'The Telegraph': '电讯报', 'Handelsblatt': '商报',
    'Welt': '世界报', 'Fox Business': '福克斯商业', 'MS NOW': '微软新闻'
  };

  function sourceToZh(newsType, source) {
    const s = String(newsType || source || '').trim();
    if (!s) return '';
    return SOURCE_NAMES_ZH[s] || s; // 未收录保留原样
  }

  root.CoinNames = { coinToZh, sourceToZh, COIN_NAMES_ZH, SOURCE_NAMES_ZH };
})(typeof self !== 'undefined' ? self : this);
