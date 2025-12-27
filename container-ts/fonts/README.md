# Fonts Directory

This directory contains TTF font files for text-to-path conversion using opentype.js.

## Required Fonts

Download the following fonts from Google Fonts and place the TTF files here:

### Primary Fonts
- **Inter** (Regular, Bold, Light) - https://fonts.google.com/specimen/Inter
- **Roboto** (Regular, Bold, Light) - https://fonts.google.com/specimen/Roboto
- **Poppins** (Regular, Bold, Light) - https://fonts.google.com/specimen/Poppins

### Display Fonts
- **Montserrat** (Regular, Bold) - https://fonts.google.com/specimen/Montserrat
- **Oswald** (Regular, Bold) - https://fonts.google.com/specimen/Oswald
- **Raleway** (Regular, Bold) - https://fonts.google.com/specimen/Raleway
- **Playfair Display** (Regular, Bold) - https://fonts.google.com/specimen/Playfair+Display

### Sans-Serif
- **Open Sans** (Regular, Bold) - https://fonts.google.com/specimen/Open+Sans
- **Lato** (Regular, Bold) - https://fonts.google.com/specimen/Lato

## File Naming Convention

Font files should be named using this pattern:
- `{FontName}-Regular.ttf`
- `{FontName}-Bold.ttf`
- `{FontName}-Light.ttf`

Examples:
- `Inter-Regular.ttf`
- `Inter-Bold.ttf`
- `Roboto-Light.ttf`

## Download Script

Run the download script to automatically fetch all required fonts:

```bash
./scripts/download-fonts.sh
```

## License

All Google Fonts are licensed under the Open Font License (OFL), which permits redistribution and embedding.
