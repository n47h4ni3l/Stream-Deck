const { app, BrowserWindow, ipcMain, powerSaveBlocker, dialog } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { parseCommand, inspectBrowser, setupBrowser, hostEnvironment } = require('./setup/browser-dependencies');
const { PlaybackMonitor } = require('./setup/playback');
const { browserAdapter } = require('./setup/browser-adapters');
const steamSetup = require('./setup/steam');
const browserReturn = require('./setup/browser-return');

// Packaged ASARs and AppImages are read-only. Keep settings and logs alongside
// usage data, using the same application name as the source installation.
const userDataPath = app && typeof app.getPath === 'function' ? app.getPath('userData') : __dirname;
const logFile = path.join(userDataPath, 'log.txt');

function logError(msg, err = '') {
  const entry = `${new Date().toISOString()} ${msg} ${(err && err.stack) || err}\n`;
  try {
    fs.appendFileSync(logFile, entry);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Failed to write log file:', e);
  }
}

// Flatpak command for Ungoogled Chromium
const defaultChromiumCommand = ['flatpak', 'run', 'io.github.ungoogled_software.ungoogled_chromium'];
const browserFile = path.join(userDataPath, 'browser_cmd');
let browserSetting = '', browserConfigError;
try {
  browserSetting = process.env.CHROMIUM_CMD ||
    (fs.existsSync(browserFile) ? fs.readFileSync(browserFile, 'utf8').trim() : '');
} catch (error) { browserConfigError = error; }
let chromiumCommand;
try { chromiumCommand = parseCommand(browserSetting); }
catch { chromiumCommand = [...defaultChromiumCommand]; }
let browserReady = process.type !== 'browser';
let browserSessionActive = false, quitting = false;
let backgroundReturn = true;
const featureFile = path.join(userDataPath, 'features.json');
try {
  if (fs.existsSync(featureFile)) backgroundReturn = JSON.parse(fs.readFileSync(featureFile, 'utf8')).backgroundReturn !== false;
} catch { /* Safe scoped default; no global keyboard/input hooks are registered. */ }
let steamStatus = { state: 'checking', detail: 'Checking Steam setup.', choices: [] };
function launchTarget() {
  if (process.env.APPIMAGE && path.isAbsolute(process.env.APPIMAGE)) {
    // AppImage resources live in a temporary mount/extraction. Keep the shortcut
    // icon at a stable user-owned path after that mount disappears.
    fs.mkdirSync(userDataPath, { recursive: true });
    const icon = path.join(userDataPath, 'steam-icon.png');
    fs.copyFileSync(path.join(process.resourcesPath, 'icon.png'), icon);
    return { launcher: process.env.APPIMAGE, launchOptions: '--appimage-extract-and-run', icon };
  }
  return app.isPackaged ? { launcher: path.resolve(process.resourcesPath, '../..', 'StreamDeckLauncher.sh'),
    icon: path.join(process.resourcesPath, 'icon.png') } : { launcher: path.join(__dirname, 'StreamDeckLauncher.sh'), icon: path.join(__dirname, 'build/icon.png') };
}
function notifyIntegration() {
  if (mainWindow && !mainWindow.isDestroyed() && typeof mainWindow.webContents.send === 'function') mainWindow.webContents.send('integration-status-changed');
}
function configureSteam(selection) {
  if (selection !== undefined && (typeof selection !== 'string' || !/^[0-9a-f]{20}$/.test(selection))) throw new Error('Invalid Steam account choice');
  steamStatus = steamSetup.setupSteam({ ...launchTarget(), env: process.env, storeDir: userDataPath, selection });
  notifyIntegration(); return steamStatus;
}
const dashboardEvent = event => event && mainWindow && !mainWindow.isDestroyed() && event.sender === mainWindow.webContents;

