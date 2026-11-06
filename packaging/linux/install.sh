#!/usr/bin/env bash
set -euo pipefail
source_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
data_dir="${XDG_DATA_HOME:-$HOME/.local/share}"
config_dir="${XDG_CONFIG_HOME:-$HOME/.config}/streamdeck-launcher"
install_dir="$data_dir/streamdeck-launcher"
desktop_file="$data_dir/applications/StreamDeckLauncher.desktop"

if [ "$(uname -s)" != Linux ] || [ "$(uname -m)" != x86_64 ]; then
  echo "This release requires Linux x86_64 (Steam Deck or a compatible desktop)." >&2
  exit 1
fi
if [ ! -x "$source_dir/app/streamdeck-launcher" ]; then
  echo "Extract the complete release archive before running install.sh." >&2
  exit 1
fi
# Restrict paths to ones that can be represented unambiguously in the shortcut.
case "$install_dir" in
  /*) ;;
  *) echo "XDG_DATA_HOME must be an absolute path." >&2; exit 1 ;;
esac
case "$install_dir" in
  *$'\n'*|*$'\r'*|*$'\t'*) echo "Installation paths cannot contain control characters." >&2; exit 1 ;;
esac
if [ -L "$install_dir" ]; then
  echo "Refusing to replace a symlinked installation directory: $install_dir" >&2
  exit 1
fi
if [ -e "$install_dir" ] && [ ! -f "$install_dir/.streamdeck-release" ]; then
  echo "Refusing to overwrite an unrecognized directory: $install_dir" >&2
  exit 1
fi
if [ "$source_dir" = "$install_dir" ]; then
  echo "Run install.sh from the extracted download, outside the installed directory." >&2
  exit 1
fi

# The dashboard contains Electron. Only the streaming browser is external.
# Keep an existing choice unless the caller explicitly provides a replacement.
browser_cmd="${CHROMIUM_CMD:-}"
if [ -z "$browser_cmd" ] && [ -f "$config_dir/browser_cmd" ]; then
  browser_cmd="$(cat "$config_dir/browser_cmd")"
fi
if [ -d "$HOME/Stream-Deck" ]; then
  echo "Legacy source folder kept: $HOME/Stream-Deck"
  if [ -z "$browser_cmd" ] && [ -f "$HOME/Stream-Deck/browser_cmd" ]; then
    echo "Its browser_cmd is kept. Set CHROMIUM_CMD to your existing browser command to keep using that browser."
  fi
fi
if [ -e "$desktop_file" ]; then
  echo "The previous menu shortcut will be backed up. Old source folders and Steam shortcuts are kept."
fi
if [ -d "$HOME/Stream-Deck" ] || [ -e "$desktop_file" ]; then
  echo "After installing this release, use its installed uninstall.sh; old source uninstallers follow the shared menu shortcut."
fi
echo "Checking native libraries, graphics/sandbox startup and the streaming browser."
echo "Missing supported browser Flatpaks will be installed for your user account; no system packages or security settings are changed."
CHROMIUM_CMD="$browser_cmd" "$source_dir/app/streamdeck-launcher" --streamdeck-setup-dependencies

# Stage the complete new installation before replacing a recognized old one.
mkdir -p "$data_dir" "$data_dir/applications" "$config_dir"
stage="$(mktemp -d "$data_dir/.streamdeck-install.XXXXXX")"
desktop_tmp=""
cleanup() {
  rm -rf -- "$stage"
  if [ -n "$desktop_tmp" ]; then rm -f -- "$desktop_tmp"; fi
}
trap cleanup EXIT
cp -a "$source_dir/app" "$stage/app"
for file in StreamDeckLauncher.sh uninstall.sh README.txt LICENSE BUILD-INFO.json; do
  cp "$source_dir/$file" "$stage/$file"
done
chmod +x "$stage/StreamDeckLauncher.sh" "$stage/uninstall.sh"
touch "$stage/.streamdeck-release"
if [ -e "$install_dir" ]; then
  mv -- "$install_dir" "$stage/previous"
fi
if ! mv -- "$stage" "$install_dir"; then
  if [ -d "$stage/previous" ]; then mv -- "$stage/previous" "$install_dir"; fi
  exit 1
fi
# The old app is within this recognized new install; settings live separately.
rm -rf -- "$install_dir/previous"
if [ -n "$browser_cmd" ]; then
  printf '%s\n' "$browser_cmd" > "$config_dir/browser_cmd"
fi

desktop_escape() {
  local value="$1"
  value="${value//\\/\\\\}"
  printf '%s' "$value"
}
exec_path="$install_dir/StreamDeckLauncher.sh"
exec_path="${exec_path//\\/\\\\}"
exec_path="${exec_path//\"/\\\"}"
exec_path="${exec_path//\$/\\\$}"
exec_path="${exec_path//\`/\\\`}"
exec_path="${exec_path//%/%%}"
if [ -e "$desktop_file" ]; then
  mkdir -p "$config_dir/shortcut-backups"
  shortcut_backup="$(mktemp -d "$config_dir/shortcut-backups/backup.XXXXXX")"
  cp -L -- "$desktop_file" "$shortcut_backup/StreamDeckLauncher.desktop"
  chmod 600 "$shortcut_backup/StreamDeckLauncher.desktop"
  printf 'Previous menu shortcut saved to %s\n' "$shortcut_backup/StreamDeckLauncher.desktop"
fi
# Replace a shortcut symlink itself; never write through it into an old checkout.
desktop_tmp="$(mktemp "$data_dir/applications/.StreamDeckLauncher.XXXXXX")"
cat > "$desktop_tmp" <<DESKTOP
[Desktop Entry]
Version=1.0
Type=Application
Name=Stream Deck Launcher
Comment=Streaming dashboard for Steam Deck
Exec="$(desktop_escape "$exec_path")"
Icon=$(desktop_escape "$install_dir/app/resources/icon.png")
Terminal=false
Categories=AudioVideo;
StartupNotify=false
X-StreamDeck-Release=true
DESKTOP
chmod +x "$desktop_tmp"
mv -f -- "$desktop_tmp" "$desktop_file"
if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$data_dir/applications" || true
fi
printf 'Installed Stream Deck Launcher. Open it from your application menu.\nSteam shortcut: %s\nUninstall: %s\n' \
  "$install_dir/StreamDeckLauncher.sh" "$install_dir/uninstall.sh"
if ! "$install_dir/app/streamdeck-launcher" --streamdeck-setup-steam \
  --launcher "$install_dir/StreamDeckLauncher.sh" --icon "$install_dir/app/resources/icon.png"; then
  echo "The app is installed, but Steam setup is pending. Open Setup in the launcher to select an account or retry after quitting Steam."
fi
