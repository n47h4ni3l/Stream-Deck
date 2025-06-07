#!/usr/bin/env bash
set -e

echo "Stream Deck Launcher Installer"

# Detect if running on Steam Deck (SteamOS)
IS_DECK=false
if grep -qi "SteamOS" /etc/os-release 2>/dev/null; then
    IS_DECK=true
fi

# Detect package manager
if [ "$IS_DECK" = true ]; then
    PM="flatpak"
elif command -v pacman >/dev/null 2>&1; then
    PM="pacman"
elif command -v apt-get >/dev/null 2>&1; then
    PM="apt"
else
    PM=""
fi

# Determine missing packages
packages=()
NODE_FLATPAK=false
command -v git >/dev/null 2>&1 || packages+=(git)

if ! command -v node >/dev/null 2>&1; then
    if [ "$IS_DECK" = true ] && command -v flatpak >/dev/null 2>&1; then
        NODE_FLATPAK=true
    else
        packages+=(nodejs)
    fi
fi

if ! command -v npm >/dev/null 2>&1; then
    if [ "$NODE_FLATPAK" = false ]; then
        packages+=(npm)
    fi
fi

if [ ${#packages[@]} -gt 0 ]; then
    echo "Installing packages: ${packages[*]}"
    if [ "$PM" = "pacman" ]; then
        sudo pacman -Sy --needed --noconfirm "${packages[@]}"
    elif [ "$PM" = "apt" ]; then
        sudo apt-get update
        sudo apt-get install -y "${packages[@]}"
    elif [ "$PM" = "flatpak" ]; then
        echo "Flatpak detected -- skipping system package install"
    fi
else
    echo "Required packages already installed."
fi

# Install Node via Flatpak on Steam Deck if needed
if [ "$NODE_FLATPAK" = true ]; then
    echo "Installing Node.js via Flatpak..."
    if ! flatpak remotes --user | grep -q '^flathub\\>' ; then
        flatpak remote-add --user --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo
    fi
    flatpak install -y --user flathub org.nodejs.Node
    NPM_CMD="flatpak run --command=npm org.nodejs.Node"
else
    NPM_CMD="npm"
fi

# Download Chromium AppImage
mkdir -p chromium
CHROMIUM_PATH="chromium/Chromium-x86-64.AppImage"
if [ ! -f "$CHROMIUM_PATH" ]; then
    CHROMIUM_URL="https://github.com/ungoogled-software/ungoogled-chromium/releases/latest/download/ungoogled-chromium.AppImage"
    echo "Downloading Chromium AppImage..."
    if command -v curl >/dev/null 2>&1; then
        curl -L "$CHROMIUM_URL" -o "$CHROMIUM_PATH"
    elif command -v wget >/dev/null 2>&1; then
        wget "$CHROMIUM_URL" -O "$CHROMIUM_PATH"
    else
        echo "Please install curl or wget to download Chromium." >&2
        exit 1
    fi
else
    echo "Chromium AppImage already exists."
fi

# Install Node.js dependencies
$NPM_CMD install

# Make AppImages executable
find chromium -name '*.AppImage' -exec chmod +x {} \;

echo -e "\nInstallation complete!"
echo "Run ./StreamDeckLauncher.sh to start Stream Deck Launcher."
