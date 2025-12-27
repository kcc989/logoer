#!/bin/bash
# Download Google Fonts for the Logo Agent Container

set -e

FONTS_DIR="$(dirname "$0")/../fonts"
mkdir -p "$FONTS_DIR"

echo "Downloading Google Fonts to $FONTS_DIR"

# Function to download a font family
download_font() {
    local family="$1"
    local url_family="${family// /+}"
    local zip_url="https://fonts.google.com/download?family=${url_family}"
    local temp_dir=$(mktemp -d)

    echo "Downloading $family..."

    curl -sL "$zip_url" -o "$temp_dir/font.zip"
    unzip -q "$temp_dir/font.zip" -d "$temp_dir/font"

    # Copy TTF files (prefer static over variable fonts)
    if [ -d "$temp_dir/font/static" ]; then
        cp "$temp_dir/font/static"/*.ttf "$FONTS_DIR/" 2>/dev/null || true
    else
        # Look for TTF files in any subdirectory
        find "$temp_dir/font" -name "*.ttf" -exec cp {} "$FONTS_DIR/" \; 2>/dev/null || true
    fi

    rm -rf "$temp_dir"
    echo "✓ $family downloaded"
}

# Download each font family
download_font "Inter"
download_font "Roboto"
download_font "Poppins"
download_font "Montserrat"
download_font "Open Sans"
download_font "Lato"
download_font "Oswald"
download_font "Raleway"
download_font "Playfair Display"

echo ""
echo "Done! Fonts downloaded to $FONTS_DIR"
ls -la "$FONTS_DIR"
