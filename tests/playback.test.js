const { PlaybackMonitor, createReader, checkPlaybackTools } = require('../setup/playback');
const { browserAdapter } = require('../setup/browser-adapters');
const flush = () => new Promise(resolve => setImmediate(resolve));
let monitor, reader, blocker;
beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['setImmediate'] });
  reader = { names: jest.fn(async () => ['org.mpris.MediaPlayer2.chromium.instance7']),
    player: jest.fn(async () => ({ identity: 'Chromium', status: 'Playing' })) };
  blocker = { start: jest.fn(() => 12), stop: jest.fn() };
});
afterEach(() => { if (monitor) monitor.stop(); monitor = undefined; jest.useRealTimers(); });
async function start(command = 'flatpak run io.github.ungoogled_software.ungoogled_chromium') {
  monitor = new PlaybackMonitor({ adapter: browserAdapter(command), reader, blocker });
  monitor.start(); await flush(); return monitor;
}
test('holds one inhibitor for fresh browser playback, including a previously existing browser', async () => {
  await start(); expect(blocker.start).toHaveBeenCalledWith('prevent-display-sleep');
  await jest.advanceTimersByTimeAsync(7500);
  expect(blocker.start).toHaveBeenCalledTimes(1);
  expect(monitor.status).toMatchObject({ state: 'playing', blocking: true, scope: 'browser-wide' });
});
test.each(['Paused', 'Stopped'])('releases on %s and reacquires on resumed playback', async status => {
  await start(); reader.player.mockResolvedValue({ identity: 'Chromium', status });
  await jest.advanceTimersByTimeAsync(2500); expect(blocker.stop).toHaveBeenCalledWith(12);
  expect(monitor.status.blocking).toBe(false);
  reader.player.mockResolvedValue({ identity: 'Chromium', status: 'Playing' });
  await jest.advanceTimersByTimeAsync(2500); expect(blocker.start).toHaveBeenCalledTimes(2);
});
test('requires a matched application identity and ignores unrelated players', async () => {
  reader.names.mockResolvedValue(['org.mpris.MediaPlayer2.spotify', 'org.mpris.MediaPlayer2.chromium.instance8']);
  reader.player.mockResolvedValue({ identity: 'Google Chrome', status: 'Playing' });
  await start(); expect(blocker.start).not.toHaveBeenCalled();
  expect(reader.player).toHaveBeenCalledTimes(1);
});
test('unsupported custom browser does not observe every player', async () => {
  await start('/opt/my-custom-wrapper');
  expect(monitor.status.state).toBe('unsupported'); expect(reader.names).not.toHaveBeenCalled();
  expect(blocker.start).not.toHaveBeenCalled();
});
test('aggregates multiple players and releases when the last playing owner disappears', async () => {
  reader.names.mockResolvedValue(['org.mpris.MediaPlayer2.chromium.instance7', 'org.mpris.MediaPlayer2.chromium.instance8']);
  reader.player.mockImplementation(async name => ({ identity: 'Chromium', status: name.endsWith('7') ? 'Paused' : 'Playing' }));
  await start(); expect(blocker.start).toHaveBeenCalledTimes(1);
  reader.names.mockResolvedValue(['org.mpris.MediaPlayer2.chromium.instance7']);
  await jest.advanceTimersByTimeAsync(2500); expect(monitor.status.state).toBe('idle');
  expect(blocker.stop).toHaveBeenCalledTimes(1);
});
test('detects delayed registration and reconnects after bus failure without retaining stale inhibition', async () => {
  reader.names.mockResolvedValue([]); await start(); expect(monitor.status.state).toBe('waiting');
  reader.names.mockResolvedValue(['org.mpris.MediaPlayer2.chromium.instance7']);
  await jest.advanceTimersByTimeAsync(2500); expect(monitor.status.blocking).toBe(true);
  reader.names.mockRejectedValue(new Error('disconnected'));
  await jest.advanceTimersByTimeAsync(2500); expect(monitor.status.state).toBe('unavailable'); expect(monitor.status.blocking).toBe(false);
  reader.names.mockResolvedValue(['org.mpris.MediaPlayer2.chromium.instance7']);
  await jest.advanceTimersByTimeAsync(2500); expect(monitor.status.blocking).toBe(true);
});
test('queries do not overlap; expired and shutdown observations cannot restart the inhibitor', async () => {
  await start(); let resolve;
  reader.player.mockImplementation(() => new Promise(r => { resolve = r; }));
  await jest.advanceTimersByTimeAsync(2500);
  const calls = reader.names.mock.calls.length;
  await jest.advanceTimersByTimeAsync(8000);
  expect(reader.names).toHaveBeenCalledTimes(calls); expect(monitor.status.blocking).toBe(false);
  monitor.stop(); resolve({ identity: 'Chromium', status: 'Playing' }); await flush();
  expect(blocker.start).toHaveBeenCalledTimes(1); expect(jest.getTimerCount()).toBe(0);
});
test('a failed player observation releases a prior blocker', async () => {
  await start(); reader.player.mockRejectedValue(new Error('timed out'));
  await jest.advanceTimersByTimeAsync(2500); expect(monitor.status.state).toBe('unavailable');
  expect(monitor.status.blocking).toBe(false);
});
test('structured reader pins owner identity and never requests media metadata', async () => {
  const args = [];
  const call = jest.fn(async command => {
    args.push(command);
    if (command.includes('org.freedesktop.DBus.ListNames')) return "(['org.mpris.MediaPlayer2.chromium.instance7'],)";
    if (command.includes('org.freedesktop.DBus.GetNameOwner')) return "(':1.7',)";
    return command.at(-1) === 'Identity' ? "(<'Chromium'>,)" : "(<'Playing'>,)";
  });
  const r = createReader({}, call); const names = await r.names();
  expect(await r.player(names[0])).toEqual({ identity: 'Chromium', status: 'Playing' });
  expect(args.some(a => a.some(v => /Metadata|xesam|trackid/.test(v)))).toBe(false);
  expect(args.filter(a => a.includes('org.freedesktop.DBus.Properties.Get')).every(a => a[1] === ':1.7')).toBe(true);
});
test('reader rejects a player whose bus owner changes during the query', async () => {
  let owners = 0;
  const r = createReader({}, async args => args.includes('org.freedesktop.DBus.GetNameOwner')
    ? `(':1.${++owners}',)` : args.at(-1) === 'Identity' ? "(<'Chromium'>,)" : "(<'Playing'>,)");
  await expect(r.player('org.mpris.MediaPlayer2.chromium.instance7')).rejects.toThrow('changed');
});
test('missing host transport is actionable and does not install software', async () => {
  await expect(checkPlaybackTools({ PATH: '/missing/streamdeck-tools' })).rejects.toThrow('requires gdbus');
});
