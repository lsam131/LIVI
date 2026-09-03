import i18n from 'i18next'
import zhTW from './locales/zh-TW.json'
import './theme/overrides.css'

/** 語系代碼 -> 翻譯字典。與 CUSTOM_LANGUAGES 必須成對維護。 */
export const CUSTOM_LOCALE_BUNDLES: Record<string, Record<string, unknown>> = {
  'zh-TW': zhTW
}

/**
 * 讓 i18next 接受我們新增的語系。
 *
 * 上游 i18n.ts 的 `supportedLngs` 是寫死的白名單，不在名單上的語言 changeLanguage()
 * 會被擋掉並退回 en。我們不去改那支檔案，改在執行期擴充白名單。
 *
 * 關鍵細節（實測得出，不是推測）：上游同時開了 `nonExplicitSupportedLngs: true`，
 * i18next 的 isSupportedCode() 會先把 'zh-TW' 截成語言主碼 'zh' 再比對白名單。
 * 只推入 'zh-TW' 不會生效，必須連 'zh' 一起推。
 *
 * LanguageUtils 在 init 時就捕獲了這個陣列的參照，所以推入同一個陣列即可生效。
 */
function allowCustomLanguages(): void {
  const supported = i18n.options.supportedLngs
  // false 或 undefined 代表沒有白名單，那就不需要做任何事。
  if (!Array.isArray(supported)) return

  for (const code of Object.keys(CUSTOM_LOCALE_BUNDLES)) {
    for (const variant of [code, code.split('-')[0]]) {
      if (!supported.includes(variant)) supported.push(variant)
    }
  }
}

/** 把客製化語系注入既有的 i18next 實例，不需要改上游的 i18n.ts。 */
function registerCustomLocales(): void {
  for (const [lng, bundle] of Object.entries(CUSTOM_LOCALE_BUNDLES)) {
    // deep=true、overwrite=true：讓我們的翻譯蓋掉同 key 的既有值，
    // 沒翻到的 key 仍然沿用 i18n.ts 設定的英文 fallback。
    i18n.addResourceBundle(lng, 'translation', bundle, true, true)
  }
}

/**
 * 直接操作 i18next singleton，而不是匯入上游的 './i18n' 模組。
 *
 * 兩個理由：一是我們要的就是那個 singleton 實例，上游的 i18n.ts 只是對它做 init；
 * 二是上游測試把 '../i18n' mock 成空物件，若我們依賴它的 default export 會讓
 * 上游的 main.test.tsx 整組壞掉，那是我們的耦合問題，不該要求上游改測試。
 *
 * 因此也必須檢查 isInitialized：i18n.ts 被 mock 掉時 i18next 沒有 init，
 * addResourceBundle() 會因為 services 未建立而拋錯。
 */
function setupI18n(): void {
  if (!i18n.isInitialized) return
  allowCustomLanguages()
  registerCustomLocales()
}

/**
 * 把 custom.json 套到 <html> 上。
 *
 * uiProfile 決定 data-profile，overrides.css 的所有規則都以它為作用域；
 * overscanPercent 以 CSS 變數傳進去，這樣實機量測完只要改 custom.json
 * 一個數字就能校正安全邊距，不必動程式碼也不必重新建置。
 */
async function applyUiProfile(): Promise<void> {
  const cfg = await window.custom?.config?.get?.()
  const root = document.documentElement

  const profile = cfg?.uiProfile ?? ''
  if (profile) root.dataset.profile = profile
  else delete root.dataset.profile

  const overscan = cfg?.overscanPercent ?? 0
  root.style.setProperty('--composite-overscan', String(overscan))
}

/**
 * 客製化 renderer 的唯一進入點（掛鉤點 T3）。
 *
 * 這個函式在上游 main.tsx 的模組頂層被呼叫，一旦拋錯會讓整個 UI 啟動失敗，
 * 所以每一段都包在 try/catch 裡：客製化功能失效可以接受，主程式起不來不行。
 */
export function initCustomRenderer(): void {
  try {
    setupI18n()
  } catch (e) {
    console.warn('[custom] 語系注入失敗，維持上游語系設定:', (e as Error).message)
  }

  // 需要 IPC，非同步進行，避免延後首次繪製。
  void applyUiProfile().catch((e: Error) => {
    console.warn('[custom] 讀取 custom.json 失敗，維持預設版面:', e.message)
  })
}
