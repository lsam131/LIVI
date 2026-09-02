# Phase 0 Spike 操作手冊：複合視訊 / GT911 / USB 麥克風

> 目標：在寫任何客製化程式碼之前，用**官方未修改的 LIVI**驗證三項硬體假設。
> 對應規格書 `custom/specs/000-development-plan.md` 的風險 R1、R3、R8。
> 這階段刻意不使用我們的 fork，避免把「我們改壞了」和「硬體不支援」兩件事混在一起。

---

## 決定性問題

整個 Spike 只為回答一句話：

> **Cage 起來之後，`wlr-randr` 有沒有列出 `Composite-1` 這個 output，而且裡面有 `720x480` 這個 mode？**

這是從上游原始碼確認的事實（`src/main/app/hostOutput.ts`）：LIVI 用 `WAYLAND_DISPLAY=wayland-0` 呼叫 `wlr-randr` 取得模式清單，而 `applyHostOutputMode()` 在套用前會檢查目標模式是否在清單內，**不在就直接放棄並印出警告**。

所以只要 `wlr-randr` 認得複合輸出，整條路就是通的；認不得，就走 HDMI→AV 轉換器備案。不需要等到 UI 做完才知道。

---

## 0. 前置準備

### 0.1 硬體清單

| 項目 | 說明 |
|---|---|
| Raspberry Pi 4B | 需 4GB 以上較穩妥 |
| microSD | 16GB 以上，Class 10 |
| TRRS 3.5mm → RCA 線 | **注意極性**，見下方警告 |
| 複合視訊螢幕 | 車用 RCA 輸入螢幕 |
| GT911 觸控外屏 | FPC 軟排線轉 6p |
| USB 音效卡 + 麥克風 | |
| HDMI 線 + 螢幕 | **Stage A 基準測試用，不可省略** |
| 網路 | 有線或無線皆可，SSH 用 |

> **TRRS 極性警告**：Pi 的 3.5mm 孔採 **TRRS，視訊在最外側環（Sleeve）**，與多數 iPod 式 AV 線的接法不同。買錯線會沒有畫面或只有聲音。若無畫面請先用萬用表確認，不要急著怪設定。

### 0.2 燒錄系統

用 Raspberry Pi Imager 燒 **Raspberry Pi OS Lite (64-bit)，Debian 13 Trixie**。

兩個硬性要求，來自上游原始碼與文件：

- **必須 64-bit**：`scripts/install/common.sh` 的 `livi_asset_arch()` 只接受 `x86_64` 與 `aarch64`，32-bit 系統會直接報錯離開。
- **必須 Trixie**：Pi 4 的 VideoCore VI 要在 Debian 13 上才有 OpenGL ES 3.x，這是 LIVI 的硬性需求。

在 Imager 的齒輪設定裡先做好：

- 啟用 SSH（密碼或金鑰皆可）
- 設定使用者名稱與密碼
- 設定 Wi-Fi（若不用有線）
- 設定地區與時區

### 0.3 保命措施（務必先做）

複合視訊一旦啟用，**Pi 4 的 HDMI 會被停用**。如果畫面沒出來又沒有 SSH，你就只能拔卡去別台電腦改檔案。所以第一次開機先確認 SSH 進得去：

```bash
ssh <你的帳號>@raspberrypi.local
```

進得去之後，記下 IP 備用：

```bash
hostname -I
```

---

## Stage A：HDMI 基準測試

**目的**：先證明 LIVI 在這台 Pi 上能跑。這樣 Stage B 若失敗，就能確定是複合視訊的問題，不是別的。

### A.1 安裝

接 HDMI 螢幕，然後：

```bash
curl -fL -o install.sh https://raw.githubusercontent.com/f-io/LIVI/main/scripts/install/headless/install.sh && chmod +x install.sh && ./install.sh
```

安裝過程會問四個問題，這次這樣答：

