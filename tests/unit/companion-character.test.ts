import { describe, expect, it } from "vitest";
import {
  companionGazePose,
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

  it("keeps cursor-follow motion inside the fixed rig's safe bounds", () => {
    expect(companionGazePose(null)).toEqual({
      headX: 0,
      headY: 0,
      headTurn: 0,
      bodyTurn: 0,
      lampLower: 0,
      lampUpper: 0,
      lampShade: 0
    });

    for (let direction = 0; direction < 16; direction += 1) {
      const pose = companionGazePose(direction);
      expect(Math.abs(pose.headX)).toBeLessThanOrEqual(4.2);
      expect(Math.abs(pose.headY)).toBeLessThanOrEqual(2.45);
      expect(Math.abs(pose.headTurn)).toBeLessThanOrEqual(1.35);
      expect(Math.abs(pose.bodyTurn)).toBeLessThanOrEqual(0.9);
      expect(Math.abs(pose.lampLower)).toBeLessThanOrEqual(0.9);
      expect(Math.abs(pose.lampUpper)).toBeLessThanOrEqual(2);
      expect(Math.abs(pose.lampShade)).toBeLessThanOrEqual(3.2);
    }
  });
});
