# Milestone 34: Resident rooms and unified ideas

Hearth 0.29.0 gives Librarian and Maker more readable presence in the rooms where they work,
while removing a duplicate decision from the idea lifecycle.

## Delivered

- Librarian's Raised Desk spans the Library heading and collection, with an 88px expressive
  portrait and more conversation height without narrowing the catalog.
- Maker's Portrait Ledge increases his Workshop portrait to 76px without taking width from the
  terminal or implying that he is the running process.
- Compact Workshop layouts preserve a visible, contained Maker composer at 1080 by 720.
- An idea now has one put-away decision: **Let go**.
- Let-go ideas leave the active Library immediately and remain recoverable in Studio and Archive.
- Bringing an idea back from Library, Studio, or Archive returns the same record to active use
  everywhere.
- Legacy archive requests for ideas are translated into the idea lifecycle instead of creating
  a second independent state.

## Principle

Library, Studio, and Archive are different views of one record. A person should never have to
repeat the same decision merely because the record appears in more than one room.
