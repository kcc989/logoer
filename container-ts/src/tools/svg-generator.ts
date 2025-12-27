import type { LogoConfig, LogoShape, LogoType } from "../types.js";

// Theme presets with typography and color settings
const THEMES = {
  modern: {
    primary: "#0f172a",
    accent: "#3b82f6",
    letterSpacing: 4,
    fontWeight: "bold",
  },
  minimal: {
    primary: "#18181b",
    accent: "#18181b",
    letterSpacing: 8,
    fontWeight: "300",
  },
  bold: {
    primary: "#dc2626",
    accent: "#fbbf24",
    letterSpacing: 0,
    fontWeight: "900",
  },
  elegant: {
    primary: "#1c1917",
    accent: "#a8a29e",
    letterSpacing: 12,
    fontWeight: "300",
  },
  playful: {
    primary: "#7c3aed",
    accent: "#f472b6",
    letterSpacing: 2,
    fontWeight: "bold",
  },
  tech: {
    primary: "#06b6d4",
    accent: "#22d3ee",
    letterSpacing: 3,
    fontWeight: "600",
  },
  vintage: {
    primary: "#78350f",
    accent: "#d97706",
    letterSpacing: 6,
    fontWeight: "normal",
  },
  organic: {
    primary: "#166534",
    accent: "#4ade80",
    letterSpacing: 2,
    fontWeight: "normal",
  },
};

// Shape generators
const SHAPES: Record<
  LogoShape,
  (cx: number, cy: number, size: number, fill: string) => string
> = {
  circle: (cx, cy, size, fill) =>
    `<circle cx="${cx}" cy="${cy}" r="${size / 2}" fill="${fill}"/>`,

  hexagon: (cx, cy, size, fill) => {
    const r = size / 2;
    const pts = Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
    }).join(" ");
    return `<polygon points="${pts}" fill="${fill}"/>`;
  },

  triangle: (cx, cy, size, fill) => {
    const h = size * 0.866;
    const pts = `${cx},${cy - h / 2} ${cx + size / 2},${cy + h / 2} ${cx - size / 2},${cy + h / 2}`;
    return `<polygon points="${pts}" fill="${fill}"/>`;
  },

  diamond: (cx, cy, size, fill) => {
    const r = size / 2;
    const pts = `${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`;
    return `<polygon points="${pts}" fill="${fill}"/>`;
  },

  star: (cx, cy, size, fill) => {
    const outer = size / 2;
    const inner = outer * 0.4;
    const pts = Array.from({ length: 10 }, (_, i) => {
      const r = i % 2 === 0 ? outer : inner;
      const a = (Math.PI / 5) * i - Math.PI / 2;
      return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
    }).join(" ");
    return `<polygon points="${pts}" fill="${fill}"/>`;
  },

  shield: (cx, cy, size, fill) => {
    const w = size;
    const h = size * 1.2;
    const x = cx - w / 2;
    const y = cy - h / 2;
    return `<path d="M${x} ${y} L${x + w} ${y} L${x + w} ${y + h * 0.6} Q${x + w} ${y + h * 0.8} ${cx} ${y + h} Q${x} ${y + h * 0.8} ${x} ${y + h * 0.6} Z" fill="${fill}"/>`;
  },

  square: (cx, cy, size, fill) => {
    const half = size / 2;
    return `<rect x="${cx - half}" y="${cy - half}" width="${size}" height="${size}" fill="${fill}"/>`;
  },

  pill: (cx, cy, size, fill) => {
    const width = size * 1.5;
    const height = size * 0.6;
    const rx = height / 2;
    return `<rect x="${cx - width / 2}" y="${cy - height / 2}" width="${width}" height="${height}" rx="${rx}" fill="${fill}"/>`;
  },

  custom: (cx, cy, size, fill) => {
    // Default to circle for custom
    return `<circle cx="${cx}" cy="${cy}" r="${size / 2}" fill="${fill}"/>`;
  },
};

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function generateText(
  text: string,
  x: number,
  y: number,
  config: LogoConfig
): string {
  const { typography, colors } = config;
  return `<text x="${x}" y="${y}" font-family="${typography.fontFamily}, Arial, sans-serif" font-size="${typography.fontSize}" font-weight="${typography.fontWeight}" fill="${colors.primary}" text-anchor="middle" dominant-baseline="central" letter-spacing="${typography.letterSpacing}">${escapeXml(text)}</text>`;
}

