# EGA Image File Format (IMEDIT)

Reference for the custom EGA sprite format used by Monster Gladiators and related projects. Based on reverse engineering of `IMAGE.H`, `IMAGE.CPP`, and the IMEDIT editor source code.

## File Structure

An `.EGA` file is a flat binary blob containing:

1. **Image table** — an array of `Istruct_t` entries (10 bytes each)
2. **Pixel data** — contiguous plane data for each image

The number of table entries is determined by the first entry's offset:

```
max_images = first_entry.offset / sizeof(Istruct_t)
```

Unused table slots are zeroed out (all fields = 0).

## Istruct_t (10 bytes, little-endian)

| Offset | Size | Type         | Field    | Description                              |
|--------|------|--------------|----------|------------------------------------------|
| 0      | 1    | signed char  | slidex   | X placement offset (pixels)              |
| 1      | 1    | signed char  | slidey   | Y placement offset (pixels)              |
| 2      | 2    | uint16       | width    | Row width in **bytes** (pixels = width * 8) |
| 4      | 2    | uint16       | size     | Bytes per plane (= width * pixel_height) |
| 6      | 2    | uint16       | flags    | Plane count, color mode, mask flag       |
| 8      | 2    | uint16       | offset   | Byte offset from **this struct** to data |

### Derived dimensions

- Pixel width = `width * 8`
- Pixel height = `size / width`

### Offset field

The offset is **relative to the struct's own position** in the file, not absolute:

```
data_file_position = (entry_index * 10) + entry.offset
```

## Flags

```
bits 0-2  IMAGE_PLANES (mask 0x07)  planes_field; data planes = 1 + planes_field
bit  3    IMAGE_NORMAL (0x08)       first 4 planes use fixed EGA colors
bit  4    IMAGE_MASK   (0x10)       an additional mask plane is present
```

Total planes stored in the file:

```
total_planes = (1 + (flags & 0x07)) + ((flags & 0x10) ? 1 : 0)
```

Total bytes of pixel data per image:

```
data_bytes = total_planes * size
```

## Pixel Data Layout

Each plane is `size` bytes: 1 bit per pixel, row-major, MSB first, `width` bytes per row.

Planes are stored contiguously in this order:

1. **Mask plane** (if `IMAGE_MASK` set) — 1 = visible, 0 = transparent
2. **Color planes** 0, 1, 2, ... N — combined to produce the final color

## Color System

The `put()` function writes each plane to the EGA hardware by setting the **Map Mask register** (port 0x3C4, index 2). This register controls which of the 4 EGA bit planes are affected by the write. The value written to the Map Mask determines the color contribution of that plane.

### Normal mode (IMAGE_NORMAL set)

The first 4 color planes use a fixed color lookup:

```
clrtbl = [0x01, 0x02, 0x04, 0x08, 0x0F, 0x0E, 0x0C, 0x09]
```

- Plane 0 writes to Map Mask 0x01 (EGA blue)
- Plane 1 writes to Map Mask 0x02 (EGA green)
- Plane 2 writes to Map Mask 0x04 (EGA red)
- Plane 3 writes to Map Mask 0x08 (EGA intensity)

These 4 planes combine via OR to produce standard 16-color EGA values.

Any planes beyond the first 4 are **overlay planes** — their Map Mask values come from the `overlay` parameter passed at draw time.

### Overlay-only mode (IMAGE_NORMAL clear)

All planes are overlay planes. Every plane's Map Mask comes from the overlay table.

### Default overlay table

```
BASE_OVERLAY = [0x04, 0x02, 0x01, 0x0F, 0x0E, 0x0C, 0x0A, 0x09, 0x08, 0x00]
```

### How overlays enable recoloring

The overlay planes define regions of the sprite that can change color per instance. By passing a different overlay table to `put()`, the same plane data writes to different EGA color planes, producing a different on-screen color.

For gladiator sprites: the normal planes define fixed details (skin, outlines, weapon), while overlay planes define armor/clothing areas that are recolored per character.

## Rendering Algorithm

For each color plane (after mask):

1. Determine the Map Mask value:
   - If `IMAGE_NORMAL` and plane index < 4: use `clrtbl[index]`
   - Otherwise: use `overlay[adjusted_index]`
2. Set the EGA Map Mask register to that value
3. Set the EGA Data Rotate register to the desired write mode (SET/AND/OR/XOR) plus the pixel-alignment rotation
4. Write the plane's bit data to video memory row by row

The mask plane (if present) is drawn first using AND mode with Map Mask 0x0F (all planes), clearing the destination area before the color planes are OR'd in.

## Known Files

### TERRAIN.EGA (7,274 bytes)

- 20 entries, all 24x24 pixels
- No mask planes
- 4 or 5 color planes (all normal, no overlays)
- 10 terrain types, 2 sprite variants each (entries 0-1, 2-3, etc.)
- Terrain types in order: clear, sand, tree, bush, rock, pool, column, light wall, dark wall, blood

### GUYS.EGA (16,202 bytes)

- 32 entries, all 24x24 pixels
- Entries 0-1: Character face/emblem sprites (5 planes: mask + 4 normal)
- Entries 2-3: Simple circles, overlay-only (5 planes: mask + 4 overlay)
- Entries 4-31: Gladiator character sprites (7 planes: mask + 4 normal + 2 overlay)
  - Paired as left-facing/right-facing variants
  - The 2 overlay planes are the armor/clothing regions recolored per fighter

## Standard EGA Palette

For reference, the 16 standard EGA colors:

```
 0 = black         8 = dark gray
 1 = blue          9 = light blue
 2 = green        10 = light green
 3 = cyan         11 = light cyan
 4 = red          12 = light red
 5 = magenta      13 = light magenta
 6 = brown        14 = yellow
 7 = light gray   15 = white
```

## Notes

- The image editor (IMEDIT) and renderer (IMAGE.CPP) are from a shared `TOOLS` library referenced as `..\TOOLS\` in project files.
- The game's text-mode version (MGLAD) uses ASCII characters with color attributes instead of these sprites, but the EGA assets exist for a graphical mode version.
- The XSCREEN library in `Modex2/` may be a Mode X (VGA 320x240) adaptation of the same rendering approach.
- The original toolchain is Turbo C++ (project file dated September 1992).
