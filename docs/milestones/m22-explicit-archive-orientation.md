# Milestone 22: Explicit Archive orientation

Hearth 0.19 turns Archive records into deliberate paths back to current work without silently moving
the terminal, residents, or project underneath the user.

## Delivered

- **View on Home** for historical Return Packs.
- A visible historical-state notice and **Back to latest** action on Home.
- Current Home project, process, and household truth preserved beside the old Return Pack.
- Historical Return Pack views remain transient and never replace the latest saved pack.
- **Open project** for Archive records connected to a discovered project.
- **Open exact file** for Hearth edit records, using a newly resolved bounded Project preview.
- **Work in Workshop** for project-backed handoff records without replaying the handoff or starting a
  process.
- Plain confirmation before an Archive action changes the working project.
- Explicit notice that a live terminal remains in its existing folder during a project switch.
- No implicit Maker or Critic context changes.
- Honest failure when an archived project or file is no longer available.
- Desktop coverage for Home history, project-switch confirmation, exact-file orientation, edit
  recovery, Workshop orientation, terminal non-creation, and compact Archive containment.

## Current boundary

Archive does not restore an old project's complete UI state, conversation scroll position, terminal
buffer, or resident context. Opening a completed handoff does not make it active again. Exact-file
orientation is available only where Archive has a bounded stored path.

## Next

Begin the remote/mobile companion foundation as a deliberately smaller surface: secure status,
decisions, idea capture, reports, and resident conversation without exposing a general remote
terminal or duplicating the desktop product.
