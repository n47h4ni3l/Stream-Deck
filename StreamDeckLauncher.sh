#!/bin/bash
set -euo pipefail

# Stream Deck Launcher Script - Final Version
# Launches Electron app using Ungoogled Chromium Flatpak

# Set working directory to script location
cd "$(dirname "$0")"


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
