const { execFile } = require('child_process');
const { hostEnvironment, executablePath } = require('./browser-dependencies');
function capability(adapter, env = process.env) {
  if (!adapter) return { available: false, detail: 'Choose a supported browser family for controller return.' };
  if (!env.DISPLAY || !executablePath('xprop', env)) return { available: false, detail: 'Browser B-return requires X11/XWayland and xprop. Native Wayland focus control is unavailable.' };
  return { available: true, detail: 'B can return from the configured browser on X11/XWayland. The browser stays open. Native controller/Steam Input acceptance still needs device testing.' };
}
function query(args, env) {
  return new Promise((resolve, reject) => execFile('xprop', args, { env: hostEnvironment(env),
    timeout: 1000, maxBuffer: 8192, encoding: 'utf8' }, (error, stdout) => error ? reject(new Error('Foreground window identity unavailable')) : resolve(stdout)));
}
async function foregroundBrowser(adapter, env = process.env, read = args => query(args, env)) {
  if (!capability(adapter, env).available) return false;
  const active = await read(['-root', '_NET_ACTIVE_WINDOW']);
  const match = /#\s*(0x[0-9a-f]+)/i.exec(active);
  if (!match || /^0x0+$/.test(match[1])) return false;
  const classes = await read(['-id', match[1], 'WM_CLASS', '_NET_WM_STATE']);
  if (!/\b_NET_WM_STATE_FOCUSED\b/.test(classes)) return false;
  const names = [...classes.matchAll(/"([a-zA-Z0-9 ._-]{1,100})"/g)].map(x => x[1].toLowerCase());
  if (!names.some(name => adapter.classes.includes(name))) return false;
  // Do not steal focus if it changed while the class query was in flight.
  return (await read(['-root', '_NET_ACTIVE_WINDOW'])).match(/#\s*(0x[0-9a-f]+)/i)?.[1] === match[1];
}
module.exports = { capability, foregroundBrowser };