| 提問 | 答案 | 理由 |
|---|---|---|
| Channel：release / nightly | **1（release）** | Spike 要穩定基準，不要 nightly 的變數 |
| Set the display up this way?（HDMI-PR） | **N** | HDMI-PR 是給低像素時脈的 RGB/VGA 面板用的，且它要下載核心原始碼編譯模組，很慢。我們用複合視訊，不需要 |
| Wire up I2C for it?（MFi 協處理器） | **N** | 尚未決定是否使用原生 CarPlay。**重要**：它會佔用 GPIO 19/26 做 i2c-gpio，與 GT911 的腳位規劃要一起考慮，晚點再開 |
| Install the LIVI boot splash? | **N** | Spike 階段保留開機訊息，出事好判讀 |

安裝完會建立 `livi-kiosk.service` 並在 tty1 上以 Cage 全螢幕啟動。

### A.2 判定

```bash
systemctl status livi-kiosk.service --no-pager
```

```bash
tail -40 ~/LIVI/LIVI.log
```

| 判定 | 條件 |
|---|---|
| **PASS** | HDMI 螢幕出現 LIVI 首頁，`livi-kiosk.service` 狀態為 active，log 無反覆重啟 |
| **FAIL** | 黑畫面或服務不斷重啟 → 先解決這裡，**不要**往 Stage B 走 |

FAIL 時先看 log 有沒有 OpenGL ES 版本不足的訊息，那代表系統不是 Trixie 或 GPU 驅動沒載入。

### A.3 記下基準資料

這份輸出等一下要跟複合視訊的比對：

```bash
WAYLAND_DISPLAY=wayland-0 wlr-randr
```

會看到類似 `HDMI-A-1` 加上一串模式。把它存起來：

```bash
WAYLAND_DISPLAY=wayland-0 wlr-randr > ~/spike-hdmi-modes.txt && cat ~/spike-hdmi-modes.txt
```

---

## Stage B：切換複合視訊（NTSC 720×480）

### B.1 先備份

```bash
sudo cp /boot/firmware/config.txt /boot/firmware/config.txt.bak && sudo cp /boot/firmware/cmdline.txt /boot/firmware/cmdline.txt.bak
```

### B.2 修改開機設定

編輯 `/boot/firmware/config.txt`：

```bash
sudo nano /boot/firmware/config.txt
```

找到既有的 `dtoverlay=vc4-kms-v3d`，改成：

```
dtoverlay=vc4-kms-v3d,composite
```

> 若檔案裡是 `dtoverlay=vc4-kms-v3d-pi4` 或在 `[pi4]` 區塊下，就改該行。不要另外新增一行，會衝突。

接著 `cmdline.txt`。這個檔案**必須是單行**，不能換行：

```bash
sudo nano /boot/firmware/cmdline.txt
```

在行尾加上（注意前面要有空格）：

```
video=Composite-1:720x480@60ie vc4.tv_norm=NTSC
```

`60ie` 的 `i` 是 interlaced，`e` 是強制啟用偵測。少了 `e`，沒插螢幕時輸出不會被建立。

### B.3 重開機

```bash
sudo reboot
```

接上 RCA 線到複合視訊螢幕。**HDMI 這時候不會有畫面，這是正常的。**

### B.4 決定性判定

SSH 進去跑：

```bash
WAYLAND_DISPLAY=wayland-0 wlr-randr
```

| 判定 | 條件 | 後續 |
|---|---|---|
| **PASS** | 列出 `Composite-1`（或含 Composite 字樣的 output），且模式清單中有 `720x480` | 繼續 B.5 |
| **PARTIAL** | 列出 Composite output，但模式不是 720x480 | 記下實際模式，我們用那個數字當設計基準 |
| **FAIL** | 完全沒有 output，或 `wlr-randr` 無回應 | 走 HDMI→AV 備案，跳到「回復程序」 |

若 `wlr-randr` 有東西但螢幕仍黑，多半是 TRRS 線極性或螢幕制式（NTSC/PAL）不符，先換線再改 `vc4.tv_norm=PAL` 試。

