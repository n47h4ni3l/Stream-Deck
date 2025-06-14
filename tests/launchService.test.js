const fs = require('fs');

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
  const spawn = jest.fn(() => ({ unref: jest.fn() }));
  return { spawn };
});

const { launchService, services, usageData, usageFile, chromiumCommand } = require('../main');
const { spawn } = require('child_process');

afterEach(() => {
  const { spawn } = require('child_process');
  spawn.mockClear();
  if (fs.existsSync(usageFile)) fs.unlinkSync(usageFile);
  Object.keys(usageData).forEach(k => delete usageData[k]);
});

describe('launchService', () => {
  test('spawns chromium with correct URL', () => {
    launchService('Netflix');
    expect(spawn).toHaveBeenCalledWith(
      chromiumCommand[0],
      expect.arrayContaining(['--kiosk', services['Netflix']]),
      { detached: true, stdio: 'ignore' }
    );
  });

  test('updates usage data and saves file', () => {
    launchService('Hulu');
    expect(usageData['Hulu']).toBe(1);
    const data = JSON.parse(fs.readFileSync(usageFile));
    expect(data['Hulu']).toBe(1);
  });

  test('handles spawn errors without throwing', () => {
    const error = new Error('fail');
    spawn.mockImplementation(() => { throw error; });
    const event = { sender: { send: jest.fn() } };

    expect(() => launchService('Netflix', event)).not.toThrow();
    expect(event.sender.send).toHaveBeenCalledWith('launch-service-error', 'Netflix');
    expect(usageData['Netflix']).toBeUndefined();
    expect(fs.existsSync(usageFile)).toBe(false);
  });

  test('uses CHROMIUM_CMD environment variable when set', () => {
    jest.resetModules();
    process.env.CHROMIUM_CMD = '/usr/bin/chromium --flag="foo bar"';

    const { spawn } = require('child_process');
    const { launchService: launchWithEnv, services, chromiumCommand } = require('../main');

    launchWithEnv('Prime');

    expect(chromiumCommand).toEqual(['/usr/bin/chromium', '--flag=foo bar']);
    expect(spawn).toHaveBeenCalledWith(
      chromiumCommand[0],
      expect.arrayContaining(['--flag=foo bar', '--kiosk', services['Prime']]),
      { detached: true, stdio: 'ignore' }
    );

    delete process.env.CHROMIUM_CMD;
  });

  test('parses CHROMIUM_CMD with quoted path', () => {
    jest.resetModules();
    process.env.CHROMIUM_CMD = '"/opt/My Browser/chrome" --incognito';

    const { chromiumCommand } = require('../main');

    expect(chromiumCommand).toEqual(['/opt/My Browser/chrome', '--incognito']);

    delete process.env.CHROMIUM_CMD;
  });

  test('uses default chromium command when CHROMIUM_CMD is unset', () => {
    jest.resetModules();
    delete process.env.CHROMIUM_CMD;

    const { chromiumCommand } = require('../main');

    expect(chromiumCommand).toEqual([
      'flatpak',
      'run',
      'io.github.ungoogled_software.ungoogled_chromium'
    ]);
  });
});
