#!/usr/bin/env bash
set -euo pipefail

# Stream Deck Launcher Script - Final Version
# Launches Electron app using Ungoogled Chromium Flatpak

# Ensure Volta-managed Node.js is on PATH
export VOLTA_HOME="$HOME/.volta"
export PATH="$VOLTA_HOME/bin:$PATH"

# Set working directory to script location
cd "$(dirname "$0")"

# Set up logging
LOG_FILE="$PWD/log.txt"
exec > >(tee -a "$LOG_FILE") 2>&1
set -x

# Ensure npm dependencies are installed
if [ ! -d node_modules/electron ]; then
    echo "Installing npm dependencies..."
    npm install
fi

# Determine how to run npx
if command -v npx >/dev/null 2>&1; then
    NPX_CMD=(npx --yes)
elif command -v flatpak >/dev/null 2>&1; then
    NPX_CMD=(flatpak run --command=npx org.nodejs.Node --yes)
else
    echo "npx not found - install Node.js." >&2
    exit 1
fi

# Detect Wayland or X11
if [ "${XDG_SESSION_TYPE:-}" = "wayland" ] || [ -n "${WAYLAND_DISPLAY:-}" ]; then
  echo "Detected Wayland session. Launching with Wayland flags..."
  "${NPX_CMD[@]}" electron . --enable-features=UseOzonePlatform --ozone-platform=wayland
else
  echo "Detected X11 session. Launching without Wayland flags..."
  "${NPX_CMD[@]}" electron .
fi
