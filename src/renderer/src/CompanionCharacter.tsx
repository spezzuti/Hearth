import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import companionAtlas from "./assets/residents/companion/pet-v2/spritesheet.webp";
import gazeCenter from "./assets/residents/companion/sprite-v2/gaze-center.png";
import gazeDownLeft from "./assets/residents/companion/sprite-v2/gaze-down-left.png";
import gazeDownRight from "./assets/residents/companion/sprite-v2/gaze-down-right.png";
import gazeDown from "./assets/residents/companion/sprite-v2/gaze-down.png";
import gazeLeft from "./assets/residents/companion/sprite-v2/gaze-left.png";
import gazeRight from "./assets/residents/companion/sprite-v2/gaze-right.png";
import gazeUpLeft from "./assets/residents/companion/sprite-v2/gaze-up-left.png";
import gazeUpRight from "./assets/residents/companion/sprite-v2/gaze-up-right.png";
import gazeUp from "./assets/residents/companion/sprite-v2/gaze-up.png";
import gaze00 from "./assets/residents/companion/gaze-v3/gaze-00.png";
import gaze01 from "./assets/residents/companion/gaze-v3/gaze-01.png";
import gaze02 from "./assets/residents/companion/gaze-v3/gaze-02.png";
import gaze03 from "./assets/residents/companion/gaze-v3/gaze-03.png";
import gaze04 from "./assets/residents/companion/gaze-v3/gaze-04.png";
import gaze05 from "./assets/residents/companion/gaze-v3/gaze-05.png";
import gaze06 from "./assets/residents/companion/gaze-v3/gaze-06.png";
import gaze07 from "./assets/residents/companion/gaze-v3/gaze-07.png";
import gaze08 from "./assets/residents/companion/gaze-v3/gaze-08.png";
import gaze09 from "./assets/residents/companion/gaze-v3/gaze-09.png";
import gaze10 from "./assets/residents/companion/gaze-v3/gaze-10.png";
import gaze11 from "./assets/residents/companion/gaze-v3/gaze-11.png";
import gaze12 from "./assets/residents/companion/gaze-v3/gaze-12.png";
import gaze13 from "./assets/residents/companion/gaze-v3/gaze-13.png";
import gaze14 from "./assets/residents/companion/gaze-v3/gaze-14.png";
import gaze15 from "./assets/residents/companion/gaze-v3/gaze-15.png";

export type CompanionMood =
  | "resting"
  | "track-high"
  | "track-level"
  | "idle"
  | "listening"
  | "thinking"
  | "failed"
  | "reply";

export type CompanionGesture = "wave" | "jump" | "spin";

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

const GAZE_SOURCES = {
  center: gazeCenter,
  down: gazeDown,
  "down-left": gazeDownLeft,
  "down-right": gazeDownRight,
  left: gazeLeft,
  right: gazeRight,
  up: gazeUp,
  "up-left": gazeUpLeft,
  "up-right": gazeUpRight
} as const;

type CompanionGazeKey = keyof typeof GAZE_SOURCES;

const DIRECTION_SOURCES = [
  gaze00, gaze01, gaze02, gaze03,
  gaze04, gaze05, gaze06, gaze07,
  gaze08, gaze09, gaze10, gaze11,
  gaze12, gaze13, gaze14, gaze15
] as const;

export const companionFrameSources = [
  companionAtlas,
  ...Object.values(GAZE_SOURCES),
  ...DIRECTION_SOURCES
];

interface CompanionClip {
  key: string;
  frames: ReadonlyArray<readonly [row: number, column: number]>;
  interval: number;
  loop: boolean;
}

const rowFrames = (
  row: number,
  columns: readonly number[]
): ReadonlyArray<readonly [number, number]> =>
  columns.map((column) => [row, column] as const);

