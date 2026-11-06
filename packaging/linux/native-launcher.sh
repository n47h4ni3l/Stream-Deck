#!/usr/bin/env bash
set -euo pipefail
app_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
binary="$app_dir/streamdeck-launcher-bin"
unset LD_PRELOAD ELECTRON_RUN_AS_NODE
error_message() {
  local message="$1"
  echo "$message" >&2
  local log_dir="${XDG_CONFIG_HOME:-$HOME/.config}/streamdeck-launcher"
  mkdir -p "$log_dir" 2>/dev/null || true
  printf '%s\n' "$message" > "$log_dir/dependency-error.txt" 2>/dev/null || true
  if [ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]; then
    if command -v kdialog >/dev/null 2>&1; then kdialog --error "$message" --title "Stream Deck Launcher" || true
    elif command -v zenity >/dev/null 2>&1; then zenity --error --title="Stream Deck Launcher" --text="$message" || true
    fi
  fi
}
if [ "$(uname -s)" != Linux ] || [ "$(uname -m)" != x86_64 ]; then
  error_message "This package requires glibc-based Linux x86_64. No system packages or security settings were changed."
  exit 1
fi
if ! command -v ldd >/dev/null 2>&1; then
  error_message "The system ldd tool is missing; native libraries cannot be checked. Repair the glibc runtime using your distribution's supported tools."
  exit 1
fi
set +e
libraries="$(ldd "$binary" 2>&1)"
library_status=$?
set -e
if [ "$library_status" -ne 0 ] || [[ "$libraries" == *"not found"* ]]; then
  missing="$(printf '%s\n' "$libraries" | grep -E 'not found|error|version' || true)"
  if [ -z "$missing" ]; then missing="$libraries"; fi
  error_message "Required Electron system libraries are missing or incompatible. Install/repair them through your distribution's supported software tools; no system software was installed automatically.
$missing"
  exit 1
fi
case "${1:-}" in
  --streamdeck-setup-dependencies|--streamdeck-check-dependencies|--streamdeck-setup-steam|--streamdeck-check-playback)
    exec env ELECTRON_RUN_AS_NODE=1 "$binary" "$app_dir/resources/setup/cli.js" "$@" ;;
esac
if [ -z "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]; then
  error_message "No graphical session is available. Open the launcher in Desktop Mode or Steam Gaming Mode."
  exit 1
fi
extra_flags=()
if [ -n "${ELECTRON_EXTRA_FLAGS:-}" ]; then read -r -a extra_flags <<< "$ELECTRON_EXTRA_FLAGS"; fi
platform="${ELECTRON_OZONE_PLATFORM:-auto}"
if [ "$platform" = auto ]; then
  if [ -n "${DISPLAY:-}" ]; then platform=x11; else platform=wayland; fi
fi
case "$platform" in
  x11|wayland) ;;
  *) error_message "ELECTRON_OZONE_PLATFORM must be auto, x11 or wayland."; exit 1 ;;
esac
error_file="$(mktemp)"
trap 'rm -f -- "$error_file"' EXIT
set +e
"$binary" "--ozone-platform=$platform" "${extra_flags[@]}" "$@" 2> "$error_file"
status=$?
set -e
cat "$error_file" >&2
if [ "$status" -ne 0 ]; then
  error_message "Stream Deck Launcher could not start (exit $status). Check the graphics session, runtime libraries and Electron sandbox setup. No security settings were changed.
$(tail -n 12 "$error_file")"
fi
exit "$status"
