#!/usr/bin/env bash
set -e

echo "Stream Deck Launcher Installer"

# Detect if running on Steam Deck (SteamOS or derivatives)
IS_DECK=false
if grep -qiE 'SteamOS|steamos|bazzite|holoiso' /etc/os-release; then
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
        if ! sudo pacman -Sy --needed --noconfirm "${packages[@]}"; then
            echo "pacman failed to synchronize. Attempting to disable read-only filesystem..." >&2
            if command -v steamos-readonly >/dev/null 2>&1; then
                sudo steamos-readonly disable
            fi
            sudo pacman -Sy
            sudo pacman -Sy --needed --noconfirm "${packages[@]}"
        fi
    elif [ "$PM" = "apt" ]; then
        sudo apt-get update
        sudo apt-get install -y "${packages[@]}"
    elif [ "$PM" = "flatpak" ]; then
        echo "Flatpak detected -- skipping system package install"
    else
        echo "No supported package manager found."
        echo "Please install: ${packages[*]} and re-run this script."
        exit 1
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

    # Attempt to download SHA256 checksum if available
    CHECKSUM_AVAILABLE=false
    if command -v curl >/dev/null 2>&1; then
        if curl -fLs "${CHROMIUM_URL}.sha256" -o "${CHROMIUM_PATH}.sha256"; then
            CHECKSUM_AVAILABLE=true
        elif curl -fLs "${CHROMIUM_URL}.sha256sum" -o "${CHROMIUM_PATH}.sha256"; then
            CHECKSUM_AVAILABLE=true
        fi
    elif command -v wget >/dev/null 2>&1; then
        if wget -q "${CHROMIUM_URL}.sha256" -O "${CHROMIUM_PATH}.sha256"; then
            CHECKSUM_AVAILABLE=true
        elif wget -q "${CHROMIUM_URL}.sha256sum" -O "${CHROMIUM_PATH}.sha256"; then
            CHECKSUM_AVAILABLE=true
        fi
    fi

    if [ "$CHECKSUM_AVAILABLE" = true ]; then
        SHA_VAL=$(grep -oE '^[0-9a-fA-F]{64}' "${CHROMIUM_PATH}.sha256" | head -n1)
        if [ -n "$SHA_VAL" ]; then
            echo "$SHA_VAL  $(basename "$CHROMIUM_PATH")" > "${CHROMIUM_PATH}.sha256"
            echo "Verifying AppImage checksum..."
            if ! (cd chromium && sha256sum -c "$(basename "${CHROMIUM_PATH}.sha256")"); then
                echo "Checksum verification failed!" >&2
                exit 1
            fi
        else
            echo "Could not parse checksum; skipping verification." >&2
        fi
    else
        echo "Checksum file not available; skipping verification." >&2
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
