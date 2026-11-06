const fs = require('fs');
const os = require('os');
const path = require('path');
const { setupSteam, discover } = require('../setup/steam');
const vdf = require('../setup/binary-vdf');
let tmp, env, root, store, launcher, database;
const str = (key, value) => Buffer.concat([Buffer.from([1]), Buffer.from(key + '\0' + value + '\0')]);
const integer = (key, value) => { const n = Buffer.alloc(4); n.writeUInt32LE(value); return Buffer.concat([Buffer.from([2]), Buffer.from(key + '\0'), n]); };
const object = (key, values) => Buffer.concat([Buffer.from([0]), Buffer.from(key + '\0'), ...values, Buffer.from([8])]);
// Independently encoded realistic Valve binary KeyValues, including unrelated
// launch options/tags and a raw float field which must survive byte-for-byte.
const original = () => Buffer.concat([object('shortcuts', [object('0', [integer('appid', 0x80000011),
  str('appname', 'Other game'), str('exe', '"/games/Existing Game/run"'), str('StartDir', '"/games/Existing Game"'),
  str('LaunchOptions', '--profile existing'), object('tags', [str('0', 'Favourites')]),
  Buffer.concat([Buffer.from([3]), Buffer.from('customfloat\0'), Buffer.from([1, 2, 192, 127])])])]), Buffer.from([8])]);
