# Pi 端額外需求

上游的 installer（`scripts/install/headless/install.sh`）裝的是 LIVI 本身需要的東西。
我們的客製化另外需要以下項目，這裡逐條記錄，之後會整併進 `custom/pi/install-custom.sh`。

---

## 1. CJK 字型（繁體中文介面的必要條件）

**沒裝的話中文會全部顯示成豆腐框（□□□），整份翻譯等於白做。**

原因：上游沒有設定 MUI 的 `typography.fontFamily`，所以字型堆疊是 MUI 預設的
`"Roboto", "Helvetica", "Arial", sans-serif`。這三個具名字型都不含中日韓字符，
Chromium 會對缺字改走 fontconfig 的 per-glyph fallback，但 Raspberry Pi OS **Lite**
是精簡系統，預設不含任何 CJK 字型，fallback 找不到東西可用。

`scripts/install/packages.txt` 裡完全沒有字型套件，所以上游 installer 不會幫你裝。

### 安裝

```bash
sudo apt-get install -y fonts-noto-cjk
```

選 Noto Sans CJK 的理由：它有正體中文（TC）的正確字形，且在 720×480 這種低解析度
螢幕上小字仍然清楚。`fonts-wqy-zenhei` 體積小得多（約 15MB vs 約 110MB），但字形
以簡體設計為主，正體字的寫法有些會不合台灣習慣。SD 卡空間不是瓶頸，選字形正確的。

### 驗證

```bash
fc-match "sans-serif:lang=zh-TW"
```

要回報一個 Noto Sans CJK 的字體檔。若回報 DejaVu 之類的，代表字型沒裝成功。

裝完之後**必須重啟 LIVI**，Chromium 的字型快取在程序啟動時建立：

```bash
sudo systemctl restart livi-kiosk.service
```

---

## 2. 版面設定（規格 002）

面板是 7 吋 480×234，吃 720×480 的 NTSC 訊號後自己縮。垂直壓縮 0.487 倍，
水平 0.667 倍，兩軸不一致會把方形的漢字拉寬 1.37 倍。

處理方式分兩層：**字級靠上游現成的 uiZoomPercent，版面幾何靠我們的 CSS profile。**

### `~/.config/LIVI/config.json`

```json
{
  "uiZoomPercent": 200,
  "displayMode": "720x480",
  "mainScreenWidth": 720,
  "mainScreenHeight": 480,
  "projectionWidth": 720,
  "projectionHeight": 480,
  "language": "zh-TW",
  "kiosk": { "main": true }
}
```

`uiZoomPercent` 用 200 是因為那是上游 schema 的上限。它讓 MUI 的基礎字級
14px 變成畫布上的 28px，面板顯示後是 18.7 實體像素、6.2mm，在 70cm 視距下
約 30.6 弧分，行車中掃一眼可讀。

原本估算的目標是 30px，200% 只到 28px，差 1.3 個實體像素，肉眼分辨不出來。
真要補足得在 profile 裡加 root 字級微調，實機看過再決定值不值得。

注意 `uiZoomFactor()` 還會乘一個 `min(1, 視窗高 / 292)` 的係數。視窗高 480
時該係數為 1，不影響；若日後改用更矮的模式要重新計算。

### `~/.config/LIVI/custom.json`

```json
{
  "uiProfile": "composite-480",
  "overscanPercent": 6
}
```

`uiProfile` 啟用 `overrides.css` 裡的預補償：內容改用 720×351 的邏輯空間排版，
再垂直拉伸 1.3675 倍填滿 720×480。面板壓縮後兩軸淨縮放同為 0.667，漢字回復方正。

`overscanPercent` 是四周的安全邊距。**6 是暫定值**，Stage B 用 `LIVI_DEBUG_BG=1`
量出實際被切掉多少之後改這個數字即可，不需要改程式碼也不需要重新建置。

---

## 3. Stage B 必須驗證的項目

版面的幾何已在 Mac 上用等效視窗尺寸量測確認（邏輯高度、拉伸倍率、overscan
內縮、視訊容器反向抵銷都正確），但以下三項只有實機能回答：

1. **overscan 實際比例。** 跑 `LIVI_DEBUG_BG=1` 看洋紅色區塊被切掉多少，據此校正 `overscanPercent`。
2. **投影視訊的長寬比。** CSS 只處理 LIVI 自己的介面；CarPlay/AA 的畫面是
   livi-compositor 畫在透明視窗後面的 GPU plane，長寬比由 `projectionWidth` /
   `projectionHeight` 與 `projectionViewArea*` 決定。若畫面看起來被橫向拉寬，
   要調的是那些設定，不是 CSS。
3. **觸控座標映射。** `overrides.css` 對 `#videoContainer` 做了反向抵銷，讓它的
   `getBoundingClientRect()` 維持真實幾何，`useProjectionTouch` 才算得對。
   實機上點螢幕四個角，確認手機端的游標落在對應位置。

---

## 4. GT911 觸控

見 `custom/pi/PHASE0-SPIKE.md` 的 Stage C。腳位與 I2C 位址待實機確認後補在這裡。

---

## 5. 複合視訊輸出

見 `custom/pi/PHASE0-SPIKE.md` 的 Stage B。確認可行後把 `config.txt` 與
`cmdline.txt` 的片段固化到這裡。

---

## 6. CAN bridge（Phase 3b）

CANable Pro 的 SocketCAN 設定與 `livi-can-bridge.service`，待 Phase 3 實作。
