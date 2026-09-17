// content.js — 隔离世界，接收 inject.js 的 postMessage，转发给 background
(function () {
  'use strict';

  window.addEventListener('message', function (ev) {
    if (ev.source !== window) return;
    const data = ev.data;
    if (!data || data.__newsliquidTts !== true) return;

    if (data.type === 'NEWS_SCORED') {
      try {
        chrome.runtime.sendMessage({
          type: 'NEWS_SCORED',
          payload: data.payload
        });
      } catch (e) { /* 扩展上下文失效时忽略 */ }
    }
  });

  // 页面加载时告知 background：本页已就绪（供 popup 显示「已挂钩」状态）
  try {
    chrome.runtime.sendMessage({ type: 'PAGE_READY', href: location.href });
  } catch (e) {}
})();
