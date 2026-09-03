import type { SelectOption } from '../routes/types'

/**
 * 客製化新增的語言選項（掛鉤點 T7）。
 *
 * 直接沿用上游的 SelectOption 型別，語言選單的節點不必做任何轉型。
 *
 * `label` 是英文後備字串：上游用 `t(labelKey, label)` 解析標籤，第二個參數是
 * 預設值，所以在還沒有這個 key 的語系底下會顯示 label 而不是原始 key。
 *
 * 每個項目都必須在 CUSTOM_LOCALE_BUNDLES 裡有對應翻譯，否則使用者選了之後
 * 整頁會 fallback 回英文。languages.test.ts 會驗證這件事。
 */
export const CUSTOM_LANGUAGES: SelectOption[] = [
  { label: 'Traditional Chinese', labelKey: 'settings.traditionalChinese', value: 'zh-TW' }
]

/** 附加在上游語言清單後面，順序維持上游在前。 */
export function applyCustomLanguages(options: SelectOption[]): SelectOption[] {
  return [...options, ...CUSTOM_LANGUAGES]
}