function generateMascot(
  cx: number,
  cy: number,
  size: number,
  colors: { primary: string; accent: string }
): string {
  const r = size * 0.35;
  const eyeR = size * 0.06;
  const eyeOffset = size * 0.1;
  const eyeY = cy - size * 0.05;

  return `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${colors.primary}"/>
    <circle cx="${cx - eyeOffset}" cy="${eyeY}" r="${eyeR}" fill="#fff"/>
    <circle cx="${cx + eyeOffset}" cy="${eyeY}" r="${eyeR}" fill="#fff"/>
    <circle cx="${cx - eyeOffset + 2}" cy="${eyeY + 2}" r="${eyeR * 0.5}" fill="#000"/>
    <circle cx="${cx + eyeOffset + 2}" cy="${eyeY + 2}" r="${eyeR * 0.5}" fill="#000"/>
    <path d="M${cx - size * 0.08} ${cy + size * 0.08} Q${cx} ${cy + size * 0.15} ${cx + size * 0.08} ${cy + size * 0.08}" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
  `;
}

export async function generateSvg(
  config: LogoConfig,
  customCode?: string
): Promise<string> {
  // Apply theme defaults if theme is specified
  const theme = THEMES[config.theme];
  if (theme) {
    if (!config.colors?.primary) {
      config.colors = { ...config.colors, primary: theme.primary };
    }
    if (!config.colors?.accent) {
      config.colors = { ...config.colors, accent: theme.accent };
    }
    if (!config.typography?.letterSpacing) {
      config.typography = {
        ...config.typography,
        letterSpacing: theme.letterSpacing,
      };
    }
    if (!config.typography?.fontWeight) {
      config.typography = {
        ...config.typography,
        fontWeight: theme.fontWeight,
      };
    }
  }

  const { width, height, colors, type, text, shape, tagline } = config;
  const cx = width / 2;
  const cy = height / 2;
  const size = Math.min(width, height) * 0.7;

  let content = "";

  // If custom Paper.js code is provided, we'll need to execute it
  // For now, use the standard generators
  if (customCode) {
    // TODO: Execute Paper.js code in sandboxed environment
    console.log("Custom code provided, using standard generator for now");
  }

  switch (type) {
    case "wordmark":
      content = generateText(text.toUpperCase(), cx, cy, config);
      if (tagline) {
        content += generateTagline(tagline, cx, cy + config.typography.fontSize * 0.8, config);
      }
      break;

    case "lettermark": {
      const letters = text.slice(0, 3).toUpperCase();
      const letterConfig = {
        ...config,
        typography: { ...config.typography, fontSize: config.typography.fontSize * 1.2 },
      };
      content = generateText(letters, cx, cy, letterConfig);
      break;
    }

    case "abstract":
    case "pictorial": {
      const shapeFn = SHAPES[shape] || SHAPES.circle;
      content = shapeFn(cx, cy, size, colors.primary);
      // Add an accent element
      content += shapeFn(cx + size * 0.3, cy + size * 0.3, size * 0.3, colors.accent);
      break;
    }

    case "mascot":
      content = generateMascot(cx, cy, size, colors);
      break;

    case "combination": {
      const iconSize = height * 0.5;
      const iconX = width * 0.22;
      const textX = width * 0.62;
      const iconFn = SHAPES[shape] || SHAPES.circle;
      content = iconFn(iconX, cy, iconSize, colors.primary);
      const combinationConfig = {
        ...config,
        typography: { ...config.typography, fontSize: height * 0.22 },
      };
      content += generateText(text, textX, cy, combinationConfig);
      break;
    }

    case "emblem": {
      const badgeSize = Math.min(width, height) * 0.85;
      const badgeFn = SHAPES.shield;
      content = badgeFn(cx, cy, badgeSize, colors.primary);
      const emblemConfig = {
        ...config,
        typography: { ...config.typography, fontSize: badgeSize * 0.12 },
        colors: { ...colors, primary: "#ffffff" },
      };
      content += generateText(text.toUpperCase(), cx, cy + badgeSize * 0.1, emblemConfig);
      break;
    }

    default:
      content = generateText(text.toUpperCase(), cx, cy, config);
  }

  // Build the final SVG
  const background = colors.background
    ? `<rect width="${width}" height="${height}" fill="${colors.background}"/>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${background}${content}</svg>`;
}

