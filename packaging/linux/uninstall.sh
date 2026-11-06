#!/usr/bin/env bash
set -euo pipefail
data_dir="${XDG_DATA_HOME:-$HOME/.local/share}"
install_dir="$data_dir/streamdeck-launcher"
desktop_file="$data_dir/applications/StreamDeckLauncher.desktop"
case "$data_dir" in
  /*) ;;
  *) echo "XDG_DATA_HOME must be an absolute path." >&2; exit 1 ;;
esac
if [ -L "$install_dir" ]; then
  echo "Refusing to remove a symlinked installation directory: $install_dir" >&2
  exit 1
fi
remove_owned_shortcut() {
  if [ -f "$desktop_file" ] && grep -Fxq 'X-StreamDeck-Release=true' "$desktop_file"; then
    rm -f -- "$desktop_file"
  elif [ -e "$desktop_file" ]; then
    echo "Kept the current menu shortcut because it no longer belongs to this release."
  fi
}
if [ ! -e "$install_dir" ]; then
  remove_owned_shortcut
  echo "Stream Deck Launcher is already uninstalled."
  exit 0
fi
if [ ! -f "$install_dir/.streamdeck-release" ]; then
  echo "Refusing to remove an unrecognized directory: $install_dir" >&2
  exit 1
fi
# Never infer a recursive deletion target from editable desktop-file contents.
rm -rf -- "$install_dir"
remove_owned_shortcut
echo "Stream Deck Launcher uninstalled. Settings, usage and browser profiles were kept."
