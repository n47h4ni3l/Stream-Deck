const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const vdf = require('../setup/binary-vdf');
const root = path.resolve(__dirname, '..');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function run(program, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(program, args, { env, cwd: root, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
    let output = '';
    for (const stream of [child.stdout, child.stderr]) stream.on('data', data => { output = (output + data).slice(-12000); });
    const timer = setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* Exited. */ } }, 60000);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('close', code => { clearTimeout(timer); code === 0 ? resolve(output) : reject(new Error(output || `Feature fixture exited ${code}`)); });
  });
}
async function main() {
  if (!process.argv.includes('--isolated-session')) {
    process.stdout.write(await run('dbus-run-session', ['--', process.execPath, __filename, '--isolated-session', ...process.argv.slice(2)], process.env));
    return;
  }
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'streamdeck-features-'));
  let player;
  try {
    const env = { ...process.env, STREAMDECK_FEATURES_DIR: temp };
    delete env.ELECTRON_RUN_AS_NODE; delete env.LD_PRELOAD;
    if (env.DISPLAY && !env.XAUTHORITY) env.XAUTHORITY = path.join(env.HOME || os.homedir(), '.Xauthority');
    env.HOME = path.join(temp, 'home'); env.XDG_CONFIG_HOME = path.join(temp, 'config');
    env.XDG_DATA_HOME = path.join(temp, 'data'); env.XDG_CACHE_HOME = path.join(temp, 'cache');
    fs.mkdirSync(env.HOME);
    const browser = path.join(temp, 'chromium');
    fs.writeFileSync(browser, '#!/bin/sh\nprintf started > "$STREAMDECK_FEATURES_DIR/browser-started"\n', { mode: 0o700 });
    env.CHROMIUM_CMD = browser;
    for (const id of ['111', '222']) {
      const dir = path.join(env.HOME, '.local/share/Steam/userdata', id, 'config'); fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'shortcuts.vdf'), vdf.encode([{ type: 0, name: 'shortcuts', value: [] }]));
    }
    fs.writeFileSync(path.join(temp, 'playback'), 'Paused'); fs.writeFileSync(path.join(temp, 'identity'), 'Chromium');
    player = spawn('/usr/bin/python3', [path.join(root, 'tests/fixtures/mpris-player.py'), temp], { env, stdio: ['ignore', 'ignore', 'pipe'] });
    let playerError = ''; player.stderr.on('data', data => { playerError += data; });
    for (let i = 0; i < 100 && !fs.existsSync(path.join(temp, 'bus-ready')); i++) await delay(30);
    assert.ok(fs.existsSync(path.join(temp, 'bus-ready')), `MPRIS fixture failed: ${playerError}`);
    await run(require('electron'), ['--require', path.join(__dirname, 'feature-hook.cjs'), root,
      ...process.argv.slice(2).filter(arg => arg !== '--isolated-session')], env);
    const report = JSON.parse(fs.readFileSync(path.join(temp, 'result.json'), 'utf8'));
    assert.ok(report.ok, report.error);
    const queries = fs.readFileSync(path.join(temp, 'queries'), 'utf8').trim().split('\n');
    assert.ok(queries.length && queries.every(name => ['Identity', 'PlaybackStatus'].includes(name)));
    const evidence = process.env.STREAMDECK_EVIDENCE_DIR;
    if (evidence) { fs.mkdirSync(evidence, { recursive: true }); fs.writeFileSync(path.join(evidence, 'feature-smoke.json'), JSON.stringify(report, null, 2) + '\n'); }
    console.log(JSON.stringify(report, null, 2));
  } finally {
    if (player) { player.kill('SIGTERM'); await Promise.race([new Promise(resolve => player.once('close', resolve)), delay(1000)]); if (player.exitCode === null) player.kill('SIGKILL'); }
    fs.rmSync(temp, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
