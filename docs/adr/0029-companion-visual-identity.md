# ADR 0029: Companion visual identity

## Context

Companion's code-native hearthling proved the right behavioral model but remained a visual
placeholder. Early concept work had already established a more distinctive resident: a compact
household machine whose articulated task lamp, face, and posture move together.

## Decision

Companion's canonical identity is the approved midpoint model in
`docs/concepts/companion/companion-midpoint-treads-v2.png`.

The design preserves:

- an asymmetrical charcoal and walnut body with aged-brass controls and joints;
- a separate walnut head with an expressive dark face panel;
- restrained amber eyes, pupils, eyelids, brows, and illuminated mouth;
- a two-joint task-lamp arm with a slim warm light bar;
- small articulated hands and a tiny blue state light; and
- short recessed indoor treads that explain quiet movement around the house.

Idle, listening, thinking, and reply expressions reflect real interface state. Movement remains
ambient, bounded, and disabled by reduced-motion preferences.

The production state family lives in
`src/renderer/src/assets/residents/companion/`. Full-body compositions are used for Companion's
floating Home presence. Compact resident surfaces use a consistent portrait crop of those same
states so his face remains readable beside the human and animal residents.

## Consequences

- Companion remains recognizable from resident-avatar through full Home scale.
- The face has enough range for personality without becoming human, childish, or emoji-like.
- Mobility is legible without roaming across or obstructing the interface.
- The original recovered concept sheet remains a historical anatomy reference; the midpoint model
  is the production identity.
