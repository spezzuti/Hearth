# Milestone 37: Visible resident consultations

Hearth 0.32.0 lets Maker bring Critic into the work when a second perspective is genuinely useful,
without turning the household into an invisible autonomous swarm.

## Delivered

- High- and unknown-risk Maker proposals automatically receive a bounded Critic preflight.
- Returned Claude Code work receives a bounded Critic postflight when it reports concerns or its
  changed-file evidence is partial or mismatched.
- Clean low- and medium-risk work remains quiet and keeps optional manual review.
- Each consultation records who handed off, why, when, and whether it happened before or after
  execution.
- Workshop shows a compact consultation card with a direct **Open Critic** route.
- Critic receives a natural acknowledgement plus the existing bounded project or execution
  evidence.
- Consultations survive reload and deduplicate by proposal phase.
- No consultation launches another model, moves terminal control, types into Claude Code, executes
  work, or blocks the user.

## Verification

- Policy unit tests cover quiet work, risky proposals, reported concerns, evidence priority, and
  duplicate prevention.
- Store coverage proves consultations persist across restart and remain bounded.
- Real Electron coverage proves the automatic preflight appears in Workshop and survives through
  the existing Maker, Claude Code, and Critic flow.
- Full Electron continuity passes in an isolated test home without disturbing a running Hearth
  instance.
- Full and compact Workshop screenshots verify the new card remains contained in Maker's rail.

## Principle

Autonomy should remove clerical handoffs, not hide authority. A resident may invite another
resident into the room when the reason is clear; the user should always be able to see why.
