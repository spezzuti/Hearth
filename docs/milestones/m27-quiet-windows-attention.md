# Milestone 27: Quiet Windows attention

The close-button boundary recorded here was superseded by Milestone 29 after hands-on product
review. Notification privacy and delivery boundaries remain current.

Hearth 0.23.0 can now wait politely in the Windows background without requiring the user to keep
checking it.

## Delivered

- Native Electron notifications from the trusted main process.
- Alerts appear only while Hearth is minimized or hidden.
- Workshop attention is enabled by default and fires only when its bounded observation requires
  input.
- Repeated copies of the same Workshop waiting state are deduplicated until that state clears.
- Finished Maker, Librarian, Critic, and Companion replies are enabled by default.
- Finished Studio Maker replies return to Studio rather than the general Study room.
- Phone capture and idea-decision notifications remain opt-in.
- Phone Companion conversation does not generate desktop notification noise.
- All notifications are silent.
- Clicking restores and focuses the existing Hearth window, then opens the relevant room.
- Notification preferences persist locally in the existing workspace preference store.
- Home contains clear, individually controlled switches and explains the minimized-only rule.

## Delivery map

| Event | Default | Click destination |
| --- | --- | --- |
| Workshop requires input | On | Workshop |
| Maker or Critic finished | On | Study |
| Librarian finished | On | Library |
| Companion finished | On | Home |
| Studio Maker finished | On | Studio |
| Phone capture | Off | Home |
| Phone idea decision | Off | Studio |

## Boundaries

Notification bodies remain deliberately generic. Resident replies, captures, idea text, project
paths, file contents, terminal output, and handoff details do not enter Windows notification text.

Hearth does not minimize itself, install a background startup task, or convert the close button into
**hide to tray**. Closing the window remains a real exit and preserves the existing terminal-stop
contract.

Windows associates reliable toast delivery with an installed application identity. The pure
notification coordinator is tested independently, while the unpackaged Electron test proves
preferences and minimized background activity without pretending that a development process owns an
installed Start-menu identity.
