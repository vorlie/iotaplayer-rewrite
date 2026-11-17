const packagerIcon =
  process.platform === 'darwin'
    ? './assets/icons/mac/icon.icns'
    : process.platform === 'win32'
      ? './assets/icons/win/icon.ico'
      : './assets/icons/linux/512x512.png'

export default {
  packagerConfig: {
    asar: true,
    prune: true,
    icon: packagerIcon,
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        setupExe: `${process.env.npm_package_name}-${process.env.npm_package_version}-setup.exe`,
        setupIcon: './assets/icons/win/icon.ico',
      },
    },
    {
      name: '@electron-forge/maker-zip',
      config: {
        platforms: ['win32'],
      },
    },
  ],
}
