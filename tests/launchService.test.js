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

const { launchService, services, usageData, usageFile, chromiumPath } = require('../main');
const { spawn } = require('child_process');

afterEach(() => {
  spawn.mockClear();
  if (fs.existsSync(usageFile)) fs.unlinkSync(usageFile);
  Object.keys(usageData).forEach(k => delete usageData[k]);
});

describe('launchService', () => {
  test('spawns chromium with correct URL', () => {
    launchService('Netflix');
    expect(spawn).toHaveBeenCalledWith(
      chromiumPath,
      [services['Netflix']],
      { detached: true, stdio: 'ignore' }
    );
  });

  test('updates usage data and saves file', () => {
    launchService('Hulu');
    expect(usageData['Hulu']).toBe(1);
    const data = JSON.parse(fs.readFileSync(usageFile));
    expect(data['Hulu']).toBe(1);
  });
});
