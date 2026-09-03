import { registerCustomMain } from '@main/custom'
import { CUSTOM_IPC } from '@main/custom/ipc/contract'
import { ipcMain } from 'electron'

type Handler = (event: unknown, ...args: unknown[]) => unknown

const handlers = (): Map<string, Handler> => {
  const m = new Map<string, Handler>()
  for (const call of (ipcMain.handle as unknown as { mock: { calls: unknown[][] } }).mock.calls) {
    m.set(call[0] as string, call[1] as Handler)
  }
  return m
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('registerCustomMain', () => {
  test('註冊契約裡的每一個頻道', () => {
    registerCustomMain()
    const registered = [...handlers().keys()]
    for (const channel of Object.values(CUSTOM_IPC)) {
      expect(registered).toContain(channel)
    }
  })

  test('所有頻道都以 custom: 開頭，不會與上游撞名', () => {
    registerCustomMain()
    for (const channel of handlers().keys()) {
      expect(channel.startsWith('custom:')).toBe(true)
    }
  })

  test('重複呼叫安全：先 removeHandler 再 handle', () => {
    registerCustomMain()
    registerCustomMain()
    expect(ipcMain.removeHandler).toHaveBeenCalledWith(CUSTOM_IPC.configGet)
    expect(ipcMain.removeHandler).toHaveBeenCalledWith(CUSTOM_IPC.configSave)
  })

  test('configGet 回傳設定物件', async () => {
    registerCustomMain()
    const result = await handlers().get(CUSTOM_IPC.configGet)?.({})
    expect(result).toHaveProperty('uiProfile')
  })

  test('configSave 收到 undefined 也不會爆', async () => {
    registerCustomMain()
    const result = await handlers().get(CUSTOM_IPC.configSave)?.({}, undefined)
    expect(result).toHaveProperty('uiProfile')
  })
})
