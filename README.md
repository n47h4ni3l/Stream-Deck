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

4. Make Chromium executable:

```
chmod +x chromium/Chromium-x86-64.AppImage
```

5. Launch Stream Deck:

```
./StreamDeckLauncher.sh
```

6. Add to Steam:

* In Desktop Mode → open Steam
* Add `StreamDeckLauncher.sh` as a Non-Steam Game
* Now run it in Gaming Mode
