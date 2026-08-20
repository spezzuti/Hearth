from pathlib import Path

from PIL import Image, ImageChops, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src/renderer/src/assets/residents/companion/companion-idle.png"
OUTPUT = ROOT / "src/renderer/src/assets/residents/companion/rig-v2"


def layer_from_alpha(source: Image.Image, alpha: Image.Image) -> Image.Image:
    """Copy only visible source pixels so transparent RGB cannot bloat the PNG."""
    clean = Image.new("RGBA", source.size, (0, 0, 0, 0))
    visible = source.copy()
    visible.putalpha(alpha)
    clean.alpha_composite(visible)
    return clean


def main() -> None:
    source = Image.open(SOURCE).convert("RGBA")
    width, height = source.size

    # The lamp is cut from the approved texture itself. The mask follows the
    # exterior lamp silhouette while stopping before Companion's arm and body.
    mask = Image.new("L", source.size, 0)
    draw = ImageDraw.Draw(mask)
    draw.polygon(
        [
            (0, 0),
            (850, 0),
            (850, 265),
            (725, 285),
            (225, 285),
            (205, 735),
            (118, 735),
            (0, 690),
        ],
        fill=255,
    )

    alpha = source.getchannel("A")
    lamp_alpha = Image.composite(alpha, Image.new("L", source.size, 0), mask)
    lamp = layer_from_alpha(source, lamp_alpha)

    # Partition the approved lamp into a small hierarchy. Every source pixel
    # belongs to exactly one segment at rest, so the three layers reconstruct
    # the approved image without redrawing or changing its perspective.
    shade_region = Image.new("L", source.size, 0)
    shade_draw = ImageDraw.Draw(shade_region)
    shade_draw.polygon([(185, 0), (900, 0), (900, 245), (205, 245)], fill=255)

    upper_region = Image.new("L", source.size, 0)
    upper_draw = ImageDraw.Draw(upper_region)
    upper_draw.polygon([(0, 0), (340, 0), (330, 190), (142, 490), (0, 490)], fill=255)

    shade_alpha = Image.composite(lamp_alpha, Image.new("L", source.size, 0), shade_region)
    remaining_after_shade = ImageChops.subtract(lamp_alpha, shade_alpha)
    upper_alpha = Image.composite(
        remaining_after_shade,
        Image.new("L", source.size, 0),
        upper_region,
    )
    lower_alpha = ImageChops.subtract(remaining_after_shade, upper_alpha)

    lamp_lower = layer_from_alpha(source, lower_alpha)
    lamp_upper = layer_from_alpha(source, upper_alpha)
    lamp_shade = layer_from_alpha(source, shade_alpha)

    body_alpha = alpha.copy()
    body_alpha.paste(0, mask=mask)

    body = layer_from_alpha(source, body_alpha)

    OUTPUT.mkdir(parents=True, exist_ok=True)
    body.save(OUTPUT / "body.png", optimize=True)
    lamp.save(OUTPUT / "lamp.png", optimize=True)
    lamp_lower.save(OUTPUT / "lamp-lower.png", optimize=True)
    lamp_upper.save(OUTPUT / "lamp-upper.png", optimize=True)
    lamp_shade.save(OUTPUT / "lamp-shade.png", optimize=True)

    # Keep the source dimensions explicit for future deterministic controls.
    (OUTPUT / "geometry.json").write_text(
        '{\n'
        f'  "width": {width},\n'
        f'  "height": {height},\n'
        '  "lampPivots": {\n'
        '    "lower": { "x": 164, "y": 687 },\n'
        '    "upper": { "x": 83, "y": 370 },\n'
        '    "shade": { "x": 251, "y": 91 }\n'
        '  },\n'
        '  "face": { "left": 318, "top": 304, "width": 430, "height": 260 },\n'
        '  "eyes": [\n'
        '    { "x": 454, "y": 426, "width": 82, "height": 58 },\n'
        '    { "x": 642, "y": 421, "width": 82, "height": 58 }\n'
        '  ]\n'
        '}\n',
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
