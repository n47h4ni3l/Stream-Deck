#!/bin/bash

echo "Stream Deck Launcher Installer (Steam Deck Safe Version)"
echo "--------------------------------------------"

# Add Flathub if not already present
echo "Checking Flathub..."
flatpak remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo

# Install Node.js via Flatpak
echo "Installing Node.js (via Flatpak)..."
flatpak install -y flathub io.nodejs.NodeJS

# Clone repo
echo "Cloning Stream Deck Launcher repo..."
git clone https://github.com/n47h4ni3l/Stream-Deck.git
cd Stream-Deck

# Install dependencies via Flatpak Node.js
echo "Running npm install (via Flatpak Node.js)..."
flatpak run io.nodejs.NodeJS npm install

# Make Chromium AppImage executable
echo "Making Chromium executable..."
chmod +x chromium/Chromium-x86-64.AppImage

# Launch Stream Deck
echo "Launching Stream Deck Launcher..."
./StreamDeckLauncher.sh
