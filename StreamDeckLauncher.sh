#!/usr/bin/env bash
set -euo pipefail

# Launch the locally installed Electron app.

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

# Prevent Steam's 32-bit overlay from breaking Electron
unset LD_PRELOAD
# A parent Electron application may export this; it would turn Electron into
# plain Node.js and prevent it from opening any windows.
unset ELECTRON_RUN_AS_NODE

# Set up logging
LOG_FILE="$PWD/log.txt"
exec > >(tee -a "$LOG_FILE") 2>&1

# Do not download a different Electron version or install packages while Steam
# is waiting for a window. Installation belongs in install.sh.
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js not found. Run bash install.sh in Desktop Mode first." >&2
  exit 1
fi
if [ ! -x node_modules/.bin/electron ]; then
  echo "Electron is not installed. Run bash install.sh in Desktop Mode first." >&2
  exit 1
fi
node --version

# Parse optional extra Electron flags
EXTRA_ELECTRON_FLAGS=()
if [ -n "${ELECTRON_EXTRA_FLAGS:-}" ]; then
  # Space-separated flags, with pathname expansion disabled.
  read -r -a EXTRA_ELECTRON_FLAGS <<< "$ELECTRON_EXTRA_FLAGS"
  if [ -n "${ELECTRON_FLAGS_OUTPUT:-}" ]; then
    mkdir -p "$(dirname "$ELECTRON_FLAGS_OUTPUT")"
    echo "$ELECTRON_EXTRA_FLAGS" > "$ELECTRON_FLAGS_OUTPUT"
  fi
fi

# Prefer XWayland when DISPLAY is available, including Steam Gaming Mode.
# A Wayland session alone does not mean Gamescope exposes native client windows.
platform="${ELECTRON_OZONE_PLATFORM:-auto}"
case "$platform" in
  auto)
    if [ -n "${DISPLAY:-}" ]; then
      platform=x11
    elif [ -n "${WAYLAND_DISPLAY:-}" ]; then
      platform=wayland
    else
      echo "No graphical display found. Launch from Desktop Mode or Steam Gaming Mode." >&2
      exit 1
    fi
    ;;
  x11|wayland) ;;
  *)
    echo "ELECTRON_OZONE_PLATFORM must be auto, x11, or wayland." >&2
    exit 1
    ;;
esac

echo "Launching Stream Deck Launcher with the $platform display backend..."
export ELECTRON_ENABLE_LOGGING=1
export ELECTRON_ENABLE_STACK_DUMPING=1
set +e
./node_modules/.bin/electron . "--ozone-platform=$platform" "${EXTRA_ELECTRON_FLAGS[@]}" "$@"
exit_code=$?
set -e
echo "Electron exited with code $exit_code"
if [ "$exit_code" -ne 0 ]; then
  echo "An error occurred launching Electron. See $LOG_FILE for details."
fi
exit "$exit_code"
