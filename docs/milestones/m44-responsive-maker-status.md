# Milestone 44: Responsive Maker Status

Hearth 0.39.0 finishes the small but persistent provider-label rough edge in Workshop.

## Delivered

- Full **Claude** / **Opus 5** presentation beside Maker.
- Semantic provider-line splitting instead of ellipsis.
- A grouped online light with even label spacing and right-edge padding.
- Provider visibility retained at wide, compact, short, and minimum supported window sizes.
- Accessible full-name and online-state labeling.

## Verification

- Real Electron layout coverage checks 1440×900, 1080×720, and 1040×700.
- Every size proves the complete **Claude Opus 5** label, at least six pixels between label and
  light, at least ten pixels at the right edge, no avatar collision, and no document overflow.
- The same run exercises a real ConPTY session, terminal focus, resize, navigation, renderer
  reattachment, Maker seat transfer, and explicit stop.

## Principle

Small status details should look placed, not merely fit.
