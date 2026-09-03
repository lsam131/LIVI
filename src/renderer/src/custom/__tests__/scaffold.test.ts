import { customRoutes } from '../routes'
import { customSettingsSchemas } from '../settingsSchema'

/**
 * 這些斷言存在的目的不是測邏輯，而是釘住「骨架是惰性的」這個前提：
 * Phase 1 不應該改變任何既有畫面。等 Phase 2 真的加東西時，這裡會紅，
 * 屆時連同新行為的測試一起更新。
 */
describe('骨架惰性', () => {
  test('customRoutes 是陣列', () => {
    expect(Array.isArray(customRoutes)).toBe(true)
  })

  test('customSettingsSchemas 是陣列', () => {
    expect(Array.isArray(customSettingsSchemas)).toBe(true)
  })

  test('設定節點若有內容，必須都是 route 型別（才會產生子頁面）', () => {
    for (const node of customSettingsSchemas) {
      expect(node.type).toBe('route')
    }
  })
})
