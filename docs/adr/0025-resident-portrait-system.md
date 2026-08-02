# ADR 0025: Resident portrait system

## Context

Maker, Librarian, and Critic already have distinct roles, voices, conversations, and room presence.
Their interface identity was still represented by initial-letter tiles, which made the household
feel more like a dashboard than the inhabited working home Hearth is meant to become.

Large character cards or animated figures would compete with project work, terminal space, and
reading. Remote profile images would also add an unnecessary network and privacy boundary.

## Decision

Hearth gives each resident one bundled portrait:

- Maker is a capable, slightly scruffy tech-nerd with an easy metalhead edge.
- Librarian is a warm, modern alt librarian in her mid-to-late thirties.
- Critic is an expressive raven with skeptical intelligence and restrained attitude.

A shared `ResidentAvatar` component owns the mapping between resident identity and local image.
Portraits replace letter tiles in Home and resident-specific room surfaces. Their size remains
modest: large enough to recognize, but subordinate to the work and conversation.

The Home household list uses a slightly larger crop than room rails because it introduces the
residents. Existing avatar classes remain as color fallbacks while images load.

Portraits are decorative beside visible resident names, so their images use empty alternative text.
All files are packaged with the renderer. Hearth performs no runtime image request, identity lookup,
or user customization migration.

## Consequences

- The household feels inhabited without turning navigation into a virtual hallway.
- Residents have consistent visual identity across Home, Library, Studio, Study, Project, and
  Workshop surfaces.
- Work areas retain their existing density and terminal space.
- A missing or failed portrait is caught by Electron regression coverage.
- Future portrait changes remain centralized and do not alter resident permissions or reasoning.
