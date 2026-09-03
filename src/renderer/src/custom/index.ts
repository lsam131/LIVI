import i18n from '../i18n'
import './theme/overrides.css'

/** 語系代碼 -> 翻譯字典。與 CUSTOM_LANGUAGES 必須成對維護。 */
export const CUSTOM_LOCALE_BUNDLES: Record<string, Record<string, unknown>> = {}

/** 把客製化語系注入既有的 i18next 實例，不需要改上游的 i18n.ts。 */
function registerCustomLocales(): void {
  for (const [lng, bundle] of Object.entries(CUSTOM_LOCALE_BUNDLES)) {
    // deep=true、overwrite=true：讓我們的翻譯蓋掉同 key 的既有值，
    // 沒翻到的 key 仍然沿用 i18n.ts 設定的英文 fallback。
    i18n.addResourceBundle(lng, 'translation', bundle, true, true)
  }
}

/**
 * 把 custom.json 的 uiProfile 寫進 <html data-profile>，
 * overrides.css 的所有規則都以它為作用域。
 */
async function applyUiProfile(): Promise<void> {
  try {
    const cfg = await window.custom?.config?.get?.()
    const profile = cfg?.uiProfile ?? ''
    if (profile) document.documentElement.dataset.profile = profile
    else delete document.documentElement.dataset.profile
  } catch (e) {
    // 取不到設定不該擋住整個 UI 起動，維持未套用 profile 的預設外觀即可。
    console.warn('[custom] 讀取 custom.json 失敗，維持預設版面:', (e as Error).message)
  }
}

/**
 * 客製化 renderer 的唯一進入點（掛鉤點 T3）。
 *
 * 同步做完不會失敗的部分（注入語系、載入 CSS），需要 IPC 的部分非同步進行，
 * 避免延後首次繪製。
 */
export function initCustomRenderer(): void {
  registerCustomLocales()
  void applyUiProfile()
}
