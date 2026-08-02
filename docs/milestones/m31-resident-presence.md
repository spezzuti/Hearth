# Milestone 31: Resident presence

Hearth 0.26.0 gives the household its settled visual identities without turning the working home
into a character dashboard.

## Delivered

- Original Maker, Librarian, and Critic portraits derived from the approved character briefs.
- One shared resident-avatar component with locally bundled artwork.
- Consistent portraits across Home and each resident's working surfaces.
- A room-aware crop that keeps faces readable in compact rails.
- Slightly larger Home introductions without reducing the surrounding work area.
- Corrected Home presence copy now that Librarian is available in Library.
- Regression coverage proving all three Home portraits load successfully.
- No runtime image network request or new resident authority.

## Visual posture

The portrait system is intentionally restrained. It adds enough warmth and recognition for the
residents to feel like people in the home, while conversations, evidence, projects, and the terminal
remain the primary surfaces.

The code-native Companion remains separate. Its small expressive pop-up role benefits from motion
and state changes more than a fixed portrait, so this milestone does not replace it with static art.
