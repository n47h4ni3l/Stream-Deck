const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');

describe('StreamDeckLauncher.sh', () => {
  test('uses npx when available with Wayland', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'launcher-'));
    const binDir = path.join(tmpDir, 'bin');
    fs.mkdirSync(binDir);
    const outFile = path.join(tmpDir, 'out');

    const npxStub = path.join(binDir, 'npx');
    fs.writeFileSync(npxStub, '#!/usr/bin/env bash\n' +
      'echo "$@" > "$STUB_OUTPUT"\n');
    fs.chmodSync(npxStub, 0o755);

    const flatpakStub = path.join(binDir, 'flatpak');
    fs.writeFileSync(flatpakStub, '#!/usr/bin/env bash\nexit 0\n');
    fs.chmodSync(flatpakStub, 0o755);

    const env = {
      ...process.env,
      PATH: `${binDir}:/usr/bin:/bin`,
      HOME: tmpDir,
      WAYLAND_DISPLAY: '1',
      STUB_OUTPUT: outFile
    };

    const result = spawnSync('bash', ['StreamDeckLauncher.sh'], {
      cwd: repoRoot,
      env,
      encoding: 'utf8'
    });

    expect(result.status).toBe(0);
    const output = fs.readFileSync(outFile, 'utf8');
    expect(output).toContain('electron');
    expect(output).toContain('--ozone-platform=wayland');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('uses flatpak fallback when npx unavailable (X11)', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'launcher-'));
    const binDir = path.join(tmpDir, 'bin');
    fs.mkdirSync(binDir);
    const outFile = path.join(tmpDir, 'out');

    const flatpakStub = path.join(binDir, 'flatpak');
    fs.writeFileSync(flatpakStub, '#!/usr/bin/env bash\n' +
      'echo "$@" > "$STUB_OUTPUT"\n');
    fs.chmodSync(flatpakStub, 0o755);

    const env = {
      ...process.env,
      PATH: `${binDir}:/usr/bin:/bin`,
      HOME: tmpDir,
      DISPLAY: ':0',
      STUB_OUTPUT: outFile
    };

    const result = spawnSync('bash', ['StreamDeckLauncher.sh'], {
      cwd: repoRoot,
      env,
      encoding: 'utf8'
    });

    expect(result.status).toBe(0);
    const output = fs.readFileSync(outFile, 'utf8');
    expect(output).toContain('run --command=npx org.nodejs.Node');
    expect(output).toContain('electron');
    expect(output).not.toContain('--ozone-platform=wayland');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
