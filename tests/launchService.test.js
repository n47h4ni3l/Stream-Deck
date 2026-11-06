const fs = require('fs');
const path = require('path');

jest.mock('electron', () => {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sd-test-'));
  return {
    app: { getPath: () => tmpDir },
    BrowserWindow: jest.fn(),
    ipcMain: { on: jest.fn(), handle: jest.fn() },
    powerSaveBlocker: { start: jest.fn(), stop: jest.fn(), isStarted: jest.fn() }
  };
});

jest.mock('child_process', () => {
  const { EventEmitter } = require('events');
  const spawn = jest.fn(() => Object.assign(new EventEmitter(), { unref: jest.fn() }));
  return { spawn };
});

let launcher, spawn, profile, originalCommand;
const child = () => spawn.mock.results.at(-1).value;
const saved = () => JSON.parse(fs.readFileSync(launcher.usageFile, 'utf8'));

beforeEach(() => {
  originalCommand = process.env.CHROMIUM_CMD;
  delete process.env.CHROMIUM_CMD;
  jest.resetModules();
  profile = require('electron').app.getPath('userData');
  launcher = require('../main');
  spawn = require('child_process').spawn;
});

afterEach(() => {
  if (originalCommand === undefined) delete process.env.CHROMIUM_CMD;
  else process.env.CHROMIUM_CMD = originalCommand;
  fs.rmSync(profile, { recursive: true, force: true });
  jest.restoreAllMocks();
});

it('loads persisted packaged browser settings and writes logs in the user profile', () => {
  fs.writeFileSync(path.join(profile, 'browser_cmd'), '"/opt/My Browser/chrome" --incognito\n');
  jest.isolateModules(() => {
    const { chromiumCommand, logFile, logError } = require('../main');
    expect(chromiumCommand).toEqual(['/opt/My Browser/chrome', '--incognito']);
    expect(logFile).toBe(path.join(profile, 'log.txt'));
    logError('packaged log check');
    expect(fs.readFileSync(logFile, 'utf8')).toContain('packaged log check');
  });
});

it('spawns chromium with the correct URL and detaches the child', () => {
  launcher.launchService('Netflix');
  expect(spawn).toHaveBeenCalledWith(
    launcher.chromiumCommand[0],
    expect.arrayContaining(['--kiosk', launcher.services.Netflix]),
    expect.objectContaining({ detached: true, stdio: 'ignore' })
  );
  expect(child().unref).toHaveBeenCalledTimes(1);
});

it('counts and persists usage only after the child starts, retaining a successful exit', () => {
  launcher.launchService('Hulu');
  expect(launcher.usageData.Hulu).toBeUndefined();
  expect(fs.existsSync(launcher.usageFile)).toBe(false);
  child().emit('spawn');
  expect(launcher.usageData.Hulu).toBe(1);
  expect(saved().Hulu).toBe(1);
  child().emit('spawn');
  child().emit('exit', 0);
  expect(saved().Hulu).toBe(1);
});

it('handles synchronous spawn errors without recording usage', () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  spawn.mockImplementation(() => { throw new Error('fail'); });
  const event = { sender: { send: jest.fn() } };
  expect(() => launcher.launchService('Netflix', event)).not.toThrow();
  expect(event.sender.send).toHaveBeenCalledWith('launch-service-error', 'Netflix');
  expect(launcher.usageData.Netflix).toBeUndefined();
  expect(fs.existsSync(launcher.usageFile)).toBe(false);
});

it('does not count an asynchronous spawn error or allow a later spawn to count it', () => {
  const event = { sender: { send: jest.fn() } };
  launcher.launchService('Netflix', event);
  child().emit('error', new Error('ENOENT'));
  child().emit('spawn');
  expect(event.sender.send).toHaveBeenCalledTimes(1);
  expect(launcher.usageData.Netflix).toBeUndefined();
  expect(fs.existsSync(launcher.usageFile)).toBe(false);
});

it.each(['error', 'exit'])('rolls back a counted launch on asynchronous %s failure', failure => {
  launcher.usageData.Netflix = 4;
  const event = { sender: { send: jest.fn() } };
  launcher.launchService('Netflix', event);
  child().emit('spawn');
  expect(saved().Netflix).toBe(5);
  if (failure === 'error') child().emit('error', new Error('runtime failure'));
  else child().emit('exit', 1);
  expect(saved().Netflix).toBe(4);
  expect(event.sender.send).toHaveBeenCalledTimes(1);
});

it('rolls back only the failed launch and reports duplicate failure events once', () => {
  launcher.usageData.Netflix = 4;
  const event = { sender: { send: jest.fn() } };
  launcher.launchService('Netflix', event);
  const failed = child();
  failed.emit('spawn');
  launcher.launchService('Netflix');
  child().emit('spawn');
  child().emit('exit', 0);
  expect(saved().Netflix).toBe(6);
  failed.emit('error', new Error('failed'));
  failed.emit('exit', 1);
  failed.emit('error', new Error('failed again'));
  expect(saved().Netflix).toBe(5);
  expect(event.sender.send).toHaveBeenCalledTimes(1);
});

