# Stream Deck Launcher

Unified streaming dashboard for **Steam Deck** (and any Linux desktop).  
Built with Electron — controller-friendly UI, persistent login, usage tracking, no-sleep.

## Quick Install

Run the installer script directly from GitHub:

```bash
wget https://raw.githubusercontent.com/n47h4ni3l/Stream-Deck/main/install.sh
chmod +x install.sh
./install.sh
```

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

1. Clone Stream Deck Launcher:

```bash
git clone https://github.com/n47h4ni3l/Stream-Deck.git
cd Stream-Deck
```

2. Run the installer script to set up requirements and download Chromium. When SteamOS is detected the script installs Node via **Flatpak** and skips the read-only workaround. `pacman` is only used on other Arch-based systems where the script will disable read-only mode and retry if a sync fails:

```bash
./install.sh
```
If the script reports **"No supported package manager found"**,
install `git`, `nodejs` and `npm` manually using your package manager
and then run `./install.sh` again.

3. Launch Stream Deck:

```bash
./StreamDeckLauncher.sh
```

4. (Optional) add `StreamDeckLauncher.sh` to Steam to use in Gaming Mode.

Installation complete! Launch from your Steam library and sign in to your favorite streaming services.

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

---

Service logos remain the property of their respective owners. This project has no affiliation with or endorsement from any streaming service.
