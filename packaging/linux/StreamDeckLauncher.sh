#!/usr/bin/env bash
set -euo pipefail
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
unset LD_PRELOAD ELECTRON_RUN_AS_NODE
platform="${ELECTRON_OZONE_PLATFORM:-auto}"
case "$platform" in
  auto)
    if [ -n "${DISPLAY:-}" ]; then platform=x11
    elif [ -n "${WAYLAND_DISPLAY:-}" ]; then platform=wayland
    else echo "Start the launcher from Desktop Mode or Steam Gaming Mode." >&2; exit 1
    fi ;;
  x11|wayland) ;;
  *) echo "ELECTRON_OZONE_PLATFORM must be auto, x11, or wayland." >&2; exit 1 ;;
esac
extra_flags=()
if [ -n "${ELECTRON_EXTRA_FLAGS:-}" ]; then
  read -r -a extra_flags <<< "$ELECTRON_EXTRA_FLAGS"
fi
exec "$script_dir/app/streamdeck-launcher" "--ozone-platform=$platform" "${extra_flags[@]}" "$@"
