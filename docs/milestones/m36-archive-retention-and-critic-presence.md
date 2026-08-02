# Milestone 36: Archive retention and Critic presence

Hearth 0.31.0 gives Critic equal visual presence and adds an honest end-of-life path for retained
material.

## Delivered

- Critic's Study portrait is now a full 112px resident portrait instead of a small avatar inside a
  decorative tile.
- Every Archive record can be removed permanently through an explicit second confirmation.
- Warning copy distinguishes database history from a private recovery-backup file.
- Removing file recovery deletes only Hearth's validated private backup and its record.
- Permanent removal never changes or deletes a project file.
- Removed captures and Return Packs are refreshed out of the active renderer state immediately.
- Automatic startup database snapshots retain the newest eight instead of accumulating forever.
- Manual backups remain outside automatic retention.
- Missing, non-file, or out-of-bound backup paths fail closed.

## Verification

- Unit coverage proves permanent removal, active-record refusal, private backup deletion, path
  containment, and bounded automatic retention.
- Real Electron coverage exercises ordinary-history and recovery-file confirmations.
- Critic's full and 1080-by-720 layouts verify the larger portrait without overflow.
- The complete continuity suite still covers restoration before deletion, Archive orientation,
  terminals, agents, mobile access, and relaunch.

## Principle

Hearth remembers generously, but it does not hold material hostage. Recovery stays easy; permanent
forgetting stays possible, explicit, and accurately scoped.
