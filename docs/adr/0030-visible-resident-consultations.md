# ADR 0030: Visible, bounded resident consultations

## Context

Hearth's residents are meant to behave like a small household, not isolated chat panels. Maker
already prepares work for Claude Code and Critic already reviews bounded project evidence, but
moving between them required the user to notice every review signal and create every handoff.

Fully autonomous agents would obscure cost, authority, and terminal ownership. Keeping every
handoff manual would make the residents feel less aware of each other and would leave useful review
signals on the table.

## Decision

Maker may bring Critic into a bounded consultation without another user click when:

- a draft proposal is marked high risk or unknown risk;
- Claude Code reports an unresolved concern; or
- Claude Code's changed-file report only partly matches, or does not match, the current Git working
  tree.

The consultation persists on the Maker proposal with its phase, reason, plain-language note, and
timestamp. Workshop shows the handoff in context and offers a direct route to Critic. Critic's
conversation receives a natural acknowledgement and the same bounded evidence packet already used
by explicit handoffs.

Consultation does not:

- start another model call;
- grant Critic terminal ownership;
- type into Claude Code;
- execute or modify project work;
- block the user from proceeding; or
- interrupt ordinary low- and medium-risk work.

The user can still send a clean execution report to Critic manually. One preflight and one
postflight consultation may be recorded per proposal so reloads and repeated events do not create
noise.

## Consequences

- Residents can collaborate without becoming an opaque agent swarm.
- High-signal uncertainty reaches Critic automatically while clean work remains quiet.
- Handoffs survive reload and remain inspectable in both Workshop and Study.
- Model cost and terminal authority remain exactly where the user expects them.
- Future resident-to-resident behavior should follow the same rule: bounded evidence, visible
  reason, narrow authority, and no duplicate chatter.
