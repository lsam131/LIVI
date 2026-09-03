import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { validate } from '@main/config/validateConfig'
import { writeFileAtomic } from '@shared/utils/atomicWrite'
import { app } from 'electron'

/**
 * 客製化設定，與上游的 config.json 分開存放。
 *
 * 上游 validateConfig 只保留 Config schema 內的 key，任何未知欄位在下次寫回時
 * 會被丟棄，所以我們的設定不能寄生在 config.json 裡。獨立一份 custom.json
 * 讓兩邊互不干擾，上游改動 Config 型別時也不會與我們衝突。
 */
export type CustomConfig = {
  /** 版面設定檔，會寫進 <html data-profile>。空字串代表不套用任何覆寫。 */
  uiProfile: string
  /**
   * 面板四周被吃掉的比例（百分比）。CRT 式與車用複合視訊面板的邊緣通常看不到，
   * UI 要往內縮這麼多才不會被切掉。實機量測後填入，0 代表不內縮。
   */
  overscanPercent: number
}

export const DEFAULT_CUSTOM_CONFIG: CustomConfig = {
  uiProfile: '',
  overscanPercent: 0
}

/** overscanPercent 的合理範圍，超出的值會被夾回來。 */
export const OVERSCAN_MIN = 0
export const OVERSCAN_MAX = 15

/** 夾回合理範圍。手動改壞 custom.json 不該讓版面整個爆掉。 */
function clampOverscan(v: number): number {
  if (!Number.isFinite(v)) return DEFAULT_CUSTOM_CONFIG.overscanPercent
  return Math.min(OVERSCAN_MAX, Math.max(OVERSCAN_MIN, v))
}

/** 測試可注入替代路徑；正式執行時走 Electron 的 userData。 */
export function customConfigPath(): string {
  return join(app.getPath('userData'), 'custom.json')
}

/**
 * 讀取 custom.json。檔案不存在、壞掉或型別不符的欄位一律退回預設值，
 * 沿用上游 validate() 的語意，讓行為與 config.json 一致。
 */
export function loadCustomConfig(file: string = customConfigPath()): CustomConfig {
  if (!existsSync(file)) return { ...DEFAULT_CUSTOM_CONFIG }
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8'))
    const cfg = validate(raw, DEFAULT_CUSTOM_CONFIG)
    return { ...cfg, overscanPercent: clampOverscan(cfg.overscanPercent) }
  } catch (e) {
    console.warn(`[custom-config] ${file} 讀取失敗，改用預設值:`, (e as Error).message)
    return { ...DEFAULT_CUSTOM_CONFIG }
  }
}

/** 合併 patch 後原子寫回，回傳寫入後的完整設定。 */
export function saveCustomConfig(
  patch: Partial<CustomConfig>,
  file: string = customConfigPath()
): CustomConfig {
  const merged = validate({ ...loadCustomConfig(file), ...patch }, DEFAULT_CUSTOM_CONFIG)
  const next = { ...merged, overscanPercent: clampOverscan(merged.overscanPercent) }
  try {
    writeFileAtomic(file, `${JSON.stringify(next, null, 2)}\n`)
  } catch (e) {
    console.warn(`[custom-config] ${file} 寫入失敗:`, (e as Error).message)
  }
  return next
}
