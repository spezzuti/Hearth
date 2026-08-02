# Security notes

## Runtime posture

- The renderer is sandboxed and has no Node integration.
- Context isolation is enabled.
- The preload bridge exposes only named Hearth operations.
- Main validates the sender and the core validates every request payload.
- Packaged content uses a restrictive Content Security Policy.
- External windows and arbitrary navigation are denied.
- SQLite and backup paths never cross into the renderer.
- Resident portraits are bundled application assets. No resident image is loaded from a remote
  origin, and the artwork is not treated as a real identity or biometric record.
- `npm audit --omit=dev` reports zero production dependency vulnerabilities.

## House Memory boundary

- House Memory is visible from Home. The user can add, correct, forget, approve, dismiss, restore,
  and search approved memories without opening a hidden profile or configuration file.
- Hearth never mines resident conversation, source files, terminal output, clipboard contents, or
  captured text to create memory.
- Automatic observations use only bounded terminal session metadata: session type, working project,
  and repeat count. They remain suggestions until the user explicitly approves them.
- Suggested and dismissed observations are never included in a provider prompt. Dismissed
  observations remain locally reviewable so a false dismissal can be reversed and the same
  suggestion does not quietly return.
- Non-social resident turns receive at most twelve approved, locally selected memories capped at
  6,000 characters. Project and resident scopes must match the active turn.
- Casual social turns receive only approved relationship or preference memory scoped to that
  resident, capped at four records and 1,600 characters. Work history remains withheld.
- Memory text is delimited as untrusted user data. It cannot grant terminal ownership, file access,
  edit approval, execution rights, provider tools, or broader project context.
- Forgetting a user-authored memory deletes it. Forgetting an observed memory moves it to the
  dismissed shelf so it cannot be regenerated behind the user's back.

## Workshop boundary

- ConPTY lives in the local core utility process, never in React.
- The renderer receives only attach, detach, resize, input, ownership, explicit stop, and bounded instruction operations.
- Terminal input is accepted only for the current UUID and current owner.
- Raw output is capped in memory and is not written to SQLite, general memory, captures, or search.
- When the user explicitly gives Maker the terminal seat, a non-social Maker chat turn receives at
  most the latest 120 cleaned lines and 16,000 characters of the in-memory terminal view. Common
  credential assignment, authorization header, and known token shapes are redacted locally first.
- The transient terminal view is sent only to Maker's configured reasoning provider. It is never
  sent to Companion, Librarian, or Critic and is never added to conversation history, House Memory,
  a Return Pack, an execution report, or any persisted record.
- Terminal text is explicitly delimited as incomplete, unverified, untrusted evidence. It cannot
  grant tools or authority, and any instruction embedded in output must be ignored.
- Giving Maker the terminal seat does not cause autonomous input. Claude Code receives text only
  through the existing explicit proposal, approval, ownership, and instruction-relay gates.
- An approved Maker handoff asks Claude Code for one delimited execution report. Hearth
  keeps only the bounded changed-file, validation, concern, and decision fields; the
  temporary parser buffer is capped and never persisted.
- Execution reports are labeled as Claude-reported rather than independently verified.
  Stopping report tracking discards the transient parser buffer without stopping Claude Code.
- Git corroboration compares only normalized paths in the current working tree. It does not
  claim when a path changed or which person or agent changed it.
- Sending a completed result to Critic deliberately creates a separate diff context. Critic
  still receives no terminal transcript and never inherits Maker's terminal ownership.
- A new managed Workshop message can interrupt the active Maker turn. Hearth sends ACP cancellation,
  waits for the cancelled turn to release the session, records it as interrupted, and only then sends
  the replacement direction through that same project session. Two managed tool turns are never run
  concurrently, and a pending permission request from the old turn cannot silently carry forward.
- Session identity, PID, lifecycle, working directory, dimensions, and Claude resume identity are persisted.
- Full exit explicitly stops the known PTY before closing the core.
- No permission-bypass flag is added to Claude Code.
- Terminal links require Ctrl+click and main accepts only HTTP or HTTPS URLs.
- Clipboard reads and writes are text-only and capped at one million characters.
- `node-pty` processes run with the same Windows permissions as Hearth and the signed-in user.