同時檢查核心層是否認得這個 connector：

```bash
for c in /sys/class/drm/card*-*/status; do echo "$c: $(cat $c)"; done
```

應該看到含 `Composite` 的項目狀態為 `connected`。

### B.5 讓 LIVI 使用這個解析度

```bash
nano ~/.config/LIVI/config.json
```

設定這幾個鍵（其他保持不動）：

```json
{
  "displayMode": "720x480",
  "mainScreenWidth": 720,
  "mainScreenHeight": 480,
  "projectionWidth": 720,
  "projectionHeight": 480
}
```

重啟服務：

```bash
sudo systemctl restart livi-kiosk.service && sleep 5 && grep -i "hostOutput" ~/LIVI/LIVI.log | tail -5
```

log 裡應該看到 `[hostOutput] Composite-1 → 720x480`。若看到 `does not offer 720x480`，代表模式清單裡沒有這個值，回頭看 B.4 的實際模式改用那個。

### B.6 overscan 量測

複合視訊螢幕邊緣通常有 5% 到 8% 看不到。用除錯背景把版面平面畫出來：

```bash
sudo systemctl stop livi-kiosk.service
```

```bash
LIVI_DEBUG_BG=1 cage -s -- ~/LIVI/LIVI.AppImage
```

洋紅色區域就是實際版面範圍。目視估計上下左右各有多少比例被切掉，記下來，這會變成 Phase 2 的 `projectionViewArea*` 內縮值。

---

## Stage C：GT911 觸控

### C.1 確認 overlay 存在與參數

```bash
dtoverlay -h goodix
```

這會印出這顆核心實際支援的參數（`interrupt`、`reset` 等）。**以這份輸出為準**，不要照網路上的舊文章。

### C.2 接線與位址探測

GT911 走 I2C。先啟用硬體 I2C：

```bash
sudo raspi-config nonint do_i2c 0 && sudo reboot
```

接好線之後掃描位址：

```bash
sudo apt-get install -y i2c-tools && i2cdetect -y 1
```

GT911 會出現在 `0x14` 或 `0x5d`，取決於上電時 INT 腳的狀態。掃不到就先查接線與供電。

> **GPIO 衝突提醒**：LIVI 的 MFi 選項會佔用 GPIO 19（SDA）與 26（SCL）做 i2c-gpio bus 2。GT911 請走硬體 `i2c1`（GPIO 2/3），中斷與重置腳另選未被佔用的。若日後要啟用 MFi，先確認不撞號。

### C.3 載入 overlay

在 `/boot/firmware/config.txt` 加上（腳位換成你實際接的）：

```
dtparam=i2c_arm=on
dtoverlay=goodix,interrupt=<你的INT腳>,reset=<你的RST腳>
```

重開機後確認裝置有出現：

```bash
sudo libinput list-devices | grep -A 6 -i goodix
```

### C.4 判定

```bash
sudo libinput debug-events
```

用手指觸碰螢幕，應該看到 `TOUCH_DOWN` / `TOUCH_MOTION` / `TOUCH_UP` 事件。

| 判定 | 條件 |
|---|---|
| **PASS** | 有觸控事件，且座標隨手指位置變化 |
| **PARTIAL** | 有事件但座標方向相反或比例不對 → 需要 `LIBINPUT_CALIBRATION_MATRIX` 校正，記下現象即可 |
| **FAIL** | `i2cdetect` 掃不到或無任何事件 → 接線或腳位問題 |

校正留到 Phase 2 一起處理，Spike 只要確認「訊號進得來」。

---

## Stage D：USB 音效卡麥克風

### D.1 確認裝置

```bash
wpctl status
```

在 Sources 區塊應該看到你的 USB 音效卡。

### D.2 錄音測試

```bash
arecord -l
```

```bash
arecord -D plughw:1,0 -f cd -d 5 /tmp/mic-test.wav && aplay /tmp/mic-test.wav
```

