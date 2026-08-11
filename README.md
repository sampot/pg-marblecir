# pg-marblecir

**彈珠圈**：夜市／地上畫圈彈珠。在地上畫一個大圈，圈內放幾顆目標彈珠；場外玩家用手指拖曳彈射自己的彈珠，把圈內目標彈珠打出圈外得點；若自己的彈珠殘留在圈內則扣分。純前端、零依賴、零 build 步驟。

也可當作 [Playgrounds（遊樂場）](https://play.samkuo.me/) 的 **SAM**（`index.html` 入口）。

## 一鍵開 SAM 小

```
https://play.samkuo.me/?open=sampot/pg-marblecir&name=彈珠圈&fresh=1
```

## 試玩（本機）

```bash
npx --yes serve .
# 或
python3 -m http.server 8080
```

點一下頁面後音效才會出聲。

## 操作

| 操作 | 說明 |
| --- | --- |
| 拖曳彈珠後放開 | 反向拉弓瞄準（拉力＝力道）發射 |
| 開局 | 開始一局（8 發彈數） |
| 音效開／關 | 靜音 |
| 再來一局 | 結束後重新開局 |

## 規則

- 圈內有 6 顆目標彈珠；你每發用藍色彈珠把它們打出圈外。
- 每打出一顆出圈 → **+1 分**。
- 若射完後**你自己的彈珠留在圈內** → **−1 分**（最低 0）。
- 清空圈內全部目標即勝；8 發用完沒清空則結束。
- 最佳紀錄存於 KV 鍵 `pg-marblecir-best`（同時輕量暫存 `localStorage`）；無 KV 環境照玩不報錯。

## 檔案

| 檔案 | 說明 |
| --- | --- |
| `index.html` | 結構 |
| `styles.css` | 亮／暗主題（mobile-first） |
| `app.js` | DOM／canvas 渲染 ＋ 互動 ＋ 最高分 KV |
| `game.js` | 純函式規則邏輯（圈界、碰撞、計分、回合） |
| `game.test.js` | Vitest 單元測試 |
| `audio.js` | Web Audio 合成音效 |
| `functions.js` | Playgrounds stub |
| `assets/` | 拷入的 CC0 美術／音效 |

## 技術

- 純 HTML＋CSS＋JS，ES module，無依賴、無 build。
- 簡化回合制物理：圓形碰撞、摩擦、場外牆反彈、圈界出圈判定。
- 測試：`cd pg-marblecir && npx --yes vitest@latest run`。

## 授權

本 repo 程式碼為 MIT（作者 sampot）。`assets/` 內素材來源與授權見 `ATTRIBUTION.md`。