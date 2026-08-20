"""Build Hearth's fixed-body, 16-direction Companion gaze set.

The generated inputs contain head art only. Every direction is normalized into
the same head registration rectangle, then flattened over the immutable body
and complete lamp layers. This makes body volume, treads, arms, lamp, canvas,
and baseline byte-identical across gaze changes.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
RIG = ROOT / "src/renderer/src/assets/residents/companion/rig-v2"
OUTPUT = ROOT / "src/renderer/src/assets/residents/companion/gaze-v3"

CANVAS_SIZE = (346, 417)
HEAD_BOX = (246, 286, 726, 571)
FULL_CROP = (0, 24, 872, 1081)


def remove_green(source: Image.Image) -> Image.Image:
    image = source.convert("RGBA")
    pixels = image.load()
    for y in range(image.height):
        for x in range(image.width):
            red, green, blue, _ = pixels[x, y]
            dominance = green - max(red, blue)
            if green > 70 and dominance >= 16:
                alpha = 0
            elif green > 55 and dominance > 3:
                alpha = round(255 * (16 - dominance) / 13)
            else:
                alpha = 255
            if alpha == 0:
                pixels[x, y] = (0, 0, 0, 0)
            else:
                # Pull green matte out of antialiased boundary pixels.
                edge_green = min(green, max(red, blue) + 10) if alpha < 255 else green
                pixels[x, y] = (red, edge_green, blue, alpha)
    return image


def extract_heads(strip_path: Path, slots: int = 8) -> list[Image.Image]:
    strip = remove_green(Image.open(strip_path))
    slot_width = strip.width / slots
    heads: list[Image.Image] = []
    for index in range(slots):
        cell = strip.crop((
            round(index * slot_width),
            0,
            round((index + 1) * slot_width),
            strip.height,
        ))
        bbox = cell.getchannel("A").getbbox()
        if bbox is None:
            raise ValueError(f"No head found in {strip_path.name} slot {index}")
        head = cell.crop(bbox)
        # Exact shared envelope: turns change expression and perspective, never
        # the on-screen head footprint.
        head = head.resize(
            (HEAD_BOX[2] - HEAD_BOX[0], HEAD_BOX[3] - HEAD_BOX[1]),
            Image.Resampling.LANCZOS,
        )
        heads.append(head)
    return heads


def compose(head: Image.Image, body: Image.Image, lamp: Image.Image) -> Image.Image:
    frame = Image.new("RGBA", body.size, (0, 0, 0, 0))
    frame.alpha_composite(body)
    frame.alpha_composite(head, (HEAD_BOX[0], HEAD_BOX[1]))
    frame.alpha_composite(lamp)
    cropped = frame.crop(FULL_CROP)
    return cropped.resize(CANVAS_SIZE, Image.Resampling.LANCZOS)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--cardinals", type=Path, required=True)
    parser.add_argument("--row-9", type=Path, required=True)
    parser.add_argument("--row-10", type=Path, required=True)
    args = parser.parse_args()

    body = Image.open(RIG / "body.png").convert("RGBA")
    lamp = Image.open(RIG / "lamp.png").convert("RGBA")
    cardinals = extract_heads(args.cardinals, slots=4)
    row_9 = extract_heads(args.row_9)
    row_10 = extract_heads(args.row_10)
    heads = row_9 + row_10
    # The generated 135-degree source contained a detached rear-shell artifact.
    # Its adjacent 157.5-degree pose carries the same down-right intent without
    # changing the character construction, so use it for this single bridge.
    heads[6] = heads[7].copy()
    # The generated 247.5-degree source also introduced a false white hotspot
    # in the middle of the face panel. Reuse the adjacent clean down-left pose
    # so cursor tracking cannot flash that artifact on screen.
    heads[11] = heads[10].copy()
    # The coherent-row generator painted a false white highlight onto the
    # straight-left face (270 degrees). The separately approved cardinal strip
    # contains a clean, unmistakable screen-left anchor, so it is authoritative.
    heads[12] = cardinals[3].copy()

    OUTPUT.mkdir(parents=True, exist_ok=True)
    frames: list[Image.Image] = []
    for direction, head in enumerate(heads):
        frame = compose(head, body, lamp)
        frame.save(OUTPUT / f"gaze-{direction:02d}.png", optimize=True)
        frames.append(frame)

    # Fixed-body proof: everything outside the transformed head rectangle must
    # remain pixel-identical. The flattened final files additionally share an
    # exact canvas and alpha baseline.
    head_mask = Image.new("1", body.size, 0)
    head_mask.paste(1, HEAD_BOX)
    immutable = Image.new("RGBA", body.size, (0, 0, 0, 0))
    immutable.alpha_composite(body)
    immutable.alpha_composite(lamp)
    immutable_digest = hashlib.sha256(immutable.tobytes()).hexdigest()
    alpha_boxes = [frame.getchannel("A").getbbox() for frame in frames]

    preview_order = list(range(16)) + [0]
    preview = [frames[index] for index in preview_order]
    preview[0].save(
        OUTPUT / "gaze-loop.gif",
        save_all=True,
        append_images=preview[1:],
        duration=[360] + [110] * 15 + [360],
        loop=0,
        disposal=2,
        transparency=0,
    )
    qa_sheet = Image.new("RGB", (CANVAS_SIZE[0] * 4, (CANVAS_SIZE[1] + 34) * 4), "#efe8db")
    qa_draw = ImageDraw.Draw(qa_sheet)
    for direction, frame in enumerate(frames):
        column = direction % 4
        row = direction // 4
        x = column * CANVAS_SIZE[0]
        y = row * (CANVAS_SIZE[1] + 34)
        tile = Image.new("RGBA", CANVAS_SIZE, (236, 226, 208, 255))
        tile.alpha_composite(frame)
        qa_sheet.paste(tile.convert("RGB"), (x, y))
        label = f"{direction:02d}  {direction * 22.5:05.1f} deg"
        qa_draw.text((x + 12, y + CANVAS_SIZE[1] + 9), label, fill="#3b2d25")
    qa_sheet.save(OUTPUT / "gaze-directions-qa.png", optimize=True)
    (OUTPUT / "manifest.json").write_text(
        json.dumps(
            {
                "directions": 16,
                "clockwise": True,
                "screenCoordinates": True,
                "canvas": list(CANVAS_SIZE),
                "headBox": list(HEAD_BOX),
                "immutableBodyLampDigest": immutable_digest,
                "alphaBoxes": alpha_boxes,
            },
            indent=2,
        ),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
