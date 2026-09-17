# NewsLiquid 高分播报 🔊

Chrome 扩展：劫持 [NewsLiquid](https://app.newsliquid.com/trade) 页面的新闻推送，出现高分 AI 新闻时**立即语音播报**（零延迟、不联网）。

## 播报格式

```
消息源，多空方向，AI分数，关联品种
例：路透社，空，75分，原油
```

- 有 ticker 时念品种中文名（`CL`→原油、`NVDA`→英伟达，`XYZ-` 前缀剥掉）
- 无 ticker 时从标题提取品种关键词（不念长标题）
- 分数门槛默认 70，可在弹窗调

## 特性

- **零延迟**：浏览器内置 `speechSynthesis`，新闻出现即刻出声，不等待联网合成
- **可调速**：0.5x～2.5x（默认 2x），优先锁定 Google 普通话（微软 Huihui 等对语速不响应）
- **不消耗 token**：复用页面已有的推送连接

## 安装

1. 下载本仓库（Code → Download ZIP 解压，或 `git clone`）
2. Chrome 打开 `chrome://extensions/`
3. 右上角开启「开发者模式」
4. 点「加载已解压的扩展程序」，选本目录

## 使用

1. 打开 `app.newsliquid.com/trade`
2. 点扩展图标 → 弹窗里可调语速 / 分数门槛 / 音量 / 标的数量
3. 点「测试播报」验证音色和语速

## 故障排查（没声音）

扩展不会自己连新闻源，必须先打开 `app.newsliquid.com/trade`，劫持页面推送后用浏览器内置 `speechSynthesis` 在 offscreen 文档里播报。没声音通常不是代码坏，而是挂钩 / 过滤 / 语音引擎这几步没通。按顺序查：

1. **页面没挂钩（最常见）**
   必须打开交易页 `https://app.newsliquid.com/trade`。点扩展图标看状态：
   - 「页面已挂钩 · 播报中」→ 正常
   - 「未挂钩」→ 页面没打开、刷新过、或扩展没装对

2. **被设置过滤掉了**
   - 总开关 `enabled` 必须开
   - AI 评分 `< minScore`（默认 70）直接丢弃 → 先把门槛降到 50 试
   - 无标的新闻要看「无标的也播报」是否打开

3. **先点「测试播报」**
   弹窗测试会念「路透社，空，75分，原油」：
   - 测试也没声 → 问题在语音 / 音量 / offscreen，不在挂钩
   - 测试有声、新闻没声 → 挂钩或分数过滤问题

4. **浏览器语音本身不出声**
   - 检查系统音量、Chrome 标签页静音
   - 本机要有中文语音包（Win：设置 → 时间和语言 → 语音；Mac：辅助功能 → 语音）
   - offscreen 里 `getVoices()` 首次可能为空 → 刷新扩展或再点一次测试
   - service worker / offscreen 被回收：`chrome://extensions` 打开「Service Worker」检查视图看报错，再点「重新加载」

5. **安装方式**
   Manifest V3 未打包扩展，用「加载已解压的扩展程序」选仓库根目录（有 `manifest.json` 那层）。改代码后必须点「重新加载」并刷新 NewsLiquid 页面。

6. **快速自检**
   重新加载扩展 → 打开并登录 `app.newsliquid.com/trade` → 弹窗确认「已挂钩」+ 总开关开 + 门槛调低 → 点测试 → 看扩展后台日志（`[NewsLiquid 高分播报] Service Worker 已加载` / `Offscreen 已加载` / `Offscreen 文档已创建`）。

   区分「测试也没声」还是「测试有声但新闻没声」，加上弹窗状态文案，就能定位到具体那一步。

## 版本

- `manifest.json` 版本 `0.5.2`（schemaVersion 9）
