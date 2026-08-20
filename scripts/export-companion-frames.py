"""Export Hearth's Companion atlas into isolated renderer-safe frame files."""

from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

from PIL import Image


CELL_WIDTH = 192
CELL_HEIGHT = 208
ROW_FRAME_COUNTS = (6, 8, 8, 4, 5, 8, 6, 6, 6, 8, 8)
ROW_STATES = (
    "idle",
    "running-right",
    "running-left",
    "waving",
    "jumping",
    "failed",
    "waiting",
    "running",
    "review",
)
CHROMA_KEY = (0, 255, 255)
CHROMA_THRESHOLD = 96


def remove_chroma_background(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    threshold_squared = CHROMA_THRESHOLD**2
    for y in range(rgba.height):
        for x in range(rgba.width):
            red, green, blue, alpha = pixels[x, y]
            distance_squared = (
                (red - CHROMA_KEY[0]) ** 2
                + (green - CHROMA_KEY[1]) ** 2
                + (blue - CHROMA_KEY[2]) ** 2
            )
            if distance_squared <= threshold_squared:
                pixels[x, y] = (0, 0, 0, 0)
    return rgba


def valley_boundaries(strip: Image.Image, frame_count: int) -> list[int]:
    """Find the least-occupied cut between neighboring generated poses."""
    alpha = strip.getchannel("A")
    counts = [sum(1 for y in range(strip.height) if alpha.getpixel((x, y)) > 16) for x in range(strip.width)]
    slot_width = strip.width / frame_count
    boundaries = [0]
    for index in range(1, frame_count):
        target = index * slot_width
        left = max(boundaries[-1] + 8, round(target - slot_width * 0.28))
        right = min(strip.width - 8, round(target + slot_width * 0.28))
        candidates = range(left, right + 1)
        boundary = min(
            candidates,
            key=lambda x: (
                sum(counts[max(0, x - 2) : min(strip.width, x + 3)]),
                abs(x - target),
            ),
        )
        boundaries.append(boundary)
    boundaries.append(strip.width)
    return boundaries


def extract_generated_row(strip_path: Path, frame_count: int) -> list[Image.Image]:
    strip = remove_chroma_background(Image.open(strip_path))
    boundaries = valley_boundaries(strip, frame_count)
    shared_bbox = strip.getbbox()
    if shared_bbox is None:
        raise ValueError(f"No visible poses in {strip_path}")
    shared_top = max(0, shared_bbox[1] - 4)
    shared_bottom = min(strip.height, shared_bbox[3] + 4)

    pose_crops: list[Image.Image] = []
    for index in range(frame_count):
        segment = strip.crop((boundaries[index], 0, boundaries[index + 1], strip.height))
        bbox = segment.getbbox()
        if bbox is None:
            raise ValueError(f"Empty pose {index} in {strip_path}")
        if strip_path.stem.startswith("jumping"):
            pose_crops.append(segment.crop(bbox))
        else:
            pose_crops.append(segment.crop((bbox[0], shared_top, bbox[2], shared_bottom)))

    if strip_path.stem.startswith("jumping"):
        lifts = (0, 9, 17, 9, 0)
        max_lift = max(lifts)
        scale = min(
            (CELL_WIDTH - 10) / max(pose.width for pose in pose_crops),
            (CELL_HEIGHT - 10 - max_lift) / max(pose.height for pose in pose_crops),
            1.0,
        )
        frames: list[Image.Image] = []
        for pose, lift in zip(pose_crops, lifts):
            if scale != 1.0:
                pose = pose.resize(
                    (round(pose.width * scale), round(pose.height * scale)),
                    Image.Resampling.LANCZOS,
                )
            frame = Image.new("RGBA", (CELL_WIDTH, CELL_HEIGHT), (0, 0, 0, 0))
            frame.alpha_composite(
                pose,
                ((CELL_WIDTH - pose.width) // 2, CELL_HEIGHT - 5 - pose.height - lift),
            )
            frames.append(frame)
        return frames

    viewport_width = max(pose.width for pose in pose_crops) + 8
    viewport_height = shared_bottom - shared_top
    scale = min(
        (CELL_WIDTH - 10) / viewport_width,
        (CELL_HEIGHT - 10) / viewport_height,
        1.0,
    )
    frames: list[Image.Image] = []
    for pose in pose_crops:
        viewport = Image.new("RGBA", (viewport_width, viewport_height), (0, 0, 0, 0))
        viewport.alpha_composite(pose, ((viewport_width - pose.width) // 2, 0))
        if scale != 1.0:
            viewport = viewport.resize(
                (round(viewport.width * scale), round(viewport.height * scale)),
                Image.Resampling.LANCZOS,
            )
        frame = Image.new("RGBA", (CELL_WIDTH, CELL_HEIGHT), (0, 0, 0, 0))
        frame.alpha_composite(
            viewport,
            ((CELL_WIDTH - viewport.width) // 2, (CELL_HEIGHT - viewport.height) // 2),
        )
        frames.append(frame)
    return frames


def remove_disconnected_edge_fragments(frame: Image.Image) -> tuple[Image.Image, int]:
    """Remove neighbor-cell debris without altering the Companion's main silhouette."""
    alpha = frame.getchannel("A")
    visible = alpha.load()
    visited: set[tuple[int, int]] = set()
    components: list[list[tuple[int, int]]] = []

    for y in range(CELL_HEIGHT):
        for x in range(CELL_WIDTH):
            if visible[x, y] == 0 or (x, y) in visited:
                continue
            component: list[tuple[int, int]] = []
            queue = deque([(x, y)])
            visited.add((x, y))
            while queue:
                current_x, current_y = queue.popleft()
                component.append((current_x, current_y))
                for neighbor_y in range(max(0, current_y - 1), min(CELL_HEIGHT, current_y + 2)):
                    for neighbor_x in range(max(0, current_x - 1), min(CELL_WIDTH, current_x + 2)):
                        point = (neighbor_x, neighbor_y)
                        if visible[point] == 0 or point in visited:
                            continue
                        visited.add(point)
                        queue.append(point)
            components.append(component)

    if not components:
        return frame, 0

    main_component = max(components, key=len)
    removed_pixels: list[tuple[int, int]] = []
    for component in components:
        if component is main_component:
            continue
        min_x = min(point[0] for point in component)
        max_x = max(point[0] for point in component)
        if min_x <= 6 or max_x >= CELL_WIDTH - 7:
            removed_pixels.extend(component)

    if not removed_pixels:
        return frame, 0

    cleaned = frame.copy()
    pixels = cleaned.load()
    for x, y in removed_pixels:
        pixels[x, y] = (0, 0, 0, 0)
    return cleaned, len(removed_pixels)


def assert_stable_jump_scale(frames: list[Image.Image]) -> None:
    """Reject jump art that changes the Companion's apparent body scale."""
    bounds = [frame.getbbox() for frame in frames]
    if any(bbox is None for bbox in bounds):
        raise ValueError("Jumping row contains an empty frame")

    visible_bounds = [bbox for bbox in bounds if bbox is not None]
    widths = [bbox[2] - bbox[0] for bbox in visible_bounds]
    heights = [bbox[3] - bbox[1] for bbox in visible_bounds]
    max_dimension_drift = 12
    if max(widths) - min(widths) > max_dimension_drift:
        raise ValueError(f"Jumping row changes visible width too much: {widths}")
    if max(heights) - min(heights) > max_dimension_drift:
        raise ValueError(f"Jumping row changes visible height too much: {heights}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("atlas", type=Path)
    parser.add_argument("output_dir", type=Path)
    parser.add_argument("--clean-atlas-output", type=Path)
    parser.add_argument("--decoded-dir", type=Path)
    args = parser.parse_args()

    atlas = Image.open(args.atlas).convert("RGBA")
    expected_size = (CELL_WIDTH * 8, CELL_HEIGHT * 11)
    if atlas.size != expected_size:
        raise ValueError(f"Expected {expected_size}, received {atlas.size}")

    args.output_dir.mkdir(parents=True, exist_ok=True)
    cleaned_atlas = Image.new("RGBA", expected_size, (0, 0, 0, 0))
    removed_total = 0
    for row, frame_count in enumerate(ROW_FRAME_COUNTS):
        generated_frames = None
        if args.decoded_dir and row < len(ROW_STATES):
            state = ROW_STATES[row]
            strip_path = args.decoded_dir / f"{state}.png"
            if state == "jumping":
                repaired_jump = args.decoded_dir.parent / "repairs" / "jumping-v2.png"
                if repaired_jump.is_file():
                    strip_path = repaired_jump
            generated_frames = extract_generated_row(
                strip_path,
                frame_count,
            )
            if state == "jumping":
                assert_stable_jump_scale(generated_frames)
        for column in range(frame_count):
            left = column * CELL_WIDTH
            top = row * CELL_HEIGHT
            frame = (
                generated_frames[column]
                if generated_frames is not None
                else atlas.crop((left, top, left + CELL_WIDTH, top + CELL_HEIGHT))
            )
            frame, removed = remove_disconnected_edge_fragments(frame)
            removed_total += removed
            destination = args.output_dir / f"r{row}-c{column}.webp"
            frame.save(
                destination,
                "WEBP",
                lossless=True,
                quality=100,
                method=6,
                exact=True,
            )
            cleaned_atlas.alpha_composite(frame, (left, top))

    neutral = atlas.crop((CELL_WIDTH * 6, 0, CELL_WIDTH * 7, CELL_HEIGHT))
    cleaned_atlas.alpha_composite(neutral, (CELL_WIDTH * 6, 0))

    if args.clean_atlas_output:
        args.clean_atlas_output.parent.mkdir(parents=True, exist_ok=True)
        cleaned_atlas.save(
            args.clean_atlas_output,
            "WEBP",
            lossless=True,
            quality=100,
            method=6,
            exact=True,
        )
    print(f"Exported {sum(ROW_FRAME_COUNTS)} frames; removed {removed_total} edge-fragment pixels")


if __name__ == "__main__":
    main()