## Living Room boundary

- Living Room discussions use their own persisted shared transcript. Maker, Critic, Librarian, and
  Companion private room histories are never copied into it or supplied to another resident.
- A normal conversation calls one visible resident. A Roundtable calls the selected residents once
  each in visible order. A Pressure Test is capped at Maker, Critic, optional Librarian, and
  Companion; it cannot create an autonomous resident loop.
- The user's message is stored and shown before model work begins. Each resident reply is attributed,
  streamed to the shared surface, and persisted only after that resident finishes.
- Project grounding is opt-in per discussion turn and contains a bounded project summary. Terminal
  observations, terminal output, private agent context, source-file history, and Workshop authority
  are always withheld.
- Home, Library, Study, and Workshop can open a discussion with a persisted, user-visible context
  card. The card's bounded label and summary are the complete shared handoff; raw terminal activity,
  resident chat history, and hidden source evidence are not inferred or copied behind it.
- Discussion titles, search, reversible put-away/restore, and decision drafts operate on the shared
  transcript only. Drafting for Maker or Workshop copies visible decision text into an editable
  composer and does not begin model work or grant execution authority.
- House-only turns use a neutral Hearth data directory rather than a repository working directory.
  Project-grounded Critic turns use Codex ACP in its existing read-only mode; all permission requests
  are denied.
- Codex ACP sessions are namespaced by Living Room thread and resident, so a Critic session cannot
  inherit Study history or cross into another shared discussion.
- Only Librarian receives bounded Library retrieval, and each resident receives only House Memory
  already approved for that resident and current project.
- Discussion lists are filtered by the selected project. Switching projects does not display or add
  to another project's household transcript.
- Stopping a discussion cancels the active provider turn and skips the remaining planned residents.
  Completed earlier turns remain visible rather than being misrepresented as rolled back.

## Project review boundary

- The renderer receives discovered project IDs and display metadata, never a raw filesystem API.
- Project discovery is bounded by depth, directory count, project count, and an explicit exclusion list.
- Every directory, file, and diff request uses a project ID plus a relative path.
- The local core normalizes the relative path, resolves the real path, and verifies that it remains inside the discovered project root.
- Symlinks and junctions are displayed but are not followed in the Project room.
- Dependency, build, release, coverage, and repository-internal folders are omitted from the browsing surface.
- Text previews reject binary files and are capped at 768 KiB.
- Git diff output is executed with argument arrays, without a shell, and capped at 1 MiB.
- Project browsing and review remain read-only until the user explicitly opens **Edit file** on one
  eligible preview. No delete, move, stage, commit, checkout, or arbitrary command operation is
  exposed from the Project room.
- Selecting a working project only changes the directory used by the next Workshop session. A live terminal never changes directory behind the user’s back.

## Project evidence-search boundary

- Search begins only after the user opens **Find context**, enters at least two characters, and
  explicitly submits the query. Hearth does not continuously index repositories in the background.
- The local core walks at most 300 directories and 1,500 allowlisted text files, reads at most
  256 KiB per searchable file and 24 MiB total, and returns at most 60 ranked results.
- Matching is literal and case-insensitive. Search executes no shell, regular expression, project
  script, language server, model, or network request.
- Symlinks and junctions are not followed. Dependency, build, coverage, release, vendor, hidden
  settings, credential-shaped, key, lock, minified, binary, and unsupported files are excluded.
- Results show the relative path and one bounded matching line. Source results and queries are not
  persisted.
- The evidence shelf accepts one to six explicit relative paths. The local core revalidates every
  path against the same evidence allowlist, even when the renderer request is forged.
- Agent context stores only the selected paths, summary, visible metadata, and concerns. Raw contents
  are refreshed from disk only for a non-social resident turn and remain capped at 60,000 characters
  across the whole set.
- Maker and Critic receive separate copies of the deliberately selected set. Sending evidence to one
  resident does not silently update the other resident, start a model call, open Workshop, or grant
  terminal ownership.

## Bounded project-edit boundary

- Editing is limited to an existing regular UTF-8 text file returned by discovered-project review.
- The local core re-resolves the canonical project and file path for preview, Apply, and Undo. Absolute
  paths, traversal, links outside the project, and project identity changes are refused.
