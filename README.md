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

## 版本

- `manifest.json` 版本 `0.5.1`（schemaVersion 9）
