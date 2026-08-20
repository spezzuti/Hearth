from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "tmp/companion-sprite/wave-magenta-source.png"
OUTPUT = ROOT / "src/renderer/src/assets/residents/companion/sprite-v1"
PREVIEW = ROOT / "tmp/companion-sprite/wave-preview.gif"


def remove_magenta_background(source: Image.Image) -> Image.Image:
    cleaned = source.convert("RGBA")
    pixels = cleaned.load()
    for y in range(cleaned.height):
        for x in range(cleaned.width):
            red, green, blue, _ = pixels[x, y]
            magenta_floor = min(red, blue)
            dominance = magenta_floor - green
            if red > 125 and blue > 105 and dominance > 62:
                alpha = 0
            elif red > 92 and blue > 78 and dominance > 28:
                alpha = round(255 * (62 - dominance) / 34)
            else:
                alpha = 255
            if alpha == 0:
                pixels[x, y] = (0, 0, 0, 0)
            else:
                edge_red = min(red, green + 18) if alpha < 255 else red
                edge_blue = min(blue, green + 18) if alpha < 255 else blue
                pixels[x, y] = (edge_red, green, edge_blue, alpha)
    return cleaned


def opaque_column_runs(source: Image.Image) -> list[tuple[int, int]]:
    alpha = source.getchannel("A")
    columns = [x for x in range(source.width) if alpha.crop((x, 0, x + 1, source.height)).getbbox()]
    if not columns:
        return []
    runs: list[tuple[int, int]] = []
    start = previous = columns[0]
    for x in columns[1:]:
        if x > previous + 1:
            runs.append((start, previous + 1))
            start = x
        previous = x
    runs.append((start, previous + 1))
    return runs


def main() -> None:
    cleaned = remove_magenta_background(Image.open(SOURCE))
    cropped_frames: list[Image.Image] = []
    # The approved source is a 3x2 contact sheet with ample separation.
    slot_width = cleaned.width / 3
    slot_height = cleaned.height / 2
    for index in range(6):
        row, column = divmod(index, 3)
        left = round(column * slot_width)
        right = round((column + 1) * slot_width)
        top = round(row * slot_height)
        bottom = round((row + 1) * slot_height)
        frame = cleaned.crop((left, top, right, bottom))
        bbox = frame.getchannel("A").getbbox()
        if bbox is None:
            raise ValueError("Wave pose is empty")
        cropped_frames.append(frame.crop(bbox))

    canvas_size = (
        max(frame.width for frame in cropped_frames) + 36,
        max(frame.height for frame in cropped_frames) + 28,
    )
    OUTPUT.mkdir(parents=True, exist_ok=True)
    frames: list[Image.Image] = []
    for index, cropped in enumerate(cropped_frames):
        canvas = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
        x = (canvas.width - cropped.width) // 2
        y = canvas.height - cropped.height - 10
        canvas.alpha_composite(cropped, (x, y))
        corners = ((0, 0), (canvas.width - 1, 0), (0, canvas.height - 1), (canvas.width - 1, canvas.height - 1))
        if any(canvas.getchannel("A").getpixel(point) for point in corners):
            raise ValueError(f"Wave frame {index} has a contaminated border")
        canvas.save(OUTPUT / f"wave-{index}.png", optimize=True)
        frames.append(canvas)

    frames[0].save(
        PREVIEW,
        save_all=True,
        append_images=frames[1:] + [frames[4], frames[3], frames[4], frames[5]],
        duration=[180, 135, 135, 150, 150, 135, 150, 150, 150, 200],
        loop=0,
        disposal=2,
        transparency=0,
    )


if __name__ == "__main__":
    main()
