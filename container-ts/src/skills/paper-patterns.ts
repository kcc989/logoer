/**
 * Paper.js Pattern Generators
 *
 * Collection of reusable pattern generators for creating
 * sophisticated logo elements using Paper.js-style path operations.
 *
 * These patterns generate SVG path data that can be embedded directly
 * into logos for more complex visual effects.
 */

export interface PatternOptions {
  width: number;
  height: number;
  color: string;
  strokeWidth?: number;
  strokeColor?: string;
}

/**
 * Generate a geometric grid pattern
 */
export function gridPattern(options: PatternOptions & { cellSize?: number }): string {
  const { width, height, color, cellSize = 20, strokeWidth = 1 } = options;
  const paths: string[] = [];

  // Vertical lines
  for (let x = 0; x <= width; x += cellSize) {
    paths.push(`<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="${color}" stroke-width="${strokeWidth}"/>`);
  }

  // Horizontal lines
  for (let y = 0; y <= height; y += cellSize) {
    paths.push(`<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="${color}" stroke-width="${strokeWidth}"/>`);
  }

  return paths.join("");
}

/**
 * Generate concentric circles pattern
 */
export function concentricCircles(
  options: PatternOptions & { rings?: number; gap?: number }
): string {
  const { width, height, color, rings = 5, gap = 10, strokeWidth = 2 } = options;
  const cx = width / 2;
  const cy = height / 2;
  const maxRadius = Math.min(width, height) / 2;
  const paths: string[] = [];

  for (let i = 1; i <= rings; i++) {
    const radius = (maxRadius / rings) * i - gap / 2;
    paths.push(
      `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${color}" stroke-width="${strokeWidth}"/>`
    );
  }

  return paths.join("");
}

/**
 * Generate a radial burst pattern
 */
export function radialBurst(
  options: PatternOptions & { rays?: number; innerRadius?: number }
): string {
  const { width, height, color, rays = 12, strokeWidth = 2 } = options;
  const cx = width / 2;
  const cy = height / 2;
  const outerRadius = Math.min(width, height) / 2;
  const innerRadius = options.innerRadius ?? outerRadius * 0.2;
  const paths: string[] = [];

  for (let i = 0; i < rays; i++) {
    const angle = (Math.PI * 2 * i) / rays - Math.PI / 2;
    const x1 = cx + innerRadius * Math.cos(angle);
    const y1 = cy + innerRadius * Math.sin(angle);
    const x2 = cx + outerRadius * Math.cos(angle);
    const y2 = cy + outerRadius * Math.sin(angle);
    paths.push(
      `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round"/>`
    );
  }

  return paths.join("");
}

/**
 * Generate a spiral pattern
 */
export function spiral(
  options: PatternOptions & { turns?: number; spacing?: number }
): string {
  const { width, height, color, turns = 3, spacing = 8, strokeWidth = 2 } = options;
  const cx = width / 2;
  const cy = height / 2;
  const maxRadius = Math.min(width, height) / 2 - strokeWidth;

  const points: string[] = [];
  const totalAngle = turns * Math.PI * 2;
  const steps = Math.floor(totalAngle / 0.1);

  for (let i = 0; i <= steps; i++) {
    const angle = (totalAngle * i) / steps;
    const radius = (spacing * angle) / (Math.PI * 2);
    if (radius <= maxRadius) {
      const x = cx + radius * Math.cos(angle - Math.PI / 2);
      const y = cy + radius * Math.sin(angle - Math.PI / 2);
      points.push(`${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`);
    }
  }

  return `<path d="${points.join(" ")}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round"/>`;
}

/**
 * Generate a wave pattern
 */
export function wavePattern(
  options: PatternOptions & { waves?: number; amplitude?: number }
): string {
  const { width, height, color, waves = 3, strokeWidth = 2 } = options;
  const amplitude = options.amplitude ?? height * 0.3;
  const cy = height / 2;
  const wavelength = width / waves;

  let path = `M 0 ${cy}`;
  for (let i = 0; i < waves; i++) {
    const x1 = i * wavelength + wavelength / 4;
    const x2 = i * wavelength + wavelength / 2;
    const x3 = i * wavelength + (wavelength * 3) / 4;
    const x4 = (i + 1) * wavelength;

    path += ` C ${x1} ${cy - amplitude}, ${x2} ${cy - amplitude}, ${x2} ${cy}`;
    path += ` C ${x3} ${cy + amplitude}, ${x4} ${cy + amplitude}, ${x4} ${cy}`;
  }

  return `<path d="${path}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round"/>`;
}

/**
 * Generate a dotted pattern
 */
export function dottedPattern(
  options: PatternOptions & { dotSize?: number; spacing?: number }
): string {
  const { width, height, color, dotSize = 4, spacing = 16 } = options;
  const paths: string[] = [];

  for (let x = spacing / 2; x < width; x += spacing) {
    for (let y = spacing / 2; y < height; y += spacing) {
      paths.push(`<circle cx="${x}" cy="${y}" r="${dotSize / 2}" fill="${color}"/>`);
    }
  }

  return paths.join("");
}

/**
 * Generate a hexagonal grid pattern
 */
