const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { EventEmitter } = require('events');

const repoRoot = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(repoRoot, require('../package.json').main), 'utf8');

async function boot(options = {}) {
  const { loadError, packaged = false } = options;
  const type = Object.prototype.hasOwnProperty.call(options, 'type') ? options.type : 'browser';
  const app = new EventEmitter();
  app.getPath = () => repoRoot;
  app.whenReady = jest.fn(() => Promise.resolve());
  app.quit = jest.fn();
  app.exit = jest.fn();
  const windows = [];
  const BrowserWindow = jest.fn(() => {
    const window = new EventEmitter();
    window.webContents = new EventEmitter();
    window.loadFile = jest.fn(() => loadError ? Promise.reject(loadError) : Promise.resolve());
    window.loadURL = jest.fn(() => Promise.resolve());
    window.close = jest.fn();
    window.setMenuBarVisibility = jest.fn();
    window.show = jest.fn();
    window.focus = jest.fn();
    window.isDestroyed = jest.fn(() => false);
    windows.push(window);
    return window;
  });
  BrowserWindow.getAllWindows = () => windows;
  const electron = {
    app, BrowserWindow,
    ipcMain: { on: jest.fn(), handle: jest.fn() },
    powerSaveBlocker: { start: jest.fn(() => 0), stop: jest.fn(), isStarted: jest.fn(() => true) },
    dialog: { showErrorBox: jest.fn(), showMessageBox: jest.fn(async () => ({ response: options.cancelSetup ? 1 : 0 })) }
  };
  const module = { exports: {} };
  const playback = { start: jest.fn(), stop: jest.fn() };
  const mockRequire = name => {
    if (name === 'electron') return electron;
    if (name === './setup/playback') return { PlaybackMonitor: jest.fn(() => playback) };
    if (name === './setup/steam') return { setupSteam: jest.fn(() => ({ state: 'not-found', choices: [], detail: 'Isolated fixture' })) };
    if (name === 'fs') return { existsSync: () => false, appendFileSync: jest.fn(),
      readFileSync: () => { throw Object.assign(new Error('missing fixture file'), { code: 'ENOENT' }); } };
    if (name === './setup/browser-dependencies') return {
      ...require('../setup/browser-dependencies'),
      inspectBrowser: jest.fn(() => options.browserMissing ? {
        ready: false, installable: !options.noFlatpak, message: 'Browser missing', command: ['flatpak', 'run', 'test.Browser.App']
      } : { ready: true }),
      setupBrowser: jest.fn(async () => {
        if (options.setupError) throw new Error(options.setupError);
        return { ready: true, command: ['flatpak', 'run', 'test.Browser.App'] };
      })
    };
    if (name.startsWith('./setup/')) return require(path.join(repoRoot, name));
    return require(name);
  };
  // Electron's default app imports this file instead of making it require.main.
  mockRequire.main = packaged ? module : { filename: 'electron/default_app/main.js' };
  vm.runInNewContext(source, {
    require: mockRequire, module, __dirname: repoRoot, console,
    process: { type, env: {}, argv: options.argv || [], platform: 'linux', on: jest.fn() }
  });
  await new Promise(resolve => setImmediate(resolve));
  return { ...electron, windows, playback };
}

test.each([false, true])('starts when loaded by Electron (packaged=%s)', async packaged => {
  const { app, windows, ipcMain } = await boot({ packaged });
  expect(app.whenReady).toHaveBeenCalledTimes(1);
  expect(windows).toHaveLength(1);
  expect(windows[0].loadFile).toHaveBeenCalledWith(path.join(repoRoot, 'index.html'));
  expect(ipcMain.handle).toHaveBeenCalledWith('get-sorted-services', expect.any(Function));
  expect(ipcMain.on).toHaveBeenCalledWith('launch-service', expect.any(Function));
  windows[0].emit('ready-to-show');
  expect(windows[0].show).toHaveBeenCalledTimes(1);
  expect(windows[0].focus).toHaveBeenCalledTimes(1);
});

test('importing helpers in Node does not start Electron', async () => {
  const { app, windows } = await boot({ type: undefined });
  expect(app.whenReady).not.toHaveBeenCalled();
  expect(windows).toHaveLength(0);
});

test('an idle dashboard does not prevent display sleep', async () => {
  const { powerSaveBlocker } = await boot();
  expect(powerSaveBlocker.start).not.toHaveBeenCalled();
});

test('reports dashboard load failures and exits instead of running invisibly', async () => {
  const { app, dialog } = await boot({ loadError: new Error('index.html missing') });
  expect(dialog.showErrorBox).toHaveBeenCalledWith(
    'Stream Deck Launcher could not start', expect.stringContaining('index.html missing')
  );
  expect(app.exit).toHaveBeenCalledWith(1);
});

test('does not show a window that closed before it was ready', async () => {
  const { windows } = await boot();
  windows[0].isDestroyed.mockReturnValue(true);
  windows[0].emit('closed');
  windows[0].emit('ready-to-show');
  expect(windows[0].show).not.toHaveBeenCalled();
});

test('stops sleep prevention when closing the last window', async () => {
  const { app, playback } = await boot();
  app.emit('window-all-closed');
  expect(playback.stop).toHaveBeenCalledTimes(1);
  expect(app.quit).toHaveBeenCalledTimes(1);
});

test('missing browser prompts for user-scoped setup and closes its progress window', async () => {
  const { windows, dialog, app } = await boot({ browserMissing: true });
  expect(dialog.showMessageBox).toHaveBeenCalledTimes(1);
  expect(dialog.showMessageBox.mock.calls[0][1].buttons).toEqual(['Install browser for my account', 'Quit']);
  expect(windows).toHaveLength(2);
  expect(windows[1].loadURL).toHaveBeenCalled();
  expect(windows[1].close).toHaveBeenCalled();
  expect(app.exit).not.toHaveBeenCalled();
});
test('declining browser setup exits without an installation progress window', async () => {
  const { windows, app } = await boot({ browserMissing: true, cancelSetup: true });
  expect(windows).toHaveLength(1);
  expect(app.exit).toHaveBeenCalledWith(0);
});
test.each([{ noFlatpak: true }, { setupError: 'Download failed' }])('reports blocked or failed browser setup: %j', async option => {
  const { dialog, app } = await boot({ browserMissing: true, ...option });
  expect(app.exit).toHaveBeenCalledWith(1);
  expect(dialog.showErrorBox).toHaveBeenCalled();
});
test('runtime probe checks a sandboxed hidden renderer without browser setup', async () => {
  const { windows, dialog, app } = await boot({ argv: ['--streamdeck-runtime-probe'], browserMissing: true });
  expect(windows).toHaveLength(1);
  expect(windows[0].loadURL).toHaveBeenCalledWith('data:text/html,<title>Runtime check</title>');
  expect(dialog.showMessageBox).not.toHaveBeenCalled();
  expect(app.exit).toHaveBeenCalledWith(0);
});
