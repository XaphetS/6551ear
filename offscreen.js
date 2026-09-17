// offscreen.js — Offscreen 文档主逻辑（劫持模式）
// 职责：
//  1. 接收 background 转发的「带 AI 评分」新闻（来自 NewsLiquid 页面推送）
//  2. 过滤高分新闻（score >= minScore 且带关联标的），去重
//  3. 生成「纯信号」播报词（评分 + 多空方向 + 股票/代币名）
//  4. Edge-TTS 合成 + 音频播放（失败降级 beep）
// 不再自己连 WebSocket —— 复用 NewsLiquid 页面已有的推送连接。

(function () {
  'use strict';

  // ---- 默认设置 ----
  const DEFAULTS = {
    enabled: true,        // 总开关
    minScore: 70,         // 最低 AI 评分
    speakNoCoin: true,    // 无标的新闻也播报（提取品种）
    maxCoins: 3,          // 最多念几个标的
    rate: 2.0,            // 语速倍数（浏览器语音 1.0=正常，2.0=2倍速）
    volume: 1.0,          // 播放音量 0~1.5
    schemaVersion: 9      // 设置结构版本（用于迁移旧 storage）
  };

  let settings = { ...DEFAULTS };
  let lastStatus = { hooked: false, lastNews: null };

  // 去重集合（newsId）
  const seenIds = new Set();
  const SEEN_MAX = 800;

  // 播放队列（串行，避免重叠）
  let playChain = Promise.resolve();

  // ---------- 状态上报 ----------
  function reportStatus() {
    try {
      chrome.runtime.sendMessage({ target: 'background', type: 'STATUS', status: lastStatus }).catch(() => {});
    } catch (e) {}
  }

  // ---------- 设置 ----------
  // 注意：offscreen 文档在部分 Chrome 里没有 chrome.storage（只有 chrome.runtime）。
  // 因此设置不再由 offscreen 读 storage，而是由 background（Service Worker）读好后
  // 塞进 NEWS_SCORED / TEST_SPEAK 消息里传进来。settings 变量仅作兜底默认值。

  // ---------- 新闻处理 ----------
  function handleNews(payload, s) {
    if (!payload || typeof payload !== 'object') return;
    const cfg = s || DEFAULTS;
    if (!cfg.enabled) return;

    const score = payload.score;
    if (score == null || score < cfg.minScore) return;

    const coins = Array.isArray(payload.coins) ? payload.coins.filter(Boolean) : [];
    if (coins.length === 0 && !cfg.speakNoCoin) return;

    // 去重
    const id = payload.id;
    if (id != null) {
      if (seenIds.has(id)) return;
      seenIds.add(id);
      if (seenIds.size > SEEN_MAX) seenIds.clear();
    }

    lastStatus = { hooked: true, lastNews: payload.text ? String(payload.text).slice(0, 60) : null };
    reportStatus();

    const speech = buildSignalSpeech(payload, cfg);
    if (speech) enqueueSpeech(speech, cfg);
  }

  // 纯信号播报词：「消息源，多空，分数，品种」例：路透社，空，75分，原油
  // 无标的时改念标题：例：金十，空，75分，苹果主力合约日内大跌…
  function buildSignalSpeech(payload, s) {
    const cfg = s || DEFAULTS;
    const source = (window.CoinNames && CoinNames.sourceToZh)
      ? CoinNames.sourceToZh(payload.newsType, payload.source)
      : (payload.newsType || payload.source || '');
    const dir = signalToDir(payload.signal);
    const scoreText = payload.score != null ? Math.round(payload.score) + '分' : '';

    const parts = [];
    if (source) parts.push(source);
    if (dir) parts.push(dir);
    if (scoreText) parts.push(scoreText);

    const coins = Array.isArray(payload.coins) ? payload.coins.filter(Boolean) : [];
    if (coins.length > 0) {
      // 有标的：念中文品种名（去重，同一标的常有 CL + XYZ-CL 两条）
      const seen = new Set();
      const names = [];
      for (const sym of coins) {
        const zh = (window.CoinNames && CoinNames.coinToZh)
          ? CoinNames.coinToZh(sym)
          : coinToCode(sym);
        if (!zh || seen.has(zh)) continue;
        seen.add(zh);
        names.push(zh);
        if (names.length >= cfg.maxCoins) break;
      }
      if (names.length) parts.push(names.join('、'));
    } else {
      // 无标的：优先从标题提取品种关键词，提取不到才念短标题
      const items = extractCommodities(payload.text, cfg.maxCoins);
      if (items.length) parts.push(items.join('、'));
      else {
        const title = cleanTitle(payload.text, 15);
        if (title) parts.push(title);
      }
    }

    return parts.join('，');
  }

  // 标题净化：去 HTML 标签、去 URL、压空白、截断（max 默认 15 字，0 = 不截断）
  function cleanTitle(text, max) {
    if (!text) return '';
    const limit = (max == null) ? 15 : max;
    let s = String(text)
      .replace(/<[^>]+>/g, ' ')
      .replace(/https?:\/\/\S+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!s) return '';
    if (limit <= 0) return s;
    return s.length > limit ? s.slice(0, limit) + '…' : s;
  }

  // ---- 品种关键词库：无 ticker 时从标题提取品种 ----
  // 格式 [标题关键词, 播报念法]；长词在前避免短词抢先误匹配
  const COMMODITY_KEYS = [
    // 能源
    ['brent', '原油'], ['wti', '原油'], ['crude', '原油'], ['oil', '原油'],
    ['布伦特', '原油'], ['原油', '原油'], ['油价', '原油'], ['石油', '原油'], ['成品油', '原油'], ['油市', '原油'],
    ['天然气', '天然气'], ['液化气', '液化气'], ['lpg', '液化气'],
    // 贵金属
    ['贵金属', '贵金属'], ['黄金', '黄金'], ['金价', '黄金'], ['金市', '黄金'], ['gold', '黄金'],
    ['白银', '白银'], ['silver', '白银'], ['铂金', '铂金'], ['钯金', '钯金'],
    // 黑色系
    ['铁矿石', '铁矿石'], ['铁矿', '铁矿石'], ['螺纹钢', '螺纹钢'], ['螺纹', '螺纹钢'], ['钢材', '钢材'],
    ['钢市', '钢材'], ['热卷', '热卷'], ['不锈钢', '不锈钢'], ['焦煤', '焦煤'], ['焦炭', '焦炭'], ['动力煤', '动力煤'],
    ['煤炭', '煤炭'], ['煤价', '煤炭'], ['煤市', '煤炭'],
    // 有色
    ['碳酸锂', '碳酸锂'], ['工业硅', '工业硅'], ['铜', '铜'], ['铜市', '铜'], ['铝', '铝'], ['锌', '锌'], ['镍', '镍'], ['锡', '锡'], ['铅', '铅'],
    // 化工
    ['纯碱', '纯碱'], ['玻璃', '玻璃'], ['尿素', '尿素'], ['甲醇', '甲醇'], ['乙二醇', '乙二醇'],
    ['pta', 'PTA'], ['pvc', 'PVC'], ['橡胶', '橡胶'], ['纸浆', '纸浆'], ['沥青', '沥青'], ['燃料油', '燃料油'],
    // 农产品
    ['苹果', '苹果'], ['红枣', '红枣'], ['花生', '花生'], ['生猪', '生猪'], ['鸡蛋', '鸡蛋'], ['白糖', '白糖'], ['棉花', '棉花'],
    ['玉米', '玉米'], ['大豆', '大豆'], ['豆粕', '豆粕'], ['豆油', '豆油'], ['棕榈油', '棕榈油'], ['菜油', '菜油'], ['菜粕', '菜粕'],
    // 加密
    ['比特币', '比特币'], ['以太坊', '以太坊'], ['狗狗币', '狗狗币'], ['加密货币', '加密'], ['加密', '加密'],
    // 宏观 / 货币
    ['美联储', '美联储'], ['加息', '加息'], ['降息', '降息'], ['央行', '央行'], ['利率', '利率'],
    ['美元', '美元'], ['人民币', '人民币'], ['欧元', '欧元'], ['日元', '日元'], ['英镑', '英镑'], ['澳元', '澳元'],
    ['非农', '非农'], ['cpi', 'CPI'], ['gdp', 'GDP'], ['pmi', 'PMI'],
    // 股指
    ['A股', 'A股'], ['美股', '美股'], ['港股', '港股'], ['日经', '日经'], ['纳指', '纳指'], ['道指', '道指'], ['标普', '标普'],
    ['上证', '上证'], ['创业板', '创业板'], ['科创板', '科创板'],
    // 板块
    ['电力', '电力'], ['光伏', '光伏'], ['新能源', '新能源'], ['半导体', '半导体'], ['芯片', '芯片'], ['锂电', '锂电'],
    ['储能', '储能'], ['军工', '军工'], ['地产', '地产'], ['银行', '银行'], ['券商', '券商'], ['医药', '医药'],
    ['白酒', '白酒'], ['汽车', '汽车'], ['机器人', '机器人']
  ];

  // 从标题提取品种：按关键词出现位置排序、去重，最多 maxCoins 个
  function extractCommodities(text, maxCoins) {
    if (!text) return [];
    const limit = (maxCoins == null) ? 3 : maxCoins;
    const clean = cleanTitle(text, 0); // 不截断，保证扫描完整
    if (!clean) return [];
    const low = clean.toLowerCase(); // 英文大小写不敏感
    const hits = [];
    for (const [kw, name] of COMMODITY_KEYS) {
      const idx = low.indexOf(kw.toLowerCase());
      if (idx >= 0) hits.push([idx, kw.length, name]);
    }
    hits.sort((a, b) => a[0] - b[0] || b[1] - a[1]); // 按位置，同位置长词优先
    const seen = new Set();
    const out = [];
    for (const [, , name] of hits) {
      if (seen.has(name)) continue;
      seen.add(name);
      out.push(name);
      if (out.length >= limit) break;
    }
    return out;
  }

  // 品种代码：剥掉 XYZ- 前缀（代币化股票），大写
  function coinToCode(symbol) {
    if (!symbol) return '';
    let s = String(symbol).toUpperCase().trim();
    if (s.indexOf('XYZ-') === 0) s = s.slice(4);
    return s;
  }

  function signalToDir(signal) {
    const s = String(signal || '').toLowerCase();
    if (s === 'long' || s === 'positive' || s === 'bullish') return '多';
    if (s === 'short' || s === 'negative' || s === 'bearish') return '空';
    return ''; // neutral 省略
  }

  // ---------- 播放 ----------
  function enqueueSpeech(text, s) {
    playChain = playChain
      .then(() => playSpeech(text, s))
      .catch(() => {});
  }

  async function playSpeech(text, s) {
    // 主引擎：浏览器内置 speechSynthesis（零延迟、无需联网）
    const cfg = s || DEFAULTS;
    const rate = Number(cfg.rate) || 2.0;
    const volume = typeof cfg.volume === 'number' ? cfg.volume : 1.0;
    const r = await speakWithSpeechSynthesis(text, rate, volume);
    if (r && r.ok) {
      return { ok: true, engine: 'speechSynthesis', rate, voice: r.voiceName, error: '' };
    }
    playBeep();
    return { ok: false, error: (r && r.error) || '浏览器语音不可用' };
  }

  // 等待声音列表就绪（getVoices 在 offscreen 里首次常返回空，必须等 voiceschanged 或超时）
  function waitVoices() {
    return new Promise((resolve) => {
      const now = speechSynthesis.getVoices();
      if (now && now.length) {
        resolve(now);
        return;
      }
      const timer = setTimeout(() => resolve(speechSynthesis.getVoices() || []), 1500);
      speechSynthesis.addEventListener('voiceschanged', () => {
        clearTimeout(timer);
        resolve(speechSynthesis.getVoices() || []);
      }, { once: true });
    });
  }

  // 浏览器原生 speechSynthesis（零延迟，语速 0.5~2.5 倍）
  async function speakWithSpeechSynthesis(text, rate, volume) {
    try {
      if (typeof speechSynthesis === 'undefined' || !speechSynthesis.speak) return { ok: false, error: 'speechSynthesis 不可用' };
      const voices = await waitVoices();
      const zh = (voices || []).filter(v => v && /^zh/i.test(v.lang || ''));
      // 锁定 Google 普通话（微软 Huihui/Kangkang/Yaoyao 对语速不响应，当摆设跳过）
      const pick =
        zh.find(v => /google/i.test(v.name || '') && /普通话|中国大陆|zh-CN/i.test((v.name || '') + (v.lang || ''))) ||
        zh.find(v => /google/i.test(v.name || '')) ||
        zh[0] ||
        null;

      const u = new SpeechSynthesisUtterance(String(text));
      u.lang = 'zh-CN';
      if (pick) u.voice = pick;
      u.rate = Math.max(0.5, Math.min(2.5, Number(rate) || 1));
      u.pitch = 1;
      u.volume = Math.max(0, Math.min(Number(volume) || 1, 1));
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
      return { ok: true, voiceName: pick ? (pick.name + ' (' + pick.lang + ')') : '系统默认' };
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  }

  function playBlob(blob) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.volume = Math.max(0, Math.min(settings.volume || 1, 1.5));
      audio.onended = () => { URL.revokeObjectURL(url); };
      audio.onerror = () => { URL.revokeObjectURL(url); };
      audio.play()
        .then(() => resolve(true))    // 播放启动 = 有声音
        .catch(() => resolve(false));  // autoplay 被拦
    });
  }

  function playBeep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.1);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
      osc.onended = () => ctx.close();
    } catch (e) {}
  }

  // ---------- 监听 background 消息 ----------
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || msg.target !== 'offscreen') return false;

    if (msg.type === 'NEWS_SCORED') {
      // settings 由 background 塞进消息（offscreen 可能没有 chrome.storage）
      handleNews(msg.payload || {}, msg.settings || null);
      sendResponse({ ok: true });
      return false;
    }

    if (msg.type === 'TEST_SPEAK') {
      const text = String(msg.text || '测试播报成功');
      // popup 把当前选的语速/音量一并传过来，测试直接用它
      const s = {
        rate: msg.rate != null ? Number(msg.rate) : 2.0,
        volume: msg.volume != null ? Number(msg.volume) : 1.0
      };
      playSpeech(text, s).then((result) => {
        sendResponse({ ok: true, result });
      }).catch((e) => {
        sendResponse({ ok: false, error: String(e && e.message ? e.message : e) });
      });
      return true; // 异步响应，把合成/播放结果回传给 popup
    }

    if (msg.type === 'GET_STATUS') {
      sendResponse({ ok: true, status: lastStatus });
      return false;
    }

    return false;
  });

  // ---------- 启动 ----------
  // 设置由 background 通过消息传入，无需本地读 storage
  console.log('[NewsLiquid 高分播报] Offscreen 已加载（劫持模式）');
})();
