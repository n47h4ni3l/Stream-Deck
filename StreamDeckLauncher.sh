#!/bin/bash

# Stream Deck Launcher Script - Final Version
# Launches Electron app with bundled Chromium launcher support

# Set working directory to script location
cd "$(dirname "$0")"

# Make sure Chromium AppImage is executable
chmod +x chromium/Chromium-x86-64.AppImage

# Run Electron app (fullscreen / Deck-friendly)
npx electron . --enable-features=OverlayScrollbar --kiosk
