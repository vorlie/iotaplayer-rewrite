import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const pkg = require('./package.json')

const packagerIcon =
  process.platform === 'darwin'
    ? './assets/icons/mac/icon.icns'
    : process.platform === 'win32'
      ? './assets/icons/win/icon.ico'
      : './assets/icons/linux/512x512.png'

export default {
  packagerConfig: {
    name: 'IotaPlayer',
    executableName: process.platform === 'linux' ? 'iotaplayer' : 'IotaPlayer',
    appBundleId: 'pl.vorlie.iotaplayer',
    appCategoryType: 'public.app-category.music',
    appVersion: pkg.version,
    asar: true,
    prune: true,
    icon: packagerIcon,
    win32metadata: {
      CompanyName: 'vorlie',
      FileDescription: 'IotaPlayer',
      OriginalFilename: 'IotaPlayer.exe',
      ProductName: 'IotaPlayer',
      InternalName: 'IotaPlayer',
    },
    ignore: [
      /^\/src($|\/)/,
      /^\/tests($|\/)/,
      /^\/scripts($|\/)/,
      /^\/docs($|\/)/,
      /^\/out($|\/)/,
      /^\/\.git($|\/)/,
      /^\/tsconfig.*\.json$/,
      /^\/eslint\.config\.js$/,
      /^\/vite\.config\.ts$/,
      /^\/electron-builder\.json$/,
      /^\/stuff\.md$/,
      /^\/README\.md$/,
      /^\/RELEASE\.md$/,
      /^\/CHANGELOG\.md$/,
    ],
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      platforms: ['win32'],
      config: {
        name: 'iotaplayer',
        authors: 'vorlie',
        description: pkg.description,
        setupIcon: './assets/icons/win/icon.ico',
        setupExe: `IotaPlayer-${pkg.version}-win32-x64-setup.exe`,
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['win32', 'darwin'],
    },
  ],
}
