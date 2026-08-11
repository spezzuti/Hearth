# Milestone 47 — Phase 1 live release gate

Hearth 0.49.1 turns the Phase 1 health model from deterministic coverage into repeatable packaged
Windows evidence.

## Delivered

- active pending and in-progress tool calls renew the idle deadline while retaining the absolute
  safety ceiling
- adapter errors and exits retain an explicit connection-loss or adapter-exit classification
- stopped adapters cannot be presented as running when the child reference has already cleared
- connection reset settles pending permissions and reaps a surviving adapter child
- terminal health clears stale permission and deadline timestamps after completion, interruption,
  or failure
- a packaged health harness uses isolated application data and validates exact process targets
  before a destructive adapter-loss drill
- the dev-only `nanoid` lock entry is 3.3.18; complete and production dependency audits are clean
- the compact handoff proposal and composer remain vertically contained at 1040 × 700

## Evidence

- a live Claude tool ran beyond the compressed ten-second test idle threshold and completed
- the health stream included working, quiet-connected, permission-wait, and completed states
- Claude reported Opus 5 usage and six activity updates during the long-tool run
- terminating the validated Claude ACP descendant produced `connection_lost`, process `stopped`, and
  an explicit fate stating that Hearth did not replay the turn
- closing and relaunching with a pending write permission left no pending permissions, marked the
  turn interrupted, and did not create the requested file
- the ordinary packaged Claude/Codex, ConPTY, usage, resume, and interruption baseline also passed

The harness compresses idle timing for a practical release check. It does not claim to have waited
out the production two-hour absolute ceiling.
