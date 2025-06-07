# Stream Deck Launcher

Unified streaming dashboard for **Steam Deck** (and any Linux desktop).  
Built with Electron — controller-friendly UI, persistent login, usage tracking, no-sleep.

## Quick Install

Install in one step using `curl`:

```bash
curl -fsSL https://raw.githubusercontent.com/n47h4ni3l/Stream-Deck/main/install.sh | bash
```

This command pipes the script directly to bash, which installs all required
dependencies and then launches the Stream Deck Launcher.

---

## Features

> Netflix, Max, Hulu, YouTube, Stan, Prime, Paramount+, Crunchyroll, Disney+, Apple TV+, Peacock, BBC iPlayer, Tubi, Pluto TV, Kayo, Binge  
> Tiles sort by most used  
> Persistent login (opens external browser — remembers sessions)  
> No-sleep while running  
> Controller-friendly  
> Steam Deck Gaming Mode compatible  


---

## Download & Run Prebuilt Release

1. Go to the [releases page](https://github.com/n47h4ni3l/Stream-Deck/releases) and download the archive for your OS.
2. Extract the archive and run the included launcher:
   - **Windows**: run `Stream Deck Launcher.exe`
   - **macOS**: open `Stream Deck Launcher.app`
   - **Linux**: run `./StreamDeckLauncher` (make it executable if needed)

---

## Installation & Running
**QUICK INSTALL (Steam Deck & Linux)**

1. Clone Stream Deck Launcher (optional, the installer clones automatically if
   run outside the repo):

```bash
git clone https://github.com/n47h4ni3l/Stream-Deck.git
cd Stream-Deck
```

2. Run the installer script to install all requirements, including Node.js and **Ungoogled Chromium** via **Flatpak**. The script automatically handles the Steam Deck read-only filesystem and installs Flatpak packages in user mode, so it won't ask for a root password:

```bash
./install.sh
```
The script detects if it's already running from within the repository and skips
cloning automatically. If it reports **"No supported package manager found"**, 
install `git`, `nodejs` and `npm` manually using your package manager and then
run `./install.sh` again.

3. Launch Stream Deck:

```bash
./StreamDeckLauncher.sh
```

4. (Optional) add `StreamDeckLauncher.sh` to Steam to use in Gaming Mode.

Installation complete! Launch from your Steam library and sign in to your favorite streaming services.

### Custom Browser Command

By default the launcher starts Ungoogled Chromium via Flatpak. Set the
`CHROMIUM_CMD` environment variable to override the browser command. The value
is split on whitespace and used as the executable and arguments.

Example:

```bash
CHROMIUM_CMD="/usr/bin/chromium --ozone-platform=wayland" ./StreamDeckLauncher.sh
```

---

## Development

This project uses **Node.js 18** as specified in `.nvmrc` and the CI workflow.

Install Node.js dependencies and run the test and lint tasks:

```bash
npm install
npm test
npm run lint
```

`npm install` installs Jest and ESLint from `devDependencies`.

## Adding a Service

1. Add the service URL to the `services` object in [`main.js`](main.js). Use the
   desired display name as the key.
2. Place a `150x150` PNG icon in the `icons/` directory. Filenames are derived
   from the service name by converting it to lowercase and stripping all
   non-alphanumeric characters, as done in `index.html`. For example, an icon for
   **Pluto TV** must be saved as `plutotv.png`.
3. Restart the launcher or run `npm start` to see the new tile.

---

Service logos remain the property of their respective owners. This project has no affiliation with or endorsement from any streaming service.

---

## Community

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines and how to submit pull requests.

Our [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) explains the standards we expect from everyone in the project community.

For information on reporting vulnerabilities, refer to [SECURITY.md](SECURITY.md).
