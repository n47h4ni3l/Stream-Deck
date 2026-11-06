const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const vdf = require('./binary-vdf');
const { profileDirectory } = require('./browser-dependencies');
const appName = 'Stream Deck Launcher';
const steamBase = 76561197960265728n;
const within = (root, child) => child.startsWith(root + path.sep);
const hash = data => crypto.createHash('sha256').update(data).digest('hex');

function textVdf(text) {
  if (text.length > 1024 * 1024) throw new Error('Steam account file is too large');
  const tokens = text.match(/\/\/[^\n]*|"(?:\\.|[^"\\])*"|[{}]|[^\s{}"]+/g) || [];
  let pos = 0;
  function object(nested = false, depth = 0) {
    if (depth > 8) throw new Error('Steam account nesting limit');
    const data = Object.create(null);
    while (pos < tokens.length) {
      let key = tokens[pos++]; if (key.startsWith('//')) continue;
      if (key === '}') { if (!nested) throw new Error('Unexpected account terminator'); return data; }
      key = key.startsWith('"') ? JSON.parse(key) : key;
      if (Object.hasOwn(data, key)) throw new Error('Duplicate account key');
      const value = tokens[pos++];
      if (!value) throw new Error('Missing account value');
      data[key] = value === '{' ? object(true, depth + 1) : value.startsWith('"') ? JSON.parse(value) : value;
    }
    if (nested) throw new Error('Incomplete account object');
    return data;
  }
  return object();
}
function discover(env = process.env) {
  const home = env.HOME || os.homedir(), roots = new Map(), choices = [];
  for (const [candidate, kind] of [[path.join(home, '.local/share/Steam'), 'native'], [path.join(home, '.steam/steam'), 'native'],
    [path.join(home, '.steam/root'), 'native'], [path.join(home, '.var/app/com.valvesoftware.Steam/.local/share/Steam'), 'flatpak']]) {
    try {
      const root = fs.realpathSync(candidate);
      if (fs.statSync(root).isDirectory() && (kind === 'flatpak' || !roots.has(root))) roots.set(root, kind);
    } catch { /* Not installed here. */ }
  }
  for (const [root, kind] of roots) {
    let accounts = {}, users;
    try { accounts = textVdf(fs.readFileSync(path.join(root, 'config/loginusers.vdf'), 'utf8')).users || {}; } catch { /* Ambiguity requires selection. */ }
    try { users = fs.readdirSync(path.join(root, 'userdata'), { withFileTypes: true }); } catch { continue; }
    for (const user of users) {
      if (!user.isDirectory() || !/^[1-9]\d{0,9}$/.test(user.name) || BigInt(user.name) > 4294967295n) continue;
      const account = path.join(root, 'userdata', user.name);
      try { if (!within(root, fs.realpathSync(account))) continue; } catch { continue; }
      const info = accounts[String(steamBase + BigInt(user.name))] || {};
      choices.push({ id: hash(root + ':' + user.name).slice(0, 20), root, kind, account: user.name,
        label: [...String(info.PersonaName || info.AccountName || `Account ${user.name}`)].filter(c => c.charCodeAt(0) >= 32).join(''),
        recent: info.MostRecent === '1', config: path.join(account, 'config') });
    }
  }
  return choices;
}
function steamRunning() {
  try {
    for (const pid of fs.readdirSync('/proc')) {
      if (!/^\d+$/.test(pid)) continue;
      try {
        if (typeof process.getuid === 'function' && fs.statSync(`/proc/${pid}`).uid !== process.getuid()) continue;
        if (/^(steam|steamwebhelper|steam\.sh)$/i.test(fs.readFileSync(`/proc/${pid}/comm`, 'utf8').trim())) return true;
      } catch (error) { if (!['ENOENT', 'ESRCH'].includes(error.code)) return true; }
    }
    return false;
  } catch { return true; }
}
function readManifest(file) {
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 512 * 1024) throw new Error('Steam integration state is not a supported regular file');
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (data.version !== 1 || !data.entries || typeof data.entries !== 'object' || Array.isArray(data.entries)) throw new Error('Invalid Steam integration state');
    return data;
  } catch (error) { if (error.code === 'ENOENT') return { version: 1, entries: {} }; throw error; }
}
function atomicJson(file, value) {
  const tmp = file + '.' + crypto.randomBytes(6).toString('hex') + '.tmp';
  try { fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', { mode: 0o600, flag: 'wx' }); fs.renameSync(tmp, file); }
  finally { try { fs.unlinkSync(tmp); } catch { /* Already renamed. */ } }
}
function quoteExecutable(file) {
  // Steam's executable field is a quoted path, not a shell program. Reject paths
  // the client cannot represent unambiguously rather than inventing shell code.
  if (!path.isAbsolute(file) || file.includes('"') || [...file].some(c => c.charCodeAt(0) < 32)) throw new Error('Steam executable paths must be absolute and cannot contain quotes/control characters');
  return `"${file}"`;
}
const value = (nodes, name) => { const node = vdf.field(nodes, name); return node && node.value; };
function shortcutList(nodes) {
  const root = vdf.field(nodes, 'shortcuts');
  if (!root || root.type !== 0 || nodes.length !== 1 || root.value.some(node => node.type !== 0 || !/^\d+$/.test(node.name))) throw new Error('Unsupported Steam shortcut structure');
  if (new Set(root.value.map(node => node.name)).size !== root.value.length) throw new Error('Duplicate Steam shortcut indices');
  for (const entry of root.value) {
    const names = entry.value.map(node => node.name.toLowerCase());
    if (new Set(names).size !== names.length || vdf.field(entry.value, 'appid')?.type !== 2 ||
      vdf.field(entry.value, 'appname')?.type !== 1 || vdf.field(entry.value, 'exe')?.type !== 1) throw new Error('Ambiguous Steam shortcut fields');
  }
  if (new Set(root.value.map(node => value(node.value, 'appid'))).size !== root.value.length) throw new Error('Duplicate Steam shortcut IDs');
  return root;
}
function acquireLock(file) {
  let fd;
  try { fd = fs.openSync(file, 'wx', 0o600); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw error;
    let old;
    try { old = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { throw error; }
    let alive = true;
    if (Number.isInteger(old.pid) && old.pid > 0) {
      try { process.kill(old.pid, 0); } catch (e) { if (e.code === 'ESRCH') alive = false; }
    }
    if (old.owner !== 'streamdeck' || alive || Date.now() - old.created < 30000 || fs.lstatSync(file).ino !== stat.ino) throw error;
    fs.unlinkSync(file); fd = fs.openSync(file, 'wx', 0o600);
  }
  const lock = { fd, file, ino: fs.fstatSync(fd).ino };
  try { fs.writeFileSync(fd, JSON.stringify({ owner: 'streamdeck', pid: process.pid, created: Date.now() })); }
  catch (error) { releaseLock(lock); throw error; }
  return lock;
}
function releaseLock(lock) {
  try { fs.closeSync(lock.fd); }
  finally { try { if (fs.lstatSync(lock.file).ino === lock.ino) fs.unlinkSync(lock.file); } catch { /* Replaced/removed; never remove another lock. */ } }
}
function result(state, detail, choices, extra = {}) {
  return { state, detail, choices: choices.map(({ id, label, root, account, kind }) => ({ id, label, root, account, kind })), ...extra };
}
function setupSteam(options = {}) {
  const env = options.env || process.env, choices = discover(env);
  const running = options.steamRunning || steamRunning;
  const store = options.storeDir || profileDirectory(env), manifestFile = path.join(store, 'steam-shortcuts.json');
  const locks = []; let temp;
  try {
    if (!choices.length) return result('not-found', 'No native/Flatpak Steam account was found. Start Steam and sign in, quit it, then retry here.', choices);
    fs.mkdirSync(store, { recursive: true });
    locks.push(acquireLock(path.join(store, '.steam-integration.lock')));
    const manifest = readManifest(manifestFile);
    let selected = choices.find(c => c.id === options.selection);
    if (options.selection && !selected) return result('selection-required', 'The chosen Steam account is no longer available.', choices);
    if (!selected) selected = choices.find(c => c.id === manifest.lastSelection);
    if (!selected && choices.length === 1) selected = choices[0];
    const recent = choices.filter(c => c.recent);
    if (!selected && recent.length === 1) selected = recent[0];
    if (!selected) return result('selection-required', 'Choose the Steam account/installation to receive this shortcut.', choices);
    // Stock Flatpak Steam cannot access this host installation or invoke host
    // processes. Do not create a shortcut that only looks installed, or broaden
    // its filesystem/session-bus permissions to make it work.
    if (selected.kind === 'flatpak') return result('unsupported-flatpak',
      'Flatpak Steam is sandboxed and cannot launch this host app with its default permissions. Automatic shortcuts currently require native Steam. No Steam files or security settings were changed.', choices);
    const executable = quoteExecutable(options.launcher || '');
    fs.accessSync(options.launcher, fs.constants.X_OK);
    if (!fs.statSync(options.launcher).isFile()) throw new Error('Launcher target is not a file');
    fs.mkdirSync(selected.config, { recursive: true });
    if (!within(selected.root, fs.realpathSync(selected.config))) throw new Error('Steam config escapes the selected installation');
    if (typeof process.getuid === 'function' && fs.statSync(selected.config).uid !== process.getuid()) throw new Error('Steam config belongs to another user');
    const database = path.join(selected.config, 'shortcuts.vdf');
    let original = null, mode = 0o600;
    try {
      const stat = fs.lstatSync(database);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 16 * 1024 * 1024) throw new Error('Steam shortcuts database is not a supported regular file');
      original = fs.readFileSync(database); mode = stat.mode & 0o777;
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const nodes = original ? vdf.parse(original) : [{ type: 0, name: 'shortcuts', value: [] }];
    if (original && !vdf.encode(nodes).equals(original)) throw new Error('Steam database did not round-trip safely');
    const root = shortcutList(nodes), owned = manifest.entries[selected.id];
    let entry = owned && root.value.find(node => value(node.value, 'appid') === owned.appid && value(node.value, 'exe') === owned.exe);
    if (!entry) {
      const exact = root.value.filter(node => value(node.value, 'appname') === appName && value(node.value, 'exe') === executable);
      if (exact.length > 1) return result('conflict', 'Multiple identical launcher shortcuts exist; keep the intended one in Steam, quit Steam and retry.', choices);
      entry = exact[0];
    }
    if (!entry && root.value.some(node => value(node.value, 'appname') === appName)) {
      return result('conflict', 'A different shortcut with this name exists. Rename it in Steam if it should be kept, then quit Steam and retry.', choices);
    }
    const launchOptions = options.launchOptions || '';
    let appid;
    if (!entry) {
      appid = (vdf.crc32(executable + appName) | 0x80000000) >>> 0;
      if (root.value.some(node => value(node.value, 'appid') === appid)) throw new Error('Steam shortcut ID collision; no changes made');
      const index = root.value.reduce((max, node) => Math.max(max, Number(node.name)), -1) + 1;
      entry = { type: 0, name: String(index), value: [] };
      for (const [name, val, type] of [['appid', appid, 2], ['appname', appName, 1], ['exe', executable, 1],
        ['StartDir', quoteExecutable(path.dirname(options.launcher)), 1], ['icon', options.icon || '', 1], ['ShortcutPath', '', 1],
        ['LaunchOptions', launchOptions, 1], ['IsHidden', 0, 2], ['AllowDesktopConfig', 1, 2], ['AllowOverlay', 1, 2],
        ['OpenVR', 0, 2], ['Devkit', 0, 2], ['DevkitGameID', '', 1], ['LastPlayTime', 0, 2]]) vdf.set(entry.value, name, val, type);
      entry.value.push({ type: 0, name: 'tags', value: [] }); root.value.push(entry);
    } else {
      appid = value(entry.value, 'appid');
      if (!Number.isInteger(appid)) throw new Error('Existing Steam shortcut ID is invalid');
      const desired = [['exe', executable]];
      // Relative custom launch options depend on StartDir. Change it only when
      // it is absent or still matches our previously recorded default.
      if (value(entry.value, 'StartDir') === undefined || owned && value(entry.value, 'StartDir') === owned.startDir) {
        desired.push(['StartDir', quoteExecutable(path.dirname(options.launcher))]);
      }
      for (const [name, val] of desired) if (value(entry.value, name) !== val) { vdf.set(entry.value, name, val); delete entry.raw; }
      if (owned && value(entry.value, 'icon') === owned.icon && owned.icon !== (options.icon || '')) {
        vdf.set(entry.value, 'icon', options.icon || ''); delete entry.raw;
      }
      if (owned && value(entry.value, 'LaunchOptions') === owned.launchOptions && owned.launchOptions !== launchOptions) {
        vdf.set(entry.value, 'LaunchOptions', launchOptions); delete entry.raw;
      }
    }
    delete root.raw;
    const updated = vdf.encode(nodes);
    vdf.parse(updated);
    const unchanged = original && original.equals(updated);
    if (!unchanged) {
      if (running()) return result('steam-running', 'Quit Steam completely, then choose Retry Steam setup. The running client database was not changed.', choices);
      locks.push(acquireLock(path.join(selected.config, '.streamdeck-shortcuts.lock')));
      const backupDir = path.join(store, 'steam-backups'); fs.mkdirSync(backupDir, { recursive: true });
      if (original) fs.writeFileSync(path.join(backupDir, `${selected.id}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.vdf`), original, { mode: 0o600, flag: 'wx' });
      temp = database + '.streamdeck-' + crypto.randomBytes(6).toString('hex') + '.tmp';
      const fd = fs.openSync(temp, 'wx', mode);
      try { fs.writeFileSync(fd, updated); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
      if (!fs.readFileSync(temp).equals(updated)) throw new Error('Steam staging verification failed');
      if (options.beforeCommit) options.beforeCommit();
      if (running()) return result('steam-running', 'Steam started during setup; no database changes were committed. Quit it and retry.', choices);
      let current = null;
      try { current = fs.readFileSync(database); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (Boolean(current) !== Boolean(original) || current && !current.equals(original)) throw new Error('Steam database changed during setup; retry after Steam exits');
      if (original) fs.renameSync(temp, database);
      else { fs.linkSync(temp, database); fs.unlinkSync(temp); }
      temp = null;
    }
    manifest.entries[selected.id] = { appid, exe: executable, launchOptions, icon: options.icon || '',
      startDir: quoteExecutable(path.dirname(options.launcher)), name: value(entry.value, 'appname') };
    manifest.lastSelection = selected.id; atomicJson(manifestFile, manifest);
    return result('installed', unchanged ? 'The stored Steam shortcut is already current.' : 'Steam shortcut added/updated. Start Steam to see it in your library.', choices,
      { selection: selected.id, appid, changed: !unchanged });
  } catch (error) {
    return result(error.code === 'EEXIST' ? 'busy' : 'error', error.code === 'EEXIST' ? 'Another setup is updating Steam; wait and retry.' : error.message, choices);
  } finally {
    if (temp) try { fs.unlinkSync(temp); } catch { /* Own staging file only. */ }
    for (const lock of locks.reverse()) releaseLock(lock);
  }
}
module.exports = { setupSteam, discover, steamRunning, textVdf, quoteExecutable };
