import i18n from '../../i18n'
import { initCustomRenderer } from '../index'
import { CUSTOM_LANGUAGES } from '../languages'

beforeAll(() => {
  initCustomRenderer()
})

describe('i18next 白名單擴充', () => {
  test('supportedLngs 同時含完整代碼與語言主碼', () => {
    // 上游開了 nonExplicitSupportedLngs，isSupportedCode() 會先把 zh-TW 截成 zh
    // 再比對白名單，所以兩者都必須在。只推 zh-TW 不會生效。
    const supported = i18n.options.supportedLngs as string[]
    expect(supported).toContain('zh-TW')
    expect(supported).toContain('zh')
  })

  test('上游原本的語系一個都沒被移掉', () => {
    const supported = i18n.options.supportedLngs as string[]
    for (const lng of ['en', 'de', 'ua', 'fr']) expect(supported).toContain(lng)
  })
})

describe('切換到繁體中文', () => {
  afterAll(async () => {
    await i18n.changeLanguage('en')
  })

  test('changeLanguage 不會被擋掉並退回 en', async () => {
    await i18n.changeLanguage('zh-TW')
    expect(i18n.resolvedLanguage).toBe('zh-TW')
  })

  test('實際取得繁中字串', async () => {
    await i18n.changeLanguage('zh-TW')
    expect(i18n.t('settings.settingsTitle')).toBe('設定')
    expect(i18n.t('settings.carName')).toBe('車輛名稱')
    expect(i18n.t('settings.traditionalChinese')).toBe('繁體中文')
  })

  test('插值仍然正常運作', async () => {
    await i18n.changeLanguage('zh-TW')
    expect(i18n.t('settings.audioDeviceOffline', { name: '喇叭' })).toBe('喇叭（離線）')
  })

  test('切回英文後拿到英文', async () => {
    await i18n.changeLanguage('en')
    expect(i18n.t('settings.settingsTitle')).toBe('Settings')
  })
})

describe('語言選單', () => {
  test('zh-TW 是可選的選項', () => {
    expect(CUSTOM_LANGUAGES.map((l) => l.value)).toContain('zh-TW')
  })

  test('選項帶英文後備字串，避免在其他語系顯示原始 key', () => {
    // 上游用 t(labelKey, label) 解析，第二個參數是預設值。
    for (const lang of CUSTOM_LANGUAGES) {
      expect(lang.label).toBeTruthy()
      expect(lang.label).not.toContain('.')
    }
  })
})
