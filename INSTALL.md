# Install Stream Deck Launcher

The beta downloads support **glibc-based Linux x86_64**. Use Desktop Mode. Steam Deck/SteamOS and Bazzite are intended targets with real-device acceptance still outstanding. These packages do not support Windows, macOS, ARM or musl-based Linux.

## Recommended: installer archive

Download these from [v1.1.0-beta.1](https://github.com/n47h4ni3l/Stream-Deck/releases/tag/v1.1.0-beta.1):

- `streamdeck-launcher-1.1.0-beta.1-linux-x86_64.tar.gz`
- `SHA256SUMS`

In their download folder, verify and extract:

```bash
sha256sum --ignore-missing -c SHA256SUMS
tar -xzf streamdeck-launcher-1.1.0-beta.1-linux-x86_64.tar.gz
cd streamdeck-launcher-1.1.0-beta.1-linux-x86_64
./install.sh
```

Quit Steam completely first if you want the native Steam shortcut created immediately. The app installs under `${XDG_DATA_HOME:-~/.local/share}/streamdeck-launcher` and creates an application-menu entry. Electron/Node are included, so system Node.js/npm/git/Volta, FUSE and root access are unnecessary.

Before copying, setup checks native libraries, an actual isolated graphics/sandbox renderer, playback transport and the browser. Missing supported browser Flatpaks/runtimes can be installed from Flathub for your account. Existing browsers are reused; failed checks stop with an actionable message. Setup does not install OS packages or change security settings.

If Steam is running, the app still installs but shortcut setup is pending. Quit Steam, open the launcher and choose **Setup → Retry Steam setup**. Choose the intended account there if multiple accounts/installations are ambiguous. Databases are backed up privately before changes; unrelated games and custom shortcut settings are kept. Flatpak Steam's default sandbox cannot launch this host installation, so automatic integration reports unsupported and leaves its database untouched.

## Portable AppImage

Download the AppImage and `SHA256SUMS` from the same release, verify them, then allow execution in file properties or run:

```bash
sha256sum --ignore-missing -c SHA256SUMS
chmod +x streamdeck-launcher-1.1.0-beta.1-linux-x86_64.AppImage
./streamdeck-launcher-1.1.0-beta.1-linux-x86_64.AppImage
```

If mounting fails because FUSE is unavailable:

```bash
./streamdeck-launcher-1.1.0-beta.1-linux-x86_64.AppImage --appimage-extract-and-run
```

The portable app checks the browser after it can start, offering Install/Quit and progress for a missing supported browser. Native Steam setup is attempted; no application-menu entry is created. Keep the AppImage at its chosen path. After moving it, quit Steam and reopen the file or retry Setup to update the owned shortcut. The Steam entry uses the original file with the FUSE-free launch argument and a stable copied icon.

## Browser and OS prerequisites

The default browser is Ungoogled Chromium from Flathub. The Flatpak CLI must already be available. To select supported Google Chrome for an archive installation:

```bash
CHROMIUM_CMD='flatpak run com.google.Chrome' ./install.sh
```

An installed native browser command may also be supplied through `CHROMIUM_CMD`. Commands must resolve to an executable and contain no shell operators. Unknown native wrappers can launch but do not gain playback/return detection by assumption. A custom command's executable check does not prove all dependencies inside an arbitrary script.

Required host libraries include GTK 3, GLib/GIO, NSS, DBus, ATK, CUPS, DRM/GBM, ALSA and X11/Wayland. Graphics and native sandbox support must work. Playback detection requires `gdbus` and the user session bus; browser B-return requires `xprop` with X11/XWayland foreground identity/focus. Repair OS prerequisites/Flatpak/FUSE/sandbox support through distribution tools. No sudo, OS package manager, broad permissions or sandbox-disabling fallback is automated.

Browser setup needs Internet access/disk space. DRM/Widevine/codecs, sign-in and service playback depend on the chosen browser/profile/service. Existing external profiles are reused; real login persistence is unverified. Native Wayland browser return is unavailable; background controller delivery and Gaming Mode require real-device acceptance.

## Update, uninstall and old attempts

Quit launcher copies before updating. For the archive, run the new release's installer; recognized owned app files are replaced while settings/profiles remain. For an AppImage, use the new file and refresh its owned Steam shortcut after quitting Steam.

Remove an archive installation with its installed uninstaller:

```bash
"${XDG_DATA_HOME:-$HOME/.local/share}/streamdeck-launcher/uninstall.sh"
```

It removes the owned application/menu entry and retains settings, browser profiles, backups and Steam shortcuts. Remove obsolete Steam entries through Steam if desired. A portable AppImage can be deleted after closing it; its retained settings/Steam entry are separate.

Old clones/downloads/Node/Volta/profiles are not swept or imported. Keep custom data outside the owned binary app directory. **Do not run an old source uninstaller after switching the shared menu shortcut:** old copies can follow it to remove the new app. Use the installed release's uninstaller. Earlier failed attempts and browser-download caches remain for manual review.

Native startup errors are shown in the terminal/dialog when available and recorded in `dependency-error.txt`; app errors go to `log.txt` under `${XDG_CONFIG_HOME:-~/.config}/streamdeck-launcher`. Setup displays playback, Steam and return capability status. See [README.md](README.md) for controls and [TESTING.md](TESTING.md) for beta validation limits.
