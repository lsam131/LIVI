import type { TabConfig } from '../../components/navigation/types'
import { applyCustomTabs } from '../tabs'

const tab = (path: string): TabConfig => ({
  label: path,
  path,
  icon: null as unknown as TabConfig['icon']
})

describe('applyCustomTabs', () => {
  test('骨架階段不改變分頁內容', () => {
    const tabs = [tab('/'), tab('/settings')]
    expect(applyCustomTabs(tabs)).toEqual(tabs)
  })

  test('空陣列不會爆', () => {
    expect(applyCustomTabs([])).toEqual([])
  })

  test('保持順序', () => {
    const tabs = [tab('/a'), tab('/b'), tab('/c')]
    expect(applyCustomTabs(tabs).map((t) => t.path)).toEqual(['/a', '/b', '/c'])
  })
})
