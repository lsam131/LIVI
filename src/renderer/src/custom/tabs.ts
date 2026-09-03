import type { TabConfig } from '../components/navigation/types'

/**
 * 導覽列分頁的最後一道加工。
 *
 * 上游的 useTabsConfig 以硬編碼陣列決定分頁，沒有插件註冊機制，所以我們在它的
 * 回傳值外面包一層（掛鉤點 T5）。要新增、隱藏或重新排序分頁都在這裡做，
 * 上游檔案永遠只有 `applyCustomTabs(...)` 這個包裝。
 *
 * 目前是恆等函式，骨架階段刻意不改變任何行為。
 */
export function applyCustomTabs(tabs: TabConfig[]): TabConfig[] {
  return tabs
}
