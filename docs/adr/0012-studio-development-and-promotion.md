# ADR 0012: Studio development and explicit project promotion

## Context

Pursuing an idea should mean that it has earned attention, not that Hearth has silently turned it
into work. Some ideas need a natural conversation before the user can tell whether they belong in
an existing project, deserve a new one, or should return to rest.

## Decision

Every pursued idea may open a private Studio conversation with Maker. These messages are stored in
their own table and do not enter the general Maker or Workshop thread. The reasoning provider
receives only the idea, its compact visible metadata, and that conversation. Studio discussion has
no terminal observation, execution report, project-file evidence, or authority to act.

Promotion is a separate explicit step:

- **Existing project** records the discovered project ID and name on the original idea. It does not
  write to the project or change the active working project.
- **New project** shows the exact destination beneath the Windows home folder, validates the folder
  name in the local core, and creates only a Hearth marker plus `IDEA.md`. Creation uses a temporary
  sibling directory and an atomic rename. It does not initialize Git or start any work.

The idea retains its original text, capture time, conversation, and pursued state. A promoted idea
cannot be silently reassigned to a different project.

## Consequences

- The Studio remains a place for judgment rather than a disguised backlog.
- Maker can help an idea develop without being confused with Claude Code or terminal ownership.
- Existing repositories remain untouched by promotion.
- A new project has enough provenance to be understood later without imposing a technical stack.
- Opening the promoted project in Study remains a separate user action.
