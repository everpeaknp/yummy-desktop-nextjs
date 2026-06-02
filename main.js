const { app, BrowserWindow, ipcMain, shell, session } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');
const {
  attachAuthPersistence,
  readWebAuthSnapshot,
} = require('./electron-auth-persist');

const isDev = !app.isPackaged;

// One stable profile dir for portable + installer (package name is "yummy-web" otherwise).
const USER_DATA_DIR = path.join(app.getPath('appData'), 'Yummy POS');
try {
  app.setPath('userData', USER_DATA_DIR);
} catch (_) {
  // setPath can throw if called after ready; safe to ignore in dev hot-reload.
}

let mainWindow;
let splashWindow;
const DEV_URL = 'http://localhost:3000';
const PROD_URL = 'https://app.yummyever.com';
const PERSIST_PARTITION = 'persist:yummy-pos';

// Helps Windows associate taskbar icon correctly.
try { app.setAppUserModelId('com.yummy.pos'); } catch (_) {}

function getLogPath() {
  // keep logs somewhere writable without admin
  try {
    return path.join(app.getPath('userData'), 'main.log');
  } catch (_) {
    return path.join(process.cwd(), 'main.log');
  }
}

function log(line) {
  const msg = `[${new Date().toISOString()}] ${String(line)}\n`;
  try {
    fs.mkdirSync(path.dirname(getLogPath()), { recursive: true });
    fs.appendFileSync(getLogPath(), msg, 'utf8');
  } catch (_) {
    // ignore
  }
}

async function logAuthStorageDiagnostics(label) {
  try {
    const ses = session.fromPartition(PERSIST_PARTITION);
    const userData = app.getPath('userData');
    const partitionPath = path.join(userData, 'Partitions', PERSIST_PARTITION.replace(':', '_'));
    const cookies = await ses.cookies.get({ domain: 'app.yummyever.com' });
    log(
      `[auth-diag:${label}] userData=${userData} partition=${PERSIST_PARTITION} partitionPath=${partitionPath} cookies(app.yummyever.com)=${cookies.length}`
    );
  } catch (err) {
    log(`[auth-diag:${label}] failed ${String(err?.message || err)}`);
  }
}

/** Read web localStorage snapshot (tokens live here for this SaaS app). */
async function logWebAuthSnapshot(label) {
  if (!mainWindow?.webContents || mainWindow.webContents.isDestroyed()) return;
  try {
    const snap = await readWebAuthSnapshot(mainWindow.webContents);
    const url = mainWindow.webContents.getURL();
    log(
      `[auth-web:${label}] url=${url} hasAccess=${!!snap?.accessToken} hasRefresh=${!!snap?.refreshToken}`
    );
  } catch (err) {
    log(`[auth-web:${label}] failed ${String(err?.message || err)}`);
  }
}

function getIconPath() {
  const candidates = [
    path.join(__dirname, 'build', 'icon.ico'),
    path.join(__dirname, 'build', 'icon.png'),
    path.join(__dirname, 'build', 'icon-256.png'),
    path.join(process.resourcesPath || '', 'build', 'icon.ico'),
    path.join(process.resourcesPath || '', 'build', 'icon.png'),
    path.join(process.resourcesPath || '', 'build', 'icon-256.png'),
    path.join(process.resourcesPath || '', 'icon.png'),
    path.join(process.resourcesPath || '', 'icon.ico')
  ];
  return candidates.find((candidate) => candidate && fs.existsSync(candidate));
}

/** Base64 data URI for splash — file:// URLs are blocked inside data: HTML pages. */
function getLogoDataUri() {
  const iconPath = getIconPath();
  if (!iconPath) return '';
  try {
    const buf = fs.readFileSync(iconPath);
    const ext = path.extname(iconPath).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : ext === '.ico' ? 'image/x-icon' : 'image/jpeg';
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch (err) {
    log(`[getLogoDataUri] ${String(err?.message || err)}`);
    return '';
  }
}

function getStartUrl() {
  // Allow overriding for staging builds, but keep strict defaults.
  const override = String(process.env.ELECTRON_START_URL || '').trim();
  if (override) return override;
  return isDev ? DEV_URL : PROD_URL;
}

/** Firebase Google sign-in opens a popup; must not be sent to the system browser. */
function isOAuthPopupUrl(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host === 'accounts.google.com') return true;
    if (host.endsWith('.googleusercontent.com')) return true;
    if (host.endsWith('.firebaseapp.com')) return true;
    if (host.endsWith('.web.app')) return true;
    if (u.pathname.includes('/__/auth/')) return true;
    const start = getStartUrl();
    if (start.startsWith('http')) {
      const appHost = new URL(start).hostname.toLowerCase();
      if (host === appHost && u.pathname.includes('/__/auth/')) return true;
    }
    return false;
  } catch (_) {
    return false;
  }
}