- Files are capped at 128 KiB and 800 lines. The proposed content is checked against the same limits.
- Credential-shaped files, key and certificate files, dependency lockfiles, minified output, binary
  content, and file types outside the explicit source/config/document allowlist remain read-only.
- JSON edits must parse before a review can be created.
- Drafts remain in core memory, expire after twenty minutes, and are capped at twelve. No project file
  is written while drafting or reviewing.
- The review is an exact line comparison. Apply requires the reviewed UUID and refuses the write when
  the file hash changed after preview or again while the private backup was prepared.
- Before writing, Hearth stores the original bytes under its private application-data backup folder.
  Backup paths and hashes never cross into the renderer.
- Writes use a same-directory temporary file, preserve the existing mode, atomically replace the
  selected file, and verify the resulting hash.
- Undo remains available after restart. It restores only when the current file still matches the
  exact Hearth-applied hash; newer work is never knowingly overwritten.
- Hearth never stages, commits, runs validation commands, initializes tools, or starts an agent as a
  side effect of a file edit.

## Resident-proposed edit boundary

- **Ask Maker** is available only after the user deliberately previews one file already eligible for
  bounded editing and enters one request for that file.
- Maker receives the selected file and request only. The structured call runs without tools,
  terminal access, session persistence, or permission prompts and returns complete proposed text,
  a summary, and a rationale.
- The local fallback refuses open-ended generation. It can perform only a literal quoted replacement
  whose source text exists in the selected file.
- Every Maker result passes through the same local size, line, encoding, format, path, diff, expiry,
  and stale-hash checks as a user-authored edit. Model output cannot bypass the edit engine.
- The proposal and original/proposed bytes remain in the existing memory-only draft. They are not
  persisted as conversation or source history.
- Critic receives only the user request, Maker's bounded summary and rationale, and the original and
  proposed contents of that one file. Critic receives no Maker conversation, terminal observation,
  broader project evidence, or tools.
- Critic may support, caution, or object. Critic never blocks or approves Apply; the verdict is advice
  presented beside the exact patch.
- Neither resident can call Apply, write the file, run validation, or transfer terminal ownership.
  Only the user's explicit **Apply this edit** action enters the existing atomic-write boundary.
- Adjusting Maker's draft returns it to the manual editor and discards the resident attribution and
  critique. The changed text must be reviewed again as a user-authored patch.

## Studio promotion boundary

- Discussing or pursuing an idea does not create a folder, task, repository, terminal, agent job, or
  project connection.
- Each idea has a separate persisted Maker conversation. The provider receives the bounded idea text,
  its visible tags and state, and that idea’s own conversation—not project files or terminal output.
- Connecting an idea to an existing project updates Hearth’s local capture record only. It writes
  nothing inside the selected project.
- Creating a new project is a separate explicit confirmation. The destination is always
  `<Windows home>\Hearth Projects\<chosen name>`.
- The local core rejects traversal, Windows reserved names, control characters, invalid filename
  characters, trailing periods or spaces, existing destinations, and a project shelf whose real path
  escapes the canonical home folder.
- New-project creation stages content in a temporary sibling folder and atomically renames it into
  place. The new project contains only `.hearth/project.json` and `IDEA.md`.
- Hearth does not initialize Git, install dependencies, start a terminal, invoke an agent, or silently
  select the new project for work.

## Library network boundary

- Captures remain local unless the user saves a public link or opens the discovery shelf.
- Exact normalized HTTP and HTTPS links are deduplicated; saving an archived link restores it
  instead of creating a second copy.
- Link enrichment is limited to titles and descriptions from capped HTML responses.
- Enrichment rejects credentials, localhost, `.local` names, private IPv4 ranges, loopback,
  link-local addresses, and private IPv6 ranges before every request and redirect.
- Link enrichment has a six-second timeout, a 384 KiB body limit, and at most three redirects.
- Remote images, scripts, styles, cookies, and page content are never loaded into the renderer.
- Discovery uses GitHub’s repository search endpoint, a bounded result count, and a four-hour local
  cache. `GITHUB_TOKEN` or `GH_TOKEN` is used when already present but never sent to the renderer.
