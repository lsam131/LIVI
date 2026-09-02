# LIVI 客製化車機：開發計畫與架構規格書

> 版本：0.1（2026-09-02）　狀態：已核准（2026-09-02）　語言：zh-TW
> 上游：`f-io/livi`（GPL-3.0-or-later，最新穩定版 v8.3.0，`main` 上為 v9.0.0 開發中）

---

## 1. 背景與目標（Context）

我們要在 Raspberry Pi 4B 上部署一套以 `f-io/livi` 為基礎的客製化車機。使用者已決定：

| 項目 | 決定 |
|---|---|
| 顯示輸出 | Pi 4B 的 TRRS 3.5mm 轉 RCA **複合視訊，NTSC 720×480@60i**（非 HDMI） |
| 顯示備案 | 若複合輸出在 LIVI 合成器下不可用，改用 **HDMI→AV 轉換器** |
| 輸入裝置 | **GT911 電容觸控外屏**（I2C，FPC 軟排線轉 6p），走 Linux `goodix` 驅動 |
| 麥克風 | **USB 音效卡**接麥克風（供 CarPlay/AA 語音與通話），走 PipeWire，於 LIVI 設定 `audioInputDevice` 選取 |
| CAN 介面 | **MKS CANable Pro（USB）**，以 `gs_usb`/candlelight 韌體在 Linux 上直接成為 SocketCAN `can0` |
| 客製化類型 | 存取硬體/系統、修改既有 UI 版面、新增繁體中文語系 |
| 首個硬體功能 | **OBD-II / CAN 車輛資訊**：LIVI 既有儀表欄位之外，加上冷氣（開關、溫度、風量、風向、循環、前後除霧、雙區恆溫）、瞬間油耗、可行駛里程 |
| 程式碼託管 | GitHub Fork（沿用上游 CI 建 arm64 AppImage） |
| Pi 狀態 | 尚未安裝，全新開始 |

核心目標依優先序：**(1) 上游可維護性**、(2) 客製化 UI、(3) 輕量功能擴充。
所有設計皆以「未來 `git merge upstream/main` 時衝突趨近於零」為第一準則。

---

## 2. 上游架構分析

### 2.1 技術堆疊
- **Electron 44 + React 19 + TypeScript 7 + Vite 8**，套件管理 **pnpm 11**，Node 24。
- **狀態管理：Zustand**（`src/renderer/src/store/store.ts`），兩個 store：
  - `useLiviStore`：`settings`（完整 `Config`）、音量、藍牙、裝置資訊；`saveSettings(patch)` 走 IPC `save-settings` 合併寫回 `config.json`。
  - `useStatusStore`：倒車、燈光、`activeProtocol`、`isStreaming`、`requestedPath`。
- **UI：Material UI v9**，主題在 `src/renderer/src/theme/theme.ts`（`buildRuntimeTheme` 可套用 config 的顏色覆寫）。
- **路由：react-router HashRouter**，`ROUTES` enum 在 `src/main/shared/types/Pages.ts`；`src/renderer/src/routes/appRoutes.tsx` 依 `PAGES` 產生路由。
- **設定頁：Schema 驅動**（`src/renderer/src/routes/schemas/*.ts` → `generateRoutes`），節點型別含 `route/checkbox/select/string/number/color/slider/custom`；`custom` 型別可掛任意 React 元件。
- **i18n：i18next**，語系檔 `src/renderer/src/locales/{en,de,fr,ua}.json`，註冊於 `src/renderer/src/i18n.ts`。
- **原生層**：Rust（`native/livi-compositor` 內嵌 wlroots 合成器、`livi-helperd`、`livi-crypto`、`livi-gst-video`）+ 自帶 GStreamer 二進位（`assets/gstreamer`）。
- **測試：Vitest** 兩個 project（`renderer` jsdom / `main` node），glob 為 `src/renderer/**/*.test.tsx?` 與 `src/main/**/*.test.ts`，**新增目錄會自動被納入**。
- **Lint/Format：Biome**，pre-commit 由 husky 觸發。

