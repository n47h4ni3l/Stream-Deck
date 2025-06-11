#!/usr/bin/env bash
set -euo pipefail

# Stream Deck Launcher Script - Final Version
# Launches Electron app using Ungoogled Chromium Flatpak

# Ensure Volta-managed Node.js is on PATH
export VOLTA_HOME="$HOME/.volta"
export PATH="$VOLTA_HOME/bin:$PATH"

# Set working directory to script location
cd "$(dirname "$0")"

# Load browser command chosen during installation
if [ -z "${CHROMIUM_CMD:-}" ] && [ -f browser_cmd ]; then
  CHROMIUM_CMD="$(cat browser_cmd)"
  export CHROMIUM_CMD
fi

# Prevent Steam’s 32-bit overlay from breaking Electron
unset LD_PRELOAD

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

# Log versions for troubleshooting
node --version
"${NPX_CMD[@]}" --version

# Parse optional extra Electron flags
EXTRA_ELECTRON_FLAGS=()
if [ -n "${ELECTRON_EXTRA_FLAGS:-}" ]; then
  # shellcheck disable=SC2206
  EXTRA_ELECTRON_FLAGS=(${ELECTRON_EXTRA_FLAGS})
  if [ -n "${ELECTRON_FLAGS_OUTPUT:-}" ]; then
    mkdir -p "$(dirname "$ELECTRON_FLAGS_OUTPUT")"
    echo "$ELECTRON_EXTRA_FLAGS" > "$ELECTRON_FLAGS_OUTPUT"
  fi
fi

# Detect Wayland or X11
set +e
if [ "${XDG_SESSION_TYPE:-}" = "wayland" ] || [ -n "${WAYLAND_DISPLAY:-}" ]; then
  echo "Detected Wayland session. Launching with Wayland flags..."
  export ELECTRON_ENABLE_LOGGING=1
  export ELECTRON_ENABLE_STACK_DUMPING=1
  ELECTRON_ENABLE_LOGGING=1 ELECTRON_ENABLE_STACK_DUMPING=1 "${NPX_CMD[@]}" electron . --enable-features=UseOzonePlatform --ozone-platform=wayland "${EXTRA_ELECTRON_FLAGS[@]}"
else
  echo "Detected X11 session. Launching without Wayland flags..."
  export ELECTRON_ENABLE_LOGGING=1
  export ELECTRON_ENABLE_STACK_DUMPING=1
  ELECTRON_ENABLE_LOGGING=1 ELECTRON_ENABLE_STACK_DUMPING=1 "${NPX_CMD[@]}" electron . "${EXTRA_ELECTRON_FLAGS[@]}"
fi
exit_code=$?
set -e
echo "Electron exited with code $exit_code"
if [ "$exit_code" -ne 0 ]; then
  echo "An error occurred launching Electron. See $LOG_FILE for details."
fi
exit "$exit_code"
