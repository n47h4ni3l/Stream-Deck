#!/usr/bin/env bash

set -euo pipefail

echo "Stream Deck Launcher Installer (Steam Deck Safe Version)"
echo "--------------------------------------------"

# Ensure read-only FS is re-enabled on exit if steamos-readonly exists
if command -v steamos-readonly >/dev/null 2>&1; then
  sudo steamos-readonly disable
  trap 'sudo steamos-readonly enable' EXIT
fi

# Ensure required commands are available
command -v flatpak >/dev/null 2>&1 || {
  echo "flatpak is required but not installed. Aborting." >&2
  exit 1
}
command -v git >/dev/null 2>&1 || {
  echo "git is required but not installed. Aborting." >&2
  exit 1
}

# Add Flathub if not already present
echo "Checking Flathub..."
flatpak remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo

# Install Node.js extension via Flatpak
echo "Installing Node.js (via Flatpak)..."
flatpak install -y flathub org.freedesktop.Sdk.Extension.node20

# Install Ungoogled Chromium via Flatpak
echo "Installing Ungoogled Chromium (via Flatpak)..."
flatpak install -y flathub com.github.Eloston.UngoogledChromium

# Clone repo
echo "Cloning Stream Deck Launcher repo..."
if [ -d Stream-Deck ]; then
  echo "Directory 'Stream-Deck' already exists, skipping clone."
else
  git clone https://github.com/n47h4ni3l/Stream-Deck.git
fi
cd Stream-Deck

# Install dependencies via Flatpak Node.js
echo "Running npm install (via Flatpak Node.js)..."
flatpak run --command=npm org.freedesktop.Sdk.Extension.node20 npm install

# Launch Stream Deck
echo "Launching Stream Deck Launcher..."
./StreamDeckLauncher.sh
