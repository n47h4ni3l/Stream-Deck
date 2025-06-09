#!/usr/bin/env bash
set -euo pipefail

# Install Stream Deck Launcher on SteamOS or other Linux systems

# Determine if running inside the repository
in_repo=1
if [ ! -f "StreamDeckLauncher.sh" ]; then
  in_repo=0
fi

# Clone repo if needed
if [ "$in_repo" -eq 0 ]; then
  target_dir="$HOME/Stream-Deck"
  if [ -d "$target_dir" ]; then
    echo "Cloning Stream-Deck repo to $target_dir..."
    rm -rf "$target_dir"
  else
    echo "Cloning Stream-Deck repo to $target_dir..."
  fi
  git clone https://github.com/n47h4ni3l/Stream-Deck.git "$target_dir"
  cd "$target_dir"
else
  target_dir="$(pwd)"
fi

# Normalize line endings for the launcher script
sed -i 's/\r$//' StreamDeckLauncher.sh

install_dir="$(pwd)"
chmod +x "$install_dir/StreamDeckLauncher.sh"

# Ensure required commands exist
for cmd in flatpak git curl node; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "$cmd is required but not installed. Aborting." >&2
    exit 1
  fi
done

# Add Flathub remote if missing
echo "Checking Flathub..."
flatpak remote-add --user --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo

# Install Volta if not present
if [ ! -d "$HOME/.volta" ]; then
  echo "Installing Volta..."
  curl -fsSL https://get.volta.sh -o /tmp/volta.sh
  bash /tmp/volta.sh
  rm -f /tmp/volta.sh
else
  echo "Volta already installed."
fi
export VOLTA_HOME="$HOME/.volta"
export PATH="$VOLTA_HOME/bin:$PATH"

# Ensure Node.js version matches .nvmrc
required_node="$(cat "$install_dir/.nvmrc")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js $required_node is required but not installed. Aborting." >&2
  exit 1
fi
current_node="$(node --version)"
current_major="$(echo "$current_node" | sed -E 's/^v([0-9]+).*$/\1/')"
if [ "$current_major" != "$required_node" ]; then
  echo "Detected Node.js $current_node but version $required_node is required. Aborting." >&2
  exit 1
fi

# Install npm dependencies
npm install

# Create desktop file
desktop_dir="$HOME/.local/share/applications"
mkdir -p "$desktop_dir"
desktop_file="$desktop_dir/StreamDeckLauncher.desktop"
cat > "$desktop_file" <<DESK
[Desktop Entry]
Version=1.0
Type=Application
Name=Stream Deck Launcher
Comment=Unified streaming launcher for Steam Deck
Exec="${install_dir}/StreamDeckLauncher.sh"
Path="${install_dir}"
Icon="${install_dir}/build/icon.png"
Terminal=false
Categories=Utility;
StartupNotify=false
DESK
chmod +x "$desktop_file"

echo "Installation complete."
