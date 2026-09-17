// inject.js — MAIN world 注入，劫持 NewsLiquid 页面的 WebSocket
// 原理：保存原生 window.WebSocket，用代理替换，识别连到 news-platform/rpc 的连接，
//       监听其 message，解析带 AI 评分的新闻，postMessage 给隔离世界的 content.js。
// 不建立任何新连接、不消耗用户 token —— 复用页面已经建立的推送。

(function () {
  'use strict';

  if (window.__NL_TTS_INJECTED__) return;
  window.__NL_TTS_INJECTED__ = true;

  const OriginalWebSocket = window.WebSocket;

  function hookedWebSocket(url, protocols) {
    let ws;
    try {
      ws = protocols ? new OriginalWebSocket(url, protocols) : new OriginalWebSocket(url);
    } catch (e) {
      ws = new OriginalWebSocket(url); // 某些实现不接受 protocols，回退单参数
    }

    const urlStr = String(url || '');
    if (urlStr.indexOf('news-platform/rpc') !== -1) {
      attachNewsListener(ws);
    }
    return ws;
  }

  // 保持 instanceof / 静态常量 / prototype 兼容
  hookedWebSocket.prototype = OriginalWebSocket.prototype;
  ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'].forEach(function (k) {
    if (k in OriginalWebSocket) hookedWebSocket[k] = OriginalWebSocket[k];
  });
  window.WebSocket = hookedWebSocket;

  function attachNewsListener(ws) {
    ws.addEventListener('message', function (ev) {
      try {
        const msg = JSON.parse(ev.data);
        handleNewsMessage(msg);
      } catch (e) { /* 非 JSON 忽略 */ }
    });
  }

  function handleNewsMessage(msg) {
    if (!msg || typeof msg !== 'object') return;
    const p = (msg.params && typeof msg.params === 'object') ? msg.params : null;
    if (!p) return;

    // 识别新闻评分消息：method 匹配（news.ai_update / news.update）或 params 自带 aiRating/score
    const isNewsMethod = msg.method === 'news.ai_update' || msg.method === 'news.update';
    const hasRating = p.aiRating || p.score != null;
    if (!isNewsMethod && !hasRating) return;

    const score = p.score != null ? p.score : (p.aiRating && p.aiRating.score);
    if (score == null) return;

    const coins = (p.coins || []).map(function (c) {
      return typeof c === 'string' ? c : (c && c.symbol);
    }).filter(Boolean);

    const id = p.newsId != null ? p.newsId : p.id;
    const grade = p.grade != null ? p.grade : (p.aiRating && p.aiRating.grade);
    const signal = p.signal != null ? p.signal : (p.aiRating && p.aiRating.signal);

    // 转给隔离世界的 content.js
    try {
      window.postMessage({
        __newsliquidTts: true,
        type: 'NEWS_SCORED',
        payload: {
          id: id,
          score: score,
          grade: grade || '',
          signal: signal || '',
          coins: coins,
          text: p.text || '',
          engineType: p.engineType || '',
          newsType: p.newsType || '',
          source: p.source || ''
        }
      }, '*');
    } catch (e) {}
  }

  console.log('[NewsLiquid 高分播报] inject.js 已注入，WebSocket 已挂钩');
})();
