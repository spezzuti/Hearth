import { describe, expect, it } from "vitest";
import {
  QuietNotificationCenter,
  type QuietNotice
} from "../../src/main/notification-center";
import type { Room } from "../../src/shared/contracts";

type NoticeEvent = "show" | "click" | "close" | "failed";

class FakeNotice implements QuietNotice {
  private readonly listeners = new Map<NoticeEvent, Array<() => void>>();

  constructor(
    readonly options: { title: string; body: string; silent: boolean }
  ) {}

  on(event: NoticeEvent, listener: () => void): void {
    const listeners = this.listeners.get(event) ?? [];
    listeners.push(listener);
    this.listeners.set(event, listeners);
  }

  show(): void {
    this.emit("show");
  }

  emit(event: NoticeEvent): void {
    for (const listener of this.listeners.get(event) ?? []) listener();
  }
}

describe("QuietNotificationCenter", () => {
  it("alerts only while hidden, deduplicates Workshop, and returns to the right room", () => {
    let hidden = false;
    const notices: FakeNotice[] = [];
    const revealed: Room[] = [];
    const center = new QuietNotificationCenter(
      {
        supported: () => true,
        windowIsHidden: () => hidden,
        create: (options) => {
          const notice = new FakeNotice(options);
          notices.push(notice);
          return notice;
        },
        reveal: (room) => revealed.push(room),
        now: () => "2026-07-30T01:00:00.000Z"
      },
      {
        workshopAttention: true,
        residentReplies: true,
        phoneActivity: false
      }
    );

    expect(center.workshopAttention("Claude Code is waiting.")).toBe(false);
    hidden = true;
    expect(center.workshopAttention("Claude Code is waiting.")).toBe(true);
    expect(center.workshopAttention("Claude Code is waiting.")).toBe(false);
    expect(notices).toHaveLength(1);
    expect(notices[0]?.options).toMatchObject({
      title: "Workshop needs you",
      silent: true
    });
    expect(center.status().lastDelivery).toEqual({
      kind: "workshop-attention",
      room: "workshop",
      createdAt: "2026-07-30T01:00:00.000Z"
    });

    notices[0]?.emit("click");
    expect(revealed).toEqual(["workshop"]);

    center.clearWorkshopAttention();
    expect(center.workshopAttention("Claude Code is waiting.")).toBe(true);
    expect(notices).toHaveLength(2);
  });

  it("keeps phone activity opt-in and routes its two useful events", () => {
    const notices: FakeNotice[] = [];
    const revealed: Room[] = [];
    const center = new QuietNotificationCenter(
      {
        supported: () => true,
        windowIsHidden: () => true,
        create: (options) => {
          const notice = new FakeNotice(options);
          notices.push(notice);
          return notice;
        },
        reveal: (room) => revealed.push(room),
        now: () => "2026-07-30T01:00:00.000Z"
      },
      {
        workshopAttention: true,
        residentReplies: true,
        phoneActivity: false
      }
    );

    expect(center.phoneActivity("phone-capture")).toBe(false);
    center.setPreferences({
      workshopAttention: true,
      residentReplies: true,
      phoneActivity: true
    });
    expect(center.phoneActivity("phone-capture")).toBe(true);
    expect(center.phoneActivity("phone-decision")).toBe(true);
    expect(notices).toHaveLength(2);

    notices[0]?.emit("click");
    notices[1]?.emit("click");
    expect(revealed).toEqual(["home", "studio"]);
    expect(center.status().lastDelivery?.kind).toBe("phone-decision");
  });

  it("returns finished residents to their working room", () => {
    const notices: FakeNotice[] = [];
    const revealed: Room[] = [];
    const center = new QuietNotificationCenter(
      {
        supported: () => true,
        windowIsHidden: () => true,
        create: (options) => {
          const notice = new FakeNotice(options);
          notices.push(notice);
          return notice;
        },
        reveal: (room) => revealed.push(room),
        now: () => "2026-07-30T01:00:00.000Z"
      },
      {
        workshopAttention: true,
        residentReplies: true,
        phoneActivity: false
      }
    );

    expect(center.residentReply("Librarian", "library")).toBe(true);
    expect(notices[0]?.options.title).toBe("Librarian is ready");
    notices[0]?.emit("click");
    expect(revealed).toEqual(["library"]);
  });
});
