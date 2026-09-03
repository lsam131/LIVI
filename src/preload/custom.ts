import type { CustomConfig } from '@main/custom/config/customConfig'
import { CUSTOM_IPC, type CustomApi } from '@main/custom/ipc/contract'
import { contextBridge, ipcRenderer } from 'electron'

/**
 * 把客製化 API 掛到 window.custom。
 *
 * 獨立成一支檔案，讓上游的 src/preload/index.ts 只需要多一行呼叫（掛鉤點 T2）。
 * 命名空間與上游的 window.projection、window.app 完全分開。
 */
export function exposeCustomApi(): void {
  const api: CustomApi = {
    config: {
      get: () => ipcRenderer.invoke(CUSTOM_IPC.configGet),
      save: (patch: Partial<CustomConfig>) => ipcRenderer.invoke(CUSTOM_IPC.configSave, patch)
    }
  }

  contextBridge.exposeInMainWorld('custom', api)
}
