const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

describe('StreamDeckLauncher.sh', () => {
  test('honors ELECTRON_EXTRA_FLAGS', () => {
    const repoRoot = path.resolve(__dirname, '..');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'electron-flag-'));
    const tmpHome = path.join(tmpDir, 'home');
    fs.mkdirSync(tmpHome);

    const binDir = path.join(tmpDir, 'bin');
    fs.mkdirSync(binDir);

    const outputFile = path.join(tmpDir, 'npx_args');
    const makeStub = (name, content) => {
      const file = path.join(binDir, name);
      fs.writeFileSync(file, content);
      fs.chmodSync(file, 0o755);
    };

    makeStub('npx', `#!/usr/bin/env bash\necho "$@" > "${outputFile}"\n`);
    makeStub('node', '#!/usr/bin/env bash\nif [ "$1" = "--version" ]; then echo v18.0.0; fi\n');
    makeStub('npm', '#!/usr/bin/env bash\nexit 0\n');

    const electronDir = path.join(repoRoot, 'node_modules', 'electron');
    const existed = fs.existsSync(electronDir);
    if (!existed) {
      fs.mkdirSync(electronDir, { recursive: true });
    }

    const env = {
      ...process.env,
      HOME: tmpHome,
      PATH: `${binDir}:${process.env.PATH}`,
      ELECTRON_EXTRA_FLAGS: '--no-sandbox',
      XDG_SESSION_TYPE: 'wayland'
    };
    const result = spawnSync('bash', ['./StreamDeckLauncher.sh'], { cwd: repoRoot, env });

    expect(result.status).toBe(0);
    const args = fs.readFileSync(outputFile, 'utf8').trim();
    expect(args.endsWith('--no-sandbox')).toBe(true);

    if (!existed) {
      fs.rmSync(electronDir, { recursive: true, force: true });
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