const CLIPS = {
  idle: {
    key: "idle",
    frames: rowFrames(0, [0, 1, 2, 3, 4, 5, 4, 3, 2, 1]),
    interval: 620,
    loop: true
  },
  resting: {
    key: "resting",
    frames: rowFrames(0, [0, 1, 2, 3, 4, 5, 4, 3, 2, 1]),
    interval: 880,
    loop: true
  },
  listening: {
    key: "listening",
    frames: rowFrames(6, [0, 1, 2, 3, 4, 5, 4, 3, 2, 1]),
    interval: 520,
    loop: true
  },
  thinking: {
    key: "thinking",
    frames: rowFrames(7, [0, 1, 2, 3, 4, 5, 4, 3, 2, 1]),
    interval: 245,
    loop: true
  },
  failed: {
    key: "failed",
    frames: rowFrames(0, [0]),
    interval: 0,
    loop: false
  },
  reply: {
    key: "reply",
    frames: rowFrames(8, [0, 1, 2, 3, 4, 5, 4, 3, 2, 1]),
    interval: 300,
    loop: true
  },
  wave: {
    key: "wave",
    frames: rowFrames(3, [0, 1, 2, 1, 2, 1, 3, 0]),
    interval: 105,
    loop: false
  },
  jump: {
    key: "jump",
    frames: rowFrames(0, [0, 0, 0, 0, 0, 0, 0]),
    interval: 92,
    loop: false
  },
  spin: {
    key: "spin",
    // A tread-circle is driven by the stage motion below, not the old
    // running art. Repeating one registered full-character pose keeps his
    // body and lamp perfectly stable while the treads carry him in an orbit.
    frames: rowFrames(0, Array.from({ length: 16 }, () => 0)),
    interval: 76,
    loop: false
  }
} satisfies Record<string, CompanionClip>;

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

export function companionGazeKey(
  gazeIndex: number | null,
  mood: CompanionMood = "idle"
): CompanionGazeKey {
  if (gazeIndex === null) {
    if (mood === "thinking") return "up-right";
    if (mood === "failed" || mood === "resting") return "down-left";
    return "center";
  }
  const direction = (gazeIndex + 16) % 16;
  if (direction === 0) return "up";
  if (direction <= 3) return "up-right";
  if (direction === 4) return "right";
  if (direction <= 7) return "down-right";
  if (direction === 8) return "down";
  if (direction <= 11) return "down-left";
  if (direction === 12) return "left";
  return "up-left";
}

export function shortestDirectionStep(current: number, target: number): number {
  const clockwise = (target - current + 16) % 16;
  const counterClockwise = (current - target + 16) % 16;
  return clockwise < counterClockwise ? (current + 1) % 16 : (current + 15) % 16;
}

export function companionAtlasCell(
  mood: CompanionMood,
  gesture: CompanionGesture | null,
  gazeIndex: number | null,
  tick: number
): { row: number; column: number; state: string } {
  if (gesture) {
    const clip = CLIPS[gesture];
    const [row, column] = clip.frames[Math.min(tick, clip.frames.length - 1)] ?? [0, 0];
    return { row, column, state: gesture };
  }
  if (gazeIndex !== null) return { row: 0, column: 0, state: "gaze" };
  const clip = mood === "thinking"
    ? CLIPS.thinking
    : mood === "failed"
      ? CLIPS.failed
      : mood === "reply"
        ? CLIPS.reply
        : mood === "listening"
          ? CLIPS.listening
          : mood === "resting"
            ? CLIPS.resting
            : CLIPS.idle;
  const [row, column] = clip.frames[tick % clip.frames.length] ?? [0, 0];
  return { row, column, state: clip.key };
}

