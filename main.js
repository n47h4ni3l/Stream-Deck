const { app, BrowserWindow, ipcMain, powerSaveBlocker } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Flatpak command for Ungoogled Chromium
const defaultChromiumCommand = ['flatpak', 'run', 'io.github.ungoogled_software.ungoogled_chromium'];
const chromiumCommand = process.env.CHROMIUM_CMD
  ? process.env.CHROMIUM_CMD.split(/\s+/)
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
const userDataPath = app && typeof app.getPath === 'function'
  ? app.getPath('userData')
  : __dirname;
const usageFile = path.join(userDataPath, 'usage.json');
let usageData = {};

// Load usage data
function loadUsage() {
  if (fs.existsSync(usageFile)) {
    try {
      usageData = JSON.parse(fs.readFileSync(usageFile));
    } catch (err) {
      console.warn('Failed to parse usage data, resetting.', err);
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

// Save usage data
function saveUsage() {
  fs.writeFileSync(usageFile, JSON.stringify(usageData));
}

// Launch a service URL in Chromium and track usage
function launchService(serviceName, event) {
  const url = services[serviceName];
  if (!url) {
    return;
  }

  try {
    const child = spawn(
      chromiumCommand[0],
      [...chromiumCommand.slice(1), url],
      { detached: true, stdio: 'ignore' }
    );
    child.unref();

    usageData[serviceName] = (usageData[serviceName] || 0) + 1;
    saveUsage();
  } catch (err) {
    console.error('Failed to launch service:', err);
    if (event && event.sender && typeof event.sender.send === 'function') {
      event.sender.send('launch-service-error', serviceName);
    }
  }
}

// Sort services by usage
function getSortedServices(data = usageData) {
  return Object.keys(services).sort((a, b) => {
    return (data[b] || 0) - (data[a] || 0);
  });
}

// Create window
function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    fullscreen: true,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  win.loadFile('index.html');

  // Prevent sleep
  psbId = powerSaveBlocker.start('prevent-display-sleep');
}

if (require.main === module) {
  // App lifecycle
  app.whenReady().then(() => {
    loadUsage();
    createWindow();

    app.on('activate', function () {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', function () {
    if (powerSaveBlocker.isStarted(psbId)) {
      powerSaveBlocker.stop(psbId);
    }
    if (process.platform !== 'darwin') app.quit();
  });

  // IPC: Launch service
  ipcMain.on('launch-service', (event, serviceName) => {
    launchService(serviceName, event);
  });

  // IPC: Get sorted services
  ipcMain.handle('get-sorted-services', async () => {
    return getSortedServices();
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
  chromiumCommand
};