### 2.2 程序模型與目錄
```
src/main/        Electron main：app/（init、gpu、hostOutput 顯示模式）、config/（loadConfig、validateConfig）、
                 ipc/（register.ts 提供 registerIpcHandle/registerIpcOn）、services/（audio、projection、custom、carBridge、power）、
                 shared/types/（Config、DefaultConfig、Pages、Telemetry — renderer 以 @shared 共用）
src/preload/     contextBridge 暴露 window.projection 與 window.app
src/renderer/src/ App.tsx(main 視窗) / DashApp.tsx / AuxApp.tsx；components/{layouts,navigation,pages}；routes/；store/；theme/；locales/
```

### 2.3 上游已內建的擴充點（我們要善用的）
1. **Custom 分頁**：`userData/custom/index.html` + `icon.svg`，以 `app://index.html/custom/…` 提供；或設定 `customUrl` 走 `CustomProxy` 反向代理。適合純網頁小工具，**零程式碼修改**。
2. **Telemetry Socket.IO（port 4000，事件 `telemetry:push`）**：任何外部程序可推送 `speedKph/rpm/fuelPct/gps.*/nightMode/path/volume…`。適合**硬體資料進 LIVI 儀表板**，零程式碼修改。`TelemetryPayload` 允許任意額外欄位。
3. **`Config` 內建可調參數**：`displayMode`（"WxH"）、`uiZoomPercent`、`mainScreenWidth/Height`、`hand`（左右駕）、`startPage`、`kiosk`、`bindings`（按鍵綁定）、六組主題色。多數 UI 需求可能**只靠設定**達成。
4. **`registerIpcHandle/registerIpcOn`** 有 remove-then-add 語意，可安全重複註冊，適合我們的模組自行掛 IPC。
5. **安裝腳本與更新器皆可重導向**：`LIVI_REPO`、`LIVI_INSTALLER_BRANCH`（install.sh）；`UPDATE_REPO`、`UPDATE_FEED`（in-app updater）。

### 2.4 對客製化不利的地方（需迴避）
- `validateConfig.ts` **只保留 schema 中的 key**，未知 key 會被 `config.json` 丟棄 → 我們的設定**不能**直接塞進 `config.json`，除非修改 `Config.ts` + `DefaultConfig.ts`（高衝突風險）。
- `ROUTES` 是 `enum`、`PAGES` 是常數陣列，新增頁面若要出現在「Start Page」選單就得改上游檔。
- `useTabsConfig.tsx` 以硬編碼陣列決定導覽列分頁，無 plugin 註冊機制。
- `index.html` 有 `grid-template-columns: 74px auto` 的硬編碼導覽寬度。
- `electron-builder.yml` 的 `appId: dev.f-io.livi`、產品名 `LIVI` 決定 `userData` 路徑（`~/.config/LIVI`）。

---

## 3. 關鍵風險與前置驗證（Phase 0 Spike）

