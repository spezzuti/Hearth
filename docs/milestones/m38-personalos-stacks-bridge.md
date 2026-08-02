# Milestone 38: PersonalOS Stacks bridge

Hearth 0.33.0 brings the useful part of the old Stacks library home without touching PersonalOS or
reviving links that were deliberately released.

## Delivered

- Quiet detection of the existing PersonalOS Stacks database under the Windows home folder.
- A contained Library review drawer showing new and already-present links before import.
- Active links only; released PersonalOS records remain behind.
- PersonalOS collection names preserved as normalized, searchable Hearth tags.
- Exact-URL deduplication with metadata and tag merging for existing Library records.
- Safe repeat imports that bring over only what is new.
- Hearth items already put away remain archived when the same URL exists in PersonalOS.
- Missing, unreadable, redirected, or malformed source databases fail closed without disturbing
  the Library.
- PersonalOS is opened read-only and remains byte-for-byte unchanged.

## Verification

- Unit fixtures prove active filtering, collection mapping, source immutability, and a quiet missing
  state.
- Store coverage proves rerun safety, exact-URL deduplication, metadata merging, and no resurrection
  of archived Hearth items.
- Real Electron coverage reviews and imports two Stacks links, excludes a released link, verifies
  the collection tag, and confirms a second inspection reports nothing new.
- A full-size Library screenshot verifies the review drawer remains calm, readable, and contained
  beside Librarian.

## Principle

Migration should preserve useful history without inheriting old ambiguity. Hearth may invite
selected material inside, but the old home stays intact and the user sees what crosses the door.
