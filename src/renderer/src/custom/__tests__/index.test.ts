import { initCustomRenderer } from '../index'

const setCustomApi = (
  get: () => Promise<{ uiProfile: string; overscanPercent?: number }>
): void => {
  Object.defineProperty(window, 'custom', {
    value: { config: { get, save: vi.fn() } },
    configurable: true,
    writable: true
  })
}

beforeEach(() => {
  delete document.documentElement.dataset.profile
  document.documentElement.style.removeProperty('--composite-overscan')
  vi.restoreAllMocks()
})

describe('initCustomRenderer', () => {
  test('有 uiProfile 時寫進 <html data-profile>', async () => {
    setCustomApi(() => Promise.resolve({ uiProfile: 'composite-480' }))
    initCustomRenderer()
    await vi.waitFor(() => expect(document.documentElement.dataset.profile).toBe('composite-480'))
  })

  test('uiProfile 為空字串時不留下屬性', async () => {
    document.documentElement.dataset.profile = 'stale'
    setCustomApi(() => Promise.resolve({ uiProfile: '' }))
    initCustomRenderer()
    await vi.waitFor(() => expect(document.documentElement.dataset.profile).toBeUndefined())
  })

  test('window.custom 不存在時不丟例外，維持預設外觀', async () => {
    Object.defineProperty(window, 'custom', {
      value: undefined,
      configurable: true,
      writable: true
    })
    expect(() => initCustomRenderer()).not.toThrow()
    await Promise.resolve()
    expect(document.documentElement.dataset.profile).toBeUndefined()
  })

  test('overscanPercent 以 CSS 變數傳給 overrides.css', async () => {
    // 實機量測完只要改 custom.json 一個數字就能校正安全邊距，不必動程式碼
    setCustomApi(() => Promise.resolve({ uiProfile: 'composite-480', overscanPercent: 6 }))
    initCustomRenderer()
    await vi.waitFor(() =>
      expect(document.documentElement.style.getPropertyValue('--composite-overscan')).toBe('6')
    )
  })

  test('沒給 overscanPercent 時填 0，而不是留下空值', async () => {
    setCustomApi(() => Promise.resolve({ uiProfile: '' }))
    initCustomRenderer()
    await vi.waitFor(() =>
      expect(document.documentElement.style.getPropertyValue('--composite-overscan')).toBe('0')
    )
  })

  test('IPC 失敗時吞掉錯誤，不擋住 UI 起動', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    setCustomApi(() => Promise.reject(new Error('IPC 掛了')))
    initCustomRenderer()
    await vi.waitFor(() => expect(warn).toHaveBeenCalled())
    expect(document.documentElement.dataset.profile).toBeUndefined()
  })
})
