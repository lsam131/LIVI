import en from '../../locales/en.json'
import { CUSTOM_LOCALE_BUNDLES } from '../index'
import zhTW from '../locales/zh-TW.json'

type Nested = Record<string, unknown>

/** 把嵌套的翻譯字典壓平成 'settings.carName' 這種點分隔 key。 */
const flatten = (obj: Nested, prefix = ''): Record<string, string> => {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object') Object.assign(out, flatten(v as Nested, key))
    else out[key] = String(v)
  }
  return out
}

const flatEn = flatten(en as Nested)
const flatZh = flatten(zhTW as Nested)
const placeholders = (s: string): string[] => [...s.matchAll(/{{(\w+)}}/g)].map((m) => m[1]).sort()

describe('zh-TW 翻譯完整性', () => {
  test('上游的每個 key 都有繁中翻譯', () => {
    // 這個測試在上游新增字串後會紅。那是刻意的：紅燈的時機正好是翻譯成本最低的
    // 時候（合併上游時），而不是等使用者在畫面上看到英文才發現。
    const missing = Object.keys(flatEn).filter((k) => !(k in flatZh))
    expect(missing, `以下 key 需要補繁中翻譯:\n${missing.join('\n')}`).toEqual([])
  })

  test('沒有多餘的 key（除了我們自己新增的語言名稱）', () => {
    const ours = new Set(['settings.traditionalChinese'])
    const extra = Object.keys(flatZh).filter((k) => !(k in flatEn) && !ours.has(k))
    expect(extra, `以下 key 在上游已不存在，應該刪除:\n${extra.join('\n')}`).toEqual([])
  })

  test('沒有未翻譯的殘留（值與英文完全相同的可疑項）', () => {
    // 專有名詞刻意保持原文，列在白名單裡。
    const keepAsIs = new Set([
      'carplay.dongle',
      'settings.wifi',
      'settings.mfi',
      'settings.gps',
      'settings.projectionFps',
      'settings.projectionDpi',
      'settings.clusterFps',
      'settings.clusterDpi',
      'settings.usbDongle',
      'settings.gpsFixGps',
      'settings.gpsFixDgps',
      'settings.gpsFixPps',
      'settings.gpsAgc',
      'settings.dongleIpPlaceholder',
      'settings.dongleIpMaskPlaceholder',
      'softwareUpdate.channelNightly'
    ])
    const untranslated = Object.keys(flatZh).filter(
      (k) => k in flatEn && flatZh[k] === flatEn[k] && !keepAsIs.has(k)
    )
    expect(untranslated, `以下 key 看起來還沒翻譯:\n${untranslated.join('\n')}`).toEqual([])
  })
})

describe('插值變數', () => {
  test('每個 key 的 {{變數}} 與英文完全一致', () => {
    // 變數名打錯會讓畫面出現字面的 {{name}}，這種錯很難用眼睛看出來。
    const mismatched: string[] = []
    for (const k of Object.keys(flatZh)) {
      if (!(k in flatEn)) continue
      const a = placeholders(flatEn[k])
      const b = placeholders(flatZh[k])
      if (a.join(',') !== b.join(',')) mismatched.push(`${k}: en=[${a}] zh=[${b}]`)
    }
    expect(mismatched, `插值變數不符:\n${mismatched.join('\n')}`).toEqual([])
  })
})

describe('CUSTOM_LOCALE_BUNDLES', () => {
  test('註冊了 zh-TW', () => {
    expect(Object.keys(CUSTOM_LOCALE_BUNDLES)).toContain('zh-TW')
  })
})