function account(base, id) {
  const config = path.join(base, 'userdata', id, 'config'); fs.mkdirSync(config, { recursive: true }); return path.join(config, 'shortcuts.vdf');
}
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'steam-fixture-'));
  env = { HOME: path.join(tmp, 'home'), XDG_CONFIG_HOME: path.join(tmp, 'config') };
  root = path.join(env.HOME, '.local/share/Steam'); store = path.join(tmp, 'state');
  database = account(root, '123'); fs.writeFileSync(database, original());
  const folder = path.join(tmp, "Launcher's Ω folder"); fs.mkdirSync(folder);
  launcher = path.join(folder, 'StreamDeckLauncher.sh'); fs.writeFileSync(launcher, '#!/bin/sh\nexit 0\n', { mode: 0o755 });
});
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));
const setup = extra => setupSteam({ env, storeDir: store, launcher, steamRunning: () => false, ...extra });
const entries = () => vdf.field(vdf.parse(fs.readFileSync(database)), 'shortcuts').value;
const get = (entry, name) => vdf.field(entry.value, name)?.value;
test('codec round-trips independent bytes and implements the standard CRC32 vector', () => {
  expect(vdf.encode(vdf.parse(original()))).toEqual(original()); expect(vdf.crc32('123456789')).toBe(0xcbf43926);
});
test('adds a quoted non-ASCII shortcut, backs up first, preserves unrelated raw data and repeats without rewriting', () => {
  const before = entries()[0].raw; const result = setup();
  expect(result.state).toBe('installed'); expect(result.changed).toBe(true);
  expect(entries()[0].raw).toEqual(before);
  expect(get(entries()[1], 'exe')).toBe(`"${launcher}"`);
  expect(get(entries()[1], 'StartDir')).toBe(`"${path.dirname(launcher)}"`);
  const backups = fs.readdirSync(path.join(store, 'steam-backups'));
  expect(backups).toHaveLength(1); expect(fs.readFileSync(path.join(store, 'steam-backups', backups[0]))).toEqual(original());
  expect(fs.statSync(path.join(store, 'steam-backups', backups[0])).mode & 0o777).toBe(0o600);
  const bytes = fs.readFileSync(database); expect(setup().changed).toBe(false); expect(fs.readFileSync(database)).toEqual(bytes);
  expect(fs.readdirSync(path.join(store, 'steam-backups'))).toHaveLength(1);
});
test('updates its owned executable while retaining Steam app ID and unrelated entries', () => {
  const first = setup(); const next = path.join(tmp, 'new launcher'); fs.copyFileSync(launcher, next);
  const result = setup({ launcher: next }); expect(result.state).toBe('installed'); expect(result.appid).toBe(first.appid);
  expect(entries()).toHaveLength(2); expect(get(entries()[1], 'exe')).toBe(`"${next}"`);
  expect(get(entries()[0], 'LaunchOptions')).toBe('--profile existing');
});
test('adopts an exact existing shortcut without stripping custom browser/profile options or artwork', () => {
  const node = { type: 0, name: '1', value: [] };
  for (const [key, val, type] of [['appid', 0x80000022, 2], ['appname', 'Stream Deck Launcher', 1], ['exe', `"${launcher}"`, 1],
    ['StartDir', '"/my/custom working directory"', 1], ['LaunchOptions', '--profile ./relative-profile', 1], ['icon', '/my/art.png', 1]]) vdf.set(node.value, key, val, type);
  const nodes = vdf.parse(original()), top = vdf.field(nodes, 'shortcuts'); delete top.raw; top.value.push(node); fs.writeFileSync(database, vdf.encode(nodes));
  expect(setup({ icon: '/new/icon.png' }).state).toBe('installed');
  expect(entries()).toHaveLength(2); expect(get(entries()[1], 'LaunchOptions')).toBe('--profile ./relative-profile');
  expect(get(entries()[1], 'StartDir')).toBe('"/my/custom working directory"');
  expect(get(entries()[1], 'icon')).toBe('/my/art.png');
});
test('preserves a user-edited working directory while updating an owned launcher path', () => {
  setup(); const nodes = vdf.parse(fs.readFileSync(database)), top = vdf.field(nodes, 'shortcuts'); delete top.raw;
  const owned = top.value[1]; delete owned.raw; vdf.set(owned.value, 'StartDir', '"/keep/my/working-directory"');
  fs.writeFileSync(database, vdf.encode(nodes));
  const next = path.join(tmp, 'next launcher'); fs.copyFileSync(launcher, next);
  expect(setup({ launcher: next }).state).toBe('installed');
  expect(get(entries()[1], 'StartDir')).toBe('"/keep/my/working-directory"');
});
test('refuses to write while Steam is running or starts before commit', () => {
  expect(setup({ steamRunning: () => true }).state).toBe('steam-running'); expect(fs.readFileSync(database)).toEqual(original());
  let running = false;
  expect(setup({ steamRunning: () => running, beforeCommit: () => { running = true; } }).state).toBe('steam-running');
  expect(fs.readFileSync(database)).toEqual(original());
  expect(fs.existsSync(path.join(path.dirname(database), '.streamdeck-shortcuts.lock'))).toBe(false);
});
test('refuses a concurrently changed database instead of overwriting it', () => {
  const other = Buffer.concat([object('shortcuts', []), Buffer.from([8])]);
  const result = setup({ beforeCommit: () => fs.writeFileSync(database, other) });
  expect(result.state).toBe('error'); expect(result.detail).toContain('changed during'); expect(fs.readFileSync(database)).toEqual(other);
});
test.each([Buffer.from([0, 1, 2]), Buffer.from([5, 0, 8])])('does not repair or overwrite unsupported/truncated input', bytes => {
  fs.writeFileSync(database, bytes); expect(setup().state).toBe('error'); expect(fs.readFileSync(database)).toEqual(bytes);
});
test('does not follow a symlinked database or overwrite its target', () => {
  const target = path.join(tmp, 'private'); fs.writeFileSync(target, original()); fs.unlinkSync(database); fs.symlinkSync(target, database);
  expect(setup().state).toBe('error'); expect(fs.readFileSync(target)).toEqual(original());
});
test('deduplicates root aliases and leaves sandboxed Flatpak Steam untouched with a clear status', () => {
  fs.mkdirSync(path.join(env.HOME, '.steam')); fs.symlinkSync(root, path.join(env.HOME, '.steam/steam'));
  expect(discover(env)).toHaveLength(1);
  fs.rmSync(path.join(env.HOME, '.steam'), { recursive: true }); fs.rmSync(root, { recursive: true });
  root = path.join(env.HOME, '.var/app/com.valvesoftware.Steam/.local/share/Steam'); database = account(root, '456');
  fs.writeFileSync(database, original());
  expect(setup().state).toBe('unsupported-flatpak'); expect(fs.readFileSync(database)).toEqual(original());
  expect(discover(env)[0].kind).toBe('flatpak');
  fs.mkdirSync(path.join(env.HOME, '.steam')); fs.symlinkSync(root, path.join(env.HOME, '.steam/steam'));
  expect(discover(env)).toHaveLength(1); expect(setup().state).toBe('unsupported-flatpak');
});
test('requires genuine account choice, then remembers it and leaves other accounts alone', () => {
  const other = account(root, '456'); fs.writeFileSync(other, original());
  const pending = setup(); expect(pending.state).toBe('selection-required');
  const selected = pending.choices.find(c => c.account === '456');
  expect(setup({ selection: selected.id }).state).toBe('installed'); expect(setup().state).toBe('installed');
  expect(fs.readFileSync(database)).toEqual(original()); expect(vdf.field(vdf.parse(fs.readFileSync(other)), 'shortcuts').value).toHaveLength(2);
});
test('uses one explicit most-recent account and rejects stale selection tokens', () => {
  const other = account(root, '456'); fs.mkdirSync(path.join(root, 'config'));
  fs.writeFileSync(path.join(root, 'config/loginusers.vdf'), '"users" { "76561197960266184" { "PersonaName" "Fixture User" "MostRecent" "1" } }');
  expect(setup({ selection: 'unrecognised' }).state).toBe('selection-required');
  expect(setup().state).toBe('installed'); expect(fs.existsSync(other)).toBe(true); expect(fs.readFileSync(database)).toEqual(original());
});
test('serializes concurrent setup attempts with a private lock', () => {
  let nested;
  const outer = setup({ beforeCommit: () => { nested = setup(); } });
  expect(outer.state).toBe('installed'); expect(nested.state).toBe('busy');
  expect(entries()).toHaveLength(2); expect(fs.existsSync(path.join(store, '.steam-integration.lock'))).toBe(false);
});
