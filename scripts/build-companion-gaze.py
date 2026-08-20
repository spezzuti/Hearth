from pathlib import Path

from PIL import Image
from collections import deque


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "tmp/companion-sprite/gaze-magenta-source.png"
OUTPUT = ROOT / "src/renderer/src/assets/residents/companion/sprite-v2"
PREVIEW = ROOT / "tmp/companion-sprite/gaze-preview.gif"
NAMES = [
    "up-left", "up", "up-right",
    "left", "center", "right",
    "down-left", "down", "down-right",
]


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


def main() -> None:
    cleaned = remove_magenta_background(Image.open(SOURCE))
    cell_width = cleaned.width / 3
    cell_height = cleaned.height / 3
    cropped: list[Image.Image] = []
    for index, name in enumerate(NAMES):
        row, column = divmod(index, 3)
        frame = cleaned.crop((
            round(column * cell_width),
            round(row * cell_height),
            round((column + 1) * cell_width),
            round((row + 1) * cell_height),
        ))
        bbox = frame.getchannel("A").getbbox()
        if bbox is None:
            raise ValueError(f"Gaze pose {name} is empty")
        frame = frame.crop(bbox)
        alpha = frame.getchannel("A")
        visited: set[tuple[int, int]] = set()
        components: list[list[tuple[int, int]]] = []
        for y in range(frame.height):
            for x in range(frame.width):
                if (x, y) in visited or alpha.getpixel((x, y)) == 0:
                    continue
                queue = deque([(x, y)])
                visited.add((x, y))
                component: list[tuple[int, int]] = []
                while queue:
                    px, py = queue.popleft()
                    component.append((px, py))
                    for nx, ny in ((px - 1, py), (px + 1, py), (px, py - 1), (px, py + 1)):
                        if 0 <= nx < frame.width and 0 <= ny < frame.height and (nx, ny) not in visited and alpha.getpixel((nx, ny)) > 0:
                            visited.add((nx, ny))
                            queue.append((nx, ny))
                components.append(component)
        if components:
            largest = max(components, key=len)
            keep = set(largest)
            pixels = frame.load()
            for y in range(frame.height):
                for x in range(frame.width):
                    if alpha.getpixel((x, y)) > 0 and (x, y) not in keep:
                        pixels[x, y] = (0, 0, 0, 0)
            final_bbox = frame.getchannel("A").getbbox()
            if final_bbox is not None:
                frame = frame.crop(final_bbox)
        cropped.append(frame)

    canvas_size = (
        max(frame.width for frame in cropped) + 40,
        max(frame.height for frame in cropped) + 30,
    )
    OUTPUT.mkdir(parents=True, exist_ok=True)
    normalized: list[Image.Image] = []
    for name, frame in zip(NAMES, cropped):
        canvas = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
        x = (canvas.width - frame.width) // 2
        y = canvas.height - frame.height - 10
        canvas.alpha_composite(frame, (x, y))
        canvas.save(OUTPUT / f"gaze-{name}.png", optimize=True)
        normalized.append(canvas)

    # A loop that makes alignment, semantic order, and size popping obvious.
    order = [4, 1, 2, 5, 8, 7, 6, 3, 0, 1, 4]
    preview_frames = [normalized[index] for index in order]
    preview_frames[0].save(
        PREVIEW,
        save_all=True,
        append_images=preview_frames[1:],
        duration=[380] + [175] * 9 + [380],
        loop=0,
        disposal=2,
        transparency=0,
    )


if __name__ == "__main__":
    main()
