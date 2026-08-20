from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCES = {
    "right": ROOT / "tmp/companion-sprite/attention-magenta-source.png",
    "left": ROOT / "tmp/companion-sprite/attention-left-source.png",
}
OUTPUT = ROOT / "src/renderer/src/assets/residents/companion/sprite-v1"
PREVIEW_DIR = ROOT / "tmp/companion-sprite"


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
    runs: list[tuple[int, int]] = []
    start = previous = columns[0]
    for x in columns[1:]:
        if x > previous + 1:
            runs.append((start, previous + 1))
            start = x
        previous = x
    runs.append((start, previous + 1))
    return runs


def extract(source_path: Path) -> list[Image.Image]:
    source = remove_magenta_background(Image.open(source_path))
    runs = opaque_column_runs(source)
    if len(runs) != 6:
        raise ValueError(f"Expected six isolated sprite poses in {source_path.name}, found {runs}")
    frames: list[Image.Image] = []
    for left, right in runs:
        frame = source.crop((left, 0, right, source.height))
        bbox = frame.getchannel("A").getbbox()
        if bbox is None:
            raise ValueError("Sprite pose is empty")
        frames.append(frame.crop(bbox))
    return frames


def main() -> None:
    families = {direction: extract(path) for direction, path in SOURCES.items()}
    max_width = max(frame.width for frames in families.values() for frame in frames) + 36
    max_height = max(frame.height for frames in families.values() for frame in frames) + 28
    canvas_size = (max_width, max_height)
    OUTPUT.mkdir(parents=True, exist_ok=True)

    for direction, raw_frames in families.items():
        frames: list[Image.Image] = []
        for index, cropped in enumerate(raw_frames):
            canvas = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
            x = (canvas.width - cropped.width) // 2
            y = canvas.height - cropped.height - 10
            canvas.alpha_composite(cropped, (x, y))
            if any(canvas.getchannel("A").getpixel(point) for point in ((0, 0), (canvas.width - 1, 0), (0, canvas.height - 1), (canvas.width - 1, canvas.height - 1))):
                raise ValueError(f"{direction} frame {index} has a contaminated border")
            canvas.save(OUTPUT / f"attention-{direction}-{index}.png", optimize=True)
            frames.append(canvas)
        durations = [620, 190, 230, 460, 230, 620]
        frames[0].save(
            PREVIEW_DIR / f"attention-{direction}-preview.gif",
            save_all=True,
            append_images=frames[1:],
            duration=durations,
            loop=0,
            disposal=2,
            transparency=0,
        )


if __name__ == "__main__":
    main()
