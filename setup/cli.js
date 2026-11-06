const fs = require('fs');
const path = require('path');
const { setupBrowser, checkRuntime, profileDirectory } = require('./browser-dependencies');
const { setupSteam } = require('./steam');
const { checkPlaybackTools } = require('./playback');

function steamArguments(args) {
  const names = { '--launcher': 'launcher', '--icon': 'icon', '--steam-selection': 'selection', '--launch-options': 'launchOptions' };
  const parsed = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!Object.hasOwn(names, args[i]) || typeof args[i + 1] !== 'string' || args[i + 1].length > 4096) throw new Error('Invalid Steam setup arguments');
    parsed[names[args[i]]] = args[i + 1];
  }
  return parsed;
}

async function runSetup(options = {}) {
  const env = options.env || process.env;
  const mode = options.mode || process.argv[2];
  if (mode === '--streamdeck-check-playback') {
    await (options.checkPlayback || checkPlaybackTools)(env);
    console.log('Playback transport is available. Browser-wide media status is checked when the browser exports MPRIS.');
    return { ready: true };
  }
  if (mode === '--streamdeck-setup-steam') {
    const status = setupSteam({ ...steamArguments(options.args || process.argv.slice(3)), env,
      storeDir: options.storeDir, steamRunning: options.steamRunning });
    console.log(`Steam shortcut: ${status.detail}`);
    if (status.state === 'selection-required') console.log('Open the launcher Setup screen to select the Steam account.');
    return status;
  }
  if (!['--streamdeck-setup-dependencies', '--streamdeck-check-dependencies'].includes(mode)) {
    throw new Error('Use --streamdeck-setup-dependencies or --streamdeck-check-dependencies.');
  }
  profileDirectory(env);
  console.log('Checking the bundled Electron runtime, graphical session and sandbox...');
  await (options.checkRuntime || checkRuntime)(options.binary || process.execPath, env);
  console.log('Checking browser-wide playback transport (gdbus/session bus)...');
  await (options.checkPlayback || checkPlaybackTools)(env);
  const status = await setupBrowser({ ...options, env,
    install: mode === '--streamdeck-setup-dependencies', onOutput: chunk => process.stdout.write(chunk) });
  if (mode === '--streamdeck-setup-dependencies' && env.CHROMIUM_CMD) {
    const dir = profileDirectory(env);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'browser_cmd'), env.CHROMIUM_CMD + '\n', { mode: 0o600 });
  }
  console.log('Runtime and browser dependency checks passed.');
  return status;
}
if (require.main === module) runSetup().then(status => {
  if (process.argv[2] === '--streamdeck-setup-steam' && status.state !== 'installed') process.exitCode = 20;
}).catch(error => {
  console.error(`Setup stopped: ${error.message}`);
  process.exitCode = 1;
});
module.exports = { runSetup, steamArguments };
