# Stream Deck Launcher

Unified streaming dashboard for **Steam Deck** (and any Linux desktop).  
Built with Electron — controller-friendly UI, persistent login, usage tracking, no-sleep.

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

1. Install Requirements:

```
sudo pacman -S git nodejs npm
```

Or via Discover:

* Git
* Node.js + npm

2. Download Stream Deck Launcher:

```
git clone https://github.com/n47h4ni3l/Stream-Deck.git
cd Stream-Deck
```

3. Install dependencies:

```
npm install
```

4. Download Chromium AppImage (not included):

Download `Chromium-x86-64.AppImage` and place it at `chromium/Chromium-x86-64.AppImage`.

5. Make Chromium executable:

```
chmod +x chromium/Chromium-x86-64.AppImage
```

6. Launch Stream Deck:

```
./StreamDeckLauncher.sh
```

7. Add to Steam:

* In Desktop Mode → open Steam
* Add `StreamDeckLauncher.sh` as a Non-Steam Game
* Now run it in Gaming Mode

Installation complete! Launch from your Steam library and sign in to your favorite streaming services.

---

Service logos remain the property of their respective owners. This project has no affiliation with or endorsement from any streaming service.
