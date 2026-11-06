const fs = require('fs');
const path = require('path');

module.exports = async context => {
  if (context.electronPlatformName !== 'linux') return;
  const executable = path.join(context.appOutDir, 'streamdeck-launcher');
  fs.renameSync(executable, executable + '-bin');
  fs.copyFileSync(path.join(__dirname, '..', 'packaging', 'linux', 'native-launcher.sh'), executable);
  fs.chmodSync(executable, 0o755);
};
