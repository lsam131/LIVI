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

## 2. GT911 觸控

見 `custom/pi/PHASE0-SPIKE.md` 的 Stage C。腳位與 I2C 位址待實機確認後補在這裡。

---

## 3. 複合視訊輸出

見 `custom/pi/PHASE0-SPIKE.md` 的 Stage B。確認可行後把 `config.txt` 與
`cmdline.txt` 的片段固化到這裡。

---

## 4. CAN bridge（Phase 3b）

CANable Pro 的 SocketCAN 設定與 `livi-can-bridge.service`，待 Phase 3 實作。
