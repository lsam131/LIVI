# 上游掛鉤點清單

> 這份檔案是**合併上游新版時的檢查表**。
> 自動驗證：`bash custom/scripts/check-touchpoints.sh`

我們對上游檔案的改動只有以下八處，每一處都只是「呼叫我們的模組」，沒有任何
客製化邏輯寫在上游檔案裡。所有實作都在 `src/main/custom/`、
`src/preload/custom.ts`、`src/renderer/src/custom/` 這三個地方。

目前總改動量：**8 個檔案，35 行新增，13 行修改**（全部是把陣列或斷言包一層）。

---

## 八個掛鉤點

| ID | 上游檔案 | 改動 | 我們的模組 |
|---|---|---|---|
| T1 | `src/main/index.ts` | `registerCustomMain()` | `src/main/custom/index.ts` |
| T2 | `src/preload/index.ts` | `exposeCustomApi()` | `src/preload/custom.ts` |
| T3 | `src/renderer/src/main.tsx` | `initCustomRenderer()` | `src/renderer/src/custom/index.ts` |
| T4 | `src/renderer/src/routes/appRoutes.tsx` | `.concat(customRoutes)` | `src/renderer/src/custom/routes.tsx` |
| T5 | `src/renderer/src/components/navigation/useTabsConfig.tsx` | 兩個 return 包上 `applyCustomTabs(...)` | `src/renderer/src/custom/tabs.ts` |
| T6 | `src/renderer/src/routes/schemas/schema.ts` | `...customSettingsSchemas` | `src/renderer/src/custom/settingsSchema.ts` |
| T7 | `src/renderer/src/routes/schemas/generalSchema.ts` | 語言選項包上 `applyCustomLanguages(...)` | `src/renderer/src/custom/languages.ts` |
| T8 | `src/renderer/src/routes/schemas/__tests__/generalSchema.test.ts` | 語言選項斷言改為 `expect.arrayContaining([...])` | 同上 |

### 為什麼這七處無法避免

- **T1 / T2 / T3** 是三個 process 的進入點。Electron 沒有插件機制，客製化程式碼要被執行就一定得有人呼叫，沒有別的辦法。
- **T4** 上游的 `appRoutes` 是靜態陣列，沒有註冊 API。
- **T5** 上游的 `useTabsConfig` 用硬編碼陣列決定導覽列，沒有註冊 API。
- **T6** 上游的 `settingsSchema.children` 是靜態陣列。
- **T7** 語言選項是寫死在 `generalSchema` 裡的陣列字面值。
- **T8** 上游測試用 `toEqual([...4 個語系])` 精確斷言語言清單，新增語系必然使其失敗。改成 `arrayContaining` 之後上游的四個語系仍被完整檢查，而我們日後再加語系不需要再動這支檔案。

---

## 刻意不碰的檔案

這些檔案改了會很痛，我們用別的方式繞過：

| 檔案 | 為什麼不碰 | 我們的替代做法 |
|---|---|---|
| `src/main/shared/types/Config.ts`<br>`DefaultConfig.ts`<br>`config/validateConfig.ts` | 上游 `validate()` 只保留 schema 內的 key，未知欄位會在下次寫回時被丟棄；要加欄位就得改型別，衝突率極高 | 設定獨立存在 `userData/custom.json`，見 `src/main/custom/config/customConfig.ts` |
| `src/main/shared/types/Pages.ts` | `ROUTES` 是 enum，`PAGES` 是常數陣列，改了會影響上游多處 | 新頁面走 T4。**代價**：新頁面不會出現在「Start Page」選單，需要時再另議 |
| `src/renderer/index.html` | 有硬編碼的 `grid-template-columns: 74px auto` | 用 `overrides.css` 的 `html[data-profile]` 作用域覆寫 |
| `src/renderer/src/components/layouts/AppLayout.tsx`<br>`components/navigation/NavRail.tsx`<br>`theme/theme.ts` | 版面相關但上游改動頻繁，衝突率最高 | 同上，一律走 CSS 覆寫 |
| `src/renderer/src/i18n.ts` | 語系註冊表 | `initCustomRenderer()` 用 `i18n.addResourceBundle()` 在執行期注入 |
| `src/renderer/src/env.d.ts` | 上游的 `window.app` / `window.projection` 型別在這 | `window.custom` 宣告在 `src/types/custom.d.ts`，兩個 tsconfig 都 include 得到 |
| `vite.config.mts`<br>`tsconfig.*.json` | 動了會多兩三個掛鉤點 | 客製化程式碼一律用**相對路徑** import，不新增 alias |
| `electron-builder.yml` | 改 `appId` 會讓 `userData` 路徑分裂，與官方版設定不相通 | 暫不改；日後若要與官方版並存再議 |

---

## 開發規則

1. **新程式碼一律放在客製化目錄**，上游檔案只留一行呼叫。
2. **renderer 不可在執行期 import `@main/*`。** vite 的 `rendererAlias` 只有 `@shared`，沒有 `@main`。型別用 `import type` 沒問題（會被編譯器抹除），但值的 import 會在打包時失敗。
3. **客製化模組之間用相對路徑**，不要新增 tsconfig / vite alias。
4. **IPC 頻道一律以 `custom:` 開頭**，型別定義集中在 `src/main/custom/ipc/contract.ts`，三方共用。
5. **CSS 覆寫一律用 `html[data-profile="..."]` 作用域**，沒套用 profile 時等於完全沒有規則。
6. **語言選項與翻譯字典必須成對新增**，`languages.test.ts` 會驗證這件事。
7. commit 訊息用 `custom:` 前綴；動到上游檔案時在訊息裡註明 `touchpoint: <ID>`。

---

## 合併上游後的檢查流程

```bash
bash custom/scripts/check-touchpoints.sh   # 八個掛鉤點是否還在
pnpm typecheck                             # 型別是否還通
pnpm test                                  # 行為是否還對
```

三項都綠才算合併完成。

合併後若 `locales.test.ts` 因為「以下 key 需要補繁中翻譯」而紅，那不是壞掉，是上游新增了字串。補進 `src/renderer/src/custom/locales/zh-TW.json` 即可。

若 `check-touchpoints.sh` 報 FAIL，代表上游把該處重構掉了。**不要只是把程式碼塞回去**，先看上游改成什麼樣子：

- 若上游新增了官方的擴充機制（例如分頁註冊 API），改用官方機制，並把這裡的對應列刪掉，掛鉤點就少一個。
- 若只是搬了位置，把掛鉤點移到新位置，更新本表的檔案路徑。
- 若該功能被上游整個移除，評估我們是否還需要它。
