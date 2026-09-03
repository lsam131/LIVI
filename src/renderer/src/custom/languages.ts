import type { SelectOption } from '../routes/types'

/**
 * 客製化新增的語言選項（掛鉤點 T7）。
 *
 * 直接沿用上游的 SelectOption 型別，語言選單的節點不必做任何轉型。
 * 每個項目都必須在 CUSTOM_LOCALE_BUNDLES 裡有對應翻譯，否則使用者選了之後
 * 整頁會 fallback 回英文。兩者一起改，不要只加一邊。
 */
export const CUSTOM_LANGUAGES: SelectOption[] = []

/** 附加在上游語言清單後面，順序維持上游在前。 */
export function applyCustomLanguages(options: SelectOption[]): SelectOption[] {
  return [...options, ...CUSTOM_LANGUAGES]
}
