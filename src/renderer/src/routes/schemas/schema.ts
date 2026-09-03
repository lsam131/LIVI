import type { Config } from '@shared/types'
import { customSettingsSchemas } from '../../custom/settingsSchema'
import { generateRoutes } from '../../utils/generateRoutes'
import { SettingsNode } from '../types'
import { appearanceSchema } from './appearanceSchema'
import { audioSchema } from './audioSchema'
import { devicesSchema } from './devicesSchema'
import { generalSchema } from './generalSchema'
import { systemSchema } from './systemSchema'
import { videoSchema } from './videoSchema'

export const settingsSchema: SettingsNode<Config> = {
  type: 'route',
  route: 'new-settings',
  label: 'Settings', // TODO deleted in favor of i18n
  labelKey: 'settings.settingsTitle',
  path: 'settings',
  children: [
    devicesSchema,
    generalSchema,
    audioSchema,
    videoSchema,
    appearanceSchema,
    systemSchema,
    ...customSettingsSchemas // 客製化掛鉤點 T6
  ]
}

export const settingsRoutes = generateRoutes(settingsSchema)
