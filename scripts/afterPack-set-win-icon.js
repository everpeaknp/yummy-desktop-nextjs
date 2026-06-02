const path = require('path');
const fs = require('fs');

/**
 * electron-builder afterPack hook
 * https://www.electron.build/configuration/configuration#afterpack
 */
module.exports = async function afterPack(context) {
  try {
    if (context.electronPlatformName !== 'win32') return;

    const appOutDir = context.appOutDir;
    const exeName = `${context.packager.appInfo.executableName || context.packager.appInfo.productFilename}.exe`;
    const exePath = path.join(appOutDir, exeName);
    const iconPath = path.join(context.packager.projectDir, 'electron-resources', 'icon.ico');

    if (!fs.existsSync(exePath)) return;
    if (!fs.existsSync(iconPath)) return;

    // rcedit is a thin wrapper that downloads/uses a Windows binary to edit exe resources.
    // This avoids electron-builder's winCodeSign symlink extraction issue.
    // eslint-disable-next-line import/no-extraneous-dependencies
    const rcedit = require('rcedit');

    await rcedit(exePath, {
      icon: iconPath
    });
  } catch (_) {
    // Best-effort. If rcedit fails, the app still builds (may show Electron icon).
  }
};

