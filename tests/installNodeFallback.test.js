const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const bash = fs.realpathSync('/bin/bash');
const repo = path.resolve(__dirname, '..');
const required = fs.readFileSync(path.join(repo, '.nvmrc'), 'utf8').trim();
const wrongMajor = String(Number(required) + 2);
const unchanged = ['install.sh', 'StreamDeckLauncher.sh', '.nvmrc'].map(file => ({
  file, data: fs.readFileSync(path.join(repo, file)), mode: fs.statSync(path.join(repo, file)).mode
}));
let tmp, fixture, bin, home, log;
function stub(dir, name, body) {
  fs.writeFileSync(path.join(dir, name), `#!${bash}\nset -eu\n${body}\n`, { mode: 0o755 });
}
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'streamdeck-node-'));
  fixture = path.join(tmp, 'copied repo'); bin = path.join(tmp, 'bin'); home = path.join(tmp, 'home');
  for (const dir of [fixture, bin, path.join(home, '.volta/bin')]) fs.mkdirSync(dir, { recursive: true });
  for (const file of ['install.sh', 'StreamDeckLauncher.sh', '.nvmrc']) fs.copyFileSync(path.join(repo, file), path.join(fixture, file));
  log = path.join(tmp, 'commands');
  // Only these core utilities are real. There is no host Node/npm/Volta on PATH.
  for (const name of ['dirname', 'sed', 'chmod', 'cat', 'rm', 'mkdir']) {
    const command = execFileSync(bash, ['-c', `command -v ${name}`], { encoding: 'utf8' }).trim();
    fs.symlinkSync(command, path.join(bin, name));
  }
  stub(bin, 'git', 'echo "unexpected git $*" >> "$TRACE"; exit 90');
  stub(bin, 'curl', 'echo "unexpected curl $*" >> "$TRACE"; exit 91');
  stub(bin, 'flatpak', 'echo "flatpak $*" >> "$TRACE"');
  const npm = `echo "npm $*" >> "$TRACE"
selected="$(command -v node)"
version="$(node --version)"
echo "runtime $version $selected" >> "$TRACE"
[ "$version" = "v$REQUIRED_NODE.0.0" ] || exit 92`;
  stub(bin, 'npm', npm);
  stub(bin, 'volta', `echo "volta $*" >> "$TRACE"
[ "$*" = "install node@$REQUIRED_NODE" ] || exit 93
[ "$VOLTA_FAIL" = 0 ] || exit "$VOLTA_FAIL"
cat > "$VOLTA_HOME/bin/node" <<'NODE'
#!${bash}
set -eu
[ "$1" = --version ]
echo 'node installed' >> "$TRACE"
printf 'v%s.0.0\\n' "$REQUIRED_NODE"
NODE
cat > "$VOLTA_HOME/bin/npm" <<'NPM'
#!${bash}
set -eu
${npm}
NPM
chmod +x "$VOLTA_HOME/bin/node" "$VOLTA_HOME/bin/npm"`);
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
  for (const { file, data, mode } of unchanged) {
    expect(fs.readFileSync(path.join(repo, file))).toEqual(data);
    expect(fs.statSync(path.join(repo, file)).mode).toBe(mode);
  }
});
function install(version, failure = 0) {
  if (version !== 'absent') stub(bin, 'node', `echo 'node initial' >> "$TRACE"\n${version === 'broken' ? 'exit 23' : `echo v${version}.0.0`}`);
  const env = { HOME: home, PATH: bin, TRACE: log, REQUIRED_NODE: required, VOLTA_FAIL: String(failure), LANG: 'C' };
  const result = spawnSync(bash, [path.join(fixture, 'install.sh')], { cwd: tmp, env, encoding: 'utf8', timeout: 10000 });
  expect(result.error).toBeUndefined();
  return { ...result, calls: fs.readFileSync(log, 'utf8').trim().split('\n') };
}
test.each(['absent', wrongMajor, 'broken'])('recovers from %s Node and runs locked npm dependencies with the installed runtime', version => {
  const result = install(version);
  expect(result.status).toBe(0);
  expect(result.calls).toEqual([
    'flatpak remote-add --user --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo',
    ...(version === 'absent' ? [] : ['node initial']),
    `volta install node@${required}`, 'npm ci --include=dev', 'node installed',
    `runtime v${required}.0.0 ${home}/.volta/bin/node`,
    'flatpak info io.github.ungoogled_software.ungoogled_chromium'
  ]);
  expect(fs.existsSync(path.join(home, '.local/share/applications/StreamDeckLauncher.desktop'))).toBe(true);
});
test('matching Node skips installation and runs npm with that runtime', () => {
  const result = install(required);
  expect(result.status).toBe(0);
  expect(result.calls).toEqual([
    'flatpak remote-add --user --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo',
    'node initial', 'npm ci --include=dev', 'node initial',
    `runtime v${required}.0.0 ${bin}/node`,
    'flatpak info io.github.ungoogled_software.ungoogled_chromium'
  ]);
});
test.each(['absent', wrongMajor, 'broken'])('propagates Volta failure for %s Node without running npm or creating a shortcut', version => {
  const result = install(version, 17);
  expect(result.status).toBe(17);
  expect(result.calls.at(-1)).toBe(`volta install node@${required}`);
  expect(result.calls.some(call => call.startsWith('npm '))).toBe(false);
  expect(fs.existsSync(path.join(home, '.local/share/applications/StreamDeckLauncher.desktop'))).toBe(false);
});
