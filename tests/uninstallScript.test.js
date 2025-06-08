const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

describe('uninstall.sh', () => {
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
});
