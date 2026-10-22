export default {
  packagerConfig: {
    asar: true,
    prune: true,
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        setupExe: `${process.env.npm_package_name}-${process.env.npm_package_version}-setup.exe`,
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
