const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
describe('native dependency preflight', () => {
  let tmp, bin, launcher, env;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'native-preflight-'));
    bin = path.join(tmp, 'bin'); fs.mkdirSync(bin);
    launcher = path.join(tmp, 'streamdeck-launcher');
    fs.copyFileSync(path.resolve(__dirname, '../packaging/linux/native-launcher.sh'), launcher); fs.chmodSync(launcher, 0o700);
    fs.writeFileSync(path.join(tmp, 'streamdeck-launcher-bin'), '#!/bin/sh\nprintf \'%s\\n\' "$@" > "$LAUNCH_LOG"\n', { mode: 0o700 });
    env = { ...process.env, HOME: tmp, XDG_CONFIG_HOME: path.join(tmp, 'config'), PATH: `${bin}:/usr/bin:/bin`, DISPLAY: ':99', LAUNCH_LOG: path.join(tmp, 'launched') };
    fs.writeFileSync(path.join(bin, 'ldd'), '#!/bin/sh\necho "all libraries resolved"\n', { mode: 0o700 });
    fs.writeFileSync(path.join(bin, 'kdialog'), '#!/bin/sh\nexit 0\n', { mode: 0o700 });
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const run = (...args) => spawnSync(launcher, args, { env, encoding: 'utf8' });
  test('missing native libraries block launch and produce a persistent diagnostic', () => {
    fs.writeFileSync(path.join(bin, 'ldd'), '#!/bin/sh\necho "libgtk-3.so.0 => not found"\n', { mode: 0o700 });
    const result = run(); expect(result.status).toBe(1); expect(result.stderr).toContain('libgtk-3.so.0');
    expect(fs.existsSync(env.LAUNCH_LOG)).toBe(false);
    expect(fs.readFileSync(path.join(env.XDG_CONFIG_HOME, 'streamdeck-launcher/dependency-error.txt'), 'utf8')).toContain('no system software was installed');
  });
  test('wrong architecture is rejected before launch', () => {
    fs.writeFileSync(path.join(bin, 'uname'), '#!/bin/sh\nif [ "$1" = -s ]; then echo Linux; else echo aarch64; fi\n', { mode: 0o700 });
    expect(run().status).toBe(1); expect(fs.existsSync(env.LAUNCH_LOG)).toBe(false);
  });
  test('missing ldd is reported without trying an OS package manager', () => {
    fs.unlinkSync(path.join(bin, 'ldd'));
    for (const [name, target] of [['bash', '/bin/bash'], ['uname', '/usr/bin/uname'],
      ['dirname', '/usr/bin/dirname'], ['mkdir', '/usr/bin/mkdir']]) fs.symlinkSync(target, path.join(bin, name));
    env.PATH = bin;
    expect(run().stderr).toContain('ldd tool is missing');
    expect(fs.existsSync(env.LAUNCH_LOG)).toBe(false);
  });
  test('headless launch gives a graphical-session message', () => {
    delete env.DISPLAY; delete env.WAYLAND_DISPLAY;
    expect(run().stderr).toContain('No graphical session'); expect(fs.existsSync(env.LAUNCH_LOG)).toBe(false);
  });
  test('ready native launch forwards arguments without adding sandbox-disabling flags', () => {
    expect(run('--enable-sandbox').status).toBe(0);
    expect(fs.readFileSync(env.LAUNCH_LOG, 'utf8')).toBe('--ozone-platform=x11\n--enable-sandbox\n');
  });
  test('setup mode delegates to bundled Node support rather than requiring system Node', () => {
    expect(run('--streamdeck-check-dependencies').status).toBe(0);
    expect(fs.readFileSync(env.LAUNCH_LOG, 'utf8')).toContain('resources/setup/cli.js\n--streamdeck-check-dependencies');
  });
});
