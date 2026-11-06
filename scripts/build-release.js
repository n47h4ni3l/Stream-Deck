// Build locally by default. Publishing is an explicit, separate workflow step.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { checkAppImage } = require('./check-appimage');
const root = path.resolve(__dirname, '..');
const pkg = require('../package.json');
const dist = path.join(root, 'dist');
const name = `streamdeck-launcher-${pkg.version}-linux-x86_64`;
const staging = path.join(dist, '.bundle');
const bundle = path.join(staging, name);

if (process.platform !== 'linux' || process.arch !== 'x64') {
  throw new Error('Release builds currently support Linux x86_64 only.');
}
execFileSync(path.join(root, 'node_modules', '.bin', 'electron-builder'),
  ['--linux', 'AppImage', '--x64', '--publish', 'never'], { cwd: root, stdio: 'inherit' });
const desktop = checkAppImage(path.join(dist, `${name}.AppImage`));
console.log(`Verified embedded AppImage desktop entry: ${desktop.exec}`);
fs.rmSync(staging, { recursive: true, force: true });
fs.mkdirSync(bundle, { recursive: true });
fs.cpSync(path.join(dist, 'linux-unpacked'), path.join(bundle, 'app'), { recursive: true });
for (const file of ['install.sh', 'uninstall.sh', 'StreamDeckLauncher.sh', 'README.txt']) {
  fs.copyFileSync(path.join(root, 'packaging', 'linux', file), path.join(bundle, file));
  if (file.endsWith('.sh')) fs.chmodSync(path.join(bundle, file), 0o755);
}
fs.copyFileSync(path.join(root, 'LICENSE'), path.join(bundle, 'LICENSE'));
const info = {
  version: pkg.version,
  platform: 'linux', arch: 'x64',
  electron: require('electron/package.json').version,
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  localChanges: Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim())
};
fs.writeFileSync(path.join(bundle, 'BUILD-INFO.json'), JSON.stringify(info, null, 2) + '\n');
execFileSync('tar', ['--sort=name', '--owner=0', '--group=0', '--numeric-owner',
  '-czf', path.join(dist, `${name}.tar.gz`), '-C', staging, name], { stdio: 'inherit' });
const artifacts = [`${name}.AppImage`, `${name}.tar.gz`];
fs.chmodSync(path.join(dist, artifacts[0]), 0o755);
fs.chmodSync(path.join(dist, artifacts[1]), 0o644);
const checksums = artifacts.map(file => {
  const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(dist, file))).digest('hex');
  return `${hash}  ${file}\n`;
}).join('');
fs.writeFileSync(path.join(dist, 'SHA256SUMS'), checksums);
fs.chmodSync(path.join(dist, 'SHA256SUMS'), 0o644);
fs.rmSync(staging, { recursive: true, force: true });
console.log(`Built ${artifacts.join(', ')} and SHA256SUMS. Nothing was published.`);
