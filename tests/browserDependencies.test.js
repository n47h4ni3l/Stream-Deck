const fs = require('fs');
const path = require('path');
const os = require('os');
const { inspectBrowser, setupBrowser, checkRuntime, hostEnvironment } = require('../setup/browser-dependencies');
const { runSetup } = require('../setup/cli');
const { checkPlaybackTools } = require('../setup/playback');

describe('dependency setup', () => {
  let tmp, env, flatpak, installed, calls, runSync, runCommand;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'streamdeck-deps-'));
    env = { HOME: tmp, XDG_CONFIG_HOME: path.join(tmp, 'config'), PATH: path.join(tmp, 'bin'), DISPLAY: ':99' };
    fs.mkdirSync(env.PATH);
    flatpak = path.join(env.PATH, 'flatpak');
    fs.writeFileSync(flatpak, '#!/bin/sh\nexit 0\n', { mode: 0o700 });
    installed = false; calls = [];
    runSync = jest.fn(() => ({ status: installed ? 0 : 1 }));
    runCommand = jest.fn(async (_program, args) => {
      calls.push(args);
      if (args[0] === 'install') installed = true;
    });
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const options = () => ({ env, runSync, runCommand, install: true });

  test('missing default browser is installed with its runtime only for the user, then rechecked', async () => {
    expect(inspectBrowser(options()).ready).toBe(false);
    expect((await setupBrowser(options())).ready).toBe(true);
    expect(calls).toEqual([
      ['remote-add', '--user', '--if-not-exists', 'flathub', 'https://flathub.org/repo/flathub.flatpakrepo'],
      ['install', '--user', '--noninteractive', '-y', 'flathub', 'io.github.ungoogled_software.ungoogled_chromium']
    ]);
    expect(runSync).toHaveBeenCalledTimes(3);
  });
  test('repeat setup does not reinstall an available browser or add remotes', async () => {
    await setupBrowser(options()); calls.length = 0;
    expect((await setupBrowser(options())).ready).toBe(true);
    expect(calls).toEqual([]);
  });
  test('check-only mode never installs a missing browser', async () => {
    await expect(setupBrowser({ ...options(), install: false })).rejects.toThrow('not available');
    expect(runCommand).not.toHaveBeenCalled();
  });
  test('missing Flatpak reports the host prerequisite without installing system software', async () => {
    fs.unlinkSync(flatpak);
    await expect(setupBrowser(options())).rejects.toThrow('Flatpak is missing');
    expect(runCommand).not.toHaveBeenCalled();
  });
  test('an installed quoted native browser needs no Flatpak', async () => {
    fs.unlinkSync(flatpak);
    const native = path.join(tmp, 'My Browser'); fs.writeFileSync(native, '', { mode: 0o700 });
    const result = await setupBrowser({ ...options(), setting: `"${native}" --incognito` });
    expect(result.command).toEqual([native, '--incognito']);
    expect(runCommand).not.toHaveBeenCalled();
  });
  test('missing custom executable is blocked rather than silently replaced', async () => {
    await expect(setupBrowser({ ...options(), setting: '/missing/browser --kiosk' })).rejects.toThrow('executable not found');
    expect(runCommand).not.toHaveBeenCalled();
  });
  test('known custom Flatpak browser can be installed with explicit setup consent', async () => {
    const result = await setupBrowser({ ...options(), setting: 'flatpak run com.google.Chrome --incognito' });
    expect(result.ready).toBe(true);
    expect(calls[1].at(-1)).toBe('com.google.Chrome');
  });
  test('unknown Flatpak is reported for manual setup without installing arbitrary software', async () => {
    await expect(setupBrowser({ ...options(), setting: 'flatpak run test.Unknown.App' })).rejects.toThrow('manually');
    expect(runCommand).not.toHaveBeenCalled();
  });
  test('user-scoped browser checks cannot be satisfied by a system-only installation', () => {
    runSync.mockImplementation((_program, args) => ({ status: args.includes('--user') ? 1 : 0 }));
    expect(inspectBrowser({ ...options(), setting: 'flatpak run --user com.google.Chrome' }).ready).toBe(false);
    expect(runSync.mock.calls[0][1]).toEqual(['info', '--user', 'com.google.Chrome']);
  });
  test('a missing system-scoped browser never triggers a user or system installation', async () => {
    await expect(setupBrowser({ ...options(), setting: 'flatpak run --system com.google.Chrome' })).rejects.toThrow('System-scoped installation is not automated');
    expect(runCommand).not.toHaveBeenCalled();
  });
  test('shell operators in a custom command are rejected without execution', async () => {
    await expect(setupBrowser({ ...options(), setting: 'flatpak run com.google.Chrome; touch /tmp/unwanted' })).rejects.toThrow('without shell operators');
    expect(runCommand).not.toHaveBeenCalled();
  });
  test.each(['remote-add', 'install'])('Flatpak %s failure remains an actionable error', async failed => {
    runCommand.mockImplementation(async (_program, args) => { if (args[0] === failed) throw new Error('Network/permission failure'); });
    await expect(setupBrowser(options())).rejects.toThrow('Network/permission failure');
    expect(installed).toBe(false);
  });
  test('a successful install exit is insufficient if the browser still cannot be found', async () => {
    runCommand.mockImplementation(async () => {});
    await expect(setupBrowser(options())).rejects.toThrow('did not produce a usable command');
  });
  test('runtime probe uses a disposable profile and enables sandboxing by default', async () => {
    const run = jest.fn(async () => {});
    await checkRuntime('/bundled/electron', env, run);
    const [program, args, opts] = run.mock.calls[0];
    expect(program).toBe('/bundled/electron');
    expect(args).toEqual(['--enable-sandbox', '--streamdeck-runtime-probe', '--ozone-platform=x11']);
    expect(opts.env.HOME).not.toBe(env.HOME);
    expect(fs.existsSync(opts.env.HOME)).toBe(false);
  });
  test('isolated X11 probe can read the original default authority file when XAUTHORITY is unset', async () => {
    const authority = path.join(env.HOME, '.Xauthority');
    fs.writeFileSync(authority, 'test X11 authority fixture', { mode: 0o600 });
    await checkRuntime('/bundled/electron', env, async (_program, _args, options) => {
      // X11 clients use XAUTHORITY, otherwise HOME/.Xauthority.
      const clientAuthority = options.env.XAUTHORITY || path.join(options.env.HOME, '.Xauthority');
      expect(options.env.HOME).not.toBe(env.HOME);
      expect(fs.readFileSync(clientAuthority, 'utf8')).toBe('test X11 authority fixture');
    });
    expect(fs.readFileSync(authority, 'utf8')).toBe('test X11 authority fixture');
    expect(fs.statSync(authority).mode & 0o777).toBe(0o600);
  });
  test('runtime probe preserves an explicitly configured X11 authority path', async () => {
    const authority = path.join(tmp, 'custom authority');
    const run = jest.fn(async () => {});
    await checkRuntime('/bundled/electron', { ...env, XAUTHORITY: authority }, run);
    expect(run.mock.calls[0][2].env.XAUTHORITY).toBe(authority);
  });
  test('Wayland-only runtime probe does not introduce an X11 authority override', async () => {
    const run = jest.fn(async () => {});
    await checkRuntime('/bundled/electron', { ...env, DISPLAY: undefined, WAYLAND_DISPLAY: 'wayland-fixture' }, run);
    expect(run.mock.calls[0][1]).toContain('--ozone-platform=wayland');
    expect(run.mock.calls[0][2].env.XAUTHORITY).toBeUndefined();
  });
  test('runtime or graphics failure blocks browser installation and leaves existing settings intact', async () => {
    env.CHROMIUM_CMD = '/bin/true';
    const profile = path.join(env.XDG_CONFIG_HOME, 'streamdeck-launcher'); fs.mkdirSync(profile, { recursive: true });
    const file = path.join(profile, 'browser_cmd'); fs.writeFileSync(file, 'keep this browser');
    await expect(runSetup({ ...options(), mode: '--streamdeck-setup-dependencies',
      checkRuntime: async () => { throw new Error('Sandbox unavailable'); } })).rejects.toThrow('Sandbox unavailable');
    expect(runCommand).not.toHaveBeenCalled(); expect(fs.readFileSync(file, 'utf8')).toBe('keep this browser');
  });
  test('missing playback transport blocks dependency setup before browser downloads', async () => {
    const checkPlayback = jest.fn(async () => { throw new Error('gdbus missing'); });
    await expect(runSetup({ ...options(), mode: '--streamdeck-setup-dependencies', checkRuntime: async () => {},
      checkPlayback })).rejects.toThrow('gdbus missing');
    expect(checkPlayback).toHaveBeenCalledWith(env);
    expect(runCommand).not.toHaveBeenCalled();
  });
  test('playback prerequisite check reports a broken session bus and succeeds when it recovers', async () => {
    const tool = path.join(env.PATH, 'gdbus');
    fs.writeFileSync(tool, '#!/bin/sh\nexit 1\n', { mode: 0o700 });
    await expect(checkPlaybackTools(env)).rejects.toThrow('session bus is unavailable');
    fs.writeFileSync(tool, '#!/bin/sh\nprintf "( [], )\\n"\n', { mode: 0o700 });
    await expect(checkPlaybackTools(env)).resolves.toBeUndefined();
    expect(runCommand).not.toHaveBeenCalled();
  });
  test('an explicitly supplied container exception is disclosed and never treated as native sandbox validation', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const run = jest.fn(async () => {});
      await checkRuntime('/bundled/electron', { ...env, ELECTRON_EXTRA_FLAGS: '--no-sandbox' }, run);
      expect(run.mock.calls[0][1]).toContain('--no-sandbox');
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('does not verify native sandbox support'));
    } finally { warn.mockRestore(); }
  });
  test('host tools do not inherit AppImage libraries or Steam overlay variables', () => {
    const clean = hostEnvironment({ PATH: '/bin', HTTPS_PROXY: 'proxy-placeholder', LD_LIBRARY_PATH: '/app/lib', LD_PRELOAD: 'overlay', GSETTINGS_SCHEMA_DIR: '/app/schema', ELECTRON_RUN_AS_NODE: '1', APPDIR: '/app', APPIMAGE: '/old.AppImage' });
    expect(clean).toEqual({ PATH: '/bin', HTTPS_PROXY: 'proxy-placeholder' });
  });
});