export function hexagonalGrid(
  options: PatternOptions & { hexSize?: number }
): string {
  const { width, height, color, hexSize = 20, strokeWidth = 1 } = options;
  const paths: string[] = [];

  const hexWidth = hexSize * 2;
  const hexHeight = hexSize * Math.sqrt(3);
  const horizontalSpacing = hexWidth * 0.75;
  const verticalSpacing = hexHeight;

  for (let row = 0; row * verticalSpacing < height + hexHeight; row++) {
    for (let col = 0; col * horizontalSpacing < width + hexWidth; col++) {
      const cx = col * horizontalSpacing;
      const cy = row * verticalSpacing + (col % 2 === 1 ? verticalSpacing / 2 : 0);

      const points = Array.from({ length: 6 }, (_, i) => {
        const angle = (Math.PI / 3) * i;
        return `${cx + hexSize * Math.cos(angle)},${cy + hexSize * Math.sin(angle)}`;
      }).join(" ");

      paths.push(
        `<polygon points="${points}" fill="none" stroke="${color}" stroke-width="${strokeWidth}"/>`
      );
    }
  }

  return paths.join("");
}

/**
 * Generate a gradient-like striped pattern
 */
export function stripes(
  options: PatternOptions & {
    stripeCount?: number;
    angle?: number;
    colors?: string[];
  }
): string {
  const { width, height, color, stripeCount = 5, angle = 45 } = options;
  const colors = options.colors || [color, "transparent"];
  const paths: string[] = [];

  // Calculate stripe dimensions based on angle
  const rad = (angle * Math.PI) / 180;
  const diagonal = Math.sqrt(width * width + height * height);
  const stripeWidth = diagonal / stripeCount;

  for (let i = 0; i < stripeCount; i++) {
    const fillColor = colors[i % colors.length];
    if (fillColor !== "transparent") {
      const offset = i * stripeWidth - diagonal / 2;
      paths.push(`
        <rect
          x="${-diagonal / 2}"
          y="${offset}"
          width="${diagonal * 2}"
          height="${stripeWidth}"
          fill="${fillColor}"
          transform="rotate(${angle}, ${width / 2}, ${height / 2})"
        />
      `);
    }
  }

  // Clip to bounds
  return `<g clip-path="url(#stripeBounds)">
    <defs>
      <clipPath id="stripeBounds">
        <rect x="0" y="0" width="${width}" height="${height}"/>
      </clipPath>
    </defs>
    ${paths.join("")}
  </g>`;
}

/**
 * Generate a geometric abstract shape composition
 */
export function abstractComposition(
  options: PatternOptions & { shapes?: number; seed?: number }
): string {
  const { width, height, color, shapes = 5 } = options;
  const seed = options.seed ?? Date.now();
  const paths: string[] = [];

  // Simple seeded random function
  let s = seed;
  const random = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };

  const shapeTypes = ["circle", "rect", "triangle", "line"];

  for (let i = 0; i < shapes; i++) {
    const type = shapeTypes[Math.floor(random() * shapeTypes.length)];
    const x = random() * width;
    const y = random() * height;
    const size = 20 + random() * 40;
    const opacity = 0.3 + random() * 0.7;

    switch (type) {
      case "circle":
        paths.push(
          `<circle cx="${x}" cy="${y}" r="${size / 2}" fill="${color}" opacity="${opacity}"/>`
        );
        break;
      case "rect":
        paths.push(
          `<rect x="${x - size / 2}" y="${y - size / 2}" width="${size}" height="${size}" fill="${color}" opacity="${opacity}" transform="rotate(${random() * 360}, ${x}, ${y})"/>`
        );
        break;
      case "triangle": {
        const pts = `${x},${y - size / 2} ${x + size / 2},${y + size / 2} ${x - size / 2},${y + size / 2}`;
        paths.push(
          `<polygon points="${pts}" fill="${color}" opacity="${opacity}"/>`
        );
        break;
      }
      case "line":
        paths.push(
          `<line x1="${x}" y1="${y}" x2="${x + size}" y2="${y + size * (random() - 0.5)}" stroke="${color}" stroke-width="3" opacity="${opacity}"/>`
        );
        break;
    }
  }

  return paths.join("");
}

/**
 * Generate a flowing curves pattern (like flowing water or wind)
 */
export function flowingCurves(
  options: PatternOptions & { curves?: number; variance?: number }
): string {
  const { width, height, color, curves = 5, variance = 30, strokeWidth = 2 } = options;
  const paths: string[] = [];

  for (let i = 0; i < curves; i++) {
    const yOffset = (height / (curves + 1)) * (i + 1);
    const points: string[] = [];

    points.push(`M 0 ${yOffset}`);

    for (let x = 0; x <= width; x += 50) {
      const yVariance = Math.sin((x / width) * Math.PI * 2 + i) * variance;
      points.push(`L ${x} ${yOffset + yVariance}`);
    }

    paths.push(
      `<path d="${points.join(" ")}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" opacity="${0.5 + (i / curves) * 0.5}"/>`
    );
  }

  return paths.join("");
}

// Export all patterns as a map for easy access
export const patterns = {
  grid: gridPattern,
  concentricCircles,
  radialBurst,
  spiral,
  wave: wavePattern,
  dots: dottedPattern,
  hexGrid: hexagonalGrid,
  stripes,
  abstract: abstractComposition,
  flow: flowingCurves,
};

export type PatternName = keyof typeof patterns;
