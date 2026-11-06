# Stream Deck Launcher

A full-screen streaming dashboard for Linux: choose a service with a controller or keyboard and open it in your existing browser profile.

**[Download v1.1.0-beta.1](https://github.com/n47h4ni3l/Stream-Deck/releases/tag/v1.1.0-beta.1)** · [Installation guide](INSTALL.md) · [Testing details](TESTING.md)

This is a **Linux x86_64 beta** for glibc-based systems. Steam Deck/SteamOS and Bazzite are intended targets, but real-device acceptance is still outstanding. Windows, macOS, ARM and musl-based Linux are not supported by these downloads.

## Install

Use Desktop Mode and quit Steam completely before setup.

1. Download `streamdeck-launcher-1.1.0-beta.1-linux-x86_64.tar.gz` and `SHA256SUMS` from the release.
2. Verify the download with `sha256sum --ignore-missing -c SHA256SUMS`, then extract the complete archive.
3. Run `./install.sh` inside the extracted folder. Open **Stream Deck Launcher** from the application menu.

The archive includes Electron and Node; it needs no system Node.js, npm, git, FUSE or root access. It creates the menu entry and attempts a native Steam shortcut. If Steam is running or accounts are ambiguous, open **Setup** to choose an account or retry after quitting Steam.

For a portable option, verify `streamdeck-launcher-1.1.0-beta.1-linux-x86_64.AppImage`, mark it executable and open it. If FUSE is unavailable, run it with `--appimage-extract-and-run`. It attempts native Steam setup on startup but creates no application-menu entry. Keep the file at its chosen path; reopen it after moving it to update its owned Steam shortcut.

See [INSTALL.md](INSTALL.md) for commands, browser choice, prerequisites, updates and uninstall.

## Requirements

A graphical Linux session, glibc, Bash/core tools, `ldd`, compatible Electron libraries and working native sandbox support are required. Playback detection needs `gdbus` (GLib tools) and the user session bus. Browser B-return needs `xprop` and X11/XWayland foreground-window information.

The default browser is Ungoogled Chromium from Flathub. The Flatpak CLI must already be installed for Flatpak browsers. Archive setup can install a missing supported browser and its runtime for your account; portable startup asks first. Internet access and disk space are needed. Existing profiles are reused. OS libraries, Flatpak CLI, FUSE and sandbox repair use your distribution's supported tools; the installer does not use sudo, change security settings or add broad Flatpak permissions.

## Controls

| Input | Action |
| --- | --- |
| Left stick or D-pad | Move between services; held input repeats |
| A, Enter or Space | Open the selected service |
| B or Escape | Close Setup; ask before quitting at the dashboard root |
| Menu or F1 | Open Setup |
| B while the supported browser is in front | Request return to the dashboard on X11/XWayland; browser stays open |

Background B-return uses the open launcher's normal Gamepad API, without global keyboard hooks or input grabbing. Setup explains and can disable it. It depends on actual controller/background input delivery and window-manager focus information. **Native Wayland browser return is unavailable; physical controller and Steam Input acceptance remain unverified.**

## Steam and playback

Automatic shortcut setup supports **native Steam**. It backs up existing databases, preserves unrelated games and custom options/artwork/working directories, and updates its owned entry without changing its Steam app ID. It defers writes while Steam runs and offers account selection when needed.

**Flatpak Steam is detected but automatic host-app shortcuts are unsupported with its default sandbox; its database is left unchanged.** This is separate from supported Flatpak streaming browsers. Paths with spaces/non-ASCII work; embedded double quotes/control characters are reported unsupported.

Display-sleep prevention follows fresh **browser-wide MPRIS playback** for recognized Chromium, Google Chrome, Brave and Firefox commands/identities. One inhibitor is held while a matching player reports `Playing`; pause, stop, player loss, errors/expiry and launcher quit release it. Keep the launcher running. Media in another tab of that browser family can inhibit; exact service/tab attribution is unavailable. Unknown wrappers or browsers without MPRIS show unsupported/off. Buffering follows the browser's reported state.

No media titles, URLs or viewing history are read or stored. Browser debugging ports, extensions and new profiles are not added. Launch counts measure browser-command starts, not successful login or playback.

## Beta status

Automated checks cover unit regressions, real Electron windows, controller/Steam/MPRIS fixtures, dependency setup, install/upgrade/uninstall, AppImage dispatch and downloaded checksums/provenance. Test-only `--no-sandbox --disable-gpu` exceptions are used in isolated runners; shipped launchers keep sandboxing enabled.

**Still needs real-device testing:** Steam Deck/Bazzite native sandbox startup, Gaming Mode, physical controllers/background Steam Input, real Steam shortcut acceptance, native Wayland, live browser installation, service sign-in/login persistence, DRM/Widevine/codecs and playback. Service availability also depends on your browser, account and region. Passing fixtures does not prove every streaming service works. See [TESTING.md](TESTING.md).

## Development

Use a fresh clone of this public repository. It starts with this beta; earlier development history remains in a private archive. Maintainers should update old clones to the archive remote rather than push their old history here.

Node.js 18 is required by the current lockfile/CI. Run `npm ci`, `npm test` and `npm run lint`. `npm run build` creates local packages without publishing. See [CONTRIBUTING.md](CONTRIBUTING.md) and [TESTING.md](TESTING.md).

## License

Project code is licensed under the [MIT License](LICENSE), copyright © 2023 n47h4ni3l. The original license and notice are retained. Bundled dependencies retain their own licenses/notices. Service logos remain the property of their respective owners; this project has no affiliation with or endorsement from any streaming service.
