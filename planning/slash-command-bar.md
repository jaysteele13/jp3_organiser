# Slash command bar - brief plan (slice 1)

Confirmed intent from the `/interview-me` session on 2026-11-27. Next step: `/spec-driven-development`.

## Statement of intent

- **Outcome:** Pressing `/` anywhere opens a command bar that shows what you type. Typing `l` or `p` suggests the command `library` or `player`, and Tab completes it. You then type a plain song name, and Enter takes you to that page showing only matching songs. Esc closes the bar.
- **User:** Me, navigating by keyboard. Library is for editing; player (MP3) is for playing and queueing the same songs.
- **Why now:** It is the foundation for an SPL-style query language for the app.
- **Success:** `/library <name>` and `/player <name>` each land on the right page, filtered to matches.
- **Constraint:** A small change that reuses existing code, with the parser built so `key=value` can slot in later.

## Examples

| Typed | Result |
|-------|--------|
| `/` | Command bar opens |
| `/l` then Tab | Completes to `/library` |
| `/p` then Tab | Completes to `/player` |
| `/library drivers` then Enter | Library page, only songs matching "drivers" |
| `/player drivers` then Enter | Player page, only songs matching "drivers" |
| Esc | Bar closes, nothing changes |

## Out of scope (later tickets)

- `artist=`, `year=`, `album=` and `genre=` filters
- Value autocomplete from the database (e.g. `artist=` lists artists)
- Wildcards and regex
- A live results list inside the bar
- Playing a song directly from the bar

## Open questions for the spec

- Which existing code to reuse. `LibrarySearch` and `FilterBar` are candidates by name only; their contents have not been read yet.
- How each page receives the filter text (for example a URL query parameter or shared state).
- Whether `/` is ignored while the cursor is already in a text box (assumed yes).

## Coding standards

Follow `jp3_organiser/AGENTS.md` ("Code Style Guidelines"): component folder with barrel export, max 250 lines and 5 `useState` per component, logic in hooks or `utils/`, CSS variables only.
