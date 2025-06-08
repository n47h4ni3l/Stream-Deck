const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

describe('StreamDeckLauncher.sh', () => {
  const repoRoot = path.resolve(__dirname, '..');

  const makeStub = (dir, name, content) => {
    const file = path.join(dir, name);
    fs.writeFileSync(file, content);
    fs.chmodSync(file, 0o755);
  };

  test('uses npx under Wayland', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'launcher-test-'));
    const binDir = path.join(tmpDir, 'bin');
    fs.mkdirSync(binDir);

    const cmdFile = path.join(tmpDir, 'cmd');
    makeStub(binDir, 'npx', `#!/usr/bin/env bash\necho "$@" > "${cmdFile}"\n`);

    const env = { ...process.env, PATH: `${binDir}:${process.env.PATH}`, WAYLAND_DISPLAY: 'wayland-0' };
    spawnSync('bash', ['StreamDeckLauncher.sh'], { cwd: repoRoot, env });

    const cmd = fs.readFileSync(cmdFile, 'utf8').trim();
    expect(cmd).toBe('electron . --ozone-platform=wayland');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('falls back to flatpak run when npx missing', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'launcher-test-'));
    const binDir = path.join(tmpDir, 'bin');
    fs.mkdirSync(binDir);

    const cmdFile = path.join(tmpDir, 'cmd');
    makeStub(binDir, 'flatpak', `#!/usr/bin/env bash\necho "$@" > "${cmdFile}"\n`);

    const env = { ...process.env, PATH: `${binDir}:/usr/bin`, DISPLAY: ':0' };
    spawnSync('bash', ['StreamDeckLauncher.sh'], { cwd: repoRoot, env });

    const cmd = fs.readFileSync(cmdFile, 'utf8').trim();
    expect(cmd).toBe('run --command=npx org.nodejs.Node electron .');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
