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
  const { EventEmitter } = require('events');
  const spawn = jest.fn(() => Object.assign(new EventEmitter(), { unref: jest.fn() }));
  return { spawn };
});

const { loadUsage, saveUsage, usageData, usageFile, launchService, getSortedServices, services } = require('../main');
const { spawn } = require('child_process');

afterEach(() => {
  jest.restoreAllMocks();
  spawn.mockClear();
  if (fs.existsSync(usageFile)) fs.unlinkSync(usageFile);
  Object.keys(usageData).forEach(k => delete usageData[k]);
});
afterAll(() => fs.rmSync(require('path').dirname(usageFile), { recursive: true, force: true }));

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
    spawn.mock.results.at(-1).value.emit('spawn');
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

  test.each([null, [], [8], true, 4, 'history'])('loads and saves invalid root %p as empty history', input => {
    fs.writeFileSync(usageFile, JSON.stringify(input));
    loadUsage();
    expect(getSortedServices()).toEqual(Object.keys(services));
    saveUsage();
    expect(JSON.parse(fs.readFileSync(usageFile, 'utf8'))).toEqual({});
  });

  test('preserves valid counts and unknown names while dropping malformed values', () => {
    const input = { Hulu: 2, Max: 0, Archived: 7, Netflix: '20', Prime: -2,
      YouTube: 0.5, Stan: true, Tubi: null, Kayo: Number.MAX_SAFE_INTEGER + 1 };
    fs.writeFileSync(usageFile, JSON.stringify(input));
    loadUsage();
    expect(getSortedServices()[0]).toBe('Hulu');
    saveUsage();
    expect(JSON.parse(fs.readFileSync(usageFile, 'utf8'))).toEqual({ Hulu: 2, Max: 0, Archived: 7 });
  });

  test('keeps the exported state current across loads and resets a missing file', () => {
    fs.writeFileSync(usageFile, '{"Hulu":2}');
    loadUsage();
    expect(usageData.Hulu).toBe(2);
    fs.writeFileSync(usageFile, '{"Prime":3}');
    loadUsage();
    expect(usageData.Hulu).toBeUndefined();
    expect(usageData.Prime).toBe(3);
    fs.unlinkSync(usageFile);
    loadUsage();
    expect(Object.keys(usageData)).toEqual([]);
  });

  test('sanitizes in-memory values before saving without dropping valid counts', () => {
    loadUsage();
    Object.assign(usageData, { Hulu: 3, Netflix: '4', Prime: -1, Max: NaN, YouTube: Infinity });
    saveUsage();
    expect(JSON.parse(fs.readFileSync(usageFile, 'utf8'))).toEqual({ Hulu: 3 });
    expect(Object.keys(usageData)).toEqual(['Hulu']);
  });

  test('treats prototype-like names as ordinary own data', () => {
    fs.writeFileSync(usageFile, '{"__proto__":4,"constructor":3,"Hulu":2}');
    loadUsage();
    saveUsage();
    const data = JSON.parse(fs.readFileSync(usageFile, 'utf8'));
    expect(Object.hasOwn(data, '__proto__')).toBe(true);
    expect(data.__proto__).toBe(4);
    expect(data.constructor).toBe(3);
    expect(data.Hulu).toBe(2);
  });

  test('preserves an unreadable history file and resumes saving after a successful reload', () => {
    const original = '{"Hulu":8}';
    fs.writeFileSync(usageFile, original);
    const read = fs.readFileSync;
    const exists = fs.existsSync;
    const failure = Object.assign(new Error('permission denied'), { code: 'EACCES' });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const spy = jest.spyOn(fs, 'readFileSync').mockImplementation((file, ...args) => {
      if (file === usageFile) throw failure;
      return read(file, ...args);
    });
    // existsSync also reports false for inaccessible paths, not just absence.
    jest.spyOn(fs, 'existsSync').mockImplementation(file => file === usageFile ? false : exists(file));
    loadUsage();
    saveUsage();
    spy.mockRestore();
    expect(warn).toHaveBeenCalled();
    expect(fs.readFileSync(usageFile, 'utf8')).toBe(original);
    loadUsage();
    launchService('Hulu');
    spawn.mock.results.at(-1).value.emit('spawn');
    expect(JSON.parse(fs.readFileSync(usageFile, 'utf8'))).toEqual({ Hulu: 9 });
  });
});
