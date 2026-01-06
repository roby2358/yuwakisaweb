# ColorWheel Port Documentation

## Overview
This document describes the port of the Scala ColorWheel example to JavaScript.

## Files Created

### colorwheel.js
Port of `ColorWheel.scala` containing:
- `mod1(a)` - Modulo 1 function for wrapping values
- `sqr(x)` - Square function
- `hslToRgb(h, s, l)` - Converts HSL to RGB color space
- `rgbToHsl(r, g, b)` - Converts RGB to HSL color space
- `pixToRGBLuminosity(radial)` - Converts radial coordinates to RGB based on luminosity
- `pixToRGBSaturation(radial)` - Converts radial coordinates to RGB based on saturation

### schemes.js
Port of `Schemes.scala` containing color scheme generators:
- `monochromatic(radial, randomFn)` - Single hue with varying lightness
- `analogous(radial, randomFn)` - Adjacent colors on the color wheel
- `triad(radial, randomFn)` - Three colors evenly spaced on the wheel
- `complementary(radial, randomFn)` - Opposite colors on the wheel
- `splitComplementary(radial, randomFn)` - Base color plus two adjacent to complement
- `doubleSplitComplementary(radial, randomFn)` - Variation with double splits
- `square(radial, randomFn)` - Four colors evenly spaced
- `compound(radial, randomFn)` - Complex scheme with adjacent and complement colors
- `randomScheme(randomFn)` - Randomly selects a scheme

### colors.js
Port of `Colors.scala` containing:
- `gradient(colors)` - Creates smooth color gradient function
- `bands(colors)` - Creates discrete color bands function
- `Colors` class - Caches color computations for performance

## Integration

### Changes to index.js
1. Replaced `getColormap()` method with:
   - `generateColorScheme(schemeName)` - Generates color palette from scheme
   - `getColormapFromScheme(colors)` - Converts palette to colormap function

2. Updated `render()` method to accept scheme name and colors

3. Updated `generate()` method to use schemes instead of colormaps

4. Added `currentColors` tracking for consistent colors when moving sources

### Changes to index.html
1. Changed "Colormap" dropdown to "Color Scheme" dropdown
2. Replaced colormap options (viridis, plasma, etc.) with scheme options:
   - Monochromatic
   - Analogous
   - Triad
   - Complementary
   - Split Complementary
   - Double Split Complementary
   - Square
   - Compound

3. Added script tags for new JavaScript files before index.js:
   - colorwheel.js
   - schemes.js
   - colors.js

## Color Theory

Each scheme follows established color theory principles:

- **Monochromatic**: Uses a single hue with varying luminosity for a harmonious look
- **Analogous**: Uses colors next to each other on the wheel for natural harmony
- **Triad**: Three colors equally spaced (120° apart) for vibrant contrast
- **Complementary**: Opposite colors (180° apart) for maximum contrast
- **Split Complementary**: Base color plus two colors adjacent to its complement
- **Double Split**: More complex variation with multiple split points
- **Square**: Four colors equally spaced (90° apart) for balanced variety
- **Compound**: Adjacent colors plus complement for rich variation

## Usage

1. Open `index.html` in a browser
2. Select a color scheme from the dropdown
3. Click "Generate New Heat Map" to create a visualization
4. The color scheme will be randomly generated based on the selected algorithm
5. Each generation uses the same seed will produce consistent heat patterns but new color variations due to randomness in the scheme generation