it('removes the failed first launch without leaving a negative count', () => {
  launcher.launchService('Netflix');
  child().emit('spawn');
  child().emit('exit', 127);
  expect(saved()).toEqual({});
  expect(launcher.usageData.Netflix).toBeUndefined();
});

it.each(['SIGSEGV', 'SIGTERM'])('rolls back a process terminated by %s', signal => {
  const event = { sender: { send: jest.fn() } };
  launcher.launchService('Netflix', event);
  child().emit('spawn');
  child().emit('exit', null, signal);
  expect(saved()).toEqual({});
  expect(event.sender.send).toHaveBeenCalledTimes(1);
  expect(fs.readFileSync(launcher.logFile, 'utf8')).toContain(`signal ${signal}`);
});

it('preserves existing history when a new child fails before spawning', () => {
  launcher.usageData.Netflix = 4;
  launcher.saveUsage();
  launcher.launchService('Netflix');
  child().emit('error', new Error('ENOENT'));
  expect(saved().Netflix).toBe(4);
});

it.each([null, [], { Hulu: '2', Prime: 4 }, { Hulu: -5, Prime: 4 }])('counts normally after loading malformed history %p', data => {
  fs.writeFileSync(launcher.usageFile, JSON.stringify(data));
  launcher.loadUsage();
  launcher.launchService('Hulu');
  child().emit('spawn');
  expect(saved().Hulu).toBe(1);
  if (data && data.Prime) expect(saved().Prime).toBe(4);
  child().emit('exit', 1);
  expect(saved().Hulu).toBeUndefined();
  if (data && data.Prime) expect(saved().Prime).toBe(4);
});

it('preserves the maximum safe count when a further launch cannot be represented', () => {
  fs.writeFileSync(launcher.usageFile, JSON.stringify({ Hulu: Number.MAX_SAFE_INTEGER }));
  launcher.loadUsage();
  launcher.launchService('Hulu');
  child().emit('spawn');
  expect(saved().Hulu).toBe(Number.MAX_SAFE_INTEGER);
  child().emit('exit', 1);
  expect(saved().Hulu).toBe(Number.MAX_SAFE_INTEGER);
});

it('preserves a concurrent successful launch when a counted launch fails at the numeric cap', () => {
  fs.writeFileSync(launcher.usageFile, JSON.stringify({ Hulu: Number.MAX_SAFE_INTEGER - 1 }));
  launcher.loadUsage();
  launcher.launchService('Hulu');
  const failed = child();
  failed.emit('spawn');
  launcher.launchService('Hulu');
  child().emit('spawn');
  child().emit('exit', 0);
  failed.emit('exit', 1);
  expect(saved().Hulu).toBe(Number.MAX_SAFE_INTEGER);
});

it.each(['missing', 'failure', 'signal', 'success'])('handles real child-process events for a %s command', async outcome => {
  const script = outcome === 'signal' ? "process.kill(process.pid, 'SIGTERM')"
    : `process.exit(${outcome === 'failure' ? 7 : 0})`;
  const command = outcome === 'missing' ? [path.join(profile, 'missing-browser')]
    : [process.execPath, '-e', script, '--'];
  launcher.chromiumCommand.splice(0, launcher.chromiumCommand.length, ...command);
  spawn.mockImplementation(jest.requireActual('child_process').spawn);
  launcher.usageData.Netflix = 4;
  launcher.saveUsage();
  const event = { sender: { send: jest.fn() } };
  launcher.launchService('Netflix', event);
  await new Promise(resolve => child().once('close', resolve));
  expect(saved().Netflix).toBe(outcome === 'success' ? 5 : 4);
  expect(event.sender.send).toHaveBeenCalledTimes(outcome === 'success' ? 0 : 1);
});

it('does not count a spawn after a synchronous child setup failure', () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  spawn.mockImplementationOnce(() => {
    const { EventEmitter } = require('events');
    return Object.assign(new EventEmitter(), { unref: () => { throw new Error('unref failed'); } });
  });
  launcher.launchService('Netflix');
  child().emit('spawn');
  expect(fs.existsSync(launcher.usageFile)).toBe(false);
});

it('ignores unknown services', () => {
  launcher.launchService('not a service');
  expect(spawn).not.toHaveBeenCalled();
});

it.each([
  ['/usr/bin/chromium --flag="foo bar"', ['/usr/bin/chromium', '--flag=foo bar']],
  ['"/opt/My Browser/chrome" --incognito', ['/opt/My Browser/chrome', '--incognito']]
])('parses custom browser commands: %s', (setting, expected) => {
  process.env.CHROMIUM_CMD = setting;
  jest.isolateModules(() => {
    const custom = require('../main');
    custom.launchService('Prime');
    expect(custom.chromiumCommand).toEqual(expected);
    expect(spawn).toHaveBeenCalledWith(expected[0], [...expected.slice(1), '--kiosk', custom.services.Prime],
      expect.objectContaining({ detached: true, stdio: 'ignore' }));
  });
});

it('uses default chromium command when CHROMIUM_CMD is unset', () => {
  expect(launcher.chromiumCommand).toEqual(['flatpak', 'run', 'io.github.ungoogled_software.ungoogled_chromium']);
});
