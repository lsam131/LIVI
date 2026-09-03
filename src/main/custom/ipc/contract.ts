import type { CustomConfig } from '../config/customConfig'

/**
 * main、preload、renderer 三方共用的 IPC 契約。
 *
 * 全部以 'custom:' 起頭，與上游頻道命名不會相撞；日後上游新增頻道也不必擔心
 * 撞名。三方都從這裡取型別，改動時編譯器會一次抓出所有沒跟上的地方。
 */
export const CUSTOM_IPC = {
  configGet: 'custom:config:get',
  configSave: 'custom:config:save'
} as const

export type CustomIpcChannel = (typeof CUSTOM_IPC)[keyof typeof CUSTOM_IPC]

/** preload 暴露到 window.custom 的形狀。 */
export type CustomApi = {
  config: {
    get(): Promise<CustomConfig>
    save(patch: Partial<CustomConfig>): Promise<CustomConfig>
  }
}