async function ensureBrowserDependencies() {
  const status = browserConfigError ? { ready: false, message: `Cannot read browser settings: ${browserConfigError.message}` }
    : inspectBrowser({ setting: browserSetting });
  if (status.ready) { browserReady = true; return; }
  if (!status.installable) throw new Error(status.message);
  const choice = await dialog.showMessageBox(mainWindow, {
    type: 'question', title: 'Streaming browser setup',
    message: 'A streaming browser is missing.',
    detail: `${status.message}\n\nInstall it and its Flatpak runtime from Flathub for your user account? Internet and disk space are required. Existing profiles are kept; system software and security settings are not changed.`,
    buttons: ['Install browser for my account', 'Quit'], defaultId: 0, cancelId: 1, noLink: true
  });
  if (choice.response !== 0) { app.exit(0); return; }
  const progress = new BrowserWindow({ width: 500, height: 220, parent: mainWindow,
    modal: true, show: true, closable: false, resizable: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } });
  try {
    await progress.loadURL('data:text/html,' + encodeURIComponent('<title>Installing streaming browser</title><body style="font:18px sans-serif;padding:24px">Installing the browser and its runtime for your account. This may take several minutes. You will be notified if setup fails.</body>'));
    const ready = await setupBrowser({ setting: browserSetting, install: true,
      onOutput: output => logError('Browser setup:', output) });
    chromiumCommand.splice(0, chromiumCommand.length, ...ready.command);
    browserReady = true;
  } finally { progress.close(); }
}

// The inhibitor follows reported browser-wide MPRIS playback, never window or
// child-process lifetime. Closing/quitting the launcher stops observation.
let playbackMonitor;
let playbackStatus = { state: 'checking', blocking: false, scope: 'browser-wide' };

// Service URLs
const services = {
  "Netflix": "https://www.netflix.com",
  "Max": "https://www.max.com",
  "Hulu": "https://www.hulu.com",
  "YouTube": "https://www.youtube.com",
  "Stan": "https://www.stan.com.au",
  "Prime": "https://www.primevideo.com",
  "Paramount+": "https://www.paramountplus.com",
  "Crunchyroll": "https://www.crunchyroll.com",
  "Disney+": "https://www.disneyplus.com",
  "Apple TV+": "https://tv.apple.com",
  "Peacock": "https://www.peacocktv.com",
  "BBC iPlayer": "https://www.bbc.co.uk/iplayer",
  "Tubi": "https://www.tubitv.com",
  "Pluto TV": "https://pluto.tv",
  "Kayo": "https://kayosports.com.au",
  "Binge": "https://binge.com.au"
};

// Usage tracking file
const usageFile = path.join(userDataPath, 'usage.json');
const usageData = Object.create(null);
// Keep excess starts in memory so rollback remains correct while the persisted
// numeric count is capped (including overlapping successful/failed launches).
const usageOverflow = new Map();
let usageReadFailed = false;

