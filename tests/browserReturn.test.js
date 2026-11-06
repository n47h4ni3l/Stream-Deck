const { browserAdapter } = require('../setup/browser-adapters');
const { foregroundBrowser } = require('../setup/browser-return');
const fs = require('fs');
const os = require('os');
const path = require('path');
const adapter = browserAdapter('chromium');
let env, bin;
beforeEach(() => {
  bin = fs.mkdtempSync(path.join(os.tmpdir(), 'return-tools-'));
  fs.writeFileSync(path.join(bin, 'xprop'), '#!/bin/sh\nexit 0\n', { mode: 0o700 });
  env = { DISPLAY: ':97', PATH: bin };
});
afterEach(() => fs.rmSync(bin, { recursive: true, force: true }));
test('matches only a currently foreground configured browser without reading titles or changing it', async () => {
  const read = jest.fn(async args => args.includes('WM_CLASS') ? 'WM_CLASS(STRING) = "chromium", "Chromium"\n_NET_WM_STATE(ATOM) = _NET_WM_STATE_FOCUSED' : '_NET_ACTIVE_WINDOW(WINDOW): window id # 0x123');
  expect(await foregroundBrowser(adapter, env, read)).toBe(true);
  expect(read.mock.calls).toEqual([[['-root', '_NET_ACTIVE_WINDOW']], [['-id', '0x123', 'WM_CLASS', '_NET_WM_STATE']], [['-root', '_NET_ACTIVE_WINDOW']]]);
});
test.each(['OtherEditor', 'Google-chrome'])('does not return from an unrelated foreground application %s', async name => {
  const read = async args => args.includes('WM_CLASS') ? `WM_CLASS(STRING) = "${name}"\n_NET_WM_STATE(ATOM) = _NET_WM_STATE_FOCUSED` : '_NET_ACTIVE_WINDOW(WINDOW): window id # 0x123';
  expect(await foregroundBrowser(adapter, env, read)).toBe(false);
});
test('does not return if foreground ownership changes during observation', async () => {
  let n = 0;
  const read = async args => args.includes('WM_CLASS') ? 'WM_CLASS(STRING) = "Chromium"\n_NET_WM_STATE(ATOM) = _NET_WM_STATE_FOCUSED' : `_NET_ACTIVE_WINDOW(WINDOW): window id # 0x${++n}`;
  expect(await foregroundBrowser(adapter, env, read)).toBe(false);
});
test('does not trust a stale XWayland active-window property without focused state', async () => {
  const read = async args => args.includes('WM_CLASS') ? 'WM_CLASS(STRING) = "Chromium"' : '_NET_ACTIVE_WINDOW(WINDOW): window id # 0x123';
  expect(await foregroundBrowser(adapter, env, read)).toBe(false);
});
test('native Wayland-only and unknown custom browsers are explicitly unsupported', async () => {
  const read = jest.fn();
  expect(await foregroundBrowser(adapter, { PATH: '/usr/bin' }, read)).toBe(false);
  expect(await foregroundBrowser(browserAdapter('/opt/custom'), env, read)).toBe(false);
  fs.unlinkSync(path.join(bin, 'xprop'));
  expect(await foregroundBrowser(adapter, env, read)).toBe(false);
  expect(read).not.toHaveBeenCalled();
});
