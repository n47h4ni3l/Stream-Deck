#!/usr/bin/env bash
set -euo pipefail

# Remove Stream Deck Launcher installation

desktop_file="$HOME/.local/share/applications/StreamDeckLauncher.desktop"
install_dir=""

if [ -f "$desktop_file" ]; then
  # Extract install directory from Exec line, removing quotes and ignoring arguments
  exec_path=$(grep -E '^Exec=' "$desktop_file" | head -n1 | cut -d '=' -f2- | sed -E 's/^"([^"]+)"(.*)$/\1/')
  install_dir="$(dirname "$exec_path")"
  rm -f "$desktop_file"
  echo "Removed $desktop_file"
else
  echo "Desktop file not found at $desktop_file"
fi

# Delete installation directory if it exists
if [ -n "$install_dir" ] && [ -d "$install_dir" ]; then
  echo "Removing installation directory $install_dir"
  rm -rf "$install_dir"
else
  echo "Install directory not found or already removed"
fi

echo "Uninstall complete."
