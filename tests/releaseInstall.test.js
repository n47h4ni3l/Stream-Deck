const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

describe('binary release installer', () => {
  let tmp, download, data, config, env;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'release-install-'));
    download = path.join(tmp, 'download');
    data = path.join(tmp, 'Deck%f Data');
    config = path.join(tmp, 'config');
    fs.mkdirSync(download);
    fs.mkdirSync(path.join(download, 'app'));
    for (const name of ['install.sh', 'uninstall.sh', 'StreamDeckLauncher.sh', 'README.txt']) {
      fs.copyFileSync(path.resolve(__dirname, '..', 'packaging', 'linux', name), path.join(download, name));
      if (name.endsWith('.sh')) fs.chmodSync(path.join(download, name), 0o755);
    }
    // Exercise the real browser setup CLI; native Electron startup is isolated
    // separately by the wrapper tests and actual built-artifact checks.
    const setupFixture = path.join(tmp, 'setup-fixture.cjs');
    fs.writeFileSync(setupFixture, `const {runSetup}=require(${JSON.stringify(path.resolve(__dirname, '../setup/cli'))});\nrunSetup({checkRuntime:async()=>{},checkPlayback:async()=>{}}).then(s=>{if(process.argv[2]==='--streamdeck-setup-steam'&&s.state!=='installed')process.exitCode=20}).catch(e=>{console.error(e.message);process.exitCode=1});\n`);
    fs.writeFileSync(path.join(download, 'app', 'streamdeck-launcher'), '#!/bin/bash\nexec "$STREAMDECK_TEST_NODE" "$STREAMDECK_TEST_SETUP" "$@"\n', { mode: 0o755 });
    fs.writeFileSync(path.join(download, 'LICENSE'), 'license');
    fs.writeFileSync(path.join(download, 'BUILD-INFO.json'), '{}');
    env = { ...process.env, HOME: tmp, XDG_DATA_HOME: data, XDG_CONFIG_HOME: config, CHROMIUM_CMD: '/bin/true',
      STREAMDECK_TEST_NODE: process.execPath, STREAMDECK_TEST_SETUP: setupFixture };
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const run = (file, env) => spawnSync(file, [], { env, encoding: 'utf8' });

  test('installs, upgrades and uninstalls directly, preserving settings and adjacent directories', () => {
    const install = path.join(download, 'install.sh');
    const installed = path.join(data, 'streamdeck-launcher');
    const settings = path.join(config, 'streamdeck-launcher');
    const adjacent = data.replace(/%/g, '%%');
    fs.mkdirSync(adjacent);
    fs.writeFileSync(path.join(adjacent, 'keep'), 'adjacent');
    expect(run(install, env).status).toBe(0);
    expect(fs.readFileSync(path.join(settings, 'browser_cmd'), 'utf8')).toBe('/bin/true\n');
    const desktop = path.join(data, 'applications', 'StreamDeckLauncher.desktop');
    expect(fs.readFileSync(desktop, 'utf8')).toContain('Deck%%f Data');
    fs.writeFileSync(path.join(settings, 'usage.json'), '{"Hulu":7}');
    expect(run(install, { ...env, CHROMIUM_CMD: '' }).status).toBe(0);
    expect(fs.readFileSync(path.join(settings, 'usage.json'), 'utf8')).toBe('{"Hulu":7}');
    expect(run(path.join(installed, 'uninstall.sh'), env).status).toBe(0);
    expect(fs.existsSync(installed)).toBe(false);
    expect(fs.existsSync(desktop)).toBe(false);
    expect(fs.readFileSync(path.join(adjacent, 'keep'), 'utf8')).toBe('adjacent');
    expect(fs.readFileSync(path.join(settings, 'usage.json'), 'utf8')).toBe('{"Hulu":7}');
    expect(run(path.join(download, 'uninstall.sh'), env).status).toBe(0);
  });

  test('refuses to overwrite or uninstall an unrecognized directory', () => {
    const foreign = path.join(data, 'streamdeck-launcher');
    fs.mkdirSync(foreign, { recursive: true });
    fs.writeFileSync(path.join(foreign, 'keep'), 'untouched');
    for (const name of ['install.sh', 'uninstall.sh']) {
      expect(run(path.join(download, name), env).status).toBe(1);
      expect(fs.readFileSync(path.join(foreign, 'keep'), 'utf8')).toBe('untouched');
    }
  });

  test('keeps legacy folders and profiles and backs up a symlinked shortcut without modifying its target', () => {
    const legacy = path.join(tmp, 'Stream-Deck');
    const retry = path.join(tmp, 'Downloads', 'Stream-Deck retry');
    const profile = path.join(tmp, '.var', 'app', 'io.github.ungoogled_software.ungoogled_chromium');
    const volta = path.join(tmp, '.volta');
    const steam = path.join(tmp, '.local', 'share', 'Steam', 'userdata', '123', 'config');
    const keepFiles = [
      [legacy, 'browser_cmd'], [legacy, 'usage.json'], [path.join(legacy, 'chromium'), 'Chromium-x86-64.AppImage'],
      [path.join(legacy, 'node_modules'), 'keep'], [retry, 'keep'], [profile, 'keep'], [volta, 'keep'], [steam, 'shortcuts.vdf']
    ];
    for (const [dir, name] of keepFiles) {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, name), 'legacy data');
    }
    const oldDesktop = path.join(legacy, 'StreamDeckLauncher.desktop');
    const oldContents = `[Desktop Entry]\nExec="${legacy}/StreamDeckLauncher.sh"\n`;
    fs.writeFileSync(oldDesktop, oldContents);
    const desktop = path.join(data, 'applications', 'StreamDeckLauncher.desktop');
    fs.mkdirSync(path.dirname(desktop), { recursive: true });
    fs.symlinkSync(oldDesktop, desktop);
    const result = run(path.join(download, 'install.sh'), env);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Legacy source folder kept');
    expect(fs.lstatSync(desktop).isSymbolicLink()).toBe(false);
    expect(fs.readFileSync(desktop, 'utf8')).toContain('X-StreamDeck-Release=true');
    const backups = path.join(config, 'streamdeck-launcher', 'shortcut-backups');
    expect(fs.readFileSync(path.join(backups, fs.readdirSync(backups)[0], 'StreamDeckLauncher.desktop'), 'utf8')).toBe(oldContents);
    expect(run(path.join(data, 'streamdeck-launcher', 'uninstall.sh'), env).status).toBe(0);
    expect(fs.readFileSync(oldDesktop, 'utf8')).toBe(oldContents);
    for (const [dir, name] of keepFiles) expect(fs.readFileSync(path.join(dir, name), 'utf8')).toBe('legacy data');
    expect(fs.existsSync(backups)).toBe(true);
  });

  test('uninstall preserves a replaced legacy shortcut and removes an owned stale shortcut on repeat', () => {
    expect(run(path.join(download, 'install.sh'), env).status).toBe(0);
    const desktop = path.join(data, 'applications', 'StreamDeckLauncher.desktop');
    const owned = fs.readFileSync(desktop, 'utf8');
    const legacy = '[Desktop Entry]\nExec=/old/source/StreamDeckLauncher.sh\n';
    fs.writeFileSync(desktop, legacy);
    expect(run(path.join(data, 'streamdeck-launcher', 'uninstall.sh'), env).status).toBe(0);
    expect(fs.readFileSync(desktop, 'utf8')).toBe(legacy);
    fs.writeFileSync(desktop, owned);
    expect(run(path.join(download, 'uninstall.sh'), env).status).toBe(0);
    expect(fs.existsSync(desktop)).toBe(false);
  });

  test('refuses symlinked installation directories even if their target has a release marker', () => {
    const target = path.join(tmp, 'saved-install');
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, '.streamdeck-release'), 'keep');
    fs.mkdirSync(data);
    fs.symlinkSync(target, path.join(data, 'streamdeck-launcher'));
    for (const name of ['install.sh', 'uninstall.sh']) {
      expect(run(path.join(download, name), env).status).toBe(1);
      expect(fs.readFileSync(path.join(target, '.streamdeck-release'), 'utf8')).toBe('keep');
    }
  });

  test('aborts on browser installation failure before writing the app or shortcut', () => {
    const bin = path.join(tmp, 'bin');
    fs.mkdirSync(bin);
    fs.writeFileSync(path.join(bin, 'flatpak'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
    const result = run(path.join(download, 'install.sh'), {
      ...env, CHROMIUM_CMD: '', PATH: `${bin}:${process.env.PATH}`
    });
    expect(result.status).toBe(1);
    expect(fs.existsSync(path.join(data, 'streamdeck-launcher'))).toBe(false);
    expect(fs.existsSync(path.join(data, 'applications', 'StreamDeckLauncher.desktop'))).toBe(false);
  });

  test('installs the missing default browser for the current user', () => {
    const bin = path.join(tmp, 'bin');
    fs.mkdirSync(bin);
    const log = path.join(tmp, 'flatpak-args');
    fs.writeFileSync(path.join(bin, 'flatpak'), [
      '#!/bin/bash', 'printf \'%s\\n\' "$*" >> "$FLATPAK_LOG"',
      'if [ "$1" = info ]; then [ -f "$FLATPAK_STATE" ]; exit $?; fi',
      'if [ "$1" = install ]; then touch "$FLATPAK_STATE"; fi', 'exit 0', ''
    ].join('\n'), { mode: 0o755 });
    const result = run(path.join(download, 'install.sh'), {
      ...env, CHROMIUM_CMD: '', PATH: `${bin}:${process.env.PATH}`, FLATPAK_LOG: log, FLATPAK_STATE: path.join(tmp, 'browser-installed')
    });
    expect(result.status).toBe(0);
    expect(fs.readFileSync(log, 'utf8').trim().split('\n')).toEqual([
      'info io.github.ungoogled_software.ungoogled_chromium',
      'remote-add --user --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo',
      'install --user --noninteractive -y flathub io.github.ungoogled_software.ungoogled_chromium',
      'info io.github.ungoogled_software.ungoogled_chromium'
    ]);
  });

  test('rejects a relative XDG data path', () => {
    expect(run(path.join(download, 'install.sh'), { ...env, XDG_DATA_HOME: 'relative' }).status).toBe(1);
    expect(run(path.join(download, 'uninstall.sh'), { ...env, XDG_DATA_HOME: 'relative' }).status).toBe(1);
  });

  test('the binary launcher clears Steam variables and forwards arguments without Node', () => {
    const log = path.join(tmp, 'args');
    fs.writeFileSync(path.join(download, 'app', 'streamdeck-launcher'), [
      '#!/bin/bash',
      '[ -z "${ELECTRON_RUN_AS_NODE+x}" ] && [ -z "${LD_PRELOAD+x}" ] || exit 9',
      'printf \'%s\\0\' "$@" > "$ARG_LOG"', ''
    ].join('\n'), { mode: 0o755 });
    const result = spawnSync(path.join(download, 'StreamDeckLauncher.sh'), ['--test=two words'], {
      env: { ...env, DISPLAY: ':1', WAYLAND_DISPLAY: 'wayland-1', ELECTRON_RUN_AS_NODE: '1',
        ELECTRON_EXTRA_FLAGS: '--disable-gpu', ARG_LOG: log }, encoding: 'utf8'
    });
    expect(result.status).toBe(0);
    expect(fs.readFileSync(log, 'utf8').split('\0').filter(Boolean)).toEqual([
      '--ozone-platform=x11', '--disable-gpu', '--test=two words'
    ]);
  });
});
