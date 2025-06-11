const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

describe('install.sh', () => {
  test('creates desktop file with absolute paths', () => {
    const repoRoot = path.resolve(__dirname, '..');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'install-test-'));
    const tmpHome = path.join(tmpDir, 'home');
    fs.mkdirSync(tmpHome);

    const binDir = path.join(tmpDir, 'bin');
    fs.mkdirSync(binDir);

    const makeStub = (name, content) => {
      const file = path.join(binDir, name);
      fs.writeFileSync(file, content);
      fs.chmodSync(file, 0o755);
    };

    makeStub('flatpak', '#!/usr/bin/env bash\nexit 0\n');
    makeStub('curl', '#!/usr/bin/env bash\nwhile [ "$1" != "" ]; do if [ "$1" = "-o" ]; then touch "$2"; shift 2; else shift; fi; done\nexit 0\n');
    makeStub('volta', '#!/usr/bin/env bash\nif [ "$1" = "which" ]; then exit 0; else exit 0; fi\n');
    makeStub('npm', '#!/usr/bin/env bash\nexit 0\n');
    makeStub('npx', '#!/usr/bin/env bash\nexit 0\n');
    makeStub('node', '#!/usr/bin/env bash\nif [ "$1" = "--version" ]; then echo v18.0.0; fi\n');

    const launcher = path.join(repoRoot, 'StreamDeckLauncher.sh');
    const origLauncher = fs.readFileSync(launcher);
    const origMode = fs.statSync(launcher).mode & 0o777;
    fs.writeFileSync(launcher, '#!/usr/bin/env bash\necho launch stub\n');
    fs.chmodSync(launcher, 0o755);

    const env = { ...process.env, HOME: tmpHome, PATH: `${binDir}:${process.env.PATH}` };
    const result = spawnSync('bash', ['install.sh'], { cwd: repoRoot, env });

    fs.writeFileSync(launcher, origLauncher);
    fs.chmodSync(launcher, origMode);

    expect(result.status).toBe(0);

    const desktopPath = path.join(tmpHome, '.local', 'share', 'applications', 'StreamDeckLauncher.desktop');
    const content = fs.readFileSync(desktopPath, 'utf8');

    expect(content).toContain(`Exec="${repoRoot}/StreamDeckLauncher.sh"`);
    expect(content).toContain(`Path="${repoRoot}"`);
    expect(content).toContain(`Icon="${repoRoot}/build/icon.png"`);

    fs.accessSync(desktopPath, fs.constants.X_OK);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('persists CHROMIUM_CMD when provided', () => {
    const repoRoot = path.resolve(__dirname, '..');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'install-test-'));
    const tmpHome = path.join(tmpDir, 'home');
    fs.mkdirSync(tmpHome);

    const binDir = path.join(tmpDir, 'bin');
    fs.mkdirSync(binDir);

    const makeStub = (name, content) => {
      const file = path.join(binDir, name);
      fs.writeFileSync(file, content);
      fs.chmodSync(file, 0o755);
    };

    makeStub('flatpak', '#!/usr/bin/env bash\nexit 0\n');
    makeStub('curl', '#!/usr/bin/env bash\nwhile [ "$1" != "" ]; do if [ "$1" = "-o" ]; then touch "$2"; shift 2; else shift; fi; done\nexit 0\n');
    makeStub('volta', '#!/usr/bin/env bash\nif [ "$1" = "which" ]; then exit 0; else exit 0; fi\n');
    makeStub('npm', '#!/usr/bin/env bash\nexit 0\n');
    makeStub('npx', '#!/usr/bin/env bash\nexit 0\n');
    makeStub('node', '#!/usr/bin/env bash\nif [ "$1" = "--version" ]; then echo v18.0.0; fi\n');

    const launcher = path.join(repoRoot, 'StreamDeckLauncher.sh');
    const origLauncher = fs.readFileSync(launcher);
    const origMode = fs.statSync(launcher).mode & 0o777;
    fs.writeFileSync(launcher, '#!/usr/bin/env bash\necho launch stub\n');
    fs.chmodSync(launcher, 0o755);

    const chromiumBin = path.join(binDir, 'chromium');
    const chromiumCmd = `${chromiumBin} --kiosk --flag="foo bar"`;
    fs.writeFileSync(chromiumBin, '#!/usr/bin/env bash\nexit 0\n');
    fs.chmodSync(chromiumBin, 0o755);
    const env = { ...process.env, HOME: tmpHome, PATH: `${binDir}:${process.env.PATH}`, CHROMIUM_CMD: chromiumCmd };
    const result = spawnSync('bash', ['install.sh'], { cwd: repoRoot, env });

    fs.writeFileSync(launcher, origLauncher);
    fs.chmodSync(launcher, origMode);

    expect(result.status).toBe(0);

    const desktopPath = path.join(tmpHome, '.local', 'share', 'applications', 'StreamDeckLauncher.desktop');
    const content = fs.readFileSync(desktopPath, 'utf8');

    expect(content).toContain(`Exec=env CHROMIUM_CMD='${chromiumCmd.replace(/'/g, "'\\''")}' "${repoRoot}/StreamDeckLauncher.sh"`);

    fs.accessSync(desktopPath, fs.constants.X_OK);


    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('installs default browser when missing', () => {
    const repoRoot = path.resolve(__dirname, '..');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'install-test-'));
    const tmpHome = path.join(tmpDir, 'home');
    fs.mkdirSync(tmpHome);

    const binDir = path.join(tmpDir, 'bin');
    fs.mkdirSync(binDir);

    const flatpakLog = path.join(tmpDir, 'flatpak.log');

    const makeStub = (name, content) => {
      const file = path.join(binDir, name);
      fs.writeFileSync(file, content);
      fs.chmodSync(file, 0o755);
    };

    makeStub('flatpak', `#!/usr/bin/env bash
if [ "$1" = "info" ]; then
  exit 1
fi
echo "$@" >> '${flatpakLog.replace(/'/g, "'\\''")}'
exit 0
`);
    makeStub('curl', '#!/usr/bin/env bash\nwhile [ "$1" != "" ]; do if [ "$1" = "-o" ]; then touch "$2"; shift 2; else shift; fi; done\nexit 0\n');
    makeStub('volta', '#!/usr/bin/env bash\nif [ "$1" = "which" ]; then exit 0; else exit 0; fi\n');
    makeStub('npm', '#!/usr/bin/env bash\nexit 0\n');
    makeStub('npx', '#!/usr/bin/env bash\nexit 0\n');
    makeStub('node', '#!/usr/bin/env bash\nif [ "$1" = "--version" ]; then echo v18.0.0; fi\n');

    const launcher = path.join(repoRoot, 'StreamDeckLauncher.sh');
    const origLauncher = fs.readFileSync(launcher);
    const origMode = fs.statSync(launcher).mode & 0o777;
    fs.writeFileSync(launcher, '#!/usr/bin/env bash\necho launch stub\n');
    fs.chmodSync(launcher, 0o755);

    const env = { ...process.env, HOME: tmpHome, PATH: `${binDir}:${process.env.PATH}` };
    const result = spawnSync('bash', ['install.sh'], { cwd: repoRoot, env });

    fs.writeFileSync(launcher, origLauncher);
    fs.chmodSync(launcher, origMode);

    expect(result.status).toBe(0);
    const log = fs.readFileSync(flatpakLog, 'utf8');
    expect(log).toContain('install --user --noninteractive -y flathub io.github.ungoogled_software.ungoogled_chromium');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('fails when custom browser is missing', () => {
    const repoRoot = path.resolve(__dirname, '..');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'install-test-'));
    const tmpHome = path.join(tmpDir, 'home');
    fs.mkdirSync(tmpHome);

    const binDir = path.join(tmpDir, 'bin');
    fs.mkdirSync(binDir);

    const makeStub = (name, content) => {
      const file = path.join(binDir, name);
      fs.writeFileSync(file, content);
      fs.chmodSync(file, 0o755);
    };

    makeStub('flatpak', '#!/usr/bin/env bash\nexit 0\n');
    makeStub('curl', '#!/usr/bin/env bash\nwhile [ "$1" != "" ]; do if [ "$1" = "-o" ]; then touch "$2"; shift 2; else shift; fi; done\nexit 0\n');
    makeStub('volta', '#!/usr/bin/env bash\nif [ "$1" = "which" ]; then exit 0; else exit 0; fi\n');
    makeStub('npm', '#!/usr/bin/env bash\nexit 0\n');
    makeStub('npx', '#!/usr/bin/env bash\nexit 0\n');
    makeStub('node', '#!/usr/bin/env bash\nif [ "$1" = "--version" ]; then echo v18.0.0; fi\n');

    const launcher = path.join(repoRoot, 'StreamDeckLauncher.sh');
    const origLauncher = fs.readFileSync(launcher);
    const origMode = fs.statSync(launcher).mode & 0o777;
    fs.writeFileSync(launcher, '#!/usr/bin/env bash\necho launch stub\n');
    fs.chmodSync(launcher, 0o755);

    const env = { ...process.env, HOME: tmpHome, PATH: `${binDir}:${process.env.PATH}`, CHROMIUM_CMD: 'fakebrowser --flag' };
    const result = spawnSync('bash', ['install.sh'], { cwd: repoRoot, env });

    fs.writeFileSync(launcher, origLauncher);
    fs.chmodSync(launcher, origMode);

    expect(result.status).not.toBe(0);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('handles browser path with spaces', () => {
    const repoRoot = path.resolve(__dirname, '..');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'install-test-'));
    const tmpHome = path.join(tmpDir, 'home');
    fs.mkdirSync(tmpHome);

    const binDir = path.join(tmpDir, 'bin');
    fs.mkdirSync(binDir);

    const makeStub = (name, content) => {
      const file = path.join(binDir, name);
      fs.writeFileSync(file, content);
      fs.chmodSync(file, 0o755);
    };

    makeStub('flatpak', '#!/usr/bin/env bash\nexit 0\n');
    makeStub('curl', '#!/usr/bin/env bash\nwhile [ "$1" != "" ]; do if [ "$1" = "-o" ]; then touch "$2"; shift 2; else shift; fi; done\nexit 0\n');
    makeStub('volta', '#!/usr/bin/env bash\nif [ "$1" = "which" ]; then exit 0; else exit 0; fi\n');
    makeStub('npm', '#!/usr/bin/env bash\nexit 0\n');
    makeStub('npx', '#!/usr/bin/env bash\nexit 0\n');
    makeStub('node', '#!/usr/bin/env bash\nif [ "$1" = "--version" ]; then echo v18.0.0; fi\n');

    const spaceDir = path.join(binDir, 'My Browser');
    fs.mkdirSync(spaceDir);
    const chromeBin = path.join(spaceDir, 'chrome');
    fs.writeFileSync(chromeBin, '#!/usr/bin/env bash\nexit 0\n');
    fs.chmodSync(chromeBin, 0o755);

    const launcher = path.join(repoRoot, 'StreamDeckLauncher.sh');
    const origLauncher = fs.readFileSync(launcher);
    const origMode = fs.statSync(launcher).mode & 0o777;
    fs.writeFileSync(launcher, '#!/usr/bin/env bash\necho launch stub\n');
    fs.chmodSync(launcher, 0o755);

    const chromiumCmd = `"${chromeBin}" --kiosk`;
    const env = { ...process.env, HOME: tmpHome, PATH: `${binDir}:${process.env.PATH}`, CHROMIUM_CMD: chromiumCmd };
    const result = spawnSync('bash', ['install.sh'], { cwd: repoRoot, env });

    fs.writeFileSync(launcher, origLauncher);
    fs.chmodSync(launcher, origMode);

    expect(result.status).toBe(0);

    const desktopPath = path.join(tmpHome, '.local', 'share', 'applications', 'StreamDeckLauncher.desktop');
    const content = fs.readFileSync(desktopPath, 'utf8');
    expect(content).toContain(`Exec=env CHROMIUM_CMD='${chromiumCmd.replace(/'/g, "'\\''")}' "${repoRoot}/StreamDeckLauncher.sh"`);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
