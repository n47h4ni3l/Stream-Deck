#!/usr/bin/env bash

set -euo pipefail

echo "Stream Deck Launcher Installer (Steam Deck Safe Version)"
echo "--------------------------------------------"

# The installer avoids any system modifications requiring root access so it
# remains compatible with immutable SteamOS.

# No root privileges required. This script does not modify system files.

# Ensure required commands are available
command -v flatpak >/dev/null 2>&1 || {
  echo "flatpak is required but not installed. Aborting." >&2
  exit 1
}
command -v git >/dev/null 2>&1 || {
  echo "git is required but not installed. Aborting." >&2
  exit 1
}
command -v curl >/dev/null 2>&1 || {
  echo "curl is required but not installed. Aborting." >&2
  exit 1
}

# Detect if we're already inside the repo
in_repo=0
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  repo_root="$(git rev-parse --show-toplevel)"
  if [ -f "$repo_root/package.json" ]; then
    echo "Detected existing Stream Deck repository at $repo_root"
    cd "$repo_root"
    in_repo=1
  fi
fi

# Add Flathub if not already present
echo "Checking Flathub..."
flatpak remote-add --user --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo

# Install Volta if needed and ensure it's on PATH
if [ ! -d "$HOME/.volta" ]; then
  echo "Installing Volta..."
  curl https://get.volta.sh | bash
else
  echo "Volta already installed."
fi
export VOLTA_HOME="$HOME/.volta"
export PATH="$VOLTA_HOME/bin:$PATH"

# Install Node.js and npm with Volta if not already installed
if ! volta which node >/dev/null 2>&1; then
  echo "Installing Node.js with Volta..."
  volta install node
else
  echo "Node.js already installed via Volta."
fi

if ! volta which npm >/dev/null 2>&1; then
  echo "Installing npm with Volta..."
  volta install npm
else
  echo "npm already installed via Volta."
fi

# Install Ungoogled Chromium via Flatpak
echo "Installing Ungoogled Chromium (via Flatpak)..."
flatpak install -y --user flathub com.github.Eloston.UngoogledChromium

# Clone repo if needed
if [ "$in_repo" -eq 0 ]; then
  echo "Cloning Stream Deck Launcher repo..."
  if [ -d Stream-Deck ]; then
    echo "Directory 'Stream-Deck' already exists, skipping clone."
  else
    git clone https://github.com/n47h4ni3l/Stream-Deck.git
  fi
  cd Stream-Deck
else
  echo "Using existing repository, skipping clone."
fi

# Install dependencies using the Volta-managed npm
echo "Running npm install..."
npm install

# Launch Stream Deck
echo "Launching Stream Deck Launcher..."
./StreamDeckLauncher.sh
