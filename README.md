# Stream Deck Launcher

Stream Deck Launcher is a simple dashboard for launching streaming services on a Steam Deck or other Linux systems. It uses Electron to display tiles for each service and opens them in Ungoogled Chromium by default.

## Features
- Large, controller-friendly interface
- Remembers how often each service is launched and sorts tiles accordingly
- Persistent logins for each service
- Prevents the device from going to sleep while in video playback
- Works with both Desktop Mode and Gaming Mode

## Installation
Run the included `install.sh` script. It clones the repository if needed, installs the required Node.js version via [Volta](https://volta.sh), installs npm dependencies and creates a desktop entry. During installation a pop-up window lets you choose between the bundled Ungoogled Chromium or a custom browser command:

```bash
bash install.sh
```

The installer verifies that your chosen browser exists. If you select the bundled Ungoogled Chromium and it is missing, the Flatpak is installed automatically (ensure the `flatpak` command is available). Custom commands must resolve to an executable or the install will abort.

After installation you will find **Stream Deck Launcher** in your application menu. You can also start it directly with `./StreamDeckLauncher.sh`.
If you later want to change the browser command, edit the `browser_cmd` file in the installation directory.
## Adding to Steam
To launch the dashboard from Gaming Mode, add the script as a Non-Steam game:
1. Open Steam in Desktop Mode and choose "Add a Non-Steam Game".
2. Browse to the installation directory and select `StreamDeckLauncher.sh`.
3. The script clears `LD_PRELOAD` internally so the Steam overlay does not crash Electron.


## Uninstallation
Run `uninstall.sh` from the cloned repository to remove the launcher. The script
deletes the desktop entry and the installation directory referenced inside it:

```bash
bash uninstall.sh
```


### Extra Electron Flags
Set `ELECTRON_EXTRA_FLAGS` to append additional flags when launching Electron. This is useful for options like `--no-sandbox` that some SteamOS setups require.

Example:
```bash
ELECTRON_EXTRA_FLAGS="--no-sandbox" ./StreamDeckLauncher.sh
```
Set `ELECTRON_FLAGS_OUTPUT` to a file path to capture the flags used during
launch. The script creates the directory if needed and writes the contents of
`ELECTRON_EXTRA_FLAGS` for debugging purposes.

---

## Development
This project requires **Node.js 18**, as specified in `.nvmrc` and the CI workflow.

Install Node.js dependencies and run the test and lint tasks:
```bash
npm install
npm test
npm run lint
```
`npm install` installs Jest and ESLint from `devDependencies`.

### Building packages
Run `npm run build` to create an AppImage with Electron Builder. The output appears in the `dist/` directory. To produce a Flatpak, add `"target": ["AppImage", "flatpak"]` under `build.linux` in `package.json` and run the command again.
When reusing its cache electron-builder may warn that it "cannot move downloaded into final location". The message is harmless but you can remove `~/.cache/electron-builder` before running `npm run build` if you want to clear the cache.

## Adding a Service
1. Add the service URL to the `services` object in [`main.js`](main.js). Use the desired display name as the key.
2. Place a `150x150` PNG icon in the `icons/` directory. Filenames are derived from the service name by converting it to lowercase and stripping all non-alphanumeric characters, as done in `index.html`. For example, an icon for **Pluto TV** must be saved as `plutotv.png`.
3. Restart the launcher or run `npm start` to see the new tile.

---

Service logos remain the property of their respective owners. This project has no affiliation with or endorsement from any streaming service.

---

## Troubleshooting
All launcher output is appended to `log.txt` in the installation directory. Run the launcher manually to view verbose logs:

```bash
./StreamDeckLauncher.sh
```

Wayland mode automatically activates when `XDG_SESSION_TYPE=wayland` or `WAYLAND_DISPLAY` is set.

`LD_PRELOAD` is cleared automatically to avoid conflicts with Steam's overlay.

If the shortcut launched through Steam crashes with a `SIGTRAP` or "zygote" error, check that `LD_PRELOAD` is cleared and try adding `--no-sandbox`. Review the `log.txt` file in your installation directory for details.

If Electron or Chromium refuses to start due to sandbox errors on SteamOS, pass the `--no-sandbox` flag using `ELECTRON_EXTRA_FLAGS` or include it in your chosen browser command.

---

## Community
We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines and how to submit pull requests.

Our [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) explains the standards we expect from everyone in the project community.

For information on reporting vulnerabilities, refer to [SECURITY.md](SECURITY.md).