function attachOAuthPopupHandler(webContents) {
  if (!webContents || webContents.isDestroyed()) return;
  webContents.setWindowOpenHandler(({ url }) => {
    if (isOAuthPopupUrl(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 520,
          height: 720,
          autoHideMenuBar: true,
          parent: mainWindow || undefined,
          modal: false,
          webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            partition: PERSIST_PARTITION,
          },
        },
      };
    }
    try {
      shell.openExternal(url);
    } catch (_) {}
    return { action: 'deny' };
  });
}

function getOfflineHtml(startUrl) {
  const safeUrl = String(startUrl).replace(/"/g, '&quot;');
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Yummy POS — Offline</title>
  <style>
    :root { color-scheme: dark; }
    html, body { height: 100%; margin: 0; }
    body {
      background: radial-gradient(1200px 600px at 50% 30%, rgba(99,102,241,0.18), transparent 60%),
                  #0b0f19;
      color: rgba(255,255,255,0.86);
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
      display: grid;
      place-items: center;
      padding: 24px;
    }
    .card {
      width: min(560px, 100%);
      border-radius: 16px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.12);
      box-shadow: 0 18px 60px rgba(0,0,0,0.45);
      padding: 22px;
    }
    h1 { font-size: 18px; margin: 0 0 8px; }
    p { margin: 0 0 14px; opacity: .75; line-height: 1.45; }
    .row { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 14px; }
    button, a.btn {
      appearance: none;
      border: 1px solid rgba(255,255,255,0.14);
      background: rgba(255,255,255,0.08);
      color: rgba(255,255,255,0.9);
      padding: 10px 12px;
      border-radius: 12px;
      cursor: pointer;
      text-decoration: none;
      font-weight: 600;
      font-size: 13px;
    }
    button.primary { background: rgba(99,102,241,0.9); border-color: rgba(99,102,241,0.9); }
    code { opacity: .85; }
  </style>
</head>
<body>
  <div class="card">
    <h1>You’re offline</h1>
    <p>Yummy POS loads the latest app from <code>${safeUrl}</code>. Check your internet connection and try again.</p>
    <div class="row">
      <button class="primary" onclick="location.href='${safeUrl}'">Retry</button>
      <button onclick="location.reload()">Reload</button>
    </div>
  </div>
</body>
</html>`;
}

function createSplashWindow(iconPath) {
  try {
    splashWindow = new BrowserWindow({
      width: 420,
      height: 320,
      frame: false,
      transparent: false,
      resizable: false,
      movable: true,
      minimizable: false,
      maximizable: false,
      // Must be closable so we can close it programmatically on Windows.
      closable: true,
      alwaysOnTop: true,
      center: true,
      show: true,
      backgroundColor: '#0b0f19',
      icon: iconPath,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });

    const logoSrc = getLogoDataUri();
    const splashHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Yummy POS</title>
  <style>
    :root { color-scheme: dark; }
    html, body { height: 100%; margin: 0; }
    body {
      background: radial-gradient(1200px 600px at 50% 30%, rgba(99,102,241,0.18), transparent 60%),
                  #0b0f19;
      color: rgba(255,255,255,0.86);
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
      display: grid;
      place-items: center;
    }
    .wrap { text-align: center; padding: 26px; }
    .logo {
      width: 92px; height: 92px;
      border-radius: 20px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.12);
      display: grid; place-items: center;
      box-shadow: 0 18px 60px rgba(0,0,0,0.45);
      margin: 0 auto 16px;
      overflow: hidden;
    }
    .logo img { width: 60px; height: 60px; object-fit: contain; }
    .title { font-weight: 900; letter-spacing: .08em; text-transform: uppercase; font-size: 13px; opacity: .72; }
    .subtitle { margin-top: 10px; font-size: 12px; opacity: .65; }
    .bar {
      width: 220px; height: 6px; border-radius: 999px;
      background: rgba(255,255,255,0.12);
      overflow: hidden; margin: 16px auto 0;
    }
    .bar > i {
      display: block; height: 100%; width: 40%;
      background: linear-gradient(90deg, rgba(99,102,241,0.15), rgba(99,102,241,0.95), rgba(16,185,129,0.85));
      border-radius: 999px;
      animation: slide 1.1s ease-in-out infinite;
    }
    @keyframes slide { 0% { transform: translateX(-120%); } 100% { transform: translateX(280%); } }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="logo">${logoSrc ? `<img alt="Yummy" src="${logoSrc}" />` : ''}</div>
    <div class="title">Yummy POS</div>
    <div class="subtitle">Opening…</div>
    <div class="bar"><i></i></div>
  </div>
</body>
</html>`;

    splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml)}`);
    splashWindow.on('closed', () => {
      splashWindow = null;
    });
  } catch (_) {
    splashWindow = null;
  }
}

function createWindow() {
  const iconPath = getIconPath();
  const startUrl = getStartUrl();

  // Show a real native splash ASAP so the app doesn't feel "stuck" on cold start.
  // (Windows can take a while to unpack Electron / load Chromium before the main window appears.)
  if (!mainWindow) {
    createSplashWindow(iconPath);
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,
    icon: iconPath,
    show: false,
    backgroundColor: '#0b0f19',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // Ensure cookies/localStorage persist across restarts (avoid accidental temp sessions).
      partition: PERSIST_PARTITION
    }
  });

  let mainReadyToShow = false;
  let mainFinishedLoad = false;

  const tryShowMain = () => {
    if (!mainWindow) return;
    // Prefer showing only when the remote app actually finished loading
    // to avoid jarring white flashes.
    if (!mainFinishedLoad && !isDev) return;
    try {
      if (!mainWindow.isVisible()) mainWindow.show();
      if (!mainWindow.isFocused()) mainWindow.focus();
    } catch (_) {}
    if (splashWindow) {
      try { splashWindow.destroy(); } catch (_) {}
      splashWindow = null;
    }
  };

  mainWindow.once('ready-to-show', () => {
    mainReadyToShow = true;
    if (isDev) tryShowMain();
  });

  mainWindow.webContents.on('did-finish-load', () => {
    mainFinishedLoad = true;
    logAuthStorageDiagnostics('did-finish-load');
    void logWebAuthSnapshot('did-finish-load');
    if (mainReadyToShow || !isDev) tryShowMain();
  });

  // Log again after the SPA hydrates and may restore session.
  mainWindow.webContents.on('did-navigate-in-page', () => {
    void logWebAuthSnapshot('did-navigate-in-page');
  });

  // Backup: never block the user forever.
  setTimeout(() => {
    if (!mainWindow) return;
    if (!mainWindow.isVisible()) {
      try { mainWindow.show(); } catch (_) {}
    }
    if (splashWindow) {
      try { splashWindow.destroy(); } catch (_) {}
      splashWindow = null;
    }
  }, 15000);

  if (isDev) {
    // In dev, Next.js is run externally by concurrently.
    mainWindow.loadURL(startUrl);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL(startUrl).catch((err) => {
      log(`[loadURL] ${String(err?.message || err)}`);
      mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(getOfflineHtml(startUrl))}`);
    });
  }

  // Fallback if the live app fails to load (e.g., no internet / DNS / SSL issues).
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame) return;
    if (isDev) return;
    log(`[did-fail-load] code=${errorCode} desc=${errorDescription} url=${validatedURL}`);
    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(getOfflineHtml(startUrl))}`);
    // Offline HTML counts as "loaded" for our splash dismissal.
    mainFinishedLoad = true;
    tryShowMain();
  });

  // Allow Firebase/Google OAuth popups in-app; other links open in the system browser.
  attachOAuthPopupHandler(mainWindow.webContents);

  attachAuthPersistence(mainWindow, USER_DATA_DIR, log);

  // Handle native window.print() requests (no-op hook kept for parity)
}

app.whenReady().then(() => {
  logAuthStorageDiagnostics('startup');
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  if (!mainWindow?.webContents || mainWindow.webContents.isDestroyed()) return;
  const { writeAuthBackup } = require('./electron-auth-persist');
  void readWebAuthSnapshot(mainWindow.webContents).then((snap) => {
    if (snap) writeAuthBackup(USER_DATA_DIR, snap);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// --- IPC Handlers for Printing ---

ipcMain.handle('get-printers', async (event) => {
  const printers = await mainWindow.webContents.getPrintersAsync();
  return printers;
});

// Print the CURRENT window silently (relies on CSS @media print just like browser)
ipcMain.handle('print-silent', async (event, options = {}) => {
  return new Promise((resolve, reject) => {
    mainWindow.webContents.print({
      silent: true,
      deviceName: options.printerName || undefined,
      margins: { marginType: 'none' },
      ...options
    }, (success, errorType) => {
      if (success) {
        resolve({ success: true });
      } else {
        reject({ success: false, error: errorType });
      }
    });
  });
});

// Send raw text payload to TCP network printer (ESC/POS compatible simulators).
ipcMain.handle('print-network-raw', async (event, options = {}) => {
  const host = String(options.host || '').trim();
  const port = Number(options.port || 9100);
  const payload = String(options.payload || '');
  const timeoutMs = Math.max(4000, Number(options.timeoutMs || 8000));

  if (!host || !port) {
    return { success: false, message: 'Invalid printer host/port' };
  }
  if (!payload) {
    return { success: false, message: 'Empty print payload' };
  }

  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      try { socket.destroy(); } catch (_) {}
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => {
      try {
        const buffer = Buffer.from(payload, 'utf8');
        socket.write(buffer, (err) => {
          if (err) {
            finish({ success: false, message: String(err?.message || err) });
            return;
          }
          socket.end();
          finish({ success: true, message: `Raw print sent to ${host}:${port} (${buffer.length} bytes)` });
        });
      } catch (err) {
        finish({ success: false, message: String(err?.message || err) });
      }
    });
    socket.once('timeout', () => finish({ success: false, message: `Timeout connecting to ${host}:${port}` }));
    socket.once('error', (err) => finish({ success: false, message: String(err?.message || err) }));

    try {
      socket.connect({ host, port, family: 4 });
    } catch (err) {
      finish({ success: false, message: String(err?.message || err) });
    }
  });
});

// Electron-local network printer connectivity test (desktop -> printer IP:port).
ipcMain.handle('test-network-printer', async (event, options = {}) => {
  const rawHost = String(options.host || '').trim();
  const host = rawHost
    .replace(/^tcp:\/\//i, '')
    .replace(/^https?:\/\//i, '')
    .split('/')[0]
    .trim();
  const port = Number(options.port || 9100);
  const timeoutMs = Math.max(4000, Number(options.timeoutMs || 8000));

  if (!host || !port) {
    return { success: false, message: 'Invalid printer host/port' };
  }

  const tryConnect = (family) => new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      try { socket.destroy(); } catch (_) {}
      resolve(result);
    };

    socket.setNoDelay(true);
    socket.setKeepAlive(true, 1000);
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish({ success: true, message: `Connected to ${host}:${port} (${family === 4 ? 'IPv4' : 'IPv6'})` }));
    socket.once('timeout', () => finish({ success: false, reason: 'timeout', message: `Timeout connecting to ${host}:${port} (${family === 4 ? 'IPv4' : 'IPv6'})` }));
    socket.once('error', (err) => finish({ success: false, reason: 'error', message: String(err?.message || err) }));

    try {
      socket.connect({ port, host, family });
    } catch (err) {
      finish({ success: false, reason: 'error', message: String(err?.message || err) });
    }
  });

  const ipv4Result = await tryConnect(4);
  if (ipv4Result.success) return ipv4Result;

  const ipv6Result = await tryConnect(6);
  if (ipv6Result.success) return ipv6Result;

  return {
    success: false,
    message: `Unable to connect to ${host}:${port}. IPv4: ${ipv4Result.message}. IPv6: ${ipv6Result.message}`
  };
});
