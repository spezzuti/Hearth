import type {
  DesktopNotificationKind,
  DesktopNotificationStatus,
  NotificationPreferences,
  Room
} from "../shared/contracts";

export interface QuietNotice {
  on(
    event: "show" | "click" | "close" | "failed",
    listener: () => void
  ): void;
  show(): void;
}

export interface QuietNotificationDependencies {
  supported(): boolean;
  windowIsHidden(): boolean;
  create(options: {
    title: string;
    body: string;
    silent: boolean;
  }): QuietNotice;
  reveal(room: Room): void;
  now(): string;
}

interface NotificationCopy {
  title: string;
  body: string;
  room: Room;
}

const PHONE_COPY: Record<
  Exclude<
    DesktopNotificationKind,
    "workshop-attention" | "resident-reply"
  >,
  NotificationCopy
> = {
  "phone-capture": {
    title: "Something was kept",
    body: "A new thought arrived from Hearth Companion.",
    room: "home"
  },
  "phone-decision": {
    title: "A phone decision changed",
    body: "Studio has the updated idea state.",
    room: "studio"
  }
};

export class QuietNotificationCenter {
  private preferences: NotificationPreferences;
  private lastDelivery: DesktopNotificationStatus["lastDelivery"] = null;
  private workshopKey: string | null = null;
  private readonly active = new Set<QuietNotice>();

  constructor(
    private readonly dependencies: QuietNotificationDependencies,
    initialPreferences: NotificationPreferences
  ) {
    this.preferences = { ...initialPreferences };
  }

  setPreferences(preferences: NotificationPreferences): void {
    this.preferences = { ...preferences };
  }

  status(): DesktopNotificationStatus {
    return {
      supported: this.dependencies.supported(),
      preferences: { ...this.preferences },
      lastDelivery: this.lastDelivery ? { ...this.lastDelivery } : null
    };
  }

  workshopAttention(summary: string): boolean {
    const key = summary.trim();
    if (!key || key === this.workshopKey) return false;
    if (!this.preferences.workshopAttention) return false;
    const delivered = this.deliver(
      "workshop-attention",
      {
        title: "Workshop needs you",
        body: key.slice(0, 220),
        room: "workshop"
      }
    );
    if (delivered) this.workshopKey = key;
    return delivered;
  }

  clearWorkshopAttention(): void {
    this.workshopKey = null;
  }

  residentReply(label: string, room: Room): boolean {
    if (!this.preferences.residentReplies) return false;
    return this.deliver("resident-reply", {
      title: `${label} is ready`,
      body: `The reply is waiting in ${
        room === "library"
          ? "Library"
          : room === "studio"
            ? "Studio"
            : room === "home"
              ? "Home"
              : "Study"
      }.`,
      room
    });
  }

  phoneActivity(
    kind: "phone-capture" | "phone-decision"
  ): boolean {
    if (!this.preferences.phoneActivity) return false;
    return this.deliver(kind, PHONE_COPY[kind]);
  }

  private deliver(
    kind: DesktopNotificationKind,
    copy: NotificationCopy
  ): boolean {
    if (
      !this.dependencies.supported() ||
      !this.dependencies.windowIsHidden()
    ) {
      return false;
    }
    const notice = this.dependencies.create({
      title: copy.title,
      body: copy.body,
      silent: true
    });
    this.active.add(notice);
    notice.on("show", () => {
      this.lastDelivery = {
        kind,
        room: copy.room,
        createdAt: this.dependencies.now()
      };
    });
    notice.on("click", () => {
      this.dependencies.reveal(copy.room);
      this.active.delete(notice);
    });
    const release = () => this.active.delete(notice);
    notice.on("close", release);
    notice.on("failed", release);
    notice.show();
    return true;
  }
}