function generateTagline(
  tagline: string,
  x: number,
  y: number,
  config: LogoConfig
): string {
  const fontSize = config.typography.fontSize * 0.35;
  return `<text x="${x}" y="${y}" font-family="${config.typography.fontFamily}, Arial, sans-serif" font-size="${fontSize}" font-weight="400" fill="${config.colors.accent}" text-anchor="middle" dominant-baseline="central" letter-spacing="1">${escapeXml(tagline)}</text>`;
}

export interface ValidationResult {
  valid: boolean;
  hasContent: boolean;
  hasViewBox: boolean;
  elementCount: number;
  error?: string;
}

export function validateSvg(svg: string): ValidationResult {
  try {
    // Basic XML validation
    if (!svg.includes("<svg")) {
      return { valid: false, hasContent: false, hasViewBox: false, elementCount: 0, error: "No <svg> element found" };
    }
    if (!svg.includes("</svg>")) {
      return { valid: false, hasContent: false, hasViewBox: false, elementCount: 0, error: "SVG not properly closed" };
    }

    // Check for viewBox
    const hasViewBox = svg.includes("viewBox");

    // Count elements (rough estimate)
    const elementMatches = svg.match(/<[a-z]+[^>]*>/gi);
    const elementCount = elementMatches ? elementMatches.length - 1 : 0; // -1 for svg itself

    const hasContent = elementCount > 0;

    return {
      valid: true,
      hasContent,
      hasViewBox,
      elementCount,
    };
  } catch (error) {
    return {
      valid: false,
      hasContent: false,
      hasViewBox: false,
      elementCount: 0,
      error: error instanceof Error ? error.message : "Unknown validation error",
    };
  }
}

export interface AnalysisResult {
  issues: string[];
  suggestions: string[];
  qualityScore: number;
  readyForUser: boolean;
}

export function analyzeLogo(
  svg: string,
  config: Partial<LogoConfig>
): AnalysisResult {
  const issues: string[] = [];
  const suggestions: string[] = [];

  // Check if text is present for text-based logo types
  const textTypes: LogoType[] = ["wordmark", "lettermark", "combination", "emblem"];
  if (config.type && textTypes.includes(config.type)) {
    if (!svg.includes("<text")) {
      issues.push(`Logo type '${config.type}' requires text but no <text> element found`);
    }
  }

  // Check for colors
  const primary = config.colors?.primary;
  if (primary && !svg.toLowerCase().includes(primary.toLowerCase())) {
    suggestions.push(`Primary color ${primary} not found in SVG`);
  }

  // Check for shape elements in abstract/pictorial logos
  const shapeTypes: LogoType[] = ["abstract", "pictorial", "mascot"];
  if (config.type && shapeTypes.includes(config.type)) {
    const shapeElements = ["<circle", "<rect", "<polygon", "<path", "<ellipse"];
    if (!shapeElements.some((elem) => svg.includes(elem))) {
      issues.push("Expected shape elements not found for this logo type");
    }
  }

  // Quality checks
  if (svg.length < 200) {
    suggestions.push("SVG seems too simple - consider adding more detail");
  }

  if (svg.length > 10000) {
    suggestions.push("SVG might be overly complex - consider simplifying");
  }

  // Check for proper SVG structure
  if (!svg.includes("xmlns")) {
    suggestions.push("SVG should include xmlns attribute for compatibility");
  }

  // Calculate quality score (10 is best)
  const qualityScore = Math.max(0, 10 - issues.length * 3 - suggestions.length);

  return {
    issues,
    suggestions,
    qualityScore,
    readyForUser: issues.length === 0 && suggestions.length <= 1,
  };
}
