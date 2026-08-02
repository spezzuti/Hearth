# ADR 0028: Canonical capture and whole-house retrieval

## Context

Universal capture originally put links, notes, and ideas onto overlapping surfaces. That made
capture easy, but it left the user deciding twice where something belonged and sometimes required
the same lifecycle decision in both Studio and Library.

Notes also needed a different relationship from ideas and links. Some notes are loose thoughts;
others only make sense beside a project. Neither case makes a note a Library resource or a Studio
idea.

## Decision

Hearth keeps one canonical record and projects it only where the record is useful:

- links and documents belong to Library;
- ideas belong to Studio;
- loose notes wait in Studio's notebook;
- connected notes remain the same record but also appear inside their related project; and
- Archive remains a recoverable projection, never a second copy.

Universal and mobile capture support a small explicit language:

- `@idea` and `@note` select the record type;
- `@ProjectName`, `@Project_Name`, or `@"Project Name"` creates a real project relationship;
- `#keyword` adds normalized retrieval tags; and
- a bare URL routes to Library.

Plain text remains a loose note. Recognized routing tokens are removed from the saved prose.

Whole-house search queries the SQLite store rather than relying only on the recent bootstrap set.
It searches titles, prose, descriptions, tags, URLs, and project names, includes inactive material,
and opens a result in its canonical room. Librarian receives bounded evidence from all saved
material and can answer the same retrieval questions conversationally.

## Consequences

- Capture is fast without making classification mysterious.
- Letting an idea go or putting a note away happens once.
- Project notes are available where work happens without becoming files or duplicate records.
- Organization improves browsing, while search remains the retrieval guarantee.
- Existing captures require no destructive migration; room filters interpret their current kind.
- Search results are bounded for display, but matching happens against the full saved-material
  database.
