import type enCommon from './locales/en/common.json'
import type enLibrary from './locales/en/library.json'
import type enPlayer from './locales/en/player.json'
import type enPlaylists from './locales/en/playlists.json'
import type enSettings from './locales/en/settings.json'

export interface I18nResources {
  common: typeof enCommon
  player: typeof enPlayer
  library: typeof enLibrary
  playlists: typeof enPlaylists
  settings: typeof enSettings
}

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common'
    resources: I18nResources
  }
}