| # | 風險 | 處置 |
|---|---|---|
| R1 | **複合視訊輸出**：Pi 4 需 `dtoverlay=vc4-kms-v3d,composite`，此參數**會停用 HDMI**；LIVI 以 `wlr-randr` 列舉模式，未針對 `Composite-1` 連接器測過；Cage/wlroots 在交錯 (interlaced) 模式的行為未知。 | Phase 0 在乾淨 Pi OS Trixie Lite 上先用官方 headless installer 跑起 LIVI，再切換 composite，驗證能否顯示與 GLES3 效能。若不可行，備案為外接 HDMI→AV 轉換器（對 LIVI 而言就是一般 HDMI 顯示器，風險歸零）。 |
| R2 | 複合視訊解析度極低（720×480）且有 overscan（約 5–8% 邊緣不可見）。 | 使用 `displayMode=720x480`、`uiZoomPercent`、CarPlay `projectionViewArea*`/`SafeArea*` 內縮；UI 覆寫層加大字級與點擊區。 |
| R3 | **GT911 觸控**需 I2C + 中斷/重置 GPIO；LIVI installer 已為 MFi 佔用 `i2c-gpio`（GPIO 19/26，bus 2），需避開。觸控座標與 720×480 及 overscan 的對映需校正。 | `dtoverlay=goodix,interrupt=<n>,reset=<n>` 走硬體 `i2c1`（GPIO 2/3）；以 `libinput` 校正矩陣處理縮放/翻轉；LIVI 的 `livi-touch-filter` udev 規則會自動視為觸控面板。Phase 0 一併驗證。 |
| R7 | **冷氣資訊不在標準 OBD-II PID 內**，必須讀車廠專屬 CAN 訊框，需反解 CAN ID/DBC。CANable Pro 若出廠為 slcan 韌體需刷成 candlelight 才有原生 SocketCAN。 | 資料擷取放在 **LIVI 外部的 Python daemon**（python-can + SocketCAN `can0`），LIVI 端零修改；標準 PID 走 ISO-TP 請求（0x7DF），冷氣走被動監聽反解；先以 `telemetry-sim` 模擬欄位開發 UI，CAN 反解與 UI 並行。 |
| R8 | USB 音效卡麥克風與 LIVI 內建 GStreamer/PipeWire 音訊鏈的相容性（取樣率、WirePlumber 角色）。 | Phase 0 以官方 AppImage 在 Settings → Audio 選取該裝置並測試 Siri/通話；上游 `wireplumberBtRoles.ts` 已處理 BT，USB 卡通常免改。 |
| R4 | 開發機（此 Mac）目前**只有 git**，無 Node 24 / pnpm / Rust。 | Phase 1 以 `nvm`/corepack 安裝；macOS 可執行 `pnpm dev` 做 UI 開發，原生模組由 CI 建置。 |
| R5 | 上游釋出頻率高（每 2–4 週一版），且 v8→v9 主版本跳動。 | 只追蹤**釋出 tag** 合併，不追 `dev`/nightly；小步頻繁合併勝過一次大合併。 |
| R6 | In-app 更新器預設指向 `f-io/LIVI`，會把我們的客製版覆蓋掉。 | systemd unit 加 `Environment=UPDATE_REPO=<我們的 fork>`；或關閉更新按鈕。 |

---

## 4. Git 工作流

### 4.1 儲存庫與 remote
```
origin    = github.com/<you>/livi      （fork，我們的程式碼）
upstream  = github.com/f-io/livi        （唯讀，只 fetch）
```

### 4.2 分支模型
| 分支 | 用途 | 規則 |
|---|---|---|
| `upstream-main` | **純鏡像**上游 `main`，不含任何我們的 commit | 只允許 `git fetch upstream && git push origin upstream/main:upstream-main` |
| `custom/main` | **我們的預設分支**，= 上游 + 客製化 | 只接受 PR 合併；CI 在此建置 AppImage |
| `feat/<spec-id>-<slug>` | 每個功能規格一支 | 從 `custom/main` 開，PR 回 `custom/main` |
| `sync/upstream-vX.Y.Z` | 同步上游釋出版的暫存分支 | 解衝突後 PR 回 `custom/main` |

**為何用 merge 而非 rebase**：`custom/main` 會被 CI 與 Pi 上的更新器引用，歷史必須穩定；merge 保留「哪些是我們的 commit」的清楚邊界。個別 feature 分支內部可自由 rebase。

### 4.3 同步上游釋出版 SOP
```bash
git fetch upstream --tags
git switch -c sync/upstream-v9.1.0 custom/main
git merge v9.1.0            # 只合 tag，不合 dev/nightly
# 解衝突 → 對照 custom/UPSTREAM_TOUCHPOINTS.md 逐一確認掛鉤點仍在
pnpm install:ci && pnpm typecheck && pnpm test
# PR → custom/main；CI 綠燈後合併並打 tag
git tag v9.1.0-custom.1
```
- 啟用 `git config rerere.enabled true`，重複衝突自動套用上次解法。
- 我們的版本標籤格式：`v<上游版本>-custom.<N>`，一眼可見基底。
- `package.json` 的 `version` **不改**（避免每次同步衝突）；我們的版本以 git tag 與 CI 產物檔名表達。

### 4.4 Commit 規範
- 訊息以 `custom:` 前綴（例：`custom(ui): shrink nav rail for 720x480`），`git log --grep '^custom' ` 即可列出所有客製化 commit，方便日後重放或審視。
- 修改上游檔案的 commit 必須在訊息內註明 `touchpoint: <檔案>`。

---

## 5. 擴充架構：隔離策略

