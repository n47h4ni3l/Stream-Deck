// Exercise the files users actually download. All writes/removals and browser
// launches use a disposable profile and a harmless local browser stub.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const net = require('net');
const crypto = require('crypto');
const { spawn, spawnSync } = require('child_process');
const WebSocket = require('ws');
const asar = require('@electron/asar');
const { checkAppImage } = require('./check-appimage');
const vdf = require('../setup/binary-vdf');
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const name = `streamdeck-launcher-${require('../package.json').version}-linux-x86_64`;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'streamdeck-release-'));
const env = { ...process.env, HOME: path.join(tmp, 'Deck%f Home'),
  XDG_DATA_HOME: path.join(tmp, 'Deck%f Data'), XDG_CONFIG_HOME: path.join(tmp, 'config'),
  XDG_CACHE_HOME: path.join(tmp, 'cache') };
if (env.DISPLAY && !env.XAUTHORITY) env.XAUTHORITY = path.join(process.env.HOME || os.homedir(), '.Xauthority');
delete env.LD_PRELOAD;
delete env.ELECTRON_RUN_AS_NODE;
delete env.CHROMIUM_CMD;
delete env.ELECTRON_EXTRA_FLAGS;
for (const key of ['HOME', 'XDG_DATA_HOME', 'XDG_CONFIG_HOME', 'XDG_CACHE_HOME']) {
  fs.mkdirSync(env[key], { recursive: true });
}
const report = { version: require('../package.json').version, checks: [] };
const artifactsDir = process.env.STREAMDECK_EVIDENCE_DIR;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let mediaPlayer;
function killGroup(pid, signal) {
  try { process.kill(-pid, signal); } catch (error) {
    if (error.code !== 'ESRCH') {
      console.error(`Could not clean up test process group ${pid}:`, error);
      process.exitCode = 1;
    }
  }
}
function run(file, args = [], commandEnv = env, cwd = tmp) {
  const result = spawnSync(file, args, { env: commandEnv, cwd, encoding: 'utf8', timeout: 60000 });
  assert.ifError(result.error);
  assert.strictEqual(result.status, 0, `${file}: ${result.stderr}\n${result.stdout}`);
  return result.stdout;
}
function getJson(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch (error) { reject(error); } });
    });
    req.setTimeout(1000, () => req.destroy(new Error('DevTools request timeout')));
    req.on('error', reject);
  });
}
async function openCdp(url) {
  const ws = new WebSocket(url);
  await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
  let next = 0;
  const pending = new Map();
  ws.on('message', data => {
    const msg = JSON.parse(data);
    if (pending.has(msg.id)) {
      const { resolve, reject, timer } = pending.get(msg.id);
      pending.delete(msg.id);
      clearTimeout(timer);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    }
  });
  return {
    async call(method, params = {}) {
      const id = ++next;
      const result = new Promise((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out`)); }, 10000);
        pending.set(id, { resolve, reject, timer });
      });
      ws.send(JSON.stringify({ id, method, params }));
      return result;
    },
    close() { ws.terminate(); }
  };
}
async function availablePort() {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
async function smoke(executable, label, prefix = [], history = { initial: { Hulu: 3 }, expected: { Hulu: 3 }, first: 'Hulu' }) {
  const port = await availablePort();
  const browserLog = path.join(tmp, `${label}-browser-args`);
  const browserDir = path.join(tmp, `${label} browser`); fs.mkdirSync(browserDir);
  const browser = path.join(browserDir, 'chromium');
  fs.writeFileSync(browser, '#!/bin/bash\nprintf \'%s\\0\' "$@" > "$STREAMDECK_BROWSER_LOG"\n', { mode: 0o755 });
  const profile = path.join(env.XDG_CONFIG_HOME, 'streamdeck-launcher');
  fs.mkdirSync(profile, { recursive: true });
  fs.writeFileSync(path.join(profile, 'browser_cmd'), `"${browser}" --test-browser\n`);
  fs.writeFileSync(path.join(profile, 'usage.json'), JSON.stringify(history.initial));
  const child = spawn(executable, [...prefix, `--remote-debugging-port=${port}`,
    '--remote-debugging-address=127.0.0.1', '--ozone-platform=x11', ...process.argv.slice(2)], {
    cwd: tmp, env: { ...env, STREAMDECK_BROWSER_LOG: browserLog },
    detached: true, stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  child.stdout.on('data', data => { output += data; });
  child.stderr.on('data', data => { output += data; });
  let cdp;
  try {
    const deadline = Date.now() + 30000;
    let target;
    while (Date.now() < deadline && child.exitCode === null && child.signalCode === null) {
      try {
        target = (await getJson(`http://127.0.0.1:${port}/json/list`))
          .find(item => item.type === 'page' && item.url.endsWith('/index.html'));
      } catch { /* Chromium may not have opened its local test endpoint yet. */ }
      if (target) break;
      await delay(100);
    }
    assert.ok(target, `${label} did not open the dashboard.\n${output}`);
    cdp = await openCdp(target.webSocketDebuggerUrl);
    const result = await cdp.call('Runtime.evaluate', { expression: `(async () => {
      if (!window.electronAPI) throw new Error('Preload API missing');
      const names = await window.electronAPI.getSortedServices();
      const deadline = Date.now() + 5000;
      while (document.querySelectorAll('.tile').length !== 16 || document.visibilityState !== 'visible') {
        if (Date.now() > deadline) throw new Error('Visible service tiles did not load');
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      if (!document.querySelectorAll('.tile')[1].classList.contains('selected')) {
        throw new Error('Keyboard navigation failed');
      }
      return { tiles: names.length, firstService: names[0], visible: document.visibilityState === 'visible' };
    })()`, awaitPromise: true, returnByValue: true });
    assert.ok(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
    assert.deepStrictEqual(result.result.value, { tiles: 16, firstService: history.first, visible: true });
    const playback = async state => {
      fs.writeFileSync(path.join(tmp, 'playback'), state);
      const deadline = Date.now() + 8000;
      while (Date.now() < deadline) {
        const observation = await cdp.call('Runtime.evaluate', { expression: 'window.electronAPI.getIntegrationStatus()', awaitPromise: true, returnByValue: true });
        if (observation.result.value?.playback.blocking === (state === 'Playing') &&
          observation.result.value?.playback.state === (state === 'Playing' ? 'playing' : 'idle')) return;
        await delay(100);
      }
      throw new Error(`${label}: packaged playback did not follow ${state}`);
    };
    await playback('Playing'); await playback('Paused');
    report.checks.push(`${label}: real packaged MPRIS reader follows Playing/Paused over a disposable session bus`);
    if (artifactsDir) {
      fs.mkdirSync(artifactsDir, { recursive: true });
      const screenshot = await cdp.call('Page.captureScreenshot');
      fs.writeFileSync(path.join(artifactsDir, `${label}-dashboard.png`), Buffer.from(screenshot.data, 'base64'));
    }
    await cdp.call('Runtime.evaluate', { expression: 'window.electronAPI.launchService("YouTube")' });
    for (let i = 0; i < 50 && !fs.existsSync(browserLog); i++) await delay(100);
    assert.deepStrictEqual(fs.readFileSync(browserLog, 'utf8').split('\0').filter(Boolean),
      ['--test-browser', '--kiosk', 'https://www.youtube.com']);
    const usage = JSON.parse(fs.readFileSync(path.join(profile, 'usage.json'), 'utf8'));
    assert.deepStrictEqual(usage, { ...history.expected, YouTube: 1 });
    report.checks.push(`${label}: visible packaged window, preload, IPC, 16 tiles, keyboard navigation, saved browser command, harmless browser launch, usage persistence`);
  } finally {
    if (cdp) {
      try {
        await cdp.call('Runtime.evaluate', { expression: 'setTimeout(() => window.close(), 50)' });
      } catch { /* Process-group cleanup below also handles startup failures. */ }
    }
    if (cdp) cdp.close();
    if (child.exitCode === null && child.signalCode === null) {
      await Promise.race([new Promise(resolve => child.once('exit', resolve)), delay(3000)]);
    }
    // AppImage runs Electron as a descendant. Terminate the isolated test
    // process group, rather than leaving its children holding pipes open.
    killGroup(child.pid, 'SIGTERM');
    await delay(100);
    killGroup(child.pid, 'SIGKILL');
    child.stdout.destroy();
    child.stderr.destroy();
    if (artifactsDir) fs.writeFileSync(path.join(artifactsDir, `${label}-electron.log`), output);
  }
}

async function main() {
  for (const line of fs.readFileSync(path.join(dist, 'SHA256SUMS'), 'utf8').trim().split('\n')) {
    const [expected, file] = line.split('  ');
    assert.strictEqual(crypto.createHash('sha256').update(fs.readFileSync(path.join(dist, file))).digest('hex'), expected);
  }
  report.checks.push('SHA256SUMS matches both download files');
  report.appImageDesktop = checkAppImage(path.join(dist, `${name}.AppImage`));
  report.checks.push('AppImage desktop entry explicitly enables sandboxing; packaged AppRun forwards its arguments without disabling sandboxing');
  run('tar', ['-xzf', path.join(dist, `${name}.tar.gz`), '-C', tmp]);
  const download = path.join(tmp, name);
  const installed = path.join(env.XDG_DATA_HOME, 'streamdeck-launcher');
  const desktop = path.join(env.XDG_DATA_HOME, 'applications', 'StreamDeckLauncher.desktop');
  const settings = path.join(env.XDG_CONFIG_HOME, 'streamdeck-launcher');
  const setupEnv = { ...env, ELECTRON_EXTRA_FLAGS: process.argv.slice(2).join(' ') };
  const packagedLauncher = path.join(download, 'app', 'streamdeck-launcher');
  const expectSetupFailure = (commandEnv, message) => {
    const result = spawnSync(packagedLauncher, ['--streamdeck-setup-dependencies'], {
      env: commandEnv, cwd: tmp, encoding: 'utf8', timeout: 60000
    });
    assert.ifError(result.error);
    assert.notStrictEqual(result.status, 0, 'A missing dependency must block setup');
    assert.ok((result.stdout + result.stderr).includes(message), result.stdout + result.stderr);
    assert.ok(!fs.existsSync(installed) && !fs.existsSync(desktop), 'Failed setup must not create an installation/shortcut');
  };
  expectSetupFailure({ ...setupEnv, CHROMIUM_CMD: '/missing/streamdeck-browser' }, 'Browser executable not found');
  const fakeBin = path.join(tmp, 'dependency-fixtures');
  fs.mkdirSync(fakeBin);
  fs.writeFileSync(path.join(fakeBin, 'kdialog'), '#!/bin/sh\nexit 0\n', { mode: 0o700 });
  const flatpakLog = path.join(tmp, 'flatpak-commands');
  fs.writeFileSync(path.join(fakeBin, 'flatpak'), [
    '#!/bin/sh', 'printf \'%s\\n\' "$*" >> "$STREAMDECK_FLATPAK_LOG"',
    'if [ "$1" = info ]; then [ -f "$STREAMDECK_BROWSER_STATE" ]; exit $?; fi',
    'if [ "$1" = install ]; then',
    '  if [ "${STREAMDECK_INSTALL_FAIL:-}" = 1 ]; then echo "Fixture browser install failed" >&2; exit 23; fi',
    '  touch "$STREAMDECK_BROWSER_STATE"', 'fi', 'exit 0', ''
  ].join('\n'), { mode: 0o700 });
  const flatpakEnv = { ...setupEnv, PATH: `${fakeBin}:${env.PATH}`, CHROMIUM_CMD: 'flatpak run io.github.ungoogled_software.ungoogled_chromium',
    STREAMDECK_FLATPAK_LOG: flatpakLog, STREAMDECK_BROWSER_STATE: path.join(tmp, 'browser-installed') };
  run(packagedLauncher, ['--streamdeck-setup-dependencies'], flatpakEnv);
  run(packagedLauncher, ['--streamdeck-setup-dependencies'], flatpakEnv);
  const calls = fs.readFileSync(flatpakLog, 'utf8').trim().split('\n');
  assert.strictEqual(calls.filter(line => line.startsWith('install ')).length, 1, 'Repeat setup must not reinstall');
  assert.ok(calls.some(line => line === 'install --user --noninteractive -y flathub io.github.ungoogled_software.ungoogled_chromium'));
  const priorBrowser = fs.readFileSync(path.join(settings, 'browser_cmd'), 'utf8');
  expectSetupFailure({ ...flatpakEnv, STREAMDECK_INSTALL_FAIL: '1', STREAMDECK_BROWSER_STATE: path.join(tmp, 'missing-browser') }, 'Fixture browser install failed');
  assert.strictEqual(fs.readFileSync(path.join(settings, 'browser_cmd'), 'utf8'), priorBrowser);
  fs.writeFileSync(path.join(fakeBin, 'ldd'), '#!/bin/sh\necho "libfixture.so => not found"\n', { mode: 0o700 });
  expectSetupFailure({ ...setupEnv, PATH: `${fakeBin}:${env.PATH}`, CHROMIUM_CMD: '/bin/true' }, 'Required Electron system libraries');
  report.checks.push('Actual packaged dependency CLI: missing custom browser/native libraries fail clearly; user-scoped browser setup/recheck/repeat succeed; failed install preserves settings and creates no shortcut (Flatpak fixture only)');
  const steamConfig = path.join(env.HOME, '.local/share/Steam/userdata/123/config');
  fs.mkdirSync(steamConfig, { recursive: true });
  const steamDatabase = path.join(steamConfig, 'shortcuts.vdf');
  const existing = { type: 0, name: '0', value: [
    { type: 2, name: 'appid', value: 42 }, { type: 1, name: 'appname', value: 'Unrelated fixture game' },
    { type: 1, name: 'exe', value: '"/keep/this game"' }, { type: 1, name: 'LaunchOptions', value: '--keep' }
  ] };
  fs.writeFileSync(steamDatabase, vdf.encode([{ type: 0, name: 'shortcuts', value: [existing] }]));
  const verifySteam = launcher => {
    const entries = vdf.field(vdf.parse(fs.readFileSync(steamDatabase)), 'shortcuts').value;
    assert.strictEqual(entries.length, 2);
    assert.deepStrictEqual(entries[0].value.map(({ name, value }) => [name, value]), existing.value.map(({ name, value }) => [name, value]));
    const added = entries.find(entry => vdf.field(entry.value, 'appname').value === 'Stream Deck Launcher');
    assert.strictEqual(vdf.field(added.value, 'exe').value, `"${launcher}"`);
    return added;
  };
  const lookalike = env.XDG_DATA_HOME.replace(/%/g, '%%');
  fs.mkdirSync(lookalike);
  fs.writeFileSync(path.join(lookalike, 'keep'), 'adjacent directory');
  run(path.join(download, 'install.sh'), [], { ...setupEnv, CHROMIUM_CMD: '/bin/true' });
  verifySteam(path.join(installed, 'StreamDeckLauncher.sh'));
  assert.ok(fs.readdirSync(path.join(settings, 'steam-backups')).length);
  assert.ok(fs.existsSync(path.join(installed, 'app', 'resources', 'app.asar')));
  run('desktop-file-validate', [desktop]);
  assert.ok(fs.readFileSync(desktop, 'utf8').includes('Deck%%f Data'));
  const files = asar.listPackage(path.join(installed, 'app', 'resources', 'app.asar'));
  assert.ok(files.includes('/main.js') && files.includes('/node_modules/shell-quote/index.js'));
  assert.ok(!files.some(file => /^\/(tests|scripts|packaging)\//.test(file) ||
    /\/(browser_cmd|usage\.json|log\.txt)$/.test(file) ||
    /^\/node_modules\/(jest|eslint|electron)(\/|-)/.test(file)));
  report.checks.push('archive installs directly; valid desktop entry escapes percent/space paths; ASAR contains runtime files and excludes developer/private data');
  fs.writeFileSync(path.join(tmp, 'identity'), 'Chromium'); fs.writeFileSync(path.join(tmp, 'playback'), 'Paused');
  mediaPlayer = spawn('/usr/bin/python3', [path.join(root, 'tests/fixtures/mpris-player.py'), tmp], { env, stdio: ['ignore', 'ignore', 'pipe'] });
  let mediaError = ''; mediaPlayer.stderr.on('data', data => { mediaError += data; });
  for (let i = 0; i < 100 && !fs.existsSync(path.join(tmp, 'bus-ready')); i++) await delay(30);
  assert.ok(fs.existsSync(path.join(tmp, 'bus-ready')), `Disposable MPRIS player failed: ${mediaError}`);
  await smoke(path.join(installed, 'StreamDeckLauncher.sh'), 'installed', [],
    { initial: null, expected: {}, first: 'Netflix' });
  report.checks.push('installed: valid JSON null history recovers to a record and persists a normal launch count');
  const savedUsage = fs.readFileSync(path.join(settings, 'usage.json'), 'utf8');
  const savedBrowser = fs.readFileSync(path.join(settings, 'browser_cmd'), 'utf8');
  run(path.join(download, 'install.sh'), [], setupEnv);
  verifySteam(path.join(installed, 'StreamDeckLauncher.sh'));
  report.checks.push('actual archive installer automatically creates/reuses one native Steam shortcut, preserves unrelated game, backs up original database and supports percent/space paths');
  assert.strictEqual(fs.readFileSync(path.join(settings, 'usage.json'), 'utf8'), savedUsage);
  assert.strictEqual(fs.readFileSync(path.join(settings, 'browser_cmd'), 'utf8'), savedBrowser);
  report.checks.push('reinstallation preserves browser setting and usage data');
  run(path.join(installed, 'uninstall.sh'));
  assert.ok(!fs.existsSync(installed) && !fs.existsSync(desktop));
  assert.strictEqual(fs.readFileSync(path.join(settings, 'usage.json'), 'utf8'), savedUsage);
  assert.strictEqual(fs.readFileSync(path.join(lookalike, 'keep'), 'utf8'), 'adjacent directory');
  run(path.join(download, 'uninstall.sh'));
  report.checks.push('direct uninstall and repeat uninstall succeed; settings and escaped lookalike directory survive');
  await smoke(path.join(dist, `${name}.AppImage`), 'appimage', ['--appimage-extract-and-run']);
  const portableShortcut = verifySteam(path.join(dist, `${name}.AppImage`));
  assert.strictEqual(vdf.field(portableShortcut.value, 'LaunchOptions').value, '--appimage-extract-and-run');
  assert.ok(fs.existsSync(vdf.field(portableShortcut.value, 'icon').value), 'Portable shortcut icon must survive the temporary AppImage extraction');
  report.checks.push('actual AppImage automatically updates owned Steam shortcut with stable original path, FUSE-free launch option and persistent user-owned icon');
  await smoke(path.join(dist, `${name}.AppImage`), 'appimage-desktop',
    ['--appimage-extract-and-run', '--enable-sandbox'], {
      initial: { Hulu: 2, Max: 0, Archived: 7, Netflix: '20', Prime: -3, Stan: 0.5 },
      expected: { Hulu: 2, Max: 0, Archived: 7 }, first: 'Hulu'
    });
  report.checks.push('appimage-desktop: mixed invalid counts are dropped; valid zero/unknown counts and normal increments persist');
  report.ok = true;
  if (artifactsDir) fs.writeFileSync(path.join(artifactsDir, 'release-verification.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  if (mediaPlayer) mediaPlayer.kill('SIGTERM');
  fs.rmSync(tmp, { recursive: true, force: true });
});
