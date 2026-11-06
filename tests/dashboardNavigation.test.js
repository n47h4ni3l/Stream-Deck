const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Execute the actual shipped dashboard script, not a copy of its navigation logic.
const source = fs.readFileSync(path.join(__dirname, '..', 'renderer.js'), 'utf8');

function gamepad(index, pressed = [], id = `controller-${index}`) {
  return { index, id, connected: true,
    buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: pressed.includes(i) })) };
}

async function dashboard(width = 1280, count = 16) {
  const tiles = [], events = {}, frames = [];
  const launchService = jest.fn();
  const element = () => {
    const classes = new Set();
    return { offsetWidth: 150, appendChild() {},
      classList: { add: name => classes.add(name), remove: name => classes.delete(name),
        contains: name => classes.has(name) },
      click() { this.onclick(); } };
  };
  const context = vm.createContext({
    document: { createElement: element, body: { appendChild: tile => tiles.push(tile) },
      querySelectorAll: () => tiles },
    window: { innerWidth: width, addEventListener: (name, callback) => { events[name] = callback; },
      electronAPI: { getSortedServices: async () => Array.from({ length: count }, (_, i) => `Service${i}`), launchService } },
    navigator: { getGamepads: () => [] },
    requestAnimationFrame: callback => frames.push(callback)
  });
  vm.runInContext(source, context);
  await new Promise(resolve => setImmediate(resolve));
  return { context, tiles, events, launchService,
    selected: () => tiles.findIndex(tile => tile.classList.contains('selected')),
    key: key => events.keydown({ key }),
    poll: (pads, time = 0) => {
      context.navigator.getGamepads = () => pads;
      const frame = frames.shift();
      expect(frame).toEqual(expect.any(Function));
      frame(time);
      expect(frames).toHaveLength(1);
    } };
}

it('keeps Up/Down on the same tile when all services fit in one wide row', async () => {
  const d = await dashboard(3840);
  d.key('ArrowUp');
  expect(d.selected()).toBe(0);
  d.key('ArrowRight');
  d.key('ArrowDown');
  expect(d.selected()).toBe(1);
});

it.each([0, 170, 1280, 1920, 3840, 100000])('keeps one valid highlight through repeated wrapping at width %i', async width => {
  const d = await dashboard(width);
  for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
    for (let i = 0; i < 40; i++) {
      d.key(key);
      expect(d.selected()).toBeGreaterThanOrEqual(0);
      expect(d.tiles.filter(tile => tile.classList.contains('selected'))).toHaveLength(1);
    }
  }
});

it('normalizes indices more than one grid length in either direction', async () => {
  const d = await dashboard();
  d.context.highlight(-49);
  expect(d.selected()).toBe(15);
  d.context.highlight(49);
  expect(d.selected()).toBe(1);
});

it('recalculates columns after resizing and preserves keyboard activation', async () => {
  const d = await dashboard();
  d.key('ArrowUp');
  expect(d.selected()).toBe(9);
  d.context.window.innerWidth = 3840;
  d.events.resize();
  d.key('ArrowUp');
  expect(d.selected()).toBe(9);
  d.key('Enter');
  d.key(' ');
  expect(d.launchService.mock.calls).toEqual([['Service9'], ['Service9']]);
});

it('handles a single tile and does not initialize navigation for an empty dashboard', async () => {
  const d = await dashboard(3840, 1);
  d.key('ArrowUp');
  d.key('ArrowLeft');
  expect(d.selected()).toBe(0);
  const empty = await dashboard(3840, 0);
  expect(empty.tiles).toHaveLength(0);
  expect(empty.events.keydown).toBeUndefined();
});

it('uses an available controller outside slot zero with held-button edge detection', async () => {
  const d = await dashboard();
  d.poll([null, gamepad(1, [15])]);
  expect(d.selected()).toBe(1);
  d.poll([null, gamepad(1, [15])]);
  expect(d.selected()).toBe(1);
  d.poll([null, gamepad(1)]);
  d.poll([null, gamepad(1, [0])]);
  d.poll([null, gamepad(1, [0])]);
  expect(d.launchService.mock.calls).toEqual([['Service1']]);
});

it('resets held inputs after a disconnect and reconnect in the same slot', async () => {
  const d = await dashboard();
  d.poll([gamepad(0, [15])]);
  d.poll([null]);
  d.poll([gamepad(0, [15])]);
  expect(d.selected()).toBe(2);
});

it('handles a disconnect event even if the same device reconnects before the next frame', async () => {
  const d = await dashboard();
  d.poll([null, gamepad(1, [15])]);
  d.events.gamepaddisconnected({ gamepad: gamepad(1) });
  d.poll([null, gamepad(1, [15])]);
  expect(d.selected()).toBe(2);
});