### 5.1 原則
1. **新程式碼一律放在專屬目錄**，上游檔案只留「一行掛鉤」。
2. 掛鉤點總數受控，全部登錄在 `custom/UPSTREAM_TOUCHPOINTS.md`（檔案、行為、為何無法避免）。
3. 能靠**設定**、**CSS 覆寫**、**外部程序**達成的，就不寫進 Electron 程式碼。
4. 我們的設定**獨立存檔** `userData/custom.json`，不碰上游 `Config`。

### 5.2 目錄配置
```
custom/                              ← 非程式碼：規格、文件、部署
  specs/NNN-<slug>.md                 每個功能一份規格（規格驅動開發）
  UPSTREAM_TOUCHPOINTS.md             掛鉤點清單（同步上游時的檢查表）
  pi/                                 config.txt / cmdline.txt 片段、systemd override、安裝腳本包裝
  locales/zh-TW.json                  繁中翻譯（由 renderer 端載入）

src/main/custom/                     ← Electron main 端客製化
  index.ts                            registerCustomMain(runtimeState, services) 單一進入點
  config/customConfig.ts              custom.json 讀寫、預設值、驗證
  services/<feature>/…                硬體/系統服務（GPIO、序列埠…）
  ipc/…                               以 'custom:' 為前綴的 IPC channel，用 registerIpcHandle 註冊

src/preload/custom.ts                ← exposeCustomApi()：contextBridge 暴露 window.custom
src/types/custom.d.ts                ← Window 型別擴充（declare global）

src/renderer/src/custom/             ← Renderer 端客製化
  index.ts                            initCustomRenderer()：載入 zh-TW、注入 CSS、註冊 profile
  routes.tsx                          customRoutes（新頁面）
  tabs.tsx                            useCustomTabs()（導覽列分頁）
  settingsSchema.ts                   customSettingsSchema（Settings 內新增一個 route 節點，內用 type:'custom' 元件讀寫 custom.json）
  store/customStore.ts                Zustand store（與 useLiviStore 同一慣例）
  theme/overrides.css                 版面覆寫（依 data-profile 套用）
  theme/themeOverrides.ts             MUI theme 覆寫函式
  pages/<feature>/…                   新頁面元件（含 __tests__/）
```

### 5.3 上游掛鉤點（預估總數 7 處，每處 1–2 行）
| # | 檔案 | 改動 | 用途 |
|---|---|---|---|
| T1 | `src/main/index.ts` | `await registerCustomMain(runtimeState, services)`（在 `createMainWindow` 前） | 啟動 main 端服務與 IPC |
| T2 | `src/preload/index.ts` | `exposeCustomApi()` | 暴露 `window.custom` |
| T3 | `src/renderer/src/main.tsx` | `initCustomRenderer()` + theme 經 `applyCustomTheme()` | 語系、CSS、主題 |
| T4 | `src/renderer/src/routes/appRoutes.tsx` | `...customRoutes` | 新頁面路由 |
| T5 | `src/renderer/src/components/navigation/useTabsConfig.tsx` | `...useCustomTabs(role)` | 導覽列分頁 |
| T6 | `src/renderer/src/routes/schemas/schema.ts` | children 加 `customSettingsSchema` | Settings 內的客製化區塊 |
| T7 | `src/renderer/src/routes/schemas/generalSchema.ts` | language options 加 `{ value: 'zh-TW' }` 一行 | 語言選單 |

**刻意不碰**：`Config.ts`、`DefaultConfig.ts`、`validateConfig.ts`、`Pages.ts`、`index.html`、`AppLayout.tsx`、`NavRail.tsx`、`theme.ts`、`i18n.ts`（zh-TW 以 `i18n.addResourceBundle` 於 runtime 注入）、`electron-builder.yml`（暫不改 appId，避免 userData 路徑分裂；若日後要與官方版並存再議）。

