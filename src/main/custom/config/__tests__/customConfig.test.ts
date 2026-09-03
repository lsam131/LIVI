import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  customConfigPath,
  DEFAULT_CUSTOM_CONFIG,
  loadCustomConfig,
  saveCustomConfig
} from '@main/custom/config/customConfig'

let dir: string
let file: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'livi-custom-'))
  file = join(dir, 'custom.json')
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('customConfigPath', () => {
  test('與上游 config.json 同目錄但不同檔名', () => {
    expect(customConfigPath()).toBe('/tmp/custom.json')
  })
})

describe('loadCustomConfig', () => {
  test('檔案不存在時回傳預設值', () => {
    expect(loadCustomConfig(file)).toEqual(DEFAULT_CUSTOM_CONFIG)
  })

  test('回傳的是複本，改動不會污染預設值', () => {
    const cfg = loadCustomConfig(file)
    cfg.uiProfile = 'mutated'
    expect(DEFAULT_CUSTOM_CONFIG.uiProfile).toBe('')
  })

  test('讀得到已寫入的值', () => {
    writeFileSync(file, JSON.stringify({ uiProfile: 'composite-480' }))
    expect(loadCustomConfig(file).uiProfile).toBe('composite-480')
  })

  test('JSON 壞掉時退回預設值而不是丟例外', () => {
    writeFileSync(file, '{ 這不是 JSON')
    expect(loadCustomConfig(file)).toEqual(DEFAULT_CUSTOM_CONFIG)
  })

  test('型別不符的欄位被換成預設值', () => {
    writeFileSync(file, JSON.stringify({ uiProfile: 42 }))
    expect(loadCustomConfig(file).uiProfile).toBe('')
  })

  test('未知欄位被丟棄', () => {
    writeFileSync(file, JSON.stringify({ uiProfile: 'x', 上游沒有的欄位: true }))
    expect(loadCustomConfig(file)).toEqual({ uiProfile: 'x' })
  })
})

describe('saveCustomConfig', () => {
  test('寫入後讀得回來', () => {
    saveCustomConfig({ uiProfile: 'composite-480' }, file)
    expect(loadCustomConfig(file).uiProfile).toBe('composite-480')
  })

  test('回傳寫入後的完整設定', () => {
    expect(saveCustomConfig({ uiProfile: 'a' }, file)).toEqual({ uiProfile: 'a' })
  })

  test('patch 是合併而非取代', () => {
    saveCustomConfig({ uiProfile: 'first' }, file)
    saveCustomConfig({}, file)
    expect(loadCustomConfig(file).uiProfile).toBe('first')
  })

  test('寫入失敗不丟例外，仍回傳合併後的值', () => {
    const bad = join(dir, '不存在的目錄', 'custom.json')
    expect(saveCustomConfig({ uiProfile: 'x' }, bad)).toEqual({ uiProfile: 'x' })
  })
})
