#!/usr/bin/env bash

set -euo pipefail

# Always operate from the directory containing this script so relative paths
# work regardless of where the installer was launched from.
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$script_dir"

echo "Stream Deck Launcher Installer (Steam Deck Safe Version)"
echo "--------------------------------------------"

# The installer avoids any system modifications requiring root access so it
# remains compatible with immutable SteamOS.

# No root privileges required. This script does not modify system files.

# Determine if we're already inside the repository
in_repo=0
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  repo_root="$(git rev-parse --show-toplevel)"
  if [ -f "$repo_root/package.json" ]; then
    echo "Detected existing Stream Deck repository at $repo_root"
    cd "$repo_root"
    in_repo=1
  fi
fi

# Clone repo when running outside it
if [ "$in_repo" -eq 0 ]; then
  if [ ! -d "Stream-Deck" ]; then
    echo "Cloning Stream-Deck repo..."
    git clone https://github.com/n47h4ni3l/Stream-Deck.git
  fi
  cd Stream-Deck
fi

# Remember where the repository lives so we can update the desktop file later
install_dir="$(pwd)"

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

# Add Flathub if not already present
echo "Checking Flathub..."
flatpak remote-add --user --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo

# Install Volta if needed and ensure it's on PATH
if [ ! -d "$HOME/.volta" ]; then
  echo "Installing Volta..."
  tmp_volta_installer="$(mktemp)"
  curl -fsSL https://get.volta.sh -o "$tmp_volta_installer"
  echo "fbdc4b8cb33fb6d19e5f07b22423265943d34e7e5c3d5a1efcecc9621854f9cb  $tmp_volta_installer" | sha256sum -c -
  bash "$tmp_volta_installer"
  rm -f "$tmp_volta_installer"
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

# Install latest Ungoogled Chromium via Flatpak (new app ID)
echo "Installing Ungoogled Chromium (via Flatpak)..."
flatpak install -y --user flathub io.github.ungoogled_software.ungoogled_chromium

# Install dependencies using the Volta-managed npm
echo "Running npm install..."
npm install

# Ensure launcher script is executable
echo "Setting launcher permissions..."
chmod +x StreamDeckLauncher.sh

# Install .desktop shortcut
echo "Installing desktop shortcut..."

desktop_file_target="$HOME/.local/share/applications/StreamDeckLauncher.desktop"

echo "Copying StreamDeckLauncher.desktop to $desktop_file_target..."
mkdir -p "$(dirname "$desktop_file_target")"
# Replace the placeholder path in the .desktop file with the actual install directory
sed_expr="s|\\\$HOME/Stream-Deck|$install_dir|g"
sed "$sed_expr" StreamDeckLauncher.desktop > "$desktop_file_target"

chmod +x "$desktop_file_target"

echo "Desktop shortcut installed at: $desktop_file_target"
echo

# Launch the app
echo "Launching Stream Deck Launcher..."
./StreamDeckLauncher.sh
