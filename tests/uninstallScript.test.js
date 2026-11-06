const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

describe('uninstall.sh', () => {
  test('refuses to remove a packaged release selected by the shared menu shortcut', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'uninstall-packaged-guard-'));
    try {
      const installed = path.join(tmp, 'home', '.local', 'share', 'streamdeck-launcher');
      const desktopDir = path.join(tmp, 'home', '.local', 'share', 'applications');
      fs.mkdirSync(installed, { recursive: true });
      fs.mkdirSync(desktopDir, { recursive: true });
      fs.writeFileSync(path.join(installed, '.streamdeck-release'), '');
      fs.writeFileSync(path.join(installed, 'StreamDeckLauncher.sh'), 'keep');
      const desktop = path.join(desktopDir, 'StreamDeckLauncher.desktop');
      const contents = `[Desktop Entry]\nExec="${installed}/StreamDeckLauncher.sh"\n`;
      fs.writeFileSync(desktop, contents);
      const result = spawnSync(path.resolve(__dirname, '..', 'uninstall.sh'), [], {
        cwd: tmp, env: { ...process.env, HOME: path.join(tmp, 'home') }, encoding: 'utf8'
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('packaged release');
      expect(fs.readFileSync(desktop, 'utf8')).toBe(contents);
      expect(fs.readFileSync(path.join(installed, 'StreamDeckLauncher.sh'), 'utf8')).toBe('keep');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('can be executed directly from a checkout or source archive', () => {
    const script = path.resolve(__dirname, '..', 'uninstall.sh');
    expect(fs.statSync(script).mode & 0o111).not.toBe(0);
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'uninstall-executable-'));
    try {
      const result = spawnSync(script, [], {
        cwd: tmpHome, env: { ...process.env, HOME: tmpHome }, encoding: 'utf8'
      });
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('Uninstall complete.');
    } finally {
      fs.rmSync(tmpHome, { recursive: true, force: true });
    }
  });

  test.each(['Deck%App', 'Deck% App', 'Deck%% App', 'Deck%f App', 'Deck App'])(
    'decodes the desktop Exec path once without deleting anything: %s',
    installName => {
      const repoRoot = path.resolve(__dirname, '..');
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uninstall-percent-test-'));
      try {
        const tmpHome = path.join(tmpDir, 'home');
        const binDir = path.join(tmpDir, 'bin');
        const rmLog = path.join(tmpDir, 'rm-arguments');
        const installDir = path.join(tmpDir, installName);
        const escapedDir = installDir.replace(/%/g, '%%');

        // Keep both possible targets present so the old code would select the
        // wrong folder, rather than quietly skipping a nonexistent directory.
        for (const dir of new Set([installDir, escapedDir])) {
          fs.mkdirSync(dir);
          fs.writeFileSync(path.join(dir, 'StreamDeckLauncher.sh'), 'keep');
        }
        fs.mkdirSync(binDir);
        const rmStub = path.join(binDir, 'rm');
        fs.writeFileSync(rmStub, [
          '#!/usr/bin/env bash',
          // NUL-separated arguments, with an empty argument between calls.
          'printf \'%s\\0\' "$@" >> "$RM_ARGUMENT_LOG"',
          'printf \'\\0\' >> "$RM_ARGUMENT_LOG"',
          ''
        ].join('\n'));
        fs.chmodSync(rmStub, 0o755);

        const desktopDir = path.join(tmpHome, '.local', 'share', 'applications');
        fs.mkdirSync(desktopDir, { recursive: true });
        const desktopFile = path.join(desktopDir, 'StreamDeckLauncher.desktop');
        fs.writeFileSync(desktopFile,
          `[Desktop Entry]\nExec="${escapedDir}/StreamDeckLauncher.sh"\nPath=${installDir}\n`);

        const result = spawnSync('bash', [path.join(repoRoot, 'uninstall.sh')], {
          cwd: tmpDir,
          encoding: 'utf8',
          env: {
            ...process.env, HOME: tmpHome,
            PATH: `${binDir}:${process.env.PATH}`, RM_ARGUMENT_LOG: rmLog
          }
        });
        expect(result.status).toBe(0);
        const calls = fs.readFileSync(rmLog, 'utf8').split('\0\0')
          .filter(Boolean).map(call => call.split('\0'));
        expect(calls).toEqual([['-f', desktopFile], ['-rf', installDir]]);
        // The stub records requests only. Neither the intended installation,
        // the escaped lookalike nor the desktop entry may actually be removed.
        expect(fs.existsSync(desktopFile)).toBe(true);
        for (const dir of new Set([installDir, escapedDir])) {
          expect(fs.readFileSync(path.join(dir, 'StreamDeckLauncher.sh'), 'utf8')).toBe('keep');
        }
      } finally {
        // Only clean up this test's own temporary fixture.
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    }
  );

  test('removes desktop file and install directory', () => {
    const repoRoot = path.resolve(__dirname, '..');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uninstall-test-'));
    const tmpHome = path.join(tmpDir, 'home');
    fs.mkdirSync(tmpHome);

    const installDir = path.join(tmpDir, 'install');
    fs.mkdirSync(installDir);
    fs.writeFileSync(path.join(installDir, 'StreamDeckLauncher.sh'), '');

    const desktopDir = path.join(tmpHome, '.local', 'share', 'applications');
    fs.mkdirSync(desktopDir, { recursive: true });
    const desktopFile = path.join(desktopDir, 'StreamDeckLauncher.desktop');
    fs.writeFileSync(
      desktopFile,
      `[Desktop Entry]\nExec=${installDir}/StreamDeckLauncher.sh\nPath=${installDir}\n`
    );

    const env = { ...process.env, HOME: tmpHome };
    const result = spawnSync('bash', ['uninstall.sh'], { cwd: repoRoot, env });

    expect(result.status).toBe(0);
    expect(fs.existsSync(desktopFile)).toBe(false);
    expect(fs.existsSync(installDir)).toBe(false);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('handles quoted Exec with args', () => {
    const repoRoot = path.resolve(__dirname, '..');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uninstall-test-'));
    const tmpHome = path.join(tmpDir, 'home');
    fs.mkdirSync(tmpHome);

    const installDir = path.join(tmpDir, 'install-quoted');
    fs.mkdirSync(installDir);
    fs.writeFileSync(path.join(installDir, 'StreamDeckLauncher.sh'), '');

    const desktopDir = path.join(tmpHome, '.local', 'share', 'applications');
    fs.mkdirSync(desktopDir, { recursive: true });
    const desktopFile = path.join(desktopDir, 'StreamDeckLauncher.desktop');
    fs.writeFileSync(
      desktopFile,
      `[Desktop Entry]\nExec="${installDir}/StreamDeckLauncher.sh" --foo\nPath=${installDir}\n`
    );

    const env = { ...process.env, HOME: tmpHome };
    const result = spawnSync('bash', ['uninstall.sh'], { cwd: repoRoot, env });

    expect(result.status).toBe(0);
    expect(fs.existsSync(desktopFile)).toBe(false);
    expect(fs.existsSync(installDir)).toBe(false);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('handles env prefix in Exec line', () => {
    const repoRoot = path.resolve(__dirname, '..');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uninstall-test-'));
    const tmpHome = path.join(tmpDir, 'home');
    fs.mkdirSync(tmpHome);

    const installDir = path.join(tmpDir, 'install-env');
    fs.mkdirSync(installDir);
    fs.writeFileSync(path.join(installDir, 'StreamDeckLauncher.sh'), '');

    const desktopDir = path.join(tmpHome, '.local', 'share', 'applications');
    fs.mkdirSync(desktopDir, { recursive: true });
    const desktopFile = path.join(desktopDir, 'StreamDeckLauncher.desktop');
    fs.writeFileSync(
      desktopFile,
      `[Desktop Entry]\nExec=env CHROMIUM_CMD="/usr/bin/chromium" "${installDir}/StreamDeckLauncher.sh"\nPath=${installDir}\n`
    );

    const env = { ...process.env, HOME: tmpHome };
    const result = spawnSync('bash', ['uninstall.sh'], { cwd: repoRoot, env });

    expect(result.status).toBe(0);
    expect(fs.existsSync(desktopFile)).toBe(false);
    expect(fs.existsSync(installDir)).toBe(false);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
