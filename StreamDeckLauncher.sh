#!/bin/bash

# Stream Deck Launcher Script - Final Version
# Launches Electron app with bundled Chromium launcher support

# Set working directory to script location
cd "$(dirname "$0")"

# Make sure Chromium AppImage is executable
chmod +x chromium/Chromium-x86-64.AppImage

# Determine how to run npx
if command -v npx >/dev/null 2>&1; then
    NPX_CMD="npx"
elif command -v flatpak >/dev/null 2>&1; then
    NPX_CMD="flatpak run --command=npx org.nodejs.Node"
else
    echo "npx not found – install Node.js." >&2
    exit 1
fi

# Run Electron app (fullscreen / Deck-friendly)
"$NPX_CMD" electron . --enable-features=OverlayScrollbar --kiosk
