import opentype from "opentype.js";
import { promises as fs } from "fs";
import path from "path";

// Font cache to avoid reloading
const fontCache: Map<string, opentype.Font> = new Map();

// Default fonts directory
const FONTS_DIR = process.env.FONTS_DIR || "/app/fonts";

// Font family mappings to file names
const FONT_FILES: Record<string, string> = {
  Inter: "Inter-Regular.ttf",
  "Inter Bold": "Inter-Bold.ttf",
  "Inter Light": "Inter-Light.ttf",
  Roboto: "Roboto-Regular.ttf",
  "Roboto Bold": "Roboto-Bold.ttf",
  "Roboto Light": "Roboto-Light.ttf",
  Poppins: "Poppins-Regular.ttf",
  "Poppins Bold": "Poppins-Bold.ttf",
  "Poppins Light": "Poppins-Light.ttf",
  Montserrat: "Montserrat-Regular.ttf",
  "Montserrat Bold": "Montserrat-Bold.ttf",
  "Open Sans": "OpenSans-Regular.ttf",
  "Open Sans Bold": "OpenSans-Bold.ttf",
  Lato: "Lato-Regular.ttf",
  "Lato Bold": "Lato-Bold.ttf",
  Oswald: "Oswald-Regular.ttf",
  "Oswald Bold": "Oswald-Bold.ttf",
  Raleway: "Raleway-Regular.ttf",
  "Raleway Bold": "Raleway-Bold.ttf",
  Playfair: "PlayfairDisplay-Regular.ttf",
  "Playfair Bold": "PlayfairDisplay-Bold.ttf",
};

// Weight to font variant mapping
const WEIGHT_MAP: Record<string | number, string> = {
  "100": "Light",
  "200": "Light",
  "300": "Light",
  light: "Light",
  "400": "Regular",
  normal: "Regular",
  "500": "Regular",
  "600": "Bold",
  "700": "Bold",
  bold: "Bold",
  "800": "Bold",
  "900": "Bold",
};

export interface FontMetrics {
  ascender: number;
  descender: number;
  unitsPerEm: number;
  xHeight: number;
  capHeight: number;
}

export interface TextPath {
  path: string;
  width: number;
  height: number;
}

/**
 * Load a font from the fonts directory
 */
export async function loadFont(
  fontFamily: string,
  weight: string | number = "normal"
): Promise<opentype.Font> {
  // Determine the font variant based on weight
  const variant = WEIGHT_MAP[String(weight).toLowerCase()] || "Regular";
  const fontKey = variant === "Regular" ? fontFamily : `${fontFamily} ${variant}`;

  // Check cache first
  if (fontCache.has(fontKey)) {
    return fontCache.get(fontKey)!;
  }

  // Get the file name
  const fileName = FONT_FILES[fontKey] || FONT_FILES[fontFamily];
  if (!fileName) {
    throw new Error(`Font not found: ${fontFamily} (${variant})`);
  }

  const fontPath = path.join(FONTS_DIR, fileName);

  try {
    // Check if file exists
    await fs.access(fontPath);

    // Load the font
    const font = await opentype.load(fontPath);
    fontCache.set(fontKey, font);
    return font;
  } catch (error) {
    throw new Error(
      `Failed to load font ${fontFamily}: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Get font metrics for a loaded font
 */
export function getFontMetrics(font: opentype.Font): FontMetrics {
  return {
    ascender: font.ascender,
    descender: font.descender,
    unitsPerEm: font.unitsPerEm,
    xHeight: font.tables.os2?.sxHeight || font.ascender * 0.5,
    capHeight: font.tables.os2?.sCapHeight || font.ascender * 0.7,
  };
}

/**
 * Convert text to SVG path data using opentype.js
 * This allows for precise text rendering without relying on system fonts
 */
export async function textToPath(
  text: string,
  fontFamily: string,
  fontSize: number,
  options: {
    weight?: string | number;
    letterSpacing?: number;
    x?: number;
    y?: number;
  } = {}
): Promise<TextPath> {
  const { weight = "normal", letterSpacing = 0, x = 0, y = 0 } = options;

  const font = await loadFont(fontFamily, weight);
  const scale = fontSize / font.unitsPerEm;

  // Create the path
  let totalWidth = 0;
  let pathData = "";

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const glyph = font.charToGlyph(char);

    if (glyph) {
      // Get the glyph path
      const glyphPath = glyph.getPath(x + totalWidth, y, fontSize);
      pathData += glyphPath.toPathData(2);

      // Advance position
      totalWidth += (glyph.advanceWidth || 0) * scale + letterSpacing;
    }
  }

  // Calculate height based on font metrics
  const height = (font.ascender - font.descender) * scale;

  return {
    path: pathData,
    width: totalWidth - letterSpacing, // Remove trailing letter spacing
    height,
  };
}

/**
 * Generate an SVG text element with embedded font path
 * This ensures consistent rendering across all systems
 */
export async function generateTextSvg(
  text: string,
  fontFamily: string,
  fontSize: number,
  options: {
    weight?: string | number;
    letterSpacing?: number;
    fill?: string;
    textAnchor?: "start" | "middle" | "end";
    x?: number;
    y?: number;
  } = {}
): Promise<string> {
  const {
    weight = "normal",
    letterSpacing = 0,
    fill = "#000000",
    textAnchor = "middle",
    x = 0,
    y = 0,
  } = options;

  try {
    const { path, width, height } = await textToPath(text, fontFamily, fontSize, {
      weight,
      letterSpacing,
      x: 0,
      y: fontSize, // Baseline at fontSize
    });

    // Calculate offset based on text anchor
    let offsetX = x;
    if (textAnchor === "middle") {
      offsetX = x - width / 2;
    } else if (textAnchor === "end") {
      offsetX = x - width;
    }

    const offsetY = y - height / 2;

    return `<path d="${path}" fill="${fill}" transform="translate(${offsetX}, ${offsetY})"/>`;
  } catch (error) {
    // Fall back to standard text element if font loading fails
    console.warn(`Font loading failed, using fallback: ${error}`);
    return `<text x="${x}" y="${y}" font-family="${fontFamily}, Arial, sans-serif" font-size="${fontSize}" font-weight="${weight}" fill="${fill}" text-anchor="${textAnchor}" dominant-baseline="central">${escapeXml(text)}</text>`;
  }
}

/**
 * List available fonts
 */
export async function listAvailableFonts(): Promise<string[]> {
  try {
    const files = await fs.readdir(FONTS_DIR);
    return files
      .filter((f) => f.endsWith(".ttf") || f.endsWith(".otf"))
      .map((f) => f.replace(/\.(ttf|otf)$/, ""));
  } catch {
    return Object.keys(FONT_FILES);
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
