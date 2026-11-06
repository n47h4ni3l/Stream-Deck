// Loaded only by scripts/smoke.js, before Electron imports the real app entry.
const { app, BrowserWindow, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

const tempDir = process.env.STREAMDECK_SMOKE_DIR;
if (!tempDir) throw new Error('Smoke hook requires an isolated temporary directory');
app.setPath('userData', tempDir);
const resultFile = path.join(tempDir, 'result.json');
let setupAccepted = false;
if (process.env.STREAMDECK_SMOKE_SETUP === '1') {
  // This hook is excluded from production packages. Never auto-approve a real
  // browser install: the executable must be this test's own Flatpak stub.
  const fake = path.join(tempDir, 'flatpak');
  if (!fs.existsSync(fake) || process.env.PATH.split(path.delimiter)[0] !== tempDir) {
    throw new Error('Browser setup smoke test requires the isolated Flatpak fixture');
  }
  dialog.showMessageBox = async () => { setupAccepted = true; return { response: 0 }; };
}
let finished = false;
function finish(report) {
  if (finished) return;
  finished = true;
  fs.writeFileSync(resultFile, JSON.stringify(report));
  app.exit(report.ok ? 0 : 1);
}
const timeout = setTimeout(() => finish({ ok: false, error: 'No working dashboard within 20 seconds' }), 20000);
timeout.unref();

app.once('browser-window-created', (_event, window) => {
  window.webContents.on('preload-error', (_event, _path, error) => finish({ ok: false, error: String(error) }));
  window.webContents.on('render-process-gone', (_event, details) => finish({ ok: false, error: details.reason }));
  window.webContents.once('did-finish-load', async () => {
    try {
      const tiles = await window.webContents.executeJavaScript(`(async () => {
        if (!window.electronAPI) throw new Error('Preload API missing');
        const names = await window.electronAPI.getSortedServices();
        const deadline = Date.now() + 5000;
        while (document.querySelectorAll('.tile').length !== names.length) {
          if (Date.now() > deadline) throw new Error('Service tiles did not load');
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
        if (!document.querySelectorAll('.tile')[1].classList.contains('selected')) {
          throw new Error('Keyboard navigation did not select the next service');
        }
        return names.length;
      })()`);
      // ready-to-show can arrive after did-finish-load on slower renderers.
      const deadline = Date.now() + 5000;
      while (!window.isVisible() && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      if (process.env.STREAMDECK_SMOKE_SETUP === '1') {
        const deadline = Date.now() + 5000;
        while (!fs.existsSync(path.join(tempDir, 'browser-installed')) || BrowserWindow.getAllWindows().length !== 1) {
          if (Date.now() > deadline) throw new Error('First-run browser setup did not finish');
          await new Promise(resolve => setTimeout(resolve, 20));
        }
      }
      finish({ ok: window.isVisible(), tiles, visible: window.isVisible(),
        dependencySetup: process.env.STREAMDECK_SMOKE_SETUP === '1' ? setupAccepted : undefined });
    } catch (error) {
      finish({ ok: false, error: String(error) });
    }
  });
});