### 5.4 各類需求的實作路線
| 需求 | 路線 | 動到上游？ |
|---|---|---|
| 720×480 版面（導覽列縮窄、字級、點擊區、overscan 內縮） | ① 先用 `displayMode`/`uiZoomPercent`/view-safe area 設定；② 不足處以 `overrides.css`（`html[data-profile="composite-480"]` 選擇器覆蓋 `#main` grid、`.MuiTab-root` 尺寸）+ `themeOverrides.ts` | 僅 T3 |
| 隱藏/重排分頁 | `useCustomTabs` 回傳過濾與重排後陣列（T5 改為 `return applyCustomTabs(tabs)` 包裝原陣列） | 僅 T5 |
| 繁體中文 | `custom/locales/zh-TW.json` + runtime `addResourceBundle`；上游 key 新增時 fallback 到 en | T3、T7 |
| 硬體資料 → 儀表板（速度、油量、倒車…） | **路線 A（優先）**：Pi 上獨立 daemon（Python/Node）推送 Socket.IO `telemetry:push`（含 `reverse`、`nightMode`、`path` 可驅動 LIVI 行為），LIVI 零修改 | 無 |
| **OBD-II/CAN 車輛資訊頁（含冷氣）** | 路線 A + 新 renderer 頁面：daemon 推送既有欄位（`speedKph`、`rpm`、`fuelRateLph`、`consumptionLPer100Km`、`rangeKm`…）餵上游儀表板，另加自訂命名空間 `hvac.*`（`power/tempL/tempR/fan/mode/recirc/defrostF/defrostR/dual`）；`useVehicleTelemetry` 會原樣保留額外欄位，我們的頁面 `custom/pages/vehicle/` 直接讀取。**main 端零修改** | T4、T5 |
| 硬體需要 UI 互動（例如 GPIO 控制、序列埠設定） | **路線 B**：`src/main/custom/services/` + `custom:` IPC + `window.custom` + 新頁面 | T1、T2、T4、T5 |
| 純資訊型小工具 | 上游 Custom 分頁（`userData/custom/index.html`），由 `custom/pi/` 部署 | 無 |

### 5.5 型別與測試
- 我們的 IPC channel 名稱、payload 型別集中於 `src/main/custom/ipc/contract.ts`，preload 與 renderer 共用。
- 每個新模組附 `__tests__/`，沿用上游 Vitest 設定與 mock 慣例（`vitest.setup.ts` / `vitest.main.setup.ts`）；CI `pnpm test` 自動涵蓋。
- 新增一支 `custom/scripts/check-touchpoints.sh`：grep 驗證 T1–T7 掛鉤仍存在，於同步上游後與 CI 執行，缺一即失敗。

---

## 6. 顯示與部署規格（複合視訊）

### 6.1 Pi 系統設定（`custom/pi/`）
- `/boot/firmware/config.txt`：`dtoverlay=vc4-kms-v3d,composite`（注意：Pi 4 上會停用 HDMI；開發期先用 HDMI，最後切換）；`dtparam=i2c_arm=on` + `dtoverlay=goodix,interrupt=<n>,reset=<n>`（GT911 觸控，接 `i2c1` GPIO 2/3）。
- `/boot/firmware/cmdline.txt`：`video=Composite-1:720x480@60ie vc4.tv_norm=NTSC`（`e` 強制偵測）。
- 觸控校正：`/etc/udev/rules.d/`（或 libinput quirks）設定 `LIBINPUT_CALIBRATION_MATRIX`，對應 overscan 內縮與可能的軸翻轉。
- CAN 介面：CANable Pro（`gs_usb`）以 udev 規則固定命名 `can0`，`systemd-networkd` 的 `can0.network` 設定 `BitRate=500000`（依車型調整）並自動 up。
- CAN daemon：`custom/pi/livi-can-bridge/`（Python，python-can + python-socketio），`livi-can-bridge.service` 於 `livi-kiosk.service` 之後啟動，推送至 `http://127.0.0.1:4000`。
- 麥克風：USB 音效卡免額外設定，於 LIVI Settings → Audio 選取輸入裝置；初值可寫入 `config.json` 的 `audioInputDevice`。
- LIVI `config.json` 初值：`displayMode: "720x480"`、`mainScreenWidth/Height: 720/480`、`projectionWidth/Height: 720/480`、`projectionViewArea*` 約 6% 內縮、`kiosk.main: true`、`language: "zh-TW"`、`startPage`。
- systemd `livi-kiosk.service` drop-in：`Environment=UPDATE_REPO=<fork>`。