function selectClip(
  mood: CompanionMood,
  gesture: CompanionGesture | null,
  gazeIndex: number | null
): CompanionClip {
  if (gesture) return CLIPS[gesture];
  if (gazeIndex !== null) {
    return {
      key: `gaze-${companionGazeKey(gazeIndex)}`,
      frames: [[0, 0]],
      interval: 0,
      loop: false
    };
  }
  return {
    key: `stable-${companionGazeKey(null, mood)}`,
    frames: [[0, 0]],
    interval: 0,
    loop: false
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
  gesture?: CompanionGesture | null;
  gaze?: CompanionGaze | null;
  gazeIndex?: number | null;
  onGestureComplete?: () => void;
  className?: string;
}): ReactNode {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const requestedGaze = gazeIndex ?? (gaze ? legacyGazeIndex(gaze) : null);
  const [displayedGaze, setDisplayedGaze] = useState<number | null>(requestedGaze);
  const [tick, setTick] = useState(0);
  const gestureComplete = useRef(onGestureComplete);

  useEffect(() => {
    gestureComplete.current = onGestureComplete;
  }, [onGestureComplete]);

  useEffect(() => {
    if (reduceMotion || requestedGaze === null) {
      setDisplayedGaze(requestedGaze);
      return;
    }
    if (displayedGaze === null) {
      setDisplayedGaze(requestedGaze);
      return;
    }
    if (displayedGaze === requestedGaze) return;
    const timer = window.setTimeout(() => {
      setDisplayedGaze(shortestDirectionStep(displayedGaze, requestedGaze));
    }, 46);
    return () => window.clearTimeout(timer);
  }, [displayedGaze, reduceMotion, requestedGaze]);

  const clip = useMemo(
    () => selectClip(mood, gesture, displayedGaze),
    [displayedGaze, gesture, mood]
  );

  useEffect(() => {
    setTick(0);
  }, [clip.key]);

  useEffect(() => {
    if (!framesReady || clip.frames.length <= 1) return;
    if (reduceMotion) {
      if (!gesture) return;
      const completion = window.setTimeout(
        () => gestureComplete.current?.(),
        180
      );
      return () => window.clearTimeout(completion);
    }
    if (!clip.loop) {
      if (tick >= clip.frames.length - 1) {
        const completion = window.setTimeout(
          () => gestureComplete.current?.(),
          clip.interval
        );
        return () => window.clearTimeout(completion);
      }
      const timer = window.setTimeout(
        () => setTick((current) => Math.min(current + 1, clip.frames.length - 1)),
        clip.interval
      );
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(
      () => setTick((current) => (current + 1) % clip.frames.length),
      clip.interval
    );
    return () => window.clearTimeout(timer);
  }, [clip, framesReady, gesture, reduceMotion, tick]);

  const cell = companionAtlasCell(mood, gesture, displayedGaze, tick);
  const gazeKey = companionGazeKey(gesture ? null : displayedGaze, mood);
  const directionSource = displayedGaze === null
    ? GAZE_SOURCES[gazeKey]
    : DIRECTION_SOURCES[(displayedGaze + 16) % 16];
  const useAtlas = gesture === "wave";
  const style = {
    "--companion-sheet-x": `${cell.column * -12.5}%`,
    "--companion-sheet-y": `${cell.row * -(100 / 11)}%`,
    "--companion-spin-duration": `${CLIPS.spin.frames.length * CLIPS.spin.interval}ms`
  } as CSSProperties;

  return (
    <span
      className={classNames(
        "companion-character",
        "companion-character--stable",
        compact && "companion-character--compact",
        className
      )}
      data-mood={mood}
      data-animation="stable-frame"
      data-state={cell.state}
      data-row={cell.row}
      data-frame={cell.column}
      data-gaze={gazeKey}
      data-gesture={gesture ?? "none"}
      data-frames-ready={framesReady ? "true" : "false"}
      style={style}
      aria-hidden="true"
    >
      <span className="companion-sprite-stage">
        {useAtlas ? (
          <span className="companion-atlas-window">
            <img
              className="companion-atlas-image"
              src={companionAtlas}
              alt=""
              draggable={false}
            />
          </span>
        ) : (
          <span className="companion-gaze-window">
            <img
              className="companion-gaze-image"
              src={directionSource}
              alt=""
              draggable={false}
            />
          </span>
        )}
      </span>
    </span>
  );
}
