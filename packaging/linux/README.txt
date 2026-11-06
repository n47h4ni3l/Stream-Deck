Stream Deck Launcher 1.1.0-beta.1 - Linux x86_64 beta
Download: https://github.com/n47h4ni3l/Stream-Deck/releases/tag/v1.1.0-beta.1
This public copy has fresh history. Real Steam Deck/Bazzite acceptance is outstanding.
BUILD-INFO.json records this archive's source revision.

Verify SHA256SUMS, extract the complete archive, quit Steam fully, then run
./install.sh in Desktop Mode. Electron/Node are included. Setup checks native
libraries, a real isolated graphics/sandbox renderer, gdbus/session bus and browser
before copying. Missing supported browser Flatpaks/runtimes can be installed from
Flathub for your account; existing browsers/profiles are reused. The Flatpak CLI,
network and disk space are prerequisites for that step. Missing custom commands,
unsupported Flatpaks and failed downloads are reported.

The archive creates an application-menu entry and attempts native Steam setup.
If Steam runs or accounts are ambiguous, open Setup to choose/retry after quitting
Steam. Databases are backed up privately, validated and updated transactionally;
unrelated games and custom options/working directories/artwork are preserved.
Repeated setup updates only the owned entry and keeps its app ID. Space/non-ASCII
paths work; embedded double quotes/control characters are reported unsupported.
No Steam process is killed and no permissions changed.

Flatpak Steam is detected but automatic host-app shortcuts are unsupported with its
default sandbox. Its database is left unchanged. Native Steam is required for
this integration; supported Flatpak streaming browsers can still be used.

PORTABLE APPIMAGE
Verify, allow execution and open it in Desktop Mode. Missing supported browser
setup offers Install/Quit and progress. Native Steam setup is attempted without
creating an application-menu entry. Keep its file at the chosen path, reopening
after moves to refresh the owned shortcut. Steam uses the original AppImage with
--appimage-extract-and-run and a stable copied icon. If FUSE is unavailable, run
./streamdeck-launcher-1.1.0-beta.1-linux-x86_64.AppImage --appimage-extract-and-run
or use the archive.

CONTROLLER / PLAYBACK
Left stick/D-pad move tiles, A launches, B closes Setup or asks before quitting.
Menu/F1 opens Setup. B can return from the configured supported browser on X11/
XWayland, leaving it open/unchanged. This uses the open launcher's normal Gamepad
API, without global keyboard hooks/input grabbing. Setup can disable it. Native
Wayland return is unavailable; real background Steam Input delivery is unverified.

Exactly one display inhibitor follows fresh browser-wide MPRIS Playing for
recognized Chromium/Google Chrome/Brave/Firefox identities. Pause/stop/player loss,
errors/expiry and app quit release it. Other tabs in that browser family can
inhibit; exact launched-tab attribution is unavailable. No titles/media URLs/
history/metadata are requested/stored, no debugging ports/extensions/profiles are
added. Unknown wrappers/browsers without MPRIS show unsupported/off. Buffering
follows reported state. Keep the launcher open for monitoring. Counts measure
browser-command starts rather than successful login/playback.

PREREQUISITES / LIMITS
Requires glibc Linux x86_64, Bash/core tools/ldd, Electron-compatible GTK3/GLib/GIO/
NSS/DBus/ATK/CUPS/DRM/GBM/ALSA/X11/Wayland libraries, graphics and native sandbox
support. Playback needs gdbus/the user session bus; B-return needs xprop and X11/
XWayland foreground identity/focus. Repair OS prerequisites/Flatpak with supported
distribution tools. No sudo/system package manager/privileged install/security
changes or broad Flatpak permissions are automated. No silent sandbox fallback.

Automated tests use harmless Node/browser/Flatpak/Steam fixtures. The graphical
feature check uses real Electron/session bus with synthetic controller/window/
MPRIS data. It does not establish physical-controller/real-Steam compatibility.
Steam Deck/Bazzite native sandbox, Gaming Mode, native Wayland, background Steam
Input, real Steam shortcuts, live browser downloads, login persistence and DRM/
codecs/playback still need target-device testing. --no-sandbox/--disable-gpu are
explicit isolated-test exceptions, never production defaults.

DIAGNOSIS / UNINSTALL / LEGACY DATA
app/streamdeck-launcher supports --streamdeck-check-dependencies (check-only),
--streamdeck-setup-dependencies (browser setup) and --streamdeck-check-playback.
Console/dependency-error.txt/log.txt in the settings folder show errors; kdialog/
zenity show native startup errors when available.

The archive installs at ${XDG_DATA_HOME:-~/.local/share}/streamdeck-launcher.
Quit launcher copies before upgrade. Use its installed uninstall.sh to remove the
owned app/menu entry. Settings/profiles/backups/Steam shortcuts are retained;
remove obsolete Steam entries through Steam if desired.

Old clones/Node/Volta/downloads/profiles are not swept or imported. The shared menu
entry is backed up, symlink targets unchanged and unknown/symlinked app directories
refused. Keep custom data outside the owned binary app directory. Do not run old
source uninstallers after switching the shared shortcut: old copies can follow it
to delete the new app. Refresh imported entries retaining v1.0.7's --no-sandbox.
Failed browser setup can leave a user remote/download cache; repeat rechecks
without deleting data.

Project code retains the MIT License, copyright (c) 2023 n47h4ni3l. Bundled
dependencies retain their own licenses/notices. Service logos belong to their
respective owners; no service affiliation or endorsement is claimed.
