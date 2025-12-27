# Logo Design Skill

Domain expertise for creating professional, high-quality SVG logos.

## Design Principles

### 1. Balance and Visual Weight
- Distribute elements evenly across the composition
- Use negative space intentionally to create visual breathing room
- Ensure the logo feels stable and grounded
- Visual weight should feel centered even if asymmetrical

### 2. Simplicity and Scalability
- Keep designs clean with minimal elements
- Logos must work at all sizes: favicon (16x16) to billboard
- Avoid fine details that disappear at small sizes
- Test mental rendering at 32px height

### 3. Typography
- Choose fonts that match the brand personality
- Ensure excellent legibility at all sizes
- Use appropriate letter spacing for the style
- Consider custom letterforms for uniqueness
- Web-safe fonts or convert to paths for production

### 4. Color Harmony
- Use colors that complement each other
- Ensure sufficient contrast for readability (4.5:1 minimum)
- Consider how the logo looks in monochrome
- Limit palette to 2-3 colors maximum
- Test on both light and dark backgrounds

### 5. Memorability
- Create distinctive, recognizable designs
- Avoid cliches unless specifically requested
- Make the logo uniquely ownable
- Simple enough to sketch from memory

## Logo Types

| Type | Description | Best For |
|------|-------------|----------|
| **Wordmark** | Typography-focused, brand name as logo | Distinctive brand names, tech companies |
| **Lettermark** | Initials or abbreviation | Long company names, professional services |
| **Abstract** | Geometric or organic shapes | Tech, innovation, multi-industry |
| **Pictorial** | Recognizable icon or symbol | Established brands, app icons |
| **Mascot** | Character-based design | Food/beverage, sports, entertainment |
| **Combination** | Icon + text together | Versatile applications, new brands |
| **Emblem** | Text within a shape or badge | Institutions, luxury brands, heritage |

## Theme Presets

### Modern
- Clean sans-serif typography
- Geometric shapes
- Monochromatic or limited palette
- Ample negative space
- Flat design, no gradients

### Minimal
- Essential elements only
- Single color or black/white
- Thin strokes, subtle details
- Maximum negative space
- Typography-forward

### Bold
- Heavy typography weight
- High contrast colors
- Strong geometric shapes
- Commanding presence
- Saturated colors

### Elegant
- Serif or script typography
- Refined, thin strokes
- Sophisticated color palette
- Balanced proportions
- Subtle flourishes

### Playful
- Rounded shapes
- Bright, vibrant colors
- Friendly typography
- Organic curves
- Energetic composition

### Tech
- Geometric precision
- Blue/purple gradients
- Futuristic typography
- Hexagons, circuits, nodes
- Clean, sharp edges

### Organic
- Natural, flowing curves
- Earth tones or greens
- Hand-drawn qualities
- Asymmetric balance
- Leaf, water, nature motifs

## Shape Generators

### Circle
- Unity, wholeness, infinity
- Soft, approachable feel
- Works well for avatars/icons

### Hexagon
- Modern, tech-forward
- Honeycomb associations
- Efficient space usage

### Triangle
- Stability (pointing up)
- Dynamic energy (pointing right)
- Innovation, progress

### Square/Rectangle
- Stability, reliability
- Professional, corporate
- Grid-friendly

### Diamond
- Premium, luxury
- Dynamic, attention-grabbing
- Geometric precision

### Shield
- Protection, security
- Trust, heritage
- Institutional feel

### Leaf/Organic
- Nature, sustainability
- Growth, health
- Environmental focus

## SVG Quality Standards

### Structure
- Always include `xmlns="http://www.w3.org/2000/svg"`
- Use proper viewBox matching dimensions
- Nest elements logically (groups, defs)
- No external dependencies

### Optimization
- Remove unnecessary attributes
- Combine similar paths when possible
- Use groups for repeated styles
- Minimize decimal precision (2 places)

### Accessibility
- Ensure 4.5:1 contrast ratio minimum
- Design works in grayscale
- No information conveyed by color alone
- Structure allows alt text

### Production Ready
- All fonts converted to paths
- No external links or embedded images
- Standard color formats (hex, rgb)
- File size under 50KB

## Iteration Workflow

### 1. Generate Initial Design
Create SVG based on configuration:
- Apply logo type constraints
- Use theme-appropriate styling
- Include all required text elements
- Set proper dimensions and viewBox

### 2. Self-Evaluate
Check against design principles:
- Balance and visual weight
- Simplicity and scalability
- Typography quality
- Color harmony
- Memorability

### 3. Judge Evaluation
Run 4 specialized judges in parallel:
- **Concept Fidelity** (weight: 35%): Brand alignment
- **Technical Quality** (weight: 25%): SVG validity
- **Scalability** (weight: 15%): Multi-size appearance
- **Production Readiness** (weight: 25%): Deployment ready

### 4. Pass Thresholds
- Concept Fidelity: >= 7.0
- Technical Quality: >= 8.0
- Scalability: >= 6.0
- Production Readiness: >= 7.5
- Overall: >= 7.0 with no critical issues

### 5. Iterate or Complete
If any judge fails:
1. Address critical issues first
2. Work through prioritized suggestions
3. Re-generate with improvements
4. Re-run judges

Maximum 5 iterations before returning best attempt.

## Common Issues to Avoid

### Typography
- Text too small at target size
- Poor letter spacing
- Font doesn't match brand personality
- Text extends beyond viewBox

### Technical
- Missing xmlns attribute
- Incorrect viewBox dimensions
- Elements positioned outside bounds
- Unclosed paths or elements

### Design
- Too many elements/complexity
- Poor color contrast
- Unbalanced composition
- Generic/cliche imagery

### Production
- External font references
- Embedded images
- Very thin strokes (< 1px)
- Unusual color formats
