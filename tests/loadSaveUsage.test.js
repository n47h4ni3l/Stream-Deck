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

const { loadUsage, saveUsage, usageData, usageFile, launchService } = require('../main');
const { spawn } = require('child_process');

afterEach(() => {
  spawn.mockClear();
  if (fs.existsSync(usageFile)) fs.unlinkSync(usageFile);
  Object.keys(usageData).forEach(k => delete usageData[k]);
});

describe('loadUsage and saveUsage', () => {
  test('handles corrupted usage.json by resetting data', () => {
    fs.writeFileSync(usageFile, '{invalid json}');
    loadUsage();
    expect(fs.existsSync(usageFile)).toBe(false);
    saveUsage();
    const data = JSON.parse(fs.readFileSync(usageFile));
    expect(Object.keys(data).length).toBe(0);
  });

  test('loads existing usage and persists updates', () => {
    fs.writeFileSync(usageFile, JSON.stringify({ Hulu: 2 }));
    loadUsage();
    launchService('Hulu');
    const data = JSON.parse(fs.readFileSync(usageFile));
    expect(data['Hulu']).toBe(3);
  });

  test('logs warning if saving usage fails', () => {
    const err = new Error('fail');
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const orig = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {
      throw err;
    });

    expect(() => saveUsage()).not.toThrow();
    expect(warn).toHaveBeenCalled();

    orig.mockRestore();
    warn.mockRestore();
  });
});
