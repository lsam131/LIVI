import { registerIpcHandle } from '@main/ipc/register'
import type { CustomConfig } from './config/customConfig'
import { loadCustomConfig, saveCustomConfig } from './config/customConfig'
import { CUSTOM_IPC } from './ipc/contract'

/**
 * 客製化 main process 的唯一進入點。
 *
 * 上游的 src/main/index.ts 只呼叫這一個函式（掛鉤點 T1），所有客製化服務都在
 * 這裡展開，因此上游檔案永遠只有一行是我們的。
 *
 * 註冊用的是上游的 registerIpcHandle，它有 remove-then-add 語意，重複呼叫安全。
 */
export function registerCustomMain(): void {
  registerIpcHandle<[], CustomConfig>(CUSTOM_IPC.configGet, () => loadCustomConfig())

  registerIpcHandle<[Partial<CustomConfig>], CustomConfig>(CUSTOM_IPC.configSave, (_event, patch) =>
    saveCustomConfig(patch ?? {})
  )
}
