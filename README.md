# Stream Deck Launcher

Stream Deck Launcher is a simple dashboard for launching streaming services on a Steam Deck or other Linux systems. It uses Electron to display tiles for each service and opens them in Ungoogled Chromium by default.

## Features
- Large, controller-friendly interface
- Remembers how often each service is launched and sorts tiles accordingly
- Persistent logins for each service
- Prevents the device from going to sleep while in video playback
- Works with both Desktop Mode and Gaming Mode

## Installation
Run the included `install.sh` script. It clones the repository if needed, installs the required Node.js version via [Volta](https://volta.sh), installs npm dependencies and creates a desktop entry:

```bash
bash install.sh
```

After installation you will find **Stream Deck Launcher** in your application menu. You can also start it directly with `./StreamDeckLauncher.sh`.

## Custom Browser
By default the launcher starts Ungoogled Chromium via Flatpak. Set the `CHROMIUM_CMD` environment variable to override the browser command. The value is split on whitespace and used as the executable and arguments.

Example:
```bash
CHROMIUM_CMD="/usr/bin/chromium --ozone-platform=wayland" ./StreamDeckLauncher.sh
```

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
Run `npm run build` to create distributable packages with Electron Builder. The artifacts appear in the `dist/` directory and currently only Linux output is generated.

## Adding a Service
1. Add the service URL to the `services` object in [`main.js`](main.js). Use the desired display name as the key.
2. Place a `150x150` PNG icon in the `icons/` directory. Filenames are derived from the service name by converting it to lowercase and stripping all non-alphanumeric characters, as done in `index.html`. For example, an icon for **Pluto TV** must be saved as `plutotv.png`.
3. Restart the launcher or run `npm start` to see the new tile.

---

Service logos remain the property of their respective owners. This project has no affiliation with or endorsement from any streaming service.

---

## Community
We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines and how to submit pull requests.

Our [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) explains the standards we expect from everyone in the project community.

For information on reporting vulnerabilities, refer to [SECURITY.md](SECURITY.md).
