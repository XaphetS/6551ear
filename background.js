// background.js — Service Worker
// 职责：
//  1. 创建并管理 Offscreen 文档（TTS 合成 + 音频播放）
//  2. 中转 content.js 的新闻推送 → offscreen 播放
//  3. 中转 popup 的消息（读写设置、测试播报）
//  4. 记录 NewsLiquid 页面挂钩状态（供 popup 显示）

const OFFSCREEN_URL = 'offscreen.html';
let offscreenCreating = null;

// 页面挂钩状态
let pageState = { ready: false, href: null, lastSeen: 0 };

// settings 缓存（offscreen 文档可能没有 chrome.storage，由 background 统一读写后塞进消息）
let cachedSettings = null;
function getCachedSettings() {
  return new Promise((resolve) => {
    if (cachedSettings) { resolve(cachedSettings); return; }
    try {
      if (!chrome.storage || !chrome.storage.local) { resolve({}); return; }
      chrome.storage.local.get(null, (res) => {
        cachedSettings = res || {};
        resolve(cachedSettings);
      });
    } catch (e) { resolve({}); }
  });
}

// 确保 offscreen 文档存在（AUDIO_PLAYBACK + BLOBS reason，常驻不被回收）
async function ensureOffscreenDocument() {
  try {
    if (chrome.runtime.getContexts) {
      const contexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [chrome.runtime.getURL(OFFSCREEN_URL)]
      });
      if (contexts && contexts.length > 0) return true;
    }
  } catch (e) { /* 旧版 Chrome 无 getContexts，走 create 分支 */ }

  if (offscreenCreating) {
    await offscreenCreating;
    return true;
  }

  offscreenCreating = (async () => {
    try {
      await chrome.offscreen.createDocument({
        url: OFFSCREEN_URL,
        reasons: ['AUDIO_PLAYBACK', 'BLOBS'],
        justification: '播报 NewsLiquid 页面推送的高分新闻语音'
      });
      console.log('[NewsLiquid 高分播报] Offscreen 文档已创建');
    } catch (e) {
      const msg = String(e && e.message ? e.message : e);
      if (!/already exists|Only a single offscreen/i.test(msg)) {
        console.warn('[NewsLiquid 高分播报] 创建 Offscreen 失败:', msg);
        throw e;
      }
    } finally {
      offscreenCreating = null;
    }
  })();

  await offscreenCreating;
  return true;
}

chrome.runtime.onInstalled.addListener(() => { ensureOffscreenDocument().catch(() => {}); getCachedSettings(); });
chrome.runtime.onStartup.addListener(() => { ensureOffscreenDocument().catch(() => {}); getCachedSettings(); });

// 给 offscreen 发消息
async function sendToOffscreen(msg) {
  await ensureOffscreenDocument();
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ target: 'offscreen', ...msg }, (resp) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }
        resolve(resp || { ok: false, error: 'no_response' });
      });
    } catch (e) {
      resolve({ ok: false, error: String(e && e.message ? e.message : e) });
    }
  });
}

// 消息路由
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg !== 'object') return false;

  // popup → 读设置
  if (msg.type === 'GET_SETTINGS') {
    chrome.storage.local.get(null, (res) => {
      sendResponse({ ok: true, settings: res });
    });
    return true;
  }

  // popup → 写设置
  if (msg.type === 'SET_SETTINGS') {
    // 补上 schemaVersion，避免 popup 保存时丢失版本标记导致反复迁移
    const merged = { ...(msg.settings || {}), schemaVersion: 9 };
    cachedSettings = merged;  // 更新缓存，供 NEWS_SCORED 转发时塞给 offscreen
    try {
      chrome.storage.local.set(merged, () => { sendResponse({ ok: true }); });
    } catch (e) {
      sendResponse({ ok: true });
    }
    return true;
  }

  // popup → 测试播报
  if (msg.type === 'TEST_SPEAK') {
    ensureOffscreenDocument().then(() => {
      sendToOffscreen({ type: 'TEST_SPEAK', text: msg.text || '测试播报成功', rate: msg.rate, volume: msg.volume }).then(sendResponse);
    }).catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }

  // content.js → 新闻推送（带 AI 评分），转发给 offscreen 播放
  if (msg.type === 'NEWS_SCORED') {
    sendResponse({ ok: true });
    getCachedSettings().then((settings) => {
      ensureOffscreenDocument().then(() => {
        sendToOffscreen({ type: 'NEWS_SCORED', payload: msg.payload, settings });
      }).catch(() => {});
    }).catch(() => {});
    return false;
  }

  // content.js → 页面就绪（挂钩成功）
  if (msg.type === 'PAGE_READY') {
    pageState = { ready: true, href: msg.href || null, lastSeen: Date.now() };
    sendResponse({ ok: true });
    return false;
  }

  // popup → 查询页面挂钩状态
  if (msg.type === 'GET_PAGE_STATE') {
    sendResponse({ ok: true, pageState });
    return false;
  }

  // offscreen → 状态上报（转发给 popup 实时显示）
  if (msg.target === 'background' && msg.type === 'STATUS') {
    chrome.runtime.sendMessage({ target: 'popup', type: 'STATUS', status: msg.status }).catch(() => {});
    return false;
  }

  return false;
});

console.log('[NewsLiquid 高分播报] Service Worker 已加载');
