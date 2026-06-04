/**
 * Persists web-app auth (localStorage tokens) to disk so login survives app restarts.
 * Required because Electron loads the remote SaaS URL; production may not yet ship
 * client-side session bootstrap. Tokens are stored only in userData (not logs).
 */
const fs = require('fs');
const path = require('path');

const AUTH_BACKUP_FILE = 'auth-session.json';
const PROD_ORIGIN = 'https://app.yummyever.com';

function getBackupPath(userDataDir) {
  return path.join(userDataDir, AUTH_BACKUP_FILE);
}

function readAuthBackup(userDataDir) {
  try {
    const raw = fs.readFileSync(getBackupPath(userDataDir), 'utf8');
    const data = JSON.parse(raw);
    if (!data || (!data.accessToken && !data.refreshToken)) return null;
    return data;
  } catch {
    return null;
  }
}

function writeAuthBackup(userDataDir, payload) {
  if (!payload || (!payload.accessToken && !payload.refreshToken)) return;
  const filePath = getBackupPath(userDataDir);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const next = {
    accessToken: payload.accessToken || null,
    refreshToken: payload.refreshToken || null,
    authStorage: payload.authStorage || null,
    savedAt: new Date().toISOString(),
  };
  fs.writeFileSync(filePath, JSON.stringify(next, null, 2), 'utf8');
}

function migrateLegacyBackup(userDataDir) {
  const legacyDir = path.join(
    process.env.APPDATA || path.join(require('os').homedir(), 'AppData', 'Roaming'),
    'yummy-web'
  );
  const legacyFile = getBackupPath(legacyDir);
  const targetFile = getBackupPath(userDataDir);
  try {
    if (fs.existsSync(targetFile) || !fs.existsSync(legacyFile)) return;
    fs.mkdirSync(path.dirname(targetFile), { recursive: true });
    fs.copyFileSync(legacyFile, targetFile);
  } catch {
    // ignore
  }
}

function isAppOrigin(url) {
  try {
    const u = new URL(url);
    return u.origin === PROD_ORIGIN;
  } catch {
    return false;
  }
}

async function readWebAuthSnapshot(webContents) {
  if (!webContents || webContents.isDestroyed()) return null;
  try {
    const raw = await webContents.executeJavaScript(
      `(() => {
        try {
          return JSON.stringify({
            accessToken: localStorage.getItem('accessToken'),
            refreshToken: localStorage.getItem('refreshToken'),
            authStorage: localStorage.getItem('auth-storage'),
          });
        } catch (e) {
          return JSON.stringify({ error: String(e) });
        }
      })()`,
      true
    );
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function injectWebAuth(webContents, backup) {
  if (!webContents || webContents.isDestroyed() || !backup) return false;
  const access = backup.accessToken ? JSON.stringify(backup.accessToken) : 'null';
  const refresh = backup.refreshToken ? JSON.stringify(backup.refreshToken) : 'null';
  const authStorage = backup.authStorage ? JSON.stringify(backup.authStorage) : 'null';

  await webContents.executeJavaScript(
    `(() => {
      const access = ${access};
      const refresh = ${refresh};
      const authStorage = ${authStorage};
      if (access) localStorage.setItem('accessToken', access);
      if (refresh) localStorage.setItem('refreshToken', refresh);
      if (authStorage) localStorage.setItem('auth-storage', authStorage);
      return {
        hasAccessToken: !!localStorage.getItem('accessToken'),
        hasRefreshToken: !!localStorage.getItem('refreshToken'),
      };
    })()`,
    true
  );
  return true;
}

/**
 * Attach backup/restore handlers to the main window.
 * @param {import('electron').BrowserWindow} win
 * @param {string} userDataDir
 * @param {(line: string) => void} log
 */
async function notifyWebAppAuthRestored(webContents) {
  if (!webContents || webContents.isDestroyed()) return;
  try {
    await webContents.executeJavaScript(
      `(() => {
        window.dispatchEvent(new CustomEvent('yummy-electron-auth-restored'));
        return true;
      })()`,
      true
    );
  } catch {
    // ignore — page may still be loading
  }
}

function isLiveWindow(win) {
  if (!win) return false;
  try {
    return !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed();
  } catch {
    return false;
  }
}

function clearAuthBackup(userDataDir) {
  try {
    const filePath = getBackupPath(userDataDir);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // ignore
  }
}

function attachAuthPersistence(win, userDataDir, log) {
  migrateLegacyBackup(userDataDir);
  let captureTimer = null;
  /** Only inject disk backup once per app launch (never again after logout on login). */
  let coldStartBackupInjected = false;

  const capture = async (reason) => {
    if (!isLiveWindow(win)) return;
    const url = win.webContents.getURL();
    if (!isAppOrigin(url)) return;

    const snap = await readWebAuthSnapshot(win.webContents);
    if (!snap || (!snap.accessToken && !snap.refreshToken)) return;

    writeAuthBackup(userDataDir, snap);
    log(`[auth-backup] saved (${reason}) refresh=${!!snap.refreshToken}`);
  };

  const tryRestore = async (reason) => {
    if (!isLiveWindow(win)) return;

    const url = win.webContents.getURL();
    if (!isAppOrigin(url)) return;

    const snap = await readWebAuthSnapshot(win.webContents);
    if (snap?.accessToken || snap?.refreshToken) {
      await capture('already-present');
      return;
    }

    const backup = readAuthBackup(userDataDir);
    if (!backup) {
      log(`[auth-restore] no backup (${reason})`);
      return;
    }

    if (coldStartBackupInjected) {
      log(`[auth-restore] skip inject — already attempted this session (${reason})`);
      return;
    }

    coldStartBackupInjected = true;
    log(`[auth-restore] injecting backup (${reason})`);
    await injectWebAuth(win.webContents, backup);

    const after = await readWebAuthSnapshot(win.webContents);
    log(
      `[auth-restore] after inject access=${!!after?.accessToken} refresh=${!!after?.refreshToken}`
    );

    if (!after?.accessToken && !after?.refreshToken) return;

    await notifyWebAppAuthRestored(win.webContents);
  };

  win.webContents.on('did-finish-load', () => {
    void tryRestore('did-finish-load');
    void capture('did-finish-load');
  });

  win.webContents.on('did-navigate-in-page', () => {
    void capture('did-navigate-in-page');
  });

  captureTimer = setInterval(() => {
    void capture('interval');
  }, 15000);

  win.on('closed', () => {
    if (captureTimer) {
      clearInterval(captureTimer);
      captureTimer = null;
    }
  });
}

module.exports = {
  PROD_ORIGIN,
  migrateLegacyBackup,
  readAuthBackup,
  writeAuthBackup,
  clearAuthBackup,
  readWebAuthSnapshot,
  attachAuthPersistence,
};
