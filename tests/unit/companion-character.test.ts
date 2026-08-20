import { describe, expect, it } from "vitest";
import {
  companionAtlasCell,
  companionGazeKey,
  shortestDirectionStep
} from "../../src/renderer/src/CompanionCharacter";

describe("Companion direction motion", () => {
  it("routes an exact left-to-right half-turn through the stable lower arc", () => {
    const frames: number[] = [];
    let current = 12;

    while (current !== 4) {
      current = shortestDirectionStep(current, 4);
      frames.push(current);
    }

    expect(frames).toEqual([11, 10, 9, 8, 7, 6, 5, 4]);
    expect(frames).not.toContain(0);
  });

  it("maps cursor directions onto the canonical-body gaze set", () => {
    expect(Array.from({ length: 16 }, (_, direction) => companionGazeKey(direction)))
      .toEqual([
        "up", "up-right", "up-right", "up-right",
        "right", "down-right", "down-right", "down-right",
        "down", "down-left", "down-left", "down-left",
        "left", "up-left", "up-left", "up-left"
      ]);
    expect(companionAtlasCell("idle", null, 4, 0)).toEqual({
      row: 0,
      column: 0,
      state: "gaze"
    });
  });

  it("plays a full tread turn without using the old running rows", () => {
    expect(companionAtlasCell("idle", "spin", null, 0)).toEqual({
      row: 0,
      column: 0,
      state: "spin"
    });
    expect(companionAtlasCell("idle", "spin", null, 7)).toEqual({
      row: 0,
      column: 0,
      state: "spin"
    });
    expect(companionAtlasCell("idle", "spin", null, 8)).toEqual({
      row: 0,
      column: 0,
      state: "spin"
    });
    expect(companionAtlasCell("idle", "spin", null, 15)).toEqual({
      row: 0,
      column: 0,
      state: "spin"
    });
  });

  it("gives an explicit gesture precedence over cursor gaze", () => {
    expect(companionAtlasCell("thinking", "wave", 12, 2)).toEqual({
      row: 3,
      column: 2,
      state: "wave"
    });
  });
});
