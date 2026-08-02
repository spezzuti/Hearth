# ADR 0015: Deliberate project evidence shelf

## Context

Hearth could ground Maker or Critic in one project, file, or diff. Real decisions often need two or
three related files, but whole-repository retrieval would make the evidence boundary invisible and
encourage residents to sound more informed than the user intended.

## Decision

The Project room exposes **Find context**. Search is local, literal, user-triggered, and bounded by
directories, files, bytes, and result count. It walks no links and excludes generated directories,
hidden settings, credentials, keys, dependency locks, binaries, minified output, and unsupported
file types.

The user may select at most six returned files. The shelf always shows the exact paths. A file already
being previewed seeds the shelf, but no source is handed anywhere until the user chooses **Send to
Maker** or **Send to Critic**.

The agent-context record persists only the path set and visible summary metadata. On a later relevant
resident turn, the core re-resolves every path, reapplies the allowlist, reads current source, labels
each file, and caps the combined evidence at 60,000 characters. Casual social turns continue to
receive no project evidence.

The two residents retain separate context rows. An evidence handoff never starts a model call,
changes the working project, opens Workshop, starts a terminal, or grants control.

## Consequences

- Multi-file questions become possible without invisible repository access.
- The user can inspect and revise scope before spending a reasoning call.
- Paths persist across restart while raw project source does not.
- Search can miss relevant content after its explicit resource limits; the interface labels bounded
  results rather than implying completeness.
- Semantic indexing and background embeddings remain outside Hearth's current trust and resource
  model.