（`plughw:1,0` 的數字依 `arecord -l` 的實際卡號調整。）

### D.3 在 LIVI 內選取

LIVI 起來後進 Settings → Audio，把輸入裝置選成該音效卡。對應的 config 鍵是 `audioInputDevice`。

| 判定 | 條件 |
|---|---|
| **PASS** | `wpctl status` 看得到、錄音有聲、LIVI 設定選單裡選得到 |
| **FAIL** | 記下 `wpctl status` 與 `arecord -l` 的完整輸出 |

---

## 回復程序

### 情況一：SSH 還進得去

```bash
sudo cp /boot/firmware/config.txt.bak /boot/firmware/config.txt && sudo cp /boot/firmware/cmdline.txt.bak /boot/firmware/cmdline.txt && sudo reboot
```

### 情況二：完全連不上（黑畫面且 SSH 不通）

1. 關機拔電，取出 microSD
2. 插到另一台電腦，會掛載名為 `bootfs` 的分割區
3. 用純文字編輯器把 `config.txt` 裡的 `,composite` 拿掉
4. 把 `cmdline.txt` 裡的 `video=Composite-1:...` 與 `vc4.tv_norm=NTSC` 刪掉，**保持單行**
5. 插回 Pi，接 HDMI 開機

### 情況三：改走 HDMI→AV 備案

若 Stage B 判定 FAIL，回復成 HDMI 設定，改接 HDMI→AV 轉換器。對 LIVI 而言那就是一台普通 HDMI 螢幕，`wlr-randr` 會正常列出 `HDMI-A-1`。此時解析度基準改用轉換器支援的輸入解析度（常見為 720×480 或 800×600），Phase 2 的版面工作照樣進行，只是不需要處理 composite connector 的特殊性。

---

## 有用的除錯開關

上游提供這些環境變數（`DEBUGGING.md`）：

| 變數 | 用途 |
|---|---|
| `LIVI_DEBUG_BG=1` | 洋紅色背景，看清版面與視訊平面範圍 |
| `LIVI_WLR_DEBUG=1` | 提高內嵌 wlroots 合成器的 log 等級 |
| `LIVI_NO_COMPOSITOR=1` | 不啟動內嵌合成器，用來隔離問題是否出在它 |
| `LIVI_GST_DEBUG=1` | GStreamer 除錯 |
| `LIVI_GST_SWDEC=1` | 強制軟體解碼，用來確認硬解是否為問題來源 |

手動啟動時這樣用：

```bash
sudo systemctl stop livi-kiosk.service && LIVI_DEBUG_BG=1 LIVI_WLR_DEBUG=1 cage -s -- ~/LIVI/LIVI.AppImage 2>&1 | tee ~/spike-debug.log
```

---

## 結果回報表

做完把這張表填一填給我，我據此決定 Phase 2 的設計基準：

```
Stage A  HDMI 基準            [ ] PASS  [ ] FAIL
         系統版本：            (cat /etc/os-release 的 VERSION)
         wlr-randr 輸出：      (貼上 ~/spike-hdmi-modes.txt)

Stage B  複合視訊              [ ] PASS  [ ] PARTIAL  [ ] FAIL
         wlr-randr 輸出：      (貼上完整內容)
         實際採用解析度：      ______x______
         hostOutput log：      (grep hostOutput ~/LIVI/LIVI.log)
         overscan 目測：       上___% 下___% 左___% 右___%

Stage C  GT911 觸控            [ ] PASS  [ ] PARTIAL  [ ] FAIL
         I2C 位址：            0x____
         INT / RST 腳位：      GPIO____ / GPIO____
         座標是否需校正：      [ ] 否  [ ] 是，現象：__________

Stage D  USB 麥克風            [ ] PASS  [ ] FAIL
         wpctl 裝置名稱：      __________
```

Stage C 的 I2C 位址與腳位，正好補上規格書 §10 待確認事項的第 3 項。
