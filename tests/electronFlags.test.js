const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

describe('StreamDeckLauncher.sh', () => {
  let tmpDir, appDir, binDir, argsFile, envFile;
  const writeExecutable = (file, content) => {
    fs.writeFileSync(file, '#!/usr/bin/env bash\n' + content + '\n');
    fs.chmodSync(file, 0o755);
  };

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'electron-launch-'));
    appDir = path.join(tmpDir, 'App With Spaces');
    binDir = path.join(tmpDir, 'bin');
    argsFile = path.join(tmpDir, 'args');
    envFile = path.join(tmpDir, 'environment');
    fs.mkdirSync(path.join(appDir, 'node_modules', '.bin'), { recursive: true });
    fs.mkdirSync(binDir);
    fs.copyFileSync(path.resolve(__dirname, '../StreamDeckLauncher.sh'), path.join(appDir, 'StreamDeckLauncher.sh'));
    writeExecutable(path.join(binDir, 'node'), 'echo v18.0.0');
    writeExecutable(path.join(binDir, 'npm'), 'exit 99');
    writeExecutable(path.join(binDir, 'npx'), 'exit 99');
    writeExecutable(path.join(appDir, 'node_modules', '.bin', 'electron'), [
      'printf \'%s\\n\' "$@" > "$TEST_ARGS_FILE"',
      '{ printenv ELECTRON_RUN_AS_NODE || echo unset; printenv LD_PRELOAD || echo unset; printenv CHROMIUM_CMD || echo unset; } > "$TEST_ENV_FILE"',
      'exit "$TEST_EXIT_CODE"'
    ].join('\n'));
  });

  afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

  function launch(extraEnv = {}, args = []) {
    return spawnSync('bash', [path.join(appDir, 'StreamDeckLauncher.sh'), ...args], {
      cwd: tmpDir,
      encoding: 'utf8',
      env: {
        ...process.env, HOME: tmpDir, PATH: binDir + ':' + process.env.PATH,
        DISPLAY: ':99', WAYLAND_DISPLAY: '', XDG_SESSION_TYPE: 'x11',
        ELECTRON_OZONE_PLATFORM: 'auto', ELECTRON_EXTRA_FLAGS: '',
        ELECTRON_FLAGS_OUTPUT: '', ELECTRON_RUN_AS_NODE: '1', LD_PRELOAD: '',
        CHROMIUM_CMD: '', TEST_EXIT_CODE: '0',
        TEST_ARGS_FILE: argsFile, TEST_ENV_FILE: envFile, ...extraEnv
      }
    });
  }

  test('uses local Electron, passes extra flags, and clears incompatible inherited variables', () => {
    const flagFile = path.join(tmpDir, 'debug', 'flags');
    const result = launch({ ELECTRON_EXTRA_FLAGS: '--no-sandbox --disable-gpu', ELECTRON_FLAGS_OUTPUT: flagFile }, ['--trace-warnings']);
    expect(result.status).toBe(0);
    expect(fs.readFileSync(argsFile, 'utf8').trim().split('\n')).toEqual([
      '.', '--ozone-platform=x11', '--no-sandbox', '--disable-gpu', '--trace-warnings'
    ]);
    expect(fs.readFileSync(envFile, 'utf8').split('\n').slice(0, 2)).toEqual(['unset', 'unset']);
    expect(fs.readFileSync(flagFile, 'utf8').trim()).toBe('--no-sandbox --disable-gpu');
  });

  test('prefers XWayland in a Gaming Mode environment with both displays', () => {
    expect(launch({ XDG_SESSION_TYPE: 'wayland', WAYLAND_DISPLAY: 'gamescope-0' }).status).toBe(0);
    expect(fs.readFileSync(argsFile, 'utf8')).toContain('--ozone-platform=x11');
  });

  test('supports a Wayland-only desktop', () => {
    expect(launch({ DISPLAY: '', WAYLAND_DISPLAY: 'wayland-0' }).status).toBe(0);
    expect(fs.readFileSync(argsFile, 'utf8')).toContain('--ozone-platform=wayland');
  });

  test('allows an explicit backend override', () => {
    expect(launch({ WAYLAND_DISPLAY: 'wayland-0', ELECTRON_OZONE_PLATFORM: 'wayland' }).status).toBe(0);
    expect(fs.readFileSync(argsFile, 'utf8')).toContain('--ozone-platform=wayland');
  });

  test('rejects an invalid backend and reports missing displays', () => {
    expect(launch({ ELECTRON_OZONE_PLATFORM: 'invalid' }).status).toBe(1);
    expect(launch({ DISPLAY: '', WAYLAND_DISPLAY: '' }).status).toBe(1);
    expect(fs.existsSync(argsFile)).toBe(false);
  });

  test('uses the saved browser command and honors an environment override', () => {
    fs.writeFileSync(path.join(appDir, 'browser_cmd'), 'flatpak run com.google.Chrome');
    expect(launch().status).toBe(0);
    expect(fs.readFileSync(envFile, 'utf8')).toContain('flatpak run com.google.Chrome');
    expect(launch({ CHROMIUM_CMD: '/opt/chrome --kiosk' }).status).toBe(0);
    expect(fs.readFileSync(envFile, 'utf8')).toContain('/opt/chrome --kiosk');
  });

  test('reports a missing installation without invoking npm or npx', () => {
    fs.unlinkSync(path.join(appDir, 'node_modules', '.bin', 'electron'));
    const result = launch();
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Run bash install.sh');
    expect(fs.existsSync(argsFile)).toBe(false);
  });

  test('preserves the Electron exit code', () => {
    expect(launch({ TEST_EXIT_CODE: '23' }).status).toBe(23);
  });
});
