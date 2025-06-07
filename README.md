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

2. Run the installer script to set up requirements and download Chromium. If `pacman` fails to sync (common on SteamOS due to a read-only filesystem), the script now attempts to disable the read-only mode and retry automatically:

```bash
./install.sh
```

3. Launch Stream Deck:

```bash
./StreamDeckLauncher.sh
```

4. (Optional) add `StreamDeckLauncher.sh` to Steam to use in Gaming Mode.

Installation complete! Launch from your Steam library and sign in to your favorite streaming services.

---

Service logos remain the property of their respective owners. This project has no affiliation with or endorsement from any streaming service.
