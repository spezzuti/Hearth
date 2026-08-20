import { type CSSProperties, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import rigBody from "./assets/residents/companion/rig-v2/body.png";
import rigHead from "./assets/residents/companion/rig-v2/head.png";
import rigLampLower from "./assets/residents/companion/rig-v2/lamp-lower.png";
import rigLampShade from "./assets/residents/companion/rig-v2/lamp-shade.png";
import rigLampUpper from "./assets/residents/companion/rig-v2/lamp-upper.png";

export type CompanionMood =
  | "resting"
  | "track-high"
  | "track-level"
  | "idle"
  | "listening"
  | "thinking"
  | "failed"
  | "reply";

export type CompanionGaze =
  | "up-left"
  | "up"
  | "up-right"
  | "left"
  | "center"
  | "right"
  | "down-left"
  | "down"
  | "down-right";

export const companionFrameSources = [
  rigBody,
  rigHead,
  rigLampLower,
  rigLampUpper,
  rigLampShade
];

function classNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

function legacyGazeIndex(gaze: CompanionGaze): number | null {
  const directions: Record<CompanionGaze, number | null> = {
    up: 0,
    "up-right": 2,
    right: 4,
    "down-right": 6,
    down: 8,
    "down-left": 10,
    left: 12,
    "up-left": 14,
    center: null
  };
  return directions[gaze];
}

export function shortestDirectionStep(current: number, target: number): number {
  const clockwise = (target - current + 16) % 16;
  const counterClockwise = (current - target + 16) % 16;
  return clockwise < counterClockwise ? (current + 1) % 16 : (current + 15) % 16;
}

export function companionGazePose(index: number | null): {
  headX: number;
  headY: number;
  headTurn: number;
  bodyTurn: number;
  lampLower: number;
  lampUpper: number;
  lampShade: number;
} {
  if (index === null) {
    return { headX: 0, headY: 0, headTurn: 0, bodyTurn: 0, lampLower: 0, lampUpper: 0, lampShade: 0 };
  }

  const angle = (index % 16) * (Math.PI / 8);
  const horizontal = Math.sin(angle);
  const vertical = -Math.cos(angle);

  return {
    // The character is made of intact approved layers. These are visible but
    // constrained physical motions: a head turn, a small upper-body follow,
    // and a larger articulated lamp response. Nothing is scaled or warped.
    headX: Number((horizontal * 4.2).toFixed(2)),
    headY: Number((vertical * 2.45).toFixed(2)),
    headTurn: Number((horizontal * 1.35).toFixed(2)),
    bodyTurn: Number((horizontal * 0.9).toFixed(2)),
    lampLower: Number((horizontal * -0.68 + vertical * 0.22).toFixed(2)),
    lampUpper: Number((horizontal * -1.55 + vertical * 0.45).toFixed(2)),
    lampShade: Number((horizontal * 2.55 - vertical * 0.6).toFixed(2))
  };
}

export function CompanionCharacter({
  mood,
  compact = false,
  framesReady = true,
  gesture = null,
  gaze = null,
  gazeIndex = null,
  onGestureComplete,
  className
}: {
  mood: CompanionMood;
  compact?: boolean;
  framesReady?: boolean;
  gesture?: "wave" | "jump" | null;
  gaze?: CompanionGaze | null;
  gazeIndex?: number | null;
  onGestureComplete?: () => void;
  className?: string;
}): ReactNode {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const requestedGaze = gazeIndex ?? (gaze ? legacyGazeIndex(gaze) : null);
  const pose = useMemo(() => companionGazePose(requestedGaze), [requestedGaze]);
  const [blinking, setBlinking] = useState(false);
  const gestureComplete = useRef(onGestureComplete);

  useEffect(() => {
    gestureComplete.current = onGestureComplete;
  }, [onGestureComplete]);

  useEffect(() => {
    if (reduceMotion || !framesReady) return;
    let closeTimer: number | null = null;
    const blink = (): void => {
      setBlinking(true);
      closeTimer = window.setTimeout(() => setBlinking(false), 115);
    };
    const timer = window.setInterval(blink, 3_800 + Math.round(Math.random() * 1_600));
    return () => {
      window.clearInterval(timer);
      if (closeTimer !== null) window.clearTimeout(closeTimer);
    };
  }, [framesReady, reduceMotion]);

  useEffect(() => {
    if (!gesture || reduceMotion) return;
    const timer = window.setTimeout(
      () => gestureComplete.current?.(),
      gesture === "wave" ? 620 : 520
    );
    return () => window.clearTimeout(timer);
  }, [gesture, reduceMotion]);

  return (
    <span
      className={classNames("companion-character", "companion-character--rig", compact && "companion-character--compact", className)}
      data-mood={mood}
      data-state={requestedGaze === null ? "idle" : "tracking"}
      data-gesture={gesture ?? "none"}
      data-blinking={blinking ? "true" : "false"}
      data-frames-ready={framesReady ? "true" : "false"}
      style={{
        "--companion-head-x": `${pose.headX}px`,
        "--companion-head-y": `${pose.headY}px`,
        "--companion-head-turn": `${pose.headTurn}deg`,
        "--companion-body-turn": `${pose.bodyTurn}deg`,
        "--companion-lamp-lower": `${pose.lampLower}deg`,
        "--companion-lamp-upper": `${pose.lampUpper}deg`,
        "--companion-lamp-shade": `${pose.lampShade}deg`
      } as CSSProperties}
      aria-hidden="true"
    >
      <span className="companion-rig">
        <span className="companion-rig-posture">
          <img className="companion-rig-body" src={rigBody} alt="" draggable={false} />
          <span className="companion-rig-lamp companion-rig-lamp--lower">
            <img src={rigLampLower} alt="" draggable={false} />
          </span>
          <span className="companion-rig-lamp companion-rig-lamp--upper">
            <img src={rigLampUpper} alt="" draggable={false} />
          </span>
          <span className="companion-rig-lamp companion-rig-lamp--shade">
            <img src={rigLampShade} alt="" draggable={false} />
          </span>
          <img className="companion-rig-head" src={rigHead} alt="" draggable={false} />
          <span className="companion-rig-lid companion-rig-lid--left" />
          <span className="companion-rig-lid companion-rig-lid--right" />
          <span className="companion-rig-lamp-light" />
          <span className="companion-rig-status-light" />
        </span>
      </span>
    </span>
  );
}
