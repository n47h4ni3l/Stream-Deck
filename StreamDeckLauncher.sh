#!/bin/bash

# Stream Deck Launcher Script
# Launches Electron app in fullscreen

# Optional: Set working directory
cd "$(dirname "$0")"

# Run Electron app
npx electron . --enable-features=OverlayScrollbar --kiosk
