#!/usr/bin/env bash
set -euo pipefail

# Install Stream Deck Launcher on SteamOS or other Linux systems

# Resolve the installer location, rather than assuming the caller's directory.
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
in_repo=1
if [ -f "$script_dir/StreamDeckLauncher.sh" ]; then
  cd "$script_dir"
elif [ ! -f "StreamDeckLauncher.sh" ]; then
  in_repo=0
fi

# Clone repo if needed
if [ "$in_repo" -eq 0 ]; then
  target_dir="$HOME/Stream-Deck"
  if [ -e "$target_dir" ]; then
    echo "$target_dir already exists. Run its install.sh, or choose a new directory." >&2
    exit 1
  fi
  echo "Cloning Stream-Deck repo to $target_dir..."
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
for cmd in flatpak git curl; do
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
if ! command -v node >/dev/null 2>&1 || ! current_node="$(node --version)"; then
  echo "Node.js $required_node is required but unavailable. Installing with Volta..."
  volta install "node@${required_node}"
else
  current_major="$(echo "$current_node" | sed -E 's/^v([0-9]+).*$/\1/')"
  if [ "$current_major" != "$required_node" ]; then
    echo "Detected Node.js $current_node but version $required_node is required. Installing with Volta..."
    volta install "node@${required_node}"
  fi
fi

# Install npm dependencies
npm ci --include=dev

# Prompt for browser choice if CHROMIUM_CMD not pre-set and zenity available
if [ -z "${CHROMIUM_CMD:-}" ] && command -v zenity >/dev/null 2>&1 && [ -n "${DISPLAY:-}" ]; then
  set +e
  choice=$(zenity --list --radiolist \
    --title="Browser Selection" \
    --text="Choose the browser used for streaming services" \
    --column="Select" --column="Browser" \
    TRUE "Bundled Ungoogled Chromium" \
    FALSE "Installed Browser")
  if [ "$choice" = "Installed Browser" ]; then
    CHROMIUM_CMD="$(zenity --entry --title="Custom Browser Command" --text="Enter the browser command")"
  fi
  set -e
fi

# Ensure selected browser is installed
if [ -n "${CHROMIUM_CMD:-}" ]; then
  set +e +u
  eval "set -- $CHROMIUM_CMD"
  browser_bin="$1"
  set -euo pipefail
  if ! command -v "$browser_bin" >/dev/null 2>&1; then
    echo "Browser $browser_bin not found. Attempting Flatpak install..."
    case "$browser_bin" in
      firefox)
        flatpak_id="org.mozilla.firefox" ;;
      chromium)
        flatpak_id="org.chromium.Chromium" ;;
      google-chrome|chrome)
        flatpak_id="com.google.Chrome" ;;
      brave|brave-browser)
        flatpak_id="com.brave.Browser" ;;
      *)
        flatpak_id="" ;;
    esac
    if [ -n "$flatpak_id" ]; then
      flatpak install --user --noninteractive -y flathub "$flatpak_id" || true
    fi
    if ! command -v "$browser_bin" >/dev/null 2>&1; then
      echo "Browser command $browser_bin still not found. Aborting." >&2
      exit 1
    fi
  fi
else
  if ! flatpak info io.github.ungoogled_software.ungoogled_chromium >/dev/null 2>&1; then
    echo "Installing Ungoogled Chromium Flatpak..."
    flatpak install --user --noninteractive -y flathub io.github.ungoogled_software.ungoogled_chromium
  fi
fi

# Persist selected browser command
if [ -n "${CHROMIUM_CMD:-}" ]; then
  echo "$CHROMIUM_CMD" > "$install_dir/browser_cmd"
else
  rm -f "$install_dir/browser_cmd"
fi

# Create desktop file
if [ -f "$install_dir/setup/cli.js" ]; then
  node "$install_dir/setup/cli.js" --streamdeck-check-playback
fi
desktop_dir="$HOME/.local/share/applications"
mkdir -p "$desktop_dir"
desktop_file="$desktop_dir/StreamDeckLauncher.desktop"

# Desktop entries are not shell scripts. The launcher already loads browser_cmd,
# so the Exec field only needs the executable, using desktop-entry escaping.
desktop_escape() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//$'\n'/\\n}"
  value="${value//$'\r'/\\r}"
  value="${value//$'\t'/\\t}"
  printf '%s' "$value"
}
exec_path="$install_dir/StreamDeckLauncher.sh"
exec_path="${exec_path//\\/\\\\}"
exec_path="${exec_path//\"/\\\"}"
exec_path="${exec_path//\$/\\\$}"
exec_path="${exec_path//\`/\\\`}"
exec_path="${exec_path//%/%%}"
exec_line="\"$(desktop_escape "$exec_path")\""

cat > "$desktop_file" <<DESK
[Desktop Entry]
Version=1.0
Type=Application
Name=Stream Deck Launcher
Comment=Unified streaming launcher for Steam Deck
Exec=${exec_line}
Path=$(desktop_escape "$install_dir")
Icon=$(desktop_escape "$install_dir/build/icon.png")
Terminal=false
Categories=Utility;
StartupNotify=false
DESK
chmod +x "$desktop_file"

echo "Installation complete."
if [ -f "$install_dir/setup/cli.js" ]; then
  if ! node "$install_dir/setup/cli.js" --streamdeck-setup-steam \
    --launcher "$install_dir/StreamDeckLauncher.sh" --icon "$install_dir/build/icon.png"; then
    echo "Steam setup is pending. Open Setup in the launcher to select an account or retry after quitting Steam."
  fi
fi
