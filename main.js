const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const net = require('net');

const isDev = process.env.NODE_ENV !== 'production';

let mainWindow;
let nextProcess;

function findStandaloneServerPath() {
  const candidates = [
    path.join(__dirname, '.next', 'standalone', 'server.js'),
    path.join(process.resourcesPath || '', 'app.asar.unpacked', '.next', 'standalone', 'server.js'),
    path.join(process.resourcesPath || '', '.next', 'standalone', 'server.js')
  ];
  return candidates.find((candidate) => candidate && fs.existsSync(candidate));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev) {
    // In dev, Next.js is run externally by concurrently.
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    const PORT = process.env.PORT || '4100';
    const serverPath = findStandaloneServerPath();
    if (!serverPath) {
      mainWindow.loadURL(`data:text/html,${encodeURIComponent('<h2>Failed to start app</h2><p>Next standalone server not found in packaged files.</p>')}`);
      return;
    }

    const env = {
      ...process.env,
      PORT: PORT,
      NODE_ENV: 'production',
      HOSTNAME: 'localhost'
    };

    nextProcess = spawn(process.execPath, [serverPath], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let loaded = false;

    nextProcess.stdout.on('data', (data) => {
      console.log(`[Next.js]: ${data}`);
      const line = data.toString();
      if (!loaded && (line.includes('Listening on') || line.includes('Ready in') || line.includes(`:${PORT}`))) {
        loaded = true;
        mainWindow.loadURL(`http://localhost:${PORT}`);
      }
    });

    nextProcess.stderr.on('data', (data) => {
      console.error(`[Next.js Error]: ${data}`);
    });

    nextProcess.on('error', (error) => {
      console.error('[Next.js Spawn Error]:', error);
      mainWindow.loadURL(`data:text/html,${encodeURIComponent(`<h2>Failed to start app server</h2><pre>${String(error)}</pre>`)}`);
    });

    nextProcess.on('exit', (code) => {
      if (!loaded) {
        mainWindow.loadURL(`data:text/html,${encodeURIComponent(`<h2>App server exited early</h2><p>Exit code: ${code}</p>`)}`);
      }
    });

    setTimeout(() => {
      if (!loaded) {
        mainWindow.loadURL(`http://localhost:${PORT}`);
      }
    }, 5000);
  }

  // Handle native window.print() requests
  mainWindow.webContents.on('did-finish-load', () => {
    // We don't automatically print here, we let the frontend trigger it
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (nextProcess) {
    nextProcess.kill();
  }
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