function isUsageCount(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function normalizeUsage(data) {
  const valid = Object.create(null);
  if (!data || typeof data !== 'object' || Array.isArray(data)) return valid;
  for (const [name, count] of Object.entries(data)) {
    if (isUsageCount(count)) valid[name] = count;
  }
  return valid;
}

function replaceUsage(data) {
  const valid = normalizeUsage(data);
  // Keep the exported state current when loading or sanitizing a new snapshot.
  for (const name of Object.keys(usageData)) delete usageData[name];
  Object.assign(usageData, valid);
}

function loadUsage() {
  replaceUsage({});
  usageOverflow.clear();
  usageReadFailed = false;
  let contents;
  try {
    contents = fs.readFileSync(usageFile, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return;
    usageReadFailed = true;
    console.warn('Unable to read usage data; preserving the file.', err);
    logError('Unable to read usage data; preserving the file.', err);
    return;
  }
  try {
    replaceUsage(JSON.parse(contents));
  } catch (err) {
    console.warn('Failed to parse usage data, resetting.', err);
    logError('Failed to parse usage data, resetting.', err);
    try {
      fs.unlinkSync(usageFile);
    } catch {
      // ignore if unable to remove
    }
  }
}

function saveUsage() {
  // An unreadable history must not be overwritten with an empty/new snapshot.
  if (usageReadFailed) return;
  replaceUsage(usageData);
  try {
    fs.writeFileSync(usageFile, JSON.stringify(usageData));
  } catch (err) {
    console.warn('Unable to save usage data:', err);
    logError('Unable to save usage data:', err);
  }
}

function launchService(serviceName, event) {
  const url = services[serviceName];
  if (!url) return;

  let counted = false;
  let failed = false;
  const reportFailure = error => {
    if (failed) return;
    failed = true;
    // Revert only this launch, without overwriting other launches of the same
    // service. A command can start successfully and fail asynchronously later.
    if (counted) {
      const excess = usageOverflow.get(serviceName) || 0n;
      if (excess > 0n) {
        if (excess === 1n) usageOverflow.delete(serviceName);
        else usageOverflow.set(serviceName, excess - 1n);
      } else {
        const count = usageData[serviceName];
        const remaining = isUsageCount(count) ? count - 1 : 0;
        if (remaining > 0) usageData[serviceName] = remaining;
        else delete usageData[serviceName];
      }
      counted = false;
      saveUsage();
    }
    logError('Failed to launch service:', error);
    if (event && event.sender && typeof event.sender.send === 'function') event.sender.send('launch-service-error', serviceName);
    if (process.type === 'browser') dialog.showErrorBox('Streaming browser unavailable', `${error.message || error}\n\nRestart the launcher to check browser setup again.`);
  };
  if (process.type === 'browser') {
    const status = browserReady ? inspectBrowser({ command: chromiumCommand }) : { ready: false, message: 'Finish browser setup before opening a service.' };
    if (!status.ready) { reportFailure(new Error(status.message)); return; }
  }

  try {
    const args = [...chromiumCommand.slice(1)];
    if (!args.includes('--kiosk')) args.push('--kiosk');
    const child = spawn(
      chromiumCommand[0],
      [...args, url],
      { detached: true, stdio: 'ignore', env: hostEnvironment() }
    );
    child.once('spawn', () => {
      if (failed) return;
      browserSessionActive = true;
      const count = usageData[serviceName];
      const previous = isUsageCount(count) ? count : 0;
      if (previous === Number.MAX_SAFE_INTEGER) {
        usageOverflow.set(serviceName, (usageOverflow.get(serviceName) || 0n) + 1n);
      } else usageData[serviceName] = previous + 1;
      counted = true;
      saveUsage();
    });
    child.on('error', reportFailure);
    child.once('exit', (code, signal) => {
      if (code || signal) {
        const reason = signal ? `signal ${signal}` : `code ${code}`;
        reportFailure(new Error(`Browser process exited with ${reason}. Check the selected browser and its runtime.`));
      }
    });
    child.unref();
  } catch (err) {
    console.error('Failed to launch service:', err);
    reportFailure(err);
  }
}

function getSortedServices(data = usageData) {
  const valid = normalizeUsage(data);
  return Object.keys(services).sort((a, b) => (valid[b] || 0) - (valid[a] || 0));
}

let mainWindow;
function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    fullscreen: true,
    show: false,
    backgroundColor: '#1b2838',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });
  mainWindow = window;

  window.setMenuBarVisibility(false);

  window.once('ready-to-show', () => {
    if (window.isDestroyed()) return;
    window.show();
    window.focus();
  });
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null;
  });
  window.on('focus', () => { browserSessionActive = false; });
  window.webContents.on('render-process-gone', (_event, details) => {
    logError('Dashboard renderer stopped:', details.reason);
  });
  window.webContents.on('preload-error', (_event, preloadPath, error) => {
    logError(`Preload failed (${preloadPath}):`, error);
  });

  return window.loadFile(path.join(__dirname, 'index.html'));
}

