# Hearth visual language

Hearth should feel like a warm, contemporary home built for actual work. The metaphor creates
atmosphere and orientation; it never asks the user to walk through a virtual building or trade
useful density for decoration.

## House-wide materials

- **Plaster** is the quiet room background. It carries light and very subtle texture without reading
  as a flat app canvas.
- **Linen and paper** hold briefs, notes, references, and calm panels. They should feel tactile but
  remain high-contrast and easy to scan.
- **Painted wood** anchors the persistent shell. It makes navigation feel stable, not heavy.
- **Copper and brass** mark action, warmth, and small points of attention. They are accents, never a
  wash over an entire room.
- **Glass and technical darks** belong mainly to Workshop and focused execution surfaces. They do
  not replace the house palette outside active technical work.

## Typography and comfort

House titles use the established serif voice; controls and long reading use Segoe UI Variable;
terminal and code use Cascadia. Body copy must remain comfortable at compact desktop sizes. If a
choice is between smaller type and more scrolling, Hearth chooses scrolling.

Text, controls, paths, and resident conversations must wrap or truncate deliberately. No room may
create horizontal document scrolling at 1440×900, 1080×720, or the 1040×700 minimum.

## Depth and motion

Depth separates working layers rather than simulating furniture. Raised surfaces use a restrained
warm shadow and a light top edge; settled surfaces sit closer to the wall. Hover motion is one or two
pixels at most. Ambient movement may suggest breathing or an ember, and all nonessential movement
must disappear under reduced-motion preferences.

## Room identity

Rooms share the same materials but change their balance:

- **Home:** plaster light, linen, warm window light, return and orientation.
- **Study:** composed paper, quieter contrast, deliberate review.
- **Workshop:** deeper technical surface, excellent terminal legibility, focused energy.
- **Library:** shelves, paper, warmer reading light, strong Librarian presence.
- **Studio:** flexible worktable, pinned ideas, a little more creative color.
- **Living Room:** shared warmth, equal resident presence, conversation first.
- **Archive:** quiet cabinetry, labels, provenance, and safe destructive boundaries.

Projects and residents may add subtle identity, but no surface should feel transported to a
different product.

## Residents and Companion

Maker, Librarian, and Critic are first-class residents, not status icons. Their portrait size,
expression, placement, and conversation should make their presence readable without crowding the
work. Companion needs a final expressive form of its own; the current CSS character remains a
functional placeholder until that dedicated pass is complete.

## Release gate

Every furnishing pass must preserve keyboard focus, Enter and Shift+Enter behavior, copy/paste,
safe links, selection, text wrapping, scroll anchoring, resizing, high-DPI rendering, and reduced
motion. Visual polish is not complete until the existing workflow suite and compact containment
checks pass.
