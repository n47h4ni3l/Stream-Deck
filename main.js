const { app, BrowserWindow, ipcMain, powerSaveBlocker, screen } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const shellQuote = require('shell-quote');

// Log file path
const logFile = path.join(__dirname, 'log.txt');

function logError(msg, err = '') {
  const entry = `${new Date().toISOString()} ${msg} ${err.stack || err}\n`;
  try {
    fs.appendFileSync(logFile, entry);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Failed to write log file:', e);
  }
}

// Flatpak command for Ungoogled Chromium
const defaultChromiumCommand = ['flatpak', 'run', 'io.github.ungoogled_software.ungoogled_chromium'];
const chromiumCommand = process.env.CHROMIUM_CMD
  ? shellQuote.parse(process.env.CHROMIUM_CMD)
  : defaultChromiumCommand;

// No-sleep blocker
let psbId = null;

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
const userDataPath = app && typeof app.getPath === 'function' ? app.getPath('userData') : __dirname;
const usageFile = path.join(userDataPath, 'usage.json');
let usageData = {};

function loadUsage() {
  if (fs.existsSync(usageFile)) {
    try {
      usageData = JSON.parse(fs.readFileSync(usageFile));
    } catch (err) {
      console.warn('Failed to parse usage data, resetting.', err);
      logError('Failed to parse usage data, resetting.', err);
      usageData = {};
      try {
        fs.unlinkSync(usageFile);
      } catch {
        // ignore if unable to remove
      }
    }
  } else {
    usageData = {};
  }
}

function saveUsage() {
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

  try {
    const args = [...chromiumCommand.slice(1)];
    if (!args.includes('--kiosk')) args.push('--kiosk');
    const child = spawn(
      chromiumCommand[0],
      [...args, url],
      { detached: true, stdio: 'ignore' }
    );
    child.unref();

    usageData[serviceName] = (usageData[serviceName] || 0) + 1;
    saveUsage();
  } catch (err) {
    console.error('Failed to launch service:', err);
    logError('Failed to launch service:', err);
    if (event && event.sender && typeof event.sender.send === 'function') {
      event.sender.send('launch-service-error', serviceName);
    }
  }
}

function getSortedServices(data = usageData) {
  return Object.keys(services).sort((a, b) => (data[b] || 0) - (data[a] || 0));
}

let mainWindow;
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    fullscreen: true,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');
  mainWindow.setMenuBarVisibility(false);

  mainWindow.once('ready-to-show', () => {
    setTimeout(checkWindowVisibility, 1000);
  });

  psbId = powerSaveBlocker.start('prevent-display-sleep');
}

function checkWindowVisibility() {
  if (!mainWindow) return;
  const cursor = screen.getCursorScreenPoint();
  const bounds = mainWindow.getBounds();
  const visible = mainWindow.isVisible();
  if (!visible ||
    cursor.x < bounds.x || cursor.x > bounds.x + bounds.width ||
    cursor.y < bounds.y || cursor.y > bounds.y + bounds.height) {
    logError('Window may not be visible. Cursor outside window bounds.');
  }
}

if (require.main === module) {
  process.on('uncaughtException', err => {
    logError('Uncaught exception:', err);
  });
  process.on('unhandledRejection', reason => {
    logError('Unhandled rejection:', reason);
  });

  app.whenReady().then(() => {
    loadUsage();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (powerSaveBlocker.isStarted(psbId)) powerSaveBlocker.stop(psbId);
    if (process.platform !== 'darwin') app.quit();
  });

  ipcMain.on('launch-service', (event, serviceName) => {
    launchService(serviceName, event);
  });
  ipcMain.handle('get-sorted-services', () => getSortedServices());
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
  logError,
  checkWindowVisibility
};
