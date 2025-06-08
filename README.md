# Stream Deck Launcher

Unified streaming dashboard for **Steam Deck** (and any Linux desktop).  
Built with Electron — controller-friendly UI, persistent login, usage tracking, no-sleep.

## Quick Install

Download and verify the installer script:

```bash
curl -fsSL -o /tmp/stream-deck-install.sh \
  https://raw.githubusercontent.com/n47h4ni3l/Stream-Deck/main/install.sh
echo "f39e1189e898c3f494f21561f2d755bbff384e34faacc1eb87e344cfcc29a6a8  /tmp/stream-deck-install.sh" | sha256sum -c -
bash /tmp/stream-deck-install.sh
```

The checksum check ensures the script has not been tampered with before it
installs dependencies and launches the Stream Deck Launcher.
---

The checksum changes whenever `install.sh` is modified, so recompute the hash if you download a new version.

---

## Features

> Netflix, Max, Hulu, YouTube, Stan, Prime, Paramount+, Crunchyroll, Disney+, Apple TV+, Peacock, BBC iPlayer, Tubi, Pluto TV, Kayo, Binge  
> Tiles sort by most used  
> Persistent login (opens external browser — remembers sessions)  
> No-sleep while running  
> Controller-friendly  
> Steam Deck Gaming Mode compatible  


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

This project requires **Node.js 18**, as specified in `.nvmrc` and the CI workflow.

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
