# Electron App Starts but Window Does Not Appear (Wayland / Linux)

> **Target**: Electron app running on Fedora 44 with a Wayland session. The process starts, logs appear in the terminal, the icon shows in the dock, but no visible window is drawn.

> **Prerequisite**: The NVIDIA driver (or your system's GPU stack) must be working before investigating Electron. See [fedora44-helios-neo16-nvidia.md](./fedora44-helios-neo16-nvidia.md) for the driver layer.

---

## Why this happens

On Linux/Wayland, Electron (Chromium-based) uses the Ozone platform abstraction. When Wayland is detected, Electron may fail to compose a visible window due to:

- A `BrowserWindow` created with `show: false` that is never explicitly shown
- A bad Wayland/Ozone flag combination that produces an invisible or off-screen window
- A renderer process that starts but stalls before the first visible paint
- Window decoration issues between Electron and the Wayland compositor (GNOME, KDE, etc.)
- GPU process issues that silently prevent the window from rendering

---

## Confirm the issue is Electron-side

Before diving in, verify:

```bash
# GPU stack is healthy
nvidia-smi
lsmod | grep nvidia

# Session is actually Wayland
echo $XDG_SESSION_TYPE   # expected: wayland

# Start the app and check if the process is alive
npm start &
sleep 5
pgrep -a electron
```

If the process is running but the window does not appear, the issue is in the Electron layer.

---

## Quick tests — run in this order

```bash
# 1. Default run
npm start

# 2. Let Electron auto-detect the platform
ELECTRON_OZONE_PLATFORM_HINT=auto npm start

# 3. Force Wayland
ELECTRON_OZONE_PLATFORM_HINT=wayland npm start

# 4. Force XWayland (X11 compatibility layer)
ELECTRON_OZONE_PLATFORM_HINT=x11 npm start

# 5. Disable GPU to isolate rendering
ELECTRON_DISABLE_GPU=1 npm start

# 6. Use software rendering entirely
LIBGL_ALWAYS_SOFTWARE=1 npm start
```

If the window appears with any of these variants, that variant tells you exactly which layer is failing.

---

## Code audit checklist

Open the Electron main process file (usually `src/main.ts`, `electron/main.ts`, or `main.js`) and check:

### BrowserWindow creation

```js
// Look for these options and verify their values:
new BrowserWindow({
  show,           // ← if false, window is hidden until .show() is called
  transparent,    // ← can cause invisible windows on some compositors
  frame,          // ← false + Wayland can cause issues
  titleBarStyle,  // ← 'hidden' / 'customButtonsOnHover' problematic on Linux
  backgroundColor,// ← '#00000000' (transparent) can prevent rendering
  x, y,           // ← fixed position may be off-screen
  width, height,  // ← very small values may render outside visible area
  focusable,      // ← false can prevent window from appearing
  skipTaskbar,
  alwaysOnTop,
  fullscreen,
  paintWhenInitiallyHidden, // ← false blocks first paint
})
```

### Show flow

```js
// GOOD pattern
const win = new BrowserWindow({ show: false, ... });
win.once('ready-to-show', () => {
  win.show();
  win.focus();
});
await win.loadURL(url);

// BAD — show: false with no guarantee of win.show()
const win = new BrowserWindow({ show: false });
await win.loadURL(url);
// if ready-to-show never fires, the window stays hidden forever
```

---

## Diagnostic logs to add temporarily

Add these to your main process to understand exactly what is happening:

```js
console.log('[diag] createWindow called');

const win = new BrowserWindow(options);
console.log('[diag] BrowserWindow created, options:', JSON.stringify(options, null, 2));

win.webContents.on('did-finish-load', () => {
  console.log('[diag] did-finish-load');
  console.log('[diag] isVisible:', win.isVisible());
  console.log('[diag] getBounds:', win.getBounds());
  console.log('[diag] isDestroyed:', win.isDestroyed());
});

win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
  console.error('[diag] did-fail-load:', errorCode, errorDescription);
});

win.webContents.on('render-process-gone', (event, details) => {
  console.error('[diag] render-process-gone:', details);
});

win.webContents.on('unresponsive', () => {
  console.warn('[diag] window unresponsive');
});

win.webContents.on('console-message', (event, level, message) => {
  console.log(`[renderer] [${level}] ${message}`);
});

app.on('gpu-process-crashed', (event, killed) => {
  console.error('[diag] gpu-process-crashed, killed:', killed);
});

app.on('child-process-gone', (event, details) => {
  console.error('[diag] child-process-gone:', details);
});

win.once('ready-to-show', () => {
  console.log('[diag] ready-to-show fired');
  win.show();
  win.focus();
  console.log('[diag] after show — isVisible:', win.isVisible());
});
```

---

## Minimal diagnostic window

If the problem persists, replace your `createWindow()` temporarily with this minimal version to isolate whether the issue is in your app logic or in the Electron + Wayland base:

```js
// See examples/electron-diagnostic-main.js for the full version
function createDiagnosticWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    x: 100,
    y: 100,
    show: false,
    backgroundColor: '#1a1a1a',
    // Remove: transparent, frame: false, titleBarStyle, vibrancy
  });

  win.once('ready-to-show', () => {
    win.show();
    win.focus();
    win.moveTop();
  });

  win.loadURL('https://example.com');
}
```

If this minimal window appears, the issue is in your real `BrowserWindow` configuration. Reintroduce your options one by one until the window stops appearing — that is the problematic option.

---

## Platform-specific Ozone flags

If your app is setting Ozone flags globally, consider applying them only on Linux:

```js
// In main process, before app.whenReady()
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('ozone-platform-hint', 'auto');
  // or: app.commandLine.appendSwitch('enable-features', 'UseOzonePlatform');
}
```

Avoid hardcoding `--ozone-platform=wayland` without a fallback — it can break XWayland and cause exactly this symptom on some compositor configurations.

---

## Summary table

| Symptom | Likely cause | Test |
|---|---|---|
| Window never appears, process alive | `show: false` without `win.show()` | Add `ready-to-show` + `win.show()` |
| Window appears with `ELECTRON_DISABLE_GPU=1` | GPU/compositor issue | Try `ELECTRON_OZONE_PLATFORM_HINT=auto` |
| Window appears with `x11` hint | Wayland compositor incompatibility | Use `auto` instead of `wayland` |
| Renderer logs show JS errors | App crash before first paint | Check `console-message` listener |
| `did-fail-load` fires | loadURL failed | Check URL, dev server, preload errors |