### 6.2 安裝流程
```bash
LIVI_REPO=<you>/livi LIVI_INSTALLER_BRANCH=custom/main ./install.sh   # 沿用上游 headless installer
```
installer 已支援以 fork 為來源；我們只需在 `custom/pi/install-custom.sh` 包一層：呼叫上游腳本 → 套用 config.txt/cmdline.txt 片段 → 寫入 `config.json`/`custom.json` 初值 → 放置 telemetry daemon 的 systemd unit。

### 6.3 CI
- 沿用上游 `build.yml`（GitHub-hosted `ubuntu-24.04-arm`），改觸發分支為 `custom/main`；nightly/badges job 在 fork 關閉。
- 沿用 `release.yml`，release 名稱改用 `v<上游>-custom.<N>` tag。

---

## 7. 規格驅動開發流程
1. 在 `custom/specs/NNN-<slug>.md` 撰寫規格：目標、使用者情境、UI 草圖/尺寸、資料流、涉及掛鉤點、驗收條件、測試計畫。
2. 我依規格提出實作方案（含觸及檔案清單）→ 你核准。
3. 實作於 `feat/NNN-<slug>` → 單元測試 → macOS `pnpm dev` 視覺檢查（以 720×480 視窗）→ PR。
4. CI 產出 arm64 AppImage → Pi 實機驗證 → 合併、打 tag。

---

## 8. 里程碑
| Phase | 內容 | 完成定義 |
|---|---|---|
| 0 | Fork 建立、remote/分支建好、Mac 開發環境（Node 24、pnpm、Rust）、**複合視訊 + GT911 Spike**（R1、R3） | Pi 以官方 AppImage 在 NTSC composite 上顯示 LIVI 首頁且觸控可用；決定是否啟用 HDMI→AV 備案 |
| 1 | 骨架：`src/main/custom`、`src/renderer/src/custom`、preload、掛鉤點 T1–T7、`check-touchpoints.sh`、CI 調整 | `pnpm typecheck && pnpm test` 綠燈；fork CI 產出 AppImage |
| 2 | 繁體中文語系 + 720×480 版面 profile（規格 001、002） | Pi 實機上 Settings、導覽列、CarPlay 畫面在 overscan 內完整可讀 |
| 3a | 規格 003：車輛資訊頁 UI（`hvac.*` 命名空間、720×480 版面），以 `telemetry-sim` 模擬資料開發 | Mac 與 Pi 上頁面正確顯示模擬資料 |
| 3b | 規格 004：CAN bridge daemon（SocketCAN → Socket.IO），含 CAN ID 反解紀錄 `custom/specs/can-map-<車型>.md` | 實車上儀表板與冷氣頁顯示真實資料；CAN 斷線/重連不崩潰 |
| 4 | 第一次上游同步演練（合併下一個上游 tag） | 依 §4.3 SOP 完成，衝突僅限於掛鉤點或零衝突 |

---

## 9. 驗證方式
- **靜態**：`pnpm typecheck`、`pnpm lint:check`、`pnpm test`、`custom/scripts/check-touchpoints.sh`。
- **視覺**（Mac）：`pnpm dev` 並以 720×480 視窗與 `uiZoomPercent` 檢查；瀏覽器 DevTools 模擬 overscan 邊界。
- **實機**（Pi）：CI AppImage → `~/LIVI/LIVI.AppImage`；檢查 `~/LIVI/LIVI.log`；`LIVI_DEBUG_BG=1` 檢視版面平面；telemetry 以 `scripts/tools/telemetry-sim.ts` 先模擬再接真硬體。
- **同步演練**：Phase 4 實際合併一次上游 tag，量測衝突數作為架構有效性的 KPI（目標：≤ 掛鉤點數）。

---

## 10. 後續需補充的資訊（不阻擋 Phase 0–2，Phase 3b 前需確定）
1. **車型與年份**：決定冷氣等車廠專屬 CAN 訊框的反解來源（是否已有 DBC 或社群資料）。
2. **CANable Pro 目前韌體**（slcan 或 candlelight）與車輛 OBD 匯流排速率（多為 500 kbps）。
3. **GT911 的中斷/重置 GPIO 腳位**與 I2C 位址（0x14 或 0x5D）。
4. 是否使用 **MFi 協處理器**做原生 CarPlay（影響 I2C/GPIO 腳位配置與 installer 參數 `LIVI_MFI`）。
