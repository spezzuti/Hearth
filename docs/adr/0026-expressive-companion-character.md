# ADR 0026: Expressive Companion character

## Context

Companion already had a useful conversational popover and an intentionally small place in Hearth,
but its floating control was a prototype robot shell. It communicated "chat button" more clearly
than "small presence living around the house."

A fixed raster portrait would add surface polish but would not react naturally to conversation.
A heavy sprite or animation runtime would be disproportionate for an ambient character that must
remain quiet beside project work and the terminal.

## Decision

Companion becomes a code-native hearthling: a warm desktop object with creature-like posture, an
expressive cream face, a small ember, articulated arms, and grounded feet.

One shared `CompanionCharacter` structure renders both the full floating character and its compact
popover identity. A `data-mood` state controls four bounded expressions:

- `idle` breathes quietly and occasionally blinks;
- `listening` raises its brows and leans attentively when chat is open;
- `thinking` glances upward and moves gently while a response is in progress; and
- `reply` brightens its hearth light and waves after a new reply arrives while chat is closed.

The reply acknowledgement clears when Companion is opened and settles on its own after a few
seconds. It does not create a notification, canned observation, or interruption.

All motion is CSS-only and follows Hearth's global reduced-motion rule. The button retains an
explicit accessible name and now has a visible keyboard focus treatment. Decorative character
parts remain hidden from assistive technology.

## Consequences

- Companion feels like a small household presence instead of a generic floating robot control.
- The same character remains coherent at full and compact sizes.
- Expression follows truthful interface state rather than simulated personality activity.
- No image download, canvas process, animation dependency, or additional runtime memory surface is
  introduced.
- The character structure can accept future expressions without changing conversation authority.
