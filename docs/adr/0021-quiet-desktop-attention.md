# ADR 0021: Quiet desktop attention

## Context

Hearth can keep a terminal or resident request running while the user looks elsewhere. Requiring
the user to repeatedly reopen the window undermines the working-home model, but broad or chatty
notifications would create the same interruption problem Hearth is meant to reduce.

Windows notification text also lives outside Hearth's own visual and privacy boundary. It may
appear on a lock screen or in Notification Center.

## Decision

Hearth may create a silent native notification only when its main window is minimized or hidden and
the matching persisted preference is enabled.

The default set is intentionally narrow:

- one deduplicated alert when Workshop's bounded observation explicitly requires input;
- one alert when a resident request initiated from the desktop finishes;
- no phone-activity alerts until the user opts in.

Phone Companion conversation never creates a Windows alert. Phone capture and idea decisions use
generic copy when enabled. Resident completion copy contains only the resident name and destination
room. Workshop is the sole category allowed to include a bounded status summary.

Clicking restores and focuses the existing window and sends a fixed room identifier through the
preload bridge. The renderer performs normal route persistence. No notification action can approve,
execute, type, edit, switch projects, or change ownership.

## Consequences

- Long-running resident and Workshop work can be left in the background without polling.
- Visible Hearth remains quiet and continues using its in-app state and toasts.
- Notification settings survive relaunch without a new schema table.
- Windows lock-screen exposure is limited to generic copy and bounded Workshop status.
- Closing Hearth remains a genuine exit; tray behavior and startup behavior require separate,
  explicit product decisions.
