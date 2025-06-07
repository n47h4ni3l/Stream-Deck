#!/usr/bin/env bash
set -e

echo "Stream Deck Launcher Installer"

# Detect package manager
if command -v pacman >/dev/null 2>&1; then
    PM="pacman"
elif command -v apt-get >/dev/null 2>&1; then
    PM="apt"
else
    PM=""
fi

# Determine missing packages
packages=()
command -v git >/dev/null 2>&1 || packages+=(git)
command -v node >/dev/null 2>&1 || packages+=(nodejs)
command -v npm >/dev/null 2>&1 || packages+=(npm)

if [ ${#packages[@]} -gt 0 ]; then
    echo "Installing packages: ${packages[*]}"
    if [ "$PM" = "pacman" ]; then
        sudo pacman -Sy --needed --noconfirm "${packages[@]}"
    elif [ "$PM" = "apt" ]; then
        sudo apt-get update
        sudo apt-get install -y "${packages[@]}"
    else
        echo "Unsupported package manager. Please install ${packages[*]} manually."
    fi
else
    echo "Required packages already installed."
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
npm install

# Make AppImages executable
find chromium -name '*.AppImage' -exec chmod +x {} \;

echo -e "\nInstallation complete!"
echo "Run ./StreamDeckLauncher.sh to start Stream Deck Launcher."
