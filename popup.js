// popup.js — 设置面板逻辑（劫持模式）

(function () {
  'use strict';

  const els = {
    enabled: document.getElementById('enabled'),
    minScore: document.getElementById('minScore'),
    scoreVal: document.getElementById('scoreVal'),
    rate: document.getElementById('rate'),
    volume: document.getElementById('volume'),
    speakNoCoin: document.getElementById('speakNoCoin'),
    maxCoins: document.getElementById('maxCoins'),
    maxCoinsVal: document.getElementById('maxCoinsVal'),
    testBtn: document.getElementById('testBtn'),
    openBtn: document.getElementById('openBtn'),
    statusDot: document.getElementById('statusDot'),
    statusText: document.getElementById('statusText')
  };

  let currentSettings = {};
  let pageHooked = false;

  function setStatus(text, ok) {
    els.statusText.textContent = text;
    els.statusDot.className = 'dot ' + (ok ? 'on' : 'off');
  }

  // ---------- 读设置 ----------
  function loadSettings() {
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (resp) => {
      if (!resp || !resp.ok) return;
      const s = resp.settings || {};
      currentSettings = s;
      els.enabled.checked = s.enabled !== false;
      els.minScore.value = s.minScore != null ? s.minScore : 70;
      els.scoreVal.textContent = els.minScore.value;
      els.rate.value = String(s.rate != null ? s.rate : 2);
      els.volume.value = String(s.volume != null ? s.volume : 1);
      els.speakNoCoin.checked = s.speakNoCoin !== false;
      els.maxCoins.value = s.maxCoins != null ? s.maxCoins : 3;
      els.maxCoinsVal.textContent = els.maxCoins.value;
      refreshStatus();
    });
  }

  // ---------- 保存设置 ----------
  function saveSettings() {
    const s = {
      enabled: els.enabled.checked,
      minScore: parseInt(els.minScore.value, 10),
      rate: parseFloat(els.rate.value),
      volume: parseFloat(els.volume.value),
      speakNoCoin: els.speakNoCoin.checked,
      maxCoins: parseInt(els.maxCoins.value, 10)
    };
    currentSettings = s;
    chrome.runtime.sendMessage({ type: 'SET_SETTINGS', settings: s }, () => {});
  }

  // ---------- 状态刷新 ----------
  function refreshStatus() {
    if (currentSettings.enabled === false) {
      setStatus('总开关已关闭', false);
      return;
    }
    // 查询页面挂钩状态
    chrome.runtime.sendMessage({ type: 'GET_PAGE_STATE' }, (resp) => {
      const st = (resp && resp.pageState) || {};
      const recent = st.ready && (Date.now() - st.lastSeen < 5 * 60 * 1000); // 5分钟内活跃
      if (st.ready) {
        pageHooked = true;
        setStatus('页面已挂钩 · 播报中', true);
      } else {
        pageHooked = false;
        setStatus('未挂钩 · 请打开 app.newsliquid.com/trade', false);
      }
    });
  }

  // ---------- 事件绑定 ----------
  function bind(el, handler) { el.addEventListener('change', handler); el.addEventListener('input', handler); }

  bind(els.enabled, saveSettings);
  bind(els.minScore, () => { els.scoreVal.textContent = els.minScore.value; saveSettings(); });
  bind(els.rate, saveSettings);
  bind(els.volume, saveSettings);
  bind(els.speakNoCoin, saveSettings);
  bind(els.maxCoins, () => { els.maxCoinsVal.textContent = els.maxCoins.value; saveSettings(); });

  els.testBtn.addEventListener('click', () => {
    const selRate = parseFloat(els.rate.value);
    setStatus('合成中…', false);
    chrome.runtime.sendMessage({ type: 'TEST_SPEAK', text: '路透社，空，75分，原油', rate: selRate }, (resp) => {
      if (chrome.runtime.lastError) { setStatus('❌ 后台无响应: ' + chrome.runtime.lastError.message, false); return; }
      if (resp && resp.ok && resp.result && resp.result.ok) {
        const used = resp.result.rate;
        setStatus('✅ 选用' + selRate + '倍 → 引擎' + (used || '?') + '倍 · ' + (resp.result.voice || '系统默认'), true);
      } else if (resp && resp.ok && resp.result) {
        setStatus('❌ ' + resp.result.error, false);
      } else if (resp && resp.ok === false) {
        setStatus('❌ ' + (resp.error || '未知错误'), false);
      } else {
        setStatus('已发送测试播报', true);
      }
    });
  });

  els.openBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://app.newsliquid.com/trade' });
  });

  // 监听 background 转发的状态更新（offscreen 实时上报）
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.target === 'popup' && msg.type === 'STATUS' && msg.status) {
      const st = msg.status;
      if (st.hooked) setStatus(st.lastNews ? ('播报中 · ' + st.lastNews) : '播报中', true);
    }
  });

  // ---------- 启动 ----------
  loadSettings();
  setInterval(refreshStatus, 3000);
})();
