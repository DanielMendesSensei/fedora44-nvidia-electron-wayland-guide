/**
 * electron-diagnostic-main.js
 *
 * A minimal Electron main process for diagnosing "app starts but window does
 * not appear" issues on Linux/Wayland.
 *
 * Usage:
 *   1. Temporarily replace your real createWindow() with createDiagnosticWindow()
 *   2. Run: npm start
 *   3. Check the terminal output for [diag] logs
 *   4. If this minimal window appears, reintroduce your real options one by one
 *
 * This file is safe on macOS and Windows — the Linux-specific flags
 * are applied only when process.platform === 'linux'.
 */

const { app, BrowserWindow } = require('electron');

// Apply Ozone/Wayland hints only on Linux, before app is ready
if (process.platform === 'linux') {
  // 'auto' lets Electron decide between Wayland and XWayland
  // This is safer than hardcoding 'wayland'
  app.commandLine.appendSwitch('ozone-platform-hint', 'auto');
}

function createDiagnosticWindow() {
  console.log('[diag] createDiagnosticWindow called');

  const options = {
    width: 1200,
    height: 800,
    x: 100,
    y: 100,
    show: false,                // always start hidden, show in ready-to-show
    backgroundColor: '#1a1a1a', // solid color avoids transparency issues
    // deliberately NOT setting:
    //   transparent: true
    //   frame: false
    //   titleBarStyle: 'hidden'
    //   vibrancy
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  };

  console.log('[diag] BrowserWindow options:', JSON.stringify(options, null, 2));

  const win = new BrowserWindow(options);

  // --- Event listeners for diagnosis ---

  win.once('ready-to-show', () => {
    console.log('[diag] ready-to-show fired');
    win.show();
    win.focus();
    win.moveTop();
    console.log('[diag] after show — isVisible:', win.isVisible());
    console.log('[diag] getBounds:', JSON.stringify(win.getBounds()));
    console.log('[diag] isDestroyed:', win.isDestroyed());
    // Open DevTools automatically for easier debugging
    win.webContents.openDevTools();
  });

  win.webContents.on('did-finish-load', () => {
    console.log('[diag] did-finish-load');
    console.log('[diag] isVisible:', win.isVisible());
  });

  win.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('[diag] did-fail-load:', errorCode, errorDescription, validatedURL);
  });

  win.webContents.on('render-process-gone', (event, details) => {
    console.error('[diag] render-process-gone:', JSON.stringify(details));
  });

  win.webContents.on('unresponsive', () => {
    console.warn('[diag] window unresponsive');
  });

  win.webContents.on('console-message', (event, level, message, line, sourceId) => {
    const levels = ['verbose', 'info', 'warning', 'error'];
    console.log(`[renderer] [${levels[level] ?? level}] ${message} (${sourceId}:${line})`);
  });

  app.on('gpu-process-crashed', (event, killed) => {
    console.error('[diag] gpu-process-crashed, killed:', killed);
  });

  app.on('child-process-gone', (event, details) => {
    console.error('[diag] child-process-gone:', JSON.stringify(details));
  });

  // --- Load a safe test URL ---
  // Replace with your actual loadURL / loadFile when testing your real app
  const testURL = 'https://example.com';
  console.log('[diag] loading URL:', testURL);
  win.loadURL(testURL);
}

app.whenReady().then(() => {
  console.log('[diag] app ready');
  console.log('[diag] platform:', process.platform);
  console.log('[diag] electron version:', process.versions.electron);
  console.log('[diag] chrome version:', process.versions.chrome);

  createDiagnosticWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createDiagnosticWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
