# Implementation Plan: Slash command bar (slice 1)

Spec: `planning/slash-command-bar-spec.md` (approved 2026-11-27). Tasks: `tasks/todo.md`.

## Overview

Press `/` to open a command bar, type `library <text>` or `player <text>`, press Enter, and land on that page's song list filtered to songs whose title, artist or album contains the text.

## How the pieces connect

```
"/" key ──> useKeyboardShortcut (skips text boxes) ──> CommandBar opens
typing  ──> suggestCommand ──> greyed suggestion, Tab completes
Enter   ──> parseCommand ──> navigate("/view?tab=songs&q=drivers")
page    ──> useTextFilter reads ?q= ──> filterSongsByText ──> song list + FilterBar
```

Build order follows the arrows backwards: pure functions first, then the bar, then the pages.

## Architecture decisions

- **The filter lives in the URL (`?q=`).** The bar and the pages never talk to each other directly; the bar only navigates. That is why the page tasks can be built and tested by typing a URL-style command before or after the bar exists.
- **One shared hook, `useTextFilter`, returns `[text, clear]`.** Both song lists use it, so there is no prop threaded through `View.jsx` or the tab components.
- **One navigation shape for both commands:** `navigate(route + "?tab=songs&q=...", { state: { tab: "songs" } })`. Player reads the tab from the URL; View already reads it from navigation state. Each ignores the other, so the bar needs no per-page logic.
- **Player's active tab becomes derived from the URL** (removes a `useState`), so a command typed while already on the Player switches to Songs.
- **Esc and Tab are handled on the bar's own input**, not as global listeners, so they cannot clash with the Esc handlers in `ContextMenu`, `ActionMenu` and `Toast`.

## Risks and mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| `/` shortcut blocks typing `/` in forms | High | Task 2 adds `ignoreInInputs`; checked by hand in the Upload form |
| Moving `isInputElement` breaks player shortcuts (space, arrows) | Med | Pure move, no logic change; checked by hand at checkpoint A |
| `SongView` caches its sorted list by key; a stale key would show unfiltered songs | Med | Task 5 adds the filter text to the cache key |
| Deriving the Player tab from the URL changes tab switching | Med | Task 6 is its own slice; all five tabs checked by hand |
| A song filter picked from `LibrarySearch` and `?q=` both active | Low | Both apply; each has its own FilterBar / clear |

## Parallelisation

Tasks 1 and 2 are independent. Tasks 5 and 6 are independent of each other and of tasks 3-4 (testable by navigating with `?q=` once task 1 is done). Sequential is fine for one person.

## Phase 2 (requested 2026-11-27): live filtering, value dropdown, history

Slices 1 and 2 (Tasks 0-7) are built. These three (Tasks 8-12 in `tasks/todo.md`) are **built but not yet checked by hand**.

### What changes

| Feature | Today | After |
|---------|-------|-------|
| Live filtering | Nothing happens until Enter | Finishing the command word (`library ` / `player `) opens that page straight away; the song list updates as you type |
| Value dropdown | Tab completes a key to `artist=` and stops | After `artist=` or `album=`, a list of matching artist / album names appears; arrows move, Tab or Enter picks one |
| History | The bar always opens empty | With the bar open, Up / Down step through previous searches |

### Design decisions

- **Live filtering is the same navigation, done earlier and repeated.** The bar already writes the query to `?q=`. It will now do that on each change (debounced with the existing `useDebounce`, and with `replace: true` so Back does not step through every keystroke). The pages need no changes.
- **Values need quotes before the dropdown can work.** "Olivia Rodrigo" has a space, and terms are split on spaces. `filterSongsByText` will accept `artist="olivia rodrigo"`, and the dropdown inserts the quotes for you. This is its own small task, tests first.
- **The dropdown reads the library the app already has loaded.** `useLibrary` is backed by a shared cache (`hooks/libraryCache.js`), so calling it from the bar does not load the library twice. Suggestions are a pure function in `utils/`, shown in a small list under the bar (max 6).
- **Arrow keys have one rule:** if the dropdown is showing, Up / Down move through it; otherwise they move through history. Tab or Enter picks the highlighted value; Enter with no dropdown closes the bar.
- **History is saved on Enter only**, not on every keystroke, so half-typed queries do not fill it. Newest first, no duplicates, capped at 20, persisted with the store plugin `SongView` already uses, so it survives a restart.
- **`useCommandBar` will be split if it passes ~100 lines or 5 `useState`**: history into `useCommandHistory`, dropdown state stays in the bar hook.

### New risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Typing in the bar re-filters and re-sorts the Library list on every keystroke, and `SongView`'s cache keeps one entry per query | Med | Debounce (150ms); check typing feels smooth on the real library; if not, stop caching text-filtered results |
| Auto-navigating away from a half-finished Upload when you type `/library ` | Med | Only navigate once the command word is complete and followed by a space; confirm Upload state survives (it uses `UploadCacheProvider`) |
| Up / Down in the bar clash with player volume shortcuts | Low | Player shortcuts already ignore text boxes |
| Bar hook grows too big | Low | Split rule above |

### Assumptions to confirm

1. **Esc** closes the bar and leaves you on the page with the current filter (it does not jump back to where you started).
2. **Enter** simply closes the bar, since the results are already showing.
3. The dropdown covers **`artist=` and `album=` only**, as asked. `title=` and `year=` get no dropdown.
4. History **survives a restart** and holds the **last 20** searches.

## Open questions

See "Assumptions to confirm" under Phase 2.
