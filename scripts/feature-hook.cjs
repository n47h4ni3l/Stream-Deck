const { app, BrowserWindow, dialog, powerSaveBlocker } = require('electron');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const vdf = require('../setup/binary-vdf');
const temp = process.env.STREAMDECK_FEATURES_DIR;
if (!temp || !fs.existsSync(path.join(temp, 'bus-ready'))) throw new Error('Isolated feature fixture required');
const profile = path.join(process.env.XDG_CONFIG_HOME, 'streamdeck-launcher'); fs.mkdirSync(profile, { recursive: true });
app.setPath('userData', profile);
const start = powerSaveBlocker.start.bind(powerSaveBlocker), stop = powerSaveBlocker.stop.bind(powerSaveBlocker);
const live = new Set(); let starts = 0, stops = 0, backDialogs = 0, finished = false;
powerSaveBlocker.start = type => { const id = start(type); live.add(id); starts++; return id; };
powerSaveBlocker.stop = id => { live.delete(id); stops++; return stop(id); };
dialog.showMessageBox = async () => { backDialogs++; return { response: 0 }; };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, message, timeout = 9000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await check()) return; await delay(40); }
  throw new Error(message);
}
function fail(error) {
  if (finished) return; finished = true;
  fs.writeFileSync(path.join(temp, 'result.json'), JSON.stringify({ ok: false, error: String(error) })); app.exit(1);
}
app.once('browser-window-created', (_event, window) => {
  window.webContents.once('did-finish-load', async () => {
    let external;
    const evaluate = code => window.webContents.executeJavaScript(code);
    const state = () => evaluate('window.electronAPI.getIntegrationStatus()');
    const selected = () => evaluate("Array.from(document.querySelectorAll('.tile')).findIndex(t=>t.classList.contains('selected'))");
    const pad = async (axes = [0, 0], pressed = [], id = 'Fixture pad') => {
      await evaluate(`window.__fixturePads=[{index:0,id:${JSON.stringify(id)},connected:true,axes:${JSON.stringify(axes)},buttons:Array.from({length:16},(_,i)=>({pressed:${JSON.stringify(pressed)}.includes(i)}))}];`);
      await delay(55);
    };
    const identity = (label, focused = true) => execFileSync('/usr/bin/python3', [path.join(__dirname, '../tests/fixtures/x11-window.py'),
      '0x' + external.getNativeWindowHandle().readUInt32LE(0).toString(16), label, focused ? '1' : '0']);
    try {
      await until(async () => (await state()).steam.state === 'selection-required', 'Steam ambiguity was not reported');
      await until(async () => (await state()).playback.state === 'idle', 'Paused MPRIS signal was not observed');
      if (starts) throw new Error('Idle dashboard inhibited sleep');
      await evaluate("Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>window.__fixturePads||[]})");
      const initial = await selected();
      await pad([0.3, 0]); if (await selected() !== initial) throw new Error('Dead-zone drift');
      await pad([0.8, 0]); if (await selected() !== (initial + 1) % 16) throw new Error('Analog navigation failed');
      await delay(340); if (await selected() === (initial + 1) % 16) throw new Error('Held analog did not repeat');
      await pad(); await pad([0, 0], [9]); await pad();
      if (await evaluate("document.getElementById('setup-panel').hidden")) throw new Error('Menu did not open setup');
      await pad([0, 0], [13]); await pad(); await pad([0, 0], [13]); await pad(); await pad([0, 0], [0]); await pad();
      await until(async () => (await state()).steam.state === 'installed', 'Steam account selection did not create shortcut');
      const chosen = (await state()).steam;
      if (chosen.choices.find(c => c.id === chosen.selection).account !== '222') throw new Error('Wrong Steam account selected');
      for (const id of ['111', '222']) {
        const file = path.join(process.env.HOME, '.local/share/Steam/userdata', id, 'config/shortcuts.vdf');
        const count = vdf.field(vdf.parse(fs.readFileSync(file)), 'shortcuts').value.length;
        if (count !== (id === '222' ? 1 : 0)) throw new Error('Steam modified the wrong account');
      }
      await pad([0, 0], [1]); await pad();
      if (!await evaluate("document.getElementById('setup-panel').hidden")) throw new Error('B did not close setup');
      await pad([0, 0], [1]); await delay(350); if (backDialogs !== 1) throw new Error('Root B repeated or did not prompt'); await pad();
      fs.writeFileSync(path.join(temp, 'playback'), 'Playing');
      await until(async () => (await state()).playback.blocking, 'Playing did not inhibit');
      await delay(2700); if (starts !== 1 || live.size !== 1) throw new Error('Duplicate inhibitor');
      fs.writeFileSync(path.join(temp, 'playback'), 'Paused'); await until(async () => !(await state()).playback.blocking, 'Pause did not release');
      fs.writeFileSync(path.join(temp, 'identity'), 'Google Chrome'); fs.writeFileSync(path.join(temp, 'playback'), 'Playing');
      await delay(2800); if (live.size) throw new Error('Wrong browser held inhibitor');
      fs.writeFileSync(path.join(temp, 'identity'), 'Chromium'); await until(async () => (await state()).playback.blocking, 'Playback did not resume');
      await evaluate("window.electronAPI.launchService('YouTube')"); await until(() => fs.existsSync(path.join(temp, 'browser-started')), 'Browser fixture did not start');
      external = new BrowserWindow({ show: true, width: 600, height: 300, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
      await external.loadURL('data:text/html,<title>External browser fixture</title><p>Untouched external content</p>');
      identity('OtherEditor'); external.focus(); await until(() => !window.isFocused(), 'External fixture did not own focus');
      await pad([0, 0], [1]); await delay(200); if (window.isFocused()) throw new Error('B stole focus from an unrelated app'); await pad();
      identity('Chromium'); await pad([0, 0], [1]);
      await until(() => window.isFocused(), 'Background B did not return through real IPC/X11 path'); await pad();
      if (external.isDestroyed() || !external.webContents.getURL().includes('Untouched')) throw new Error('Return changed/closed external window');
      external.close(); external = null;
      if (!live.size) throw new Error('Window lifetime incorrectly stopped active playback guard');
      fs.writeFileSync(path.join(temp, 'playback'), 'Stopped'); await until(async () => !(await state()).playback.blocking, 'Stop did not release');
      fs.writeFileSync(path.join(temp, 'playback'), 'Playing'); await until(async () => (await state()).playback.blocking, 'Playback did not reacquire');
      app.once('will-quit', () => {
        if (finished) return; finished = true;
        fs.writeFileSync(path.join(temp, 'result.json'), JSON.stringify({ ok: live.size === 0,
          analogAndHeldRepeat: true, dashboardBackAndMenu: true, steamSelectedAccountOnly: true,
          backgroundReturnViaX11: true, unrelatedWindowUntouched: true,
          realSessionBusPlaybackPauseStop: true, oneInhibitor: true, quitReleased: live.size === 0, starts, stops,
          limits: 'Synthetic controller, Steam files, X11 window identity and MPRIS player. Not physical Steam Input, real Steam client/browser, native sandbox, DRM or login acceptance.' }));
      });
      app.quit();
    } catch (error) { if (external) external.destroy(); fail(error); }
  });
});
setTimeout(() => fail('Feature smoke timed out'), 50000).unref();
