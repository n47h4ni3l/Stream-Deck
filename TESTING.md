# Manual Testing

Use these scenarios to verify the launcher in different SteamOS modes.

## Automated startup check
- Run `npm test` and `npm run lint`.
- Source-installer Node regressions copy the repository scripts, use an absolute Bash executable, a minimal environment and a PATH containing only allowlisted core utilities and command stubs. They cover absent, wrong-major, matching and non-executable-version Node, selected post-Volta Node/npm, and failure propagation. No real Node installation or checkout/user configuration modification occurs.
- Usage regressions cover invalid JSON/root types, mixed malformed counts, load/save/sort/launch behavior, stable state on reload, prototype-like keys and read failures. Only nonnegative safe integer counts are retained; valid zero and unknown service names are preserved. Counts stop at the safe-integer limit. An unreadable history file is not removed or overwritten until a successful reload; malformed JSON retains the existing reset/removal behavior.
- Run `npm run test:smoke` on a graphical Linux desktop, or `xvfb-run -a npm run test:smoke -- --no-sandbox --disable-gpu --ozone-platform=x11` in CI.
- Add `--setup-fixture` to exercise first-run browser consent, progress and completion using an isolated fake Flatpak. The test hook auto-accepts only with that fixture present and is excluded from production packages. No real browser or Flatpak is installed.
- This starts the real Electron package entry from a different working directory, verifies a visible window, the preload API, service-list IPC, all 16 tiles and keyboard navigation, then exits. It uses a temporary profile and never opens a service.

## Release downloads
- Build with `npm run build` on Linux x86_64, then run `dbus-run-session -- xvfb-run -a npm run test:release -- --no-sandbox --disable-gpu` (or use a real X11 display without Xvfb).
- The release check verifies both SHA-256 checksums, extracts and installs the actual archive, validates the desktop file in a path containing `%f` and spaces, launches the installed binary through its shell wrapper and the AppImage without FUSE, and checks tiles, preload, IPC, keyboard navigation, browser-command persistence and usage updates.
- Packaged history fixtures include a valid JSON `null` root and mixed valid/invalid counts, verifying recovery, ordering, preservation of valid values and normal numeric increments through the actual IPC/browser-stub path.
- It also invokes the actual packaged dependency CLI: a missing custom browser and fake missing native library must fail before app/shortcut creation; an isolated Flatpak fixture must install only for the user, recheck, skip installation on repeat and preserve existing settings on a failed install. Runtime probes use temporary profiles and the caller's explicit CI flags; this does not establish native sandbox support.
- The build and release checks extract the actual AppImage's `.desktop` and `AppRun`, require `Exec=AppRun --enable-sandbox %U`, reject sandbox-disabling flags in AppRun, validate desktop syntax and check argument forwarding through the packaged launcher with a harmless executable. A unit regression also checks the locked builder's actual desktop generation against the production configuration. The release check exercises both raw AppImage launch and its desktop-entry argument path; the explicit `--no-sandbox` CI exception is still needed for container window tests and does not establish native sandbox support.
- Browser launches go only to a local argument-recording stub. Installation, upgrade and direct uninstallation use an isolated temporary home; settings and an escaped-path lookalike directory must survive. No streaming login or existing user installation is touched.
- Set `STREAMDECK_EVIDENCE_DIR` to save screenshots, Electron logs and the JSON check report. The container test may require `--no-sandbox`; the shipped launcher does not add it.
- Check `uninstall.sh` is executable in a fresh checkout/source archive. The regression test invokes it directly with an empty temporary home.

## Desktop Mode
- Run `./StreamDeckLauncher.sh` from a terminal
- Confirm services open in the selected browser and usage stats update

