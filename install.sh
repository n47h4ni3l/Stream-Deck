diff --git a/install.sh b/install.sh
index 93ea1308110dfbfcd46e17d7df1cad43ebd3ae77..74f73490f6148cb52c26306e436b6c1d14a740b7 100755
--- a/install.sh
+++ b/install.sh
@@ -40,50 +40,54 @@ if [ "$in_repo" -eq 0 ]; then
     echo "Cloning Stream-Deck repo to $target_dir..."
     rm -rf "$target_dir"
     git clone https://github.com/n47h4ni3l/Stream-Deck.git "$target_dir"
   fi
   cd "$target_dir"
 fi
 # Normalize line endings in case the script was cloned with CRLF
 sed -i 's/\r$//' StreamDeckLauncher.sh
 
 # Remember where the repository lives so we can update the desktop file later
 install_dir="$(pwd)"
 
 # Ensure required commands are available
 command -v flatpak >/dev/null 2>&1 || {
   echo "flatpak is required but not installed. Aborting." >&2
   exit 1
 }
 command -v git >/dev/null 2>&1 || {
   echo "git is required but not installed. Aborting." >&2
   exit 1
 }
 command -v curl >/dev/null 2>&1 || {
   echo "curl is required but not installed. Aborting." >&2
   exit 1
 }
+command -v sha256sum >/dev/null 2>&1 || {
+  echo "sha256sum is required but not installed. Aborting." >&2
+  exit 1
+}
 
 # Add Flathub if not already present
 echo "Checking Flathub..."
 flatpak remote-add --user --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo
 
 # Install Volta if needed and ensure it's on PATH
 if [ ! -d "$HOME/.volta" ]; then
   echo "Installing Volta..."
   tmp_volta_installer="$(mktemp)"
   curl -fsSL https://get.volta.sh -o "$tmp_volta_installer"
   echo "fbdc4b8cb33fb6d19e5f07b22423265943d34e7e5c3d5a1efcecc9621854f9cb  $tmp_volta_installer" | sha256sum -c -
   bash "$tmp_volta_installer"
   rm -f "$tmp_volta_installer"
 else
   echo "Volta already installed."
 fi
 export VOLTA_HOME="$HOME/.volta"
 export PATH="$VOLTA_HOME/bin:$PATH"
 
 # Ensure required Node.js version from .nvmrc
 required_node="$(cat "$install_dir/.nvmrc")"
 current_node="$(node -v 2>/dev/null || echo none)"
 
 if [ "v$required_node" != "$current_node" ]; then
   echo "Installing Node.js $required_node with Volta..."
