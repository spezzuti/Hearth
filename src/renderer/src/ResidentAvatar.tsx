import type { ReactNode } from "react";
import criticPortrait from "./assets/residents/critic.png";
import librarianPortrait from "./assets/residents/librarian.png";
import librarianThinkingPortrait from "./assets/residents/librarian-thinking.png";
import makerPortrait from "./assets/residents/maker.png";
import makerThinkingPortrait from "./assets/residents/maker-thinking.png";

export type Resident = "maker" | "librarian" | "critic";
export type ResidentMood = "resting" | "present" | "thinking";

const portraitByResident: Record<Resident, string> = {
  maker: makerPortrait,
  librarian: librarianPortrait,
  critic: criticPortrait
};

const thinkingPortraitByResident: Partial<Record<Resident, string>> = {
  maker: makerThinkingPortrait,
  librarian: librarianThinkingPortrait
};

export function ResidentAvatar({
  resident,
  mood = "resting",
  className = ""
}: {
  resident: Resident;
  mood?: ResidentMood;
  className?: string;
}): ReactNode {
  const thinkingPortrait = thinkingPortraitByResident[resident];
  return (
    <span
      className={`avatar avatar--${resident} resident-avatar ${className}`.trim()}
      data-mood={mood}
      aria-hidden="true"
    >
      <img className="resident-avatar__portrait" src={portraitByResident[resident]} alt="" />
      {thinkingPortrait ? (
        <img
          className="resident-avatar__portrait resident-avatar__portrait--thinking"
          src={thinkingPortrait}
          alt=""
        />
      ) : null}
      <i className="resident-avatar__presence" />
    </span>
  );
}