it('resets button state when a different controller reuses the active slot', async () => {
  const d = await dashboard();
  d.poll([gamepad(0, [15], 'first')]);
  d.poll([gamepad(0, [15], 'replacement')]);
  expect(d.selected()).toBe(2);
});

it('retains the active controller when another connects, then falls back on disconnect', async () => {
  const d = await dashboard();
  d.poll([null, gamepad(1, [15])]);
  d.poll([gamepad(0, [15]), gamepad(1, [15])]);
  expect(d.selected()).toBe(1);
  d.events.gamepaddisconnected({ gamepad: gamepad(0) });
  d.poll([null, gamepad(1, [15])]);
  expect(d.selected()).toBe(1);
  d.poll([gamepad(0, [15]), null]);
  expect(d.selected()).toBe(2);
});

it('ignores explicitly disconnected entries', async () => {
  const d = await dashboard();
  d.poll([{ ...gamepad(0, [15]), connected: false }, gamepad(1, [14])]);
  expect(d.selected()).toBe(15);
});

it('supports keyboard navigation when the gamepad API is unavailable', async () => {
  const d = await dashboard();
  delete d.context.navigator.getGamepads;
  expect(() => d.context.pollGamepad()).not.toThrow();
  d.key('ArrowRight');
  expect(d.selected()).toBe(1);
});


it('navigates with the left stick beyond its dead zone and repeats held input at a stable rate', async () => {
  const d = await dashboard();
  const pad = x => ({ ...gamepad(0), axes: [x, 0] });
  d.poll([pad(0.3)], 0); expect(d.selected()).toBe(0);
  d.poll([pad(0.8)], 10); expect(d.selected()).toBe(1);
  d.poll([pad(0.8)], 200); expect(d.selected()).toBe(1);
  d.poll([pad(0.8)], 350); expect(d.selected()).toBe(2);
  d.poll([pad(0.8)], 360); expect(d.selected()).toBe(2);
  d.poll([pad(0.8)], 480); expect(d.selected()).toBe(3);
  d.poll([pad(0.8)], 5000); expect(d.selected()).toBe(4);
});
it('uses hysteresis and one axis for a held diagonal, then resets after centering', async () => {
  const d = await dashboard();
  const pad = (x, y) => ({ ...gamepad(0), axes: [x, y] });
  d.poll([pad(0.8, 0.8)], 0); expect(d.selected()).toBe(1);
  d.poll([pad(0.77, 0.8)], 350); expect(d.selected()).toBe(2);
  d.poll([pad(0.4, 0.39)], 480); expect(d.selected()).toBe(3);
  d.poll([pad(0.1, 0.1)], 500);
  d.poll([pad(0, -0.8)], 510); expect(d.selected()).toBe(12);
});
it('gives D-pad priority over the stick without moving twice per frame', async () => {
  const d = await dashboard();
  d.poll([{ ...gamepad(0, [14]), axes: [0.9, 0] }], 0);
  expect(d.selected()).toBe(15);
  d.poll([{ ...gamepad(0), axes: [0.9, 0] }], 10);
  expect(d.selected()).toBe(0);
});
it('resets analog repeat when controllers disconnect or are replaced', async () => {
  const d = await dashboard();
  d.poll([{ ...gamepad(1), axes: [0.9, 0] }], 0);
  d.poll([null], 10);
  d.poll([{ ...gamepad(1), axes: [0.9, 0] }], 20);
  expect(d.selected()).toBe(2);
  d.poll([{ ...gamepad(0, [], 'replacement'), axes: [-0.9, 0] }], 30);
  expect(d.selected()).toBe(1);
});
it('routes B and Escape to back once per press without activating a tile', async () => {
  const d = await dashboard(); const back = jest.fn();
  d.context.window.electronAPI.dashboardBack = back;
  d.poll([gamepad(0, [1])], 0); d.poll([gamepad(0, [1])], 1000);
  expect(back).toHaveBeenCalledTimes(1);
  d.key('Escape'); expect(back).toHaveBeenCalledTimes(2);
  expect(d.launchService).not.toHaveBeenCalled();
});
it('does not launch a tile when keyboard activation targets a native Setup button', async () => {
  const d = await dashboard(); const target = { closest: selector => selector.includes('button') ? {} : null };
  for (const key of ['Enter', ' ', 'ArrowRight']) d.events.keydown({ key, target });
  expect(d.launchService).not.toHaveBeenCalled(); expect(d.selected()).toBe(0);
});
