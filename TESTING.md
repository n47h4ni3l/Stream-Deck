# Manual Testing

Use these scenarios to verify the launcher in different SteamOS modes.

## Desktop Mode
- Run `./StreamDeckLauncher.sh` from a terminal
- Confirm services open in the selected browser and usage stats update

## Gaming Mode via Steam Shortcut
- Add `StreamDeckLauncher.sh` to Steam as described in the README
- Launch the shortcut from Gaming Mode and ensure Electron starts

## Browser Profile Persistence
- Sign in to a service, close the launcher, and relaunch
- Verify credentials persist across sessions

## Wayland/X11 Detection
- Start the launcher in a Wayland session and verify Wayland flags are used
- Repeat under X11 to confirm fallback mode works


