#!/usr/bin/env node
/**
 * Logo Generator - Pure SVG output (no native dependencies)
 */

const fs = require('fs');

// Theme presets
const THEMES = {
  modern:   { primary: '#0f172a', accent: '#3b82f6', letterSpacing: 4, fontWeight: 'bold' },
  minimal:  { primary: '#18181b', accent: '#18181b', letterSpacing: 8, fontWeight: '300' },
  bold:     { primary: '#dc2626', accent: '#fbbf24', letterSpacing: 0, fontWeight: '900' },
  elegant:  { primary: '#1c1917', accent: '#a8a29e', letterSpacing: 12, fontWeight: '300' },
  playful:  { primary: '#7c3aed', accent: '#f472b6', letterSpacing: 2, fontWeight: 'bold' },
  tech:     { primary: '#06b6d4', accent: '#22d3ee', letterSpacing: 3, fontWeight: '600' },
  vintage:  { primary: '#78350f', accent: '#d97706', letterSpacing: 6, fontWeight: 'normal' },
  organic:  { primary: '#166534', accent: '#4ade80', letterSpacing: 2, fontWeight: 'normal' }
};

// Default config
const DEFAULTS = {
  type: 'wordmark',
  text: 'BRAND',
  shape: 'circle',
  width: 400,
  height: 200,
  colors: { primary: '#0f172a', accent: '#3b82f6' },
  typography: { fontSize: 48, letterSpacing: 4, fontWeight: 'bold', fontFamily: 'Arial, sans-serif' }
};

// Shape generators (return SVG path/element strings)
const SHAPES = {
  circle: (cx, cy, size, fill) => 
    `<circle cx="${cx}" cy="${cy}" r="${size/2}" fill="${fill}"/>`,

  hexagon: (cx, cy, size, fill) => {
    const r = size / 2;
    const pts = Array.from({length: 6}, (_, i) => {
      const a = Math.PI/3 * i - Math.PI/2;
      return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
    }).join(' ');
    return `<polygon points="${pts}" fill="${fill}"/>`;
  },

  triangle: (cx, cy, size, fill) => {
    const h = size * 0.866;
    const pts = `${cx},${cy - h/2} ${cx + size/2},${cy + h/2} ${cx - size/2},${cy + h/2}`;
    return `<polygon points="${pts}" fill="${fill}"/>`;
  },

  diamond: (cx, cy, size, fill) => {
    const r = size / 2;
    const pts = `${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`;
    return `<polygon points="${pts}" fill="${fill}"/>`;
  },

  star: (cx, cy, size, fill) => {
    const outer = size / 2, inner = outer * 0.4;
    const pts = Array.from({length: 10}, (_, i) => {
      const r = i % 2 === 0 ? outer : inner;
      const a = Math.PI/5 * i - Math.PI/2;
      return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
    }).join(' ');
    return `<polygon points="${pts}" fill="${fill}"/>`;
  },

  shield: (cx, cy, size, fill) => {
    const w = size, h = size * 1.2;
    const x = cx - w/2, y = cy - h/2;
    return `<path d="M${x} ${y} L${x+w} ${y} L${x+w} ${y+h*0.6} Q${x+w} ${y+h*0.8} ${cx} ${y+h} Q${x} ${y+h*0.8} ${x} ${y+h*0.6} Z" fill="${fill}"/>`;
  }
};