function reportStartupError(error) {
  logError('Failed to start dashboard:', error);
  dialog.showErrorBox('Stream Deck Launcher could not start',
    `${error.message || error}\n\nSee ${logFile} for details.`);
  app.exit(1);
}

// Electron 29's default app imports our CommonJS entry point. In that path
// require.main !== module, so a Node CLI guard silently skips all startup work.
// process.type identifies the actual Electron main process, including packages.
if (process.type === 'browser') {
  process.on('uncaughtException', err => {
    logError('Uncaught exception:', err);
  });
  process.on('unhandledRejection', reason => {
    logError('Unhandled rejection:', reason);
  });

  app.whenReady().then(async () => {
    if ((process.argv || []).includes('--streamdeck-runtime-probe')) {
      const probe = new BrowserWindow({ show: false,
        webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } });
      await probe.loadURL('data:text/html,<title>Runtime check</title>');
      app.exit(0);
      return;
    }
    loadUsage();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow().catch(reportStartupError);
      } else if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
    await createWindow();
    await ensureBrowserDependencies();
    if (!browserReady) return;
    playbackMonitor = new PlaybackMonitor({ adapter: browserAdapter(chromiumCommand), blocker: powerSaveBlocker,
      onState: status => {
        playbackStatus = status;
        notifyIntegration();
      } });
    playbackMonitor.start();
    configureSteam();
  }).catch(reportStartupError);

  app.on('window-all-closed', () => {
    if (playbackMonitor) playbackMonitor.stop();
    if (process.platform !== 'darwin') app.quit();
  });
  app.on('before-quit', () => { quitting = true; if (playbackMonitor) playbackMonitor.stop(); });

  ipcMain.on('launch-service', (event, serviceName) => {
    launchService(serviceName, event);
  });
  ipcMain.handle('get-sorted-services', () => getSortedServices());
  ipcMain.handle('get-integration-status', event => dashboardEvent(event) ? { playback: playbackStatus, steam: steamStatus,
    browserReturn: { ...browserReturn.capability(browserAdapter(chromiumCommand)), enabled: backgroundReturn } } : {});
  ipcMain.handle('setup-steam', (event, selection) => {
    if (!dashboardEvent(event)) throw new Error('Steam setup is only available from the dashboard');
    return configureSteam(selection);
  });
  ipcMain.handle('set-browser-return', (event, enabled) => {
    if (!dashboardEvent(event) || typeof enabled !== 'boolean') throw new Error('Invalid return setting');
    fs.mkdirSync(userDataPath, { recursive: true });
    fs.writeFileSync(featureFile, JSON.stringify({ backgroundReturn: enabled }), { mode: 0o600 });
    backgroundReturn = enabled; notifyIntegration(); return enabled;
  });
  ipcMain.handle('return-from-browser', async event => {
    if (!dashboardEvent(event) || quitting || !backgroundReturn || !browserSessionActive || mainWindow.isFocused()) return false;
    try {
      if (!await browserReturn.foregroundBrowser(browserAdapter(chromiumCommand)) || quitting || !mainWindow || mainWindow.isDestroyed()) return false;
      mainWindow.show(); mainWindow.focus(); browserSessionActive = false; return true;
    } catch { return false; }
  });
  let backDialog = false;
  ipcMain.handle('dashboard-back', async event => {
    if (!dashboardEvent(event) || backDialog) return;
    backDialog = true;
    try {
      const choice = await dialog.showMessageBox(mainWindow, { type: 'question', title: 'Leave launcher?',
        message: 'Quit Stream Deck Launcher?', detail: 'The browser stays open. Playback-aware sleep prevention stops when the launcher quits.',
        buttons: ['Stay', 'Quit launcher'], defaultId: 0, cancelId: 0, noLink: true });
      if (choice.response === 1) app.quit();
    } finally { backDialog = false; }
  });
}

module.exports = {
  getSortedServices,
  services,
  loadUsage,
  saveUsage,
  usageFile,
  usageData,
  launchService,
  chromiumCommand,
  logFile,
  logError
};
