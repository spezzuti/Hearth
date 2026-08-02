# ADR 0027: First-class resident presence

## Context

The settled Maker and Librarian portraits gave Hearth recognizable human residents, but most
surfaces still presented them at generic account-avatar size. Companion's expressive character
system made that imbalance more visible: the ambient helper felt present while the people doing the
work felt represented by static thumbnails.

Full animation or video portraits would be distracting, expensive, and tonally mismatched with the
warm editorial artwork. Purely scaling the original images would improve recognition but not make
their presence respond to conversation.

## Decision

Maker and Librarian receive a restrained portrait-state system:

- `resting` is a quiet static portrait;
- `present` uses the settled portrait with an almost imperceptible living crop and a small green
  presence light; and
- `thinking` crossfades to an identity-preserved expression variant, adds a slow considered drift,
  and warms the presence light while a real response is in progress.

The expression variants preserve the original person, styling, room, camera, and lighting. They are
preloaded beside the base portrait so state changes do not flash or wait on a network request.

Home increases resident introductions from thumbnail to portrait size. Maker receives a larger
conversation identity in Study and stronger presence in Workshop and Studio. Librarian receives a
larger at-the-desk identity in Library. Compact room rails grow only enough to make faces readable;
they do not become character cards.

Critic keeps the settled raven portrait and existing review card. The shared component still
supports the present-state crop so household treatment remains coherent, but no artificial human
expression variant is applied.

All motion follows Hearth's global reduced-motion rule.

## Consequences

- Maker and Librarian read as first-class residents rather than account avatars.
- Visual expression now corresponds to truthful conversation state.
- The UI gains warmth without speech bubbles, canned reactions, or mascot behavior.
- Two additional local portrait assets increase the packaged renderer by roughly four megabytes.
- No runtime image fetch, video decoder, canvas loop, or animation dependency is introduced.