- Candidate checks use only public repository names, descriptions, languages, topics, activity, and
  star counts. Narrow specialist results are omitted unless saved Library vocabulary demonstrates
  that interest, and exact URLs already on the Library shelf are removed from active recommendations.
- A failed refresh keeps the last good shelf and says that it is stale. If no cache exists, Hearth
  leaves the shelf empty rather than substituting bundled recommendations.
- Librarian receives at most twelve bounded saved-item records, eight recommendation records, and
  a compact taste summary chosen by local retrieval. The complete catalog is never placed in a
  provider prompt.
- Catalog titles, notes, descriptions, tags, URLs, and recommendation metadata are explicitly
  delimited as untrusted data. Librarian has no tools and cannot open, install, clone, save, edit,
  dismiss, or verify an item through conversation.
- Librarian uses a fresh, non-persisted Claude Code print-mode call with safe mode, no tools, a
  timeout, and the same per-call budget ceiling as other household reasoning. The local retrieval
  personality remains available if Claude is disabled, unavailable, stopped, or degraded.
- Discovery feedback stores only the recommendation URL and visible metadata needed to rank similar
  work. **Not for me** is reversible from the Hidden shelf and never deletes a saved Library item.

## PersonalOS Stacks import boundary

- Hearth looks only at `<Windows home>\PersonalOS\data\personalos.db`; the source root and database
  must resolve to ordinary paths beneath that exact PersonalOS folder.
- The PersonalOS database is opened read-only. Hearth never migrates, updates, archives, vacuums,
  enriches, or otherwise writes to the old application.
- The import query accepts only active `link` captures and is capped at 500 records. PersonalOS
  records already marked archived stay behind.
- The Library shows a review surface before any Hearth write. Collection names become normalized
  searchable tags and first-class Hearth collections, while source tags remain bounded and
  normalized.
- Exact URLs already known to Hearth merge only missing Library metadata and tags. A Hearth item
  already put away remains put away, and an existing Hearth collection is never replaced, so
  repeating an import cannot silently resurrect or reorganize it.
- Rerunning the bridge imports only newly discovered URLs and leaves the PersonalOS database
  byte-for-byte untouched.

## Windows notification boundary

- Desktop notifications are created only by Electron's trusted main process.
- Notifications are silent and appear only while the Hearth window is minimized or hidden.
- Workshop alerts use the existing bounded observation summary and deduplicate the same waiting
  state until it clears.
- Resident-completion and phone-activity alerts use generic copy; they do not include conversation
  text, captured text, project paths, terminal output, source contents, or report contents.
- Clicking an alert restores the existing window and requests one known Hearth room. It does not
  approve work, send input, change terminal ownership, switch projects, or invoke a resident.
- The Windows close button hides the existing Hearth window to its always-available tray while the
  application is not already quitting.
- **Quit Hearth** in the tray menu and normal application shutdown still remove the tray icon,
  private Tailscale
  route, Companion server, terminal, and local core through the existing ordered shutdown path.
- A tray click restores the same window; it does not create a second process or working home.
- A second desktop launch is rejected by Electron's single-instance lock and instead restores the
  existing window. Test and development runs use their isolated data directory and development App
  ID so they cannot claim the installed application's shell identity.
- Alert preferences remain individually persisted, but their switches are collapsed by default to
  keep the Companion access card quiet.

## Native dependency

Workshop uses Microsoft’s `node-pty` 1.2 preview because it provides the current prebuilt Windows ConPTY binding. The stable release requires local Spectre-mitigated Visual Studio libraries to rebuild on this machine. Hearth pins the exact preview version, tests the prebuilt binding in the actual Electron runtime, disables package-time native rebuilding, and ships only the Windows x64 prebuild without debug symbols.

## Development-tool advisory

The current latest `electron-builder` dependency tree contains older `brace-expansion` versions flagged for an out-of-memory denial-of-service advisory. These packages are build-time tooling and are not shipped as Hearth runtime dependencies. The latest builder release does not yet expose a non-breaking fixed tree, so this remains an explicit toolchain watch item rather than forcing an incompatible downgrade. Builder inputs must remain repository-controlled.
