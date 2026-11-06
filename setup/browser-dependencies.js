const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, spawnSync } = require('child_process');
const shellQuote = require('shell-quote');

const defaultBrowserId = 'io.github.ungoogled_software.ungoogled_chromium';
const defaultCommand = ['flatpak', 'run', defaultBrowserId];
const installableIds = new Set([defaultBrowserId, 'com.google.Chrome', 'org.chromium.Chromium',
  'com.brave.Browser', 'org.mozilla.firefox']);

function hostEnvironment(env = process.env) {
  const clean = { ...env };
  // AppImage's bundled libraries and Steam's overlay must not leak into host tools.
  delete clean.LD_LIBRARY_PATH;
  delete clean.LD_PRELOAD;
  delete clean.GSETTINGS_SCHEMA_DIR;
  delete clean.ELECTRON_RUN_AS_NODE;
  delete clean.APPDIR;
  delete clean.APPIMAGE;
  return clean;
}
function profileDirectory(env = process.env) {
  const dir = path.join(env.XDG_CONFIG_HOME || path.join(env.HOME || os.homedir(), '.config'), 'streamdeck-launcher');
  if (!path.isAbsolute(dir)) throw new Error('XDG_CONFIG_HOME must be an absolute path.');
  return dir;
}
function browserSetting(env = process.env) {
  if (env.CHROMIUM_CMD) return env.CHROMIUM_CMD;
  const file = path.join(profileDirectory(env), 'browser_cmd');
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim() : '';
}
function parseCommand(setting) {
  const command = setting ? shellQuote.parse(setting) : [...defaultCommand];
  if (!command.length || command.some(arg => typeof arg !== 'string') || !command[0]) {
    throw new Error('Browser command must be an executable with arguments, without shell operators.');
  }
  return command;
}
function executablePath(name, env = process.env) {
  const candidates = name.includes(path.sep) ? [name] : (env.PATH || '').split(path.delimiter).map(dir => path.join(dir, name));
  return candidates.find(file => {
    try { fs.accessSync(file, fs.constants.X_OK); return fs.statSync(file).isFile(); }
    catch { return false; }
  });
}
function inspectBrowser(options = {}) {
  const env = options.env || process.env;
  const run = options.runSync || spawnSync;
  let command;
  try { command = options.command || parseCommand(options.setting === undefined ? browserSetting(env) : options.setting); }
  catch (error) { return { ready: false, installable: false, message: error.message }; }
  const executable = executablePath(command[0], env);
  if (!executable) return { ready: false, command, installable: false,
    message: command[0] === 'flatpak'
      ? 'Flatpak is missing. Install or repair Flatpak using your distribution\'s supported tools, or configure an installed native browser with CHROMIUM_CMD.'
      : `Browser executable not found: ${command[0]}. Install that browser or set CHROMIUM_CMD to an installed browser. No system packages were changed.` };
  if (path.basename(command[0]) !== 'flatpak') return { ready: true, command, executable };
  const id = command[1] === 'run' ? command.slice(2).find(arg => !arg.startsWith('-')) : undefined;
  if (!id || !/^[a-zA-Z][\w-]*(\.[\w-]+){2,}$/.test(id)) return { ready: false, command, installable: false,
    message: 'Use a browser command such as flatpak run com.google.Chrome, or an installed native browser executable.' };
  const scope = command.slice(2).find(arg => arg === '--user' || arg === '--system');
  const result = run(executable, ['info', ...(scope ? [scope] : []), id], { env: hostEnvironment(env), encoding: 'utf8', timeout: 10000 });
  if (result.status === 0) return { ready: true, command, executable, id };
  const installable = installableIds.has(id) && scope !== '--system';
  return { ready: false, command, executable, id, installable,
    message: `Browser Flatpak ${id} is not available. ${scope === '--system' ? 'System-scoped installation is not automated; use an installed browser or a user-scoped command.' : installable ? 'It can be installed for your user account from Flathub.' : 'Install it manually or choose a supported browser.'}` };
}
function runCommand(program, args, options = {}) {
  return new Promise((resolve, reject) => {
    let child, timer, settled = false, output = '';
    const finish = error => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error); else resolve();
    };
    child = spawn(program, args, { env: options.env || hostEnvironment(), detached: true,
      stdio: ['ignore', 'pipe', 'pipe'] });
    for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => {
      output = (output + chunk).slice(-8000);
      if (options.onOutput) options.onOutput(String(chunk));
    });
    child.once('error', finish);
    child.once('close', code => finish(code === 0 ? null : new Error(`Command failed (${code}): ${output.slice(-2500)}`)));
    timer = setTimeout(() => {
      try { process.kill(-child.pid, 'SIGKILL'); } catch { /* Already stopped. */ }
      finish(new Error('Dependency check/setup timed out. Retry after checking the connection/session.'));
    }, options.timeout || 600000);
  });
}
async function setupBrowser(options = {}) {
  const env = options.env || process.env;
  const status = inspectBrowser(options);
  if (status.ready) return status;
  if (!options.install || !status.installable) throw new Error(status.message);
  const run = options.runCommand || runCommand;
  const runOptions = { env: hostEnvironment(env), onOutput: options.onOutput };
  await run(status.executable, ['remote-add', '--user', '--if-not-exists', 'flathub',
    'https://flathub.org/repo/flathub.flatpakrepo'], runOptions);
  await run(status.executable, ['install', '--user', '--noninteractive', '-y', 'flathub', status.id], runOptions);
  const after = inspectBrowser(options);
  if (!after.ready) throw new Error(`Browser installation did not produce a usable command. ${after.message}`);
  return after;
}
async function checkRuntime(binary, env = process.env, run = runCommand) {
  if (!env.DISPLAY && !env.WAYLAND_DISPLAY) throw new Error('Run setup from a graphical Desktop Mode session so Electron graphics and sandbox startup can be checked.');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'streamdeck-runtime-check-'));
  try {
    const extra = (env.ELECTRON_EXTRA_FLAGS || '').trim().split(/\s+/).filter(Boolean);
    if (extra.some(flag => flag === '--no-sandbox' || flag.startsWith('--disable-') && flag.includes('sandbox'))) {
      console.warn('Explicit Electron flags disable sandboxing for this probe; this does not verify native sandbox support. No such flag is added automatically.');
    }
    let platform = env.ELECTRON_OZONE_PLATFORM || 'auto';
    if (platform === 'auto') platform = env.DISPLAY ? 'x11' : 'wayland';
    if (!['x11', 'wayland'].includes(platform)) throw new Error('ELECTRON_OZONE_PLATFORM must be auto, x11 or wayland.');
    const probeEnv = { ...env, HOME: tmp, XDG_CONFIG_HOME: path.join(tmp, 'config'),
      XDG_CACHE_HOME: path.join(tmp, 'cache'), XDG_DATA_HOME: path.join(tmp, 'data') };
    // X11 falls back to HOME/.Xauthority. Keep the session's cookie path while
    // isolating Electron's profile, without copying or changing the authority file.
    if (platform === 'x11' && env.XAUTHORITY === undefined) {
      probeEnv.XAUTHORITY = path.join(env.HOME || os.homedir(), '.Xauthority');
    }
    delete probeEnv.ELECTRON_RUN_AS_NODE;
    delete probeEnv.LD_PRELOAD;
    // This is the bundled app, so retain its AppImage library search path.
    await run(binary, ['--enable-sandbox', '--streamdeck-runtime-probe', `--ozone-platform=${platform}`, ...extra], {
      env: probeEnv, timeout: 30000
    });
  } catch (error) {
    throw new Error(`Electron graphics/sandbox startup failed. No security settings were changed. Check your supported desktop/session and OS setup.\n${error.message}`);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}
module.exports = { defaultCommand, defaultBrowserId, hostEnvironment, profileDirectory,
  browserSetting, parseCommand, executablePath, inspectBrowser, setupBrowser, checkRuntime, runCommand };
