import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'

/**
 * 客製化設定，與上游的 config.json 分開存放。
 *
 * 上游 v9.4.0 起把設定處理整個搬進 Rust 的 livi-core 程序，config.json 由它
 * 讀寫，Electron 端透過 socket 溝通。我們的設定本來就獨立，不受影響。
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

/**
 * 依預設值的型別過濾輸入，順便丟掉不認識的 key。
 *
 * 這兩個小工具原本是重用上游的 validate() 與 writeFileAtomic()，但 v9.4.0
 * 的重構把 src/main/config/ 整個刪掉、atomicWrite 也從 shared/utils 移除，
 * 同步時直接編譯失敗。它們各只有十幾行，自己留一份換來不再被上游內部重構
 * 波及，划算。教訓已記在 custom/UPSTREAM_TOUCHPOINTS.md。
 */
function validateAgainst<T extends Record<string, unknown>>(input: unknown, schema: T): T {
  const out = {} as T
  const src = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {}

  for (const key of Object.keys(schema) as Array<keyof T>) {
    const def = schema[key]
    const val = src[key as string]
    // 缺值或型別不符一律退回預設值，壞掉的設定檔不該讓程式爆掉
    out[key] = (val !== undefined && typeof val === typeof def ? val : def) as T[keyof T]
  }
  return out
}

/** 先寫 .tmp 再 rename。rename 是單一步驟，讀的人只會拿到舊的或新的，不會拿到半套。 */
function writeAtomic(file: string, data: string): void {
  const tmp = `${file}.tmp`
  writeFileSync(tmp, data)
  renameSync(tmp, file)
}

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
 * 讀取 custom.json。檔案不存在、壞掉或型別不符的欄位一律退回預設值。
 */
export function loadCustomConfig(file: string = customConfigPath()): CustomConfig {
  if (!existsSync(file)) return { ...DEFAULT_CUSTOM_CONFIG }
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8'))
    const cfg = validateAgainst(raw, DEFAULT_CUSTOM_CONFIG)
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
  const merged = validateAgainst({ ...loadCustomConfig(file), ...patch }, DEFAULT_CUSTOM_CONFIG)
  const next = { ...merged, overscanPercent: clampOverscan(merged.overscanPercent) }
  try {
    writeAtomic(file, `${JSON.stringify(next, null, 2)}\n`)
  } catch (e) {
    console.warn(`[custom-config] ${file} 寫入失敗:`, (e as Error).message)
  }
  return next
}
