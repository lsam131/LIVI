import { CUSTOM_LOCALE_BUNDLES } from '../index'
import { applyCustomLanguages, CUSTOM_LANGUAGES } from '../languages'

const upstream = [
  { label: 'English', labelKey: 'settings.english', value: 'en' },
  { label: 'German', labelKey: 'settings.german', value: 'de' }
]

describe('applyCustomLanguages', () => {
  test('上游選項一個都不能少，且順序在前', () => {
    const result = applyCustomLanguages(upstream)
    expect(result.slice(0, upstream.length)).toEqual(upstream)
  })

  test('不改動傳入的陣列', () => {
    const input = [...upstream]
    applyCustomLanguages(input)
    expect(input).toEqual(upstream)
  })
})

describe('語系一致性', () => {
  test('每個新增語言都必須有對應的翻譯字典', () => {
    // 只加選項卻沒加翻譯，使用者選了會整頁 fallback 回英文。
    for (const lang of CUSTOM_LANGUAGES) {
      expect(Object.keys(CUSTOM_LOCALE_BUNDLES)).toContain(String(lang.value))
    }
  })

  test('每份翻譯字典都必須有對應的語言選項', () => {
    const values = CUSTOM_LANGUAGES.map((l) => String(l.value))
    for (const lng of Object.keys(CUSTOM_LOCALE_BUNDLES)) {
      expect(values).toContain(lng)
    }
  })
})