## Navigation and launch regressions
- The unit suite executes the shipped dashboard script with isolated DOM/gamepad fixtures. It covers narrow and wide viewports (including 3840 CSS pixels), repeated wrapping, resize, controller slots other than zero, held buttons, device replacement and disconnect/reconnect. These fixtures do not establish physical controller or Steam Input behavior.
- On the target display, check every arrow direction at the first/last tile and after resizing or changing scaling. At widths that fit all tiles in one row, Up/Down should retain the current tile.
- Connect a controller after another has disconnected, navigate with the D-pad and launch with A. Reconnect while holding a direction and check that the first input is accepted, without repeated activation while held. Check left-stick dead zones, held repeat, diagonals and D-pad priority; B should close Setup or ask before quitting at the dashboard root. Check B while the supported external browser owns focus separately: it should raise the dashboard on X11/XWayland without closing/navigating that browser, and ignore an unrelated foreground app. Native Wayland and background Gamepad/Steam Input delivery need real-device acceptance.
- Usage is counted after the browser command emits its process-start event, not merely when `spawn()` returns. While the launcher remains running, an asynchronous process error, nonzero exit or signal termination removes that launch's count and reports the failure once. Concurrent successful launches retain their counts. A zero exit, including forwarding to an existing browser, retains its count. Force-killing a browser is treated as an unsuccessful command too. This measures browser-command launches, not successful login or video playback; a detached browser's later failure cannot be observed after the dashboard exits.
- Regression fixtures cover synchronous throws, asynchronous spawn errors, nonzero exits, signals, duplicate failure events and overlapping launches. Harmless real child-process tests also check missing executables, failing commands, signal termination and clean exits. Check a real browser startup failure on the target system too; it should not increase the final ranking.

## Gaming Mode via Steam Shortcut
- Quit Steam fully; install or use Setup to create the native Steam shortcut automatically. Test account selection, repeat setup and pending/retry while Steam is running. Inspect the private database backup and unrelated games. Flatpak Steam must report unsupported with no database changes; its default sandbox cannot launch a host installation.
- Launch the shortcut from Gaming Mode and ensure Electron starts

## Browser Profile Persistence
- Sign in to a service, close the launcher, and relaunch
- Verify credentials persist across sessions

## Wayland/X11 Detection
- With `DISPLAY` set, confirm the log selects the x11 backend (also in Gaming Mode).
- With only `WAYLAND_DISPLAY` set, confirm the log selects wayland.
- Try `ELECTRON_OZONE_PLATFORM=wayland ./StreamDeckLauncher.sh` on a native Wayland desktop to check the explicit override.

## Desktop shortcut and installation
- From outside the checkout, run `bash /path/to/Stream-Deck/install.sh`.
- Check the application-menu shortcut, including when the install path contains spaces and the custom browser command contains quoted arguments.
- Remove dependencies only from a disposable checkout and confirm launching gives a clear instruction to run the installer, without downloading anything.



## Controller / Steam / playback integration
- Run `xvfb-run -a npm run test:features -- --no-sandbox --disable-gpu --ozone-platform=x11` on a disposable Linux test runner. This starts a separate D-Bus session, real Electron and a small Gio MPRIS player, with an isolated home/config/data/cache. It drives the real renderer with synthetic controller input, selects only one of two fixture Steam accounts, and tests background B through real IPC and synthetic X11 class/focus properties. The unrelated synthetic window stays open and unchanged. This does not validate physical controller/Steam Input delivery or a real browser/Steam client.
- The fixture observes `Playing`/`Paused`/`Stopped`, one inhibitor, identity filtering and release on quit. Unit tests cover delayed media registration, multiple players, existing-browser handoff, owner changes, bus failure/reconnect, bounded non-overlapping queries, freshness expiry and shutdown races. No media metadata is requested.
- On real hardware, play/pause/stop media in the configured supported browser, close the media tab, close the player/browser and disconnect/reconnect the session bus. Confirm Setup's status follows the signal and a paused/closed/unsupported player cannot leave the display inhibited. Real buffering behavior follows the browser's MPRIS state, which may vary by service/browser.
- Confirm browser-wide scope: media in another tab of that browser family can inhibit. Exact launched-tab attribution is not available. An unknown custom wrapper should show unsupported detection, without monitoring every player. No titles, URLs or history should be logged/persisted. Quitting the launcher stops monitoring and releases its inhibitor while leaving the browser open.
- Archive/source dependency setup must report missing `gdbus` or session bus before browser downloads; it must never install system software or change sandbox/Flatpak permissions. Check `xprop` availability and native Wayland's honest unavailable return status. Physical-controller, native sandbox, Steam/Gaming Mode, browser installation, DRM/playback and login persistence remain manual acceptance gates.
