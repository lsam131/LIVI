import type { CustomApi } from '@main/custom/ipc/contract'

/**
 * window.custom 的型別。
 *
 * 放在 src/types/ 是因為 tsconfig.node.json 與 tsconfig.web.json 都 include 了
 * src/types/**，一份宣告兩個 project 都吃得到。上游的 window.app 與
 * window.projection 宣告在 src/renderer/src/env.d.ts，我們刻意不去動那支檔案，
 * 省下一個掛鉤點。
 */
declare global {
  interface Window {
    custom: CustomApi
  }
}

export {}
