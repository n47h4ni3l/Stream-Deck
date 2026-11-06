// Run the real package entry point with Electron. CI supplies Xvfb on Linux.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const shellQuote = require('shell-quote');

const repoRoot = path.resolve(__dirname, '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'streamdeck-smoke-'));
const resultFile = path.join(tempDir, 'result.json');
const env = { ...process.env, STREAMDECK_SMOKE_DIR: tempDir };
if (env.DISPLAY && !env.XAUTHORITY) env.XAUTHORITY = path.join(env.HOME || os.homedir(), '.Xauthority');
env.HOME = path.join(tempDir, 'home');
env.XDG_CONFIG_HOME = path.join(tempDir, 'config');
env.XDG_DATA_HOME = path.join(tempDir, 'data');
env.XDG_CACHE_HOME = path.join(tempDir, 'cache');
fs.mkdirSync(env.HOME);
const setupFixture = process.argv.includes('--setup-fixture');
delete env.ELECTRON_RUN_AS_NODE;
delete env.LD_PRELOAD;
// The smoke test must not read the developer's browser settings or usage data.
const browserStub = path.join(tempDir, 'browser-stub');
fs.writeFileSync(browserStub, '#!/bin/sh\nexit 0\n', { mode: 0o700 });
env.CHROMIUM_CMD = shellQuote.quote([browserStub]);
if (setupFixture) {
  const fakeFlatpak = path.join(tempDir, 'flatpak');
  fs.writeFileSync(fakeFlatpak, '#!/bin/sh\nif [ "$1" = info ]; then [ -f "$STREAMDECK_SMOKE_DIR/browser-installed" ]; exit $?; fi\nif [ "$1" = install ]; then touch "$STREAMDECK_SMOKE_DIR/browser-installed"; fi\nexit 0\n', { mode: 0o700 });
  env.PATH = `${tempDir}:${env.PATH}`;
  env.CHROMIUM_CMD = '';
  env.STREAMDECK_SMOKE_SETUP = '1';
}

try {
  const result = spawnSync(require('electron'), [
    '--require', path.join(__dirname, 'smoke-hook.cjs'),
    repoRoot, ...process.argv.slice(2).filter(arg => arg !== '--setup-fixture')
  ], { cwd: tempDir, env, timeout: 30000, encoding: 'utf8' });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  assert.strictEqual(result.status, 0, 'Electron did not exit successfully');
  assert.ok(fs.existsSync(resultFile), 'Electron never created a working dashboard');
  const report = JSON.parse(fs.readFileSync(resultFile, 'utf8'));
  assert.strictEqual(report.ok, true, report.error);
  assert.strictEqual(report.tiles, 16, 'Expected all 16 service tiles');
  assert.strictEqual(report.visible, true, 'The dashboard window must be visible');
  if (setupFixture) assert.strictEqual(report.dependencySetup, true, 'First-run browser setup did not finish');
  console.log('Electron smoke test passed: visible window, preload, IPC, 16 tiles and keyboard navigation.');
  if (setupFixture) console.log('First-run browser setup passed: consent, progress and completion with the isolated Flatpak fixture.');
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
