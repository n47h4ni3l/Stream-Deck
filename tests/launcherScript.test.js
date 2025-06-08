const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const script = path.join(repoRoot, 'StreamDeckLauncher.sh');

function makeStub(dir, name, content) {
  const file = path.join(dir, name);
  fs.writeFileSync(file, content);
  fs.chmodSync(file, 0o755);
  return file;
}

describe('StreamDeckLauncher.sh', () => {
  let tmpDir;
  let binDir;
  let logFile;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'launcher-test-'));
    binDir = path.join(tmpDir, 'bin');
    fs.mkdirSync(binDir);
    logFile = path.join(tmpDir, 'log');

    makeStub(binDir, 'flatpak', `#!/usr/bin/env bash\necho \"flatpak $@\" >> \"$STUB_LOG\"\nexit 0\n`);
    // npx stub (not on PATH) to ensure it's not used when absent
    makeStub(tmpDir, 'npx', '#!/usr/bin/env bash\nexit 1\n');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const runScript = (env) => {
    return spawnSync('bash', [script], {
      cwd: repoRoot,
      env: {
        ...process.env,
        ...env,
        STUB_LOG: logFile,
        PATH: `${binDir}:/usr/bin`,
      },
      encoding: 'utf8'
    });
  };

  test.each([
    ['wayland', { XDG_SESSION_TYPE: 'wayland' }, 'flatpak run --command=npx org.nodejs.Node electron . --enable-features=UseOzonePlatform --ozone-platform=wayland'],
    ['x11', {}, 'flatpak run --command=npx org.nodejs.Node electron .']
  ])('falls back to flatpak when npx absent on %s', (_, extraEnv, expected) => {
    const result = runScript(extraEnv);
    expect(result.status).toBe(0);
    const log = fs.readFileSync(logFile, 'utf8').trim();
    expect(log).toBe(expected);
  });
});