// Mascot generator
function generateMascot(cx, cy, size, colors) {
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
    <path d="M${cx - size*0.08} ${cy + size*0.08} Q${cx} ${cy + size*0.15} ${cx + size*0.08} ${cy + size*0.08}" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
  `;
}

// Text element generator
function generateText(text, x, y, config) {
  const { fontSize, letterSpacing, fontWeight, fontFamily } = config.typography;
  const fill = config.colors.primary;
  return `<text x="${x}" y="${y}" font-family="${fontFamily}" font-size="${fontSize}" font-weight="${fontWeight}" fill="${fill}" text-anchor="middle" dominant-baseline="central" letter-spacing="${letterSpacing}">${escapeXml(text)}</text>`;
}

function escapeXml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Main generator
function generateLogo(userConfig = {}) {
  // Merge with defaults and theme
  let config = JSON.parse(JSON.stringify(DEFAULTS));
  
  if (userConfig.theme && THEMES[userConfig.theme]) {
    const theme = THEMES[userConfig.theme];
    config.colors.primary = theme.primary;
    config.colors.accent = theme.accent;
    config.typography.letterSpacing = theme.letterSpacing;
    config.typography.fontWeight = theme.fontWeight;
  }
  
  // Apply user overrides
  if (userConfig.type) config.type = userConfig.type;
  if (userConfig.text) config.text = userConfig.text;
  if (userConfig.shape) config.shape = userConfig.shape;
  if (userConfig.width) config.width = userConfig.width;
  if (userConfig.height) config.height = userConfig.height;
  if (userConfig.colors?.primary) config.colors.primary = userConfig.colors.primary;
  if (userConfig.colors?.accent) config.colors.accent = userConfig.colors.accent;
  if (userConfig.typography?.fontSize) config.typography.fontSize = userConfig.typography.fontSize;
  if (userConfig.typography?.letterSpacing) config.typography.letterSpacing = userConfig.typography.letterSpacing;
  if (userConfig.typography?.fontWeight) config.typography.fontWeight = userConfig.typography.fontWeight;
  if (userConfig.typography?.fontFamily) config.typography.fontFamily = userConfig.typography.fontFamily;

  const { width, height, colors, type, text, shape } = config;
  const cx = width / 2, cy = height / 2;
  const size = Math.min(width, height) * 0.7;

  let content = '';

  switch (type) {
    case 'wordmark':
      content = generateText(text.toUpperCase(), cx, cy, config);
      break;

    case 'lettermark':
      const letters = text.slice(0, 3).toUpperCase();
      config.typography.fontSize = config.typography.fontSize * 1.2;
      content = generateText(letters, cx, cy, config);
      break;

    case 'abstract':
    case 'pictorial':
      const shapeFn = SHAPES[shape] || SHAPES.circle;
      content = shapeFn(cx, cy, size, colors.primary);
      break;

    case 'mascot':
      content = generateMascot(cx, cy, size, colors);
      break;

    case 'combination':
      const iconSize = height * 0.5;
      const iconX = width * 0.22;
      const textX = width * 0.62;
      const iconFn = SHAPES[shape] || SHAPES.circle;
      content = iconFn(iconX, cy, iconSize, colors.primary);
      config.typography.fontSize = height * 0.22;
      content += generateText(text, textX, cy, config);
      break;

    case 'emblem':
      const badgeSize = Math.min(width, height) * 0.85;
      const badgeFn = SHAPES.shield;
      content = badgeFn(cx, cy, badgeSize, colors.primary);
      config.typography.fontSize = badgeSize * 0.12;
      config.colors.primary = '#ffffff';
      content += generateText(text.toUpperCase(), cx, cy + badgeSize * 0.1, config);
      break;

    default:
      content = generateText(text.toUpperCase(), cx, cy, config);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${content}</svg>`;
}

// CLI
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const val = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
      opts[key] = val;
    }
  }
  return opts;
}

function main() {
  const args = parseArgs();
  let config = {};

  // Load config file if specified
  if (args.config) {
    try {
      config = JSON.parse(fs.readFileSync(args.config, 'utf8'));
    } catch (e) {
      console.error('Error loading config:', e.message);
      process.exit(1);
    }
  }

  // CLI overrides
  if (args.type) config.type = args.type;
  if (args.text) config.text = args.text;
  if (args.shape) config.shape = args.shape;
  if (args.theme) config.theme = args.theme;
  if (args.width) config.width = parseInt(args.width);
  if (args.height) config.height = parseInt(args.height);
  if (args.primary) config.colors = { ...config.colors, primary: args.primary };
  if (args.accent) config.colors = { ...config.colors, accent: args.accent };

  const svg = generateLogo(config);

  if (args.output) {
    fs.writeFileSync(args.output, svg);
    console.error(`Saved to ${args.output}`);
  } else {
    console.log(svg);
  }
}

// Export for programmatic use
module.exports = { generateLogo, THEMES, SHAPES, DEFAULTS };

if (require.main === module) {
  main();
}
