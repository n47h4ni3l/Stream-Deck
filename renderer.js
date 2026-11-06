/* eslint-env browser */
async function loadTiles() {
            const services = await window.electronAPI.getSortedServices();
            for (const service of services) {
                const tile = document.createElement('div');
                tile.className = 'tile';
                tile.onclick = () => window.electronAPI.launchService(service);

                const img = document.createElement('img');
                img.src = `icons/${service.toLowerCase().replace(/[^a-z0-9]/g, '')}.png`;
                img.alt = service;
                img.onerror = () => {
                    img.remove();
                    tile.textContent = service;
                };

                tile.appendChild(img);
                document.body.insertBefore ? document.body.insertBefore(tile, document.getElementById('integration-summary')) : document.body.appendChild(tile);
            }
            initNavigation();
        }

        let tiles = [];
        let selectedIndex = 0;
        let columns = 1;

        function updateColumns() {
            if (!tiles.length) return;
            const tile = tiles[0];
            columns = Math.min(tiles.length, Math.max(1, Math.floor(window.innerWidth / (tile.offsetWidth + 20))));
        }

        function highlight(index) {
            if (!tiles.length) return;
            tiles[selectedIndex].classList.remove('selected');
            selectedIndex = ((index % tiles.length) + tiles.length) % tiles.length;
            tiles[selectedIndex].classList.add('selected');
        }

        function handleKey(e) {
            if (handleSetupKey(e.key)) { if (e.preventDefault) e.preventDefault(); return; }
            // Native keyboard controls activate themselves. Do not launch a
            // selected service as well when the Setup button has keyboard focus.
            if (['Enter', ' ', 'ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key) &&
                e.target && typeof e.target.closest === 'function' && e.target.closest('button, input, select, textarea, a[href]')) return;
            switch (e.key) {
                case 'F1':
                    openSetup();
                    break;
                case 'Escape':
                    dashboardBack();
                    break;
                case 'ArrowRight':
                    highlight(selectedIndex + 1);
                    break;
                case 'ArrowLeft':
                    highlight(selectedIndex - 1);
                    break;
                case 'ArrowDown':
                    highlight(selectedIndex + columns);
                    break;
                case 'ArrowUp':
                    highlight(selectedIndex - columns);
                    break;
                case 'Enter':
                case ' ':
                    tiles[selectedIndex].click();
                    break;
            }
        }

        function dashboardBack() {
            const api = window.electronAPI;
            if (document.hasFocus && !document.hasFocus()) {
                if (api.returnFromBrowser) Promise.resolve(api.returnFromBrowser()).catch(() => {});
            } else if (!closeSetup() && api.dashboardBack) api.dashboardBack();
        }

        let prevButtons = [];
        let activeGamepadSlot = -1;
        let activeGamepadId;
        let stickDirection = null;
        let heldDirection = null;
        let nextRepeat = 0;
        const stickOn = 0.55, stickOff = 0.35;

        function resetGamepad() {
            prevButtons = [];
            activeGamepadSlot = -1;
            activeGamepadId = undefined;
            stickDirection = heldDirection = null;
            nextRepeat = 0;
        }
        function stickKey(gp) {
            const axis = i => Number.isFinite(gp.axes && gp.axes[i]) ? Math.max(-1, Math.min(1, gp.axes[i])) : 0;
            const x = axis(0), y = axis(1), ax = Math.abs(x), ay = Math.abs(y);
            const candidate = ax >= ay ? (x >= 0 ? 'ArrowRight' : 'ArrowLeft') : (y >= 0 ? 'ArrowDown' : 'ArrowUp');
            if (Math.max(ax, ay) < stickOff) return (stickDirection = null);
            if (stickDirection) {
                const horizontal = stickDirection === 'ArrowRight' || stickDirection === 'ArrowLeft';
                const along = horizontal ? x : y;
                const positive = stickDirection === 'ArrowRight' || stickDirection === 'ArrowDown';
                if (Math.abs(along) >= stickOff && (along >= 0) === positive &&
                    (horizontal ? ay <= ax + 0.2 : ax <= ay + 0.2)) return stickDirection;
            }
            stickDirection = Math.max(ax, ay) >= stickOn ? candidate : null;
            return stickDirection;
        }
        function pollGamepad(now = 0) {
            let gamepads = [];
            try { gamepads = navigator.getGamepads ? Array.from(navigator.getGamepads()) : []; } catch { /* Keyboard remains available. */ }
            const connected = gp => gp && gp.connected !== false;
            let slot = activeGamepadSlot;
            if (!connected(gamepads[slot]) || gamepads[slot].id !== activeGamepadId) slot = gamepads.findIndex(connected);
            const gp = gamepads[slot];
            if (slot !== activeGamepadSlot || (gp && gp.id !== activeGamepadId)) {
                resetGamepad(); activeGamepadSlot = slot; activeGamepadId = gp && gp.id;
            }
            if (gp) {
                const pressed = i => Boolean(gp.buttons[i] && gp.buttons[i].pressed);
                const back = pressed(1);
                if (back && !prevButtons[1]) dashboardBack();
                const focused = !document.hasFocus || document.hasFocus();
                if (focused && !back) {
                    const up = pressed(12), down = pressed(13), left = pressed(14), right = pressed(15);
                    const hasDpad = up || down || left || right;
                    let direction;
                    if (hasDpad) direction = left !== right ? (right ? 'ArrowRight' : 'ArrowLeft')
                        : up !== down ? (down ? 'ArrowDown' : 'ArrowUp') : null;
                    else direction = stickKey(gp);
                    const key = direction ? `${hasDpad ? 'pad' : 'stick'}:${direction}` : null;
                    if (key !== heldDirection) {
                        heldDirection = key; nextRepeat = now + 320;
                        if (direction) handleKey({ key: direction });
                    } else if (direction && now >= nextRepeat) {
                        nextRepeat = now + 120; handleKey({ key: direction });
                    }
                    if (pressed(0) && !prevButtons[0]) handleKey({ key: 'Enter' });
                    if (pressed(9) && !prevButtons[9] && typeof openSetup === 'function') openSetup();
                } else { heldDirection = null; stickDirection = null; }
                for (const i of [0, 1, 9]) prevButtons[i] = pressed(i);
            } else resetGamepad();
            requestAnimationFrame(pollGamepad);
        }

        function initNavigation() {
            tiles = Array.from(document.querySelectorAll('.tile'));
            if (!tiles.length) return;
            updateColumns();
            tiles[0].classList.add('selected');
            window.addEventListener('keydown', handleKey);
            window.addEventListener('resize', updateColumns);
            window.addEventListener('gamepaddisconnected', e => {
                if (e.gamepad.index === activeGamepadSlot) resetGamepad();
            });
            requestAnimationFrame(pollGamepad);
        }

        loadTiles();

const byId = id => document.getElementById ? document.getElementById(id) : null;
let integrationPromise, choiceSignature = '';
function closeSetup() {
    const panel = byId('setup-panel');
    if (!panel || panel.hidden) return false;
    panel.hidden = true; return true;
}
async function openSetup() {
    const panel = byId('setup-panel'); if (!panel) return;
    panel.hidden = false; await refreshIntegration();
    byId('steam-retry').focus();
}
function handleSetupKey(key) {
    const panel = byId('setup-panel');
    if (!panel || panel.hidden) return false;
    if (key === 'Escape') { closeSetup(); return true; }
    const controls = Array.from(panel.querySelectorAll('button:not(:disabled), input:not(:disabled)'));
    if (!controls.length) return false;
    const index = Math.max(0, controls.indexOf(document.activeElement));
    if (['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'].includes(key)) {
        const step = key === 'ArrowUp' || key === 'ArrowLeft' ? -1 : 1;
        controls[(index + step + controls.length) % controls.length].focus(); return true;
    }
    if (key === 'Enter' || key === ' ') { controls[index].click(); return true; }
    return false;
}
const playbackText = status => {
    const prefix = 'Sleep prevention: ';
    if (status.state === 'playing') return prefix + `active — ${status.browser} reports playback (browser-wide).`;
    if (status.state === 'idle') return prefix + 'off — browser reports paused/stopped.';
    if (status.state === 'unsupported') return prefix + 'unavailable — custom browser has no supported identity adapter.';
    if (status.state === 'unavailable') return prefix + 'unavailable — check gdbus/session bus. No stale inhibitor is retained.';
    if (status.state === 'waiting') return prefix + 'off — no matching browser media signal yet. Some media/browser setups do not export MPRIS.';
    return prefix + 'off — checking browser media signals.';
};
async function refreshIntegration() {
    if (!window.electronAPI.getIntegrationStatus || !byId('integration-summary')) return;
    if (integrationPromise) return integrationPromise;
    integrationPromise = window.electronAPI.getIntegrationStatus().then(status => {
        const playback = status.playback || { state: 'unavailable' };
        const steam = status.steam || { state: 'checking', detail: 'Checking Steam.' };
        const ret = status.browserReturn || { available: false, enabled: false, detail: 'Return capability unavailable.' };
        byId('integration-summary').textContent = `${playbackText(playback)} · Steam: ${steam.state}. Stick/D-pad: move · A: launch · B: back/return · Menu/F1: setup`;
        byId('playback-status').textContent = playbackText(playback);
        byId('steam-status').textContent = steam.detail;
        byId('return-status').textContent = ret.detail;
        byId('browser-return').checked = ret.enabled;
        byId('browser-return').disabled = !ret.available;
        const signature = JSON.stringify(steam.choices || []);
        if (signature !== choiceSignature) {
            choiceSignature = signature; const list = byId('steam-choices'); list.replaceChildren();
            if ((steam.choices || []).length > 1) for (const choice of steam.choices) {
                const button = document.createElement('button'); button.textContent = `Use ${choice.label} (${choice.account}) — ${choice.root}`;
                button.dataset.steamSelection = choice.id; button.onclick = () => configureSteamUI(choice.id); list.appendChild(button);
            }
        }
    }).catch(() => { byId('integration-summary').textContent = 'Setup status unavailable; reopen Setup to retry.'; })
        .finally(() => { integrationPromise = null; });
    return integrationPromise;
}
async function configureSteamUI(selection) {
    const button = byId('steam-retry'); button.disabled = true;
    try { await window.electronAPI.setupSteam(selection); } catch (error) { byId('steam-status').textContent = error.message; }
    finally { button.disabled = false; await refreshIntegration(); }
}
if (byId('setup-button')) {
    byId('setup-button').onclick = openSetup;
    byId('setup-close').onclick = closeSetup;
    byId('steam-retry').onclick = () => configureSteamUI();
    byId('browser-return').onchange = async event => {
        await window.electronAPI.setBrowserReturn(event.target.checked); await refreshIntegration();
    };
    refreshIntegration(); setInterval(refreshIntegration, 2500);
}
