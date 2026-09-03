import type { Config } from '@shared/types'
import type { SettingsNode } from '../routes/types'

/**
 * 要併進上游設定頁的客製化區塊（掛鉤點 T6）。
 *
 * 用陣列而非單一節點，是為了讓上游 schema.ts 的改動是一個 spread，
 * 空陣列時完全不影響既有畫面，也不會產生沒有子項目的空路由。
 */
export const customSettingsSchemas: SettingsNode<Config>[] = []
