# Tasks: Slash command bar (slice 1)

Plan: `tasks/plan.md`. Spec: `planning/slash-command-bar-spec.md`.

Run from `jp3_organiser/`: `npm test`, `npm run build`, `npm run tauri dev`. All paths below are under `jp3_organiser/src/`. No `git add`, commit or PR.

- [x] **Task 0: Command parser** (already done, uncommitted) - `utils/commandParser.js` + 3 tests.

## Phase 1: Foundation

- [x] **Task 1: Filter songs by text**
  - Does: adds `filterSongsByText(songs, text)`, which keeps songs whose title, artist name or album name contains the text, ignoring case.
  - Acceptance: matches on each of the three fields; empty or blank text returns every song; no match returns an empty list.
  - Verify: `npm test` (3 new tests in `songFilter.test.js`).
  - Depends on: none.
  - Files: `utils/songFilter.js`, `utils/songFilter.test.js`, `utils/index.js`.
  - Size: S.

- [x] **Task 2: Shortcut option that ignores text boxes**
  - Does: moves the existing `isInputElement` helper into `utils/dom.js` and adds an `ignoreInInputs` option to `useKeyboardShortcut`, off by default.
  - Acceptance: with the option on, the shortcut does nothing while the cursor is in an input, textarea, select or editable element; existing callers behave exactly as before.
  - Verify: `npm run build`; by hand, Ctrl+S still toggles the nav and space/arrow player shortcuts still work.
  - Depends on: none.
  - Files: `utils/dom.js`, `utils/index.js`, `hooks/useKeyboardShortcut.js`, `hooks/player/usePlayerKeyboardShortcuts.js`.
  - Size: S.

### Checkpoint A
- [x] `npm test` and `npm run build` pass
- [ ] Ctrl+S and player shortcuts unchanged
- [ ] Review with Jay

## Phase 2: The bar

- [x] **Task 3: Bar opens, suggests, completes and closes** (built; not yet checked by hand)
  - Does: adds `CommandBar` (the visible bar) and `useCommandBar` (its logic), mounted once in `AppLayout`.
  - Acceptance: `/` opens the bar focused and showing `/`, but types a normal `/` inside a text box; typing `l` or `p` shows a greyed `library` / `player` and Tab completes it with a trailing space; Esc closes the bar and clears it.
  - Verify: `npm run build`; by hand on the Upload page (has text boxes) and the Player page.
  - Depends on: Task 2.
  - Files: `hooks/useCommandBar.js`, `hooks/index.js`, `components/CommandBar/CommandBar.jsx`, `components/CommandBar/CommandBar.module.css`, `components/CommandBar/index.js`, `components/index.js`, `App.jsx` (three of these are one-line exports).
  - Size: M.

- [x] **Task 4: Enter runs the command** (built; not yet checked by hand)
  - Does: on Enter, `parseCommand` turns the input into a route and the bar navigates there with `?tab=songs&q=<text>`.
  - Acceptance: `library drivers` goes to the Library page and `player drivers` to the Player page, each with `q=drivers` in the URL, and the bar closes; a command with no text just opens the page; an unknown command keeps the bar open and shows "Unknown command".
  - Verify: `npm run build`; by hand for all three cases.
  - Depends on: Task 3.
  - Files: `hooks/useCommandBar.js`, `components/CommandBar/CommandBar.jsx`.
  - Size: S.

### Checkpoint B
- [x] `npm test` and `npm run build` pass
- [ ] Bar navigates to the right page (lists not filtered yet)
- [ ] Review with Jay

## Phase 3: The pages

- [x] **Task 5: Library song list filters by `?q=`** (built; not yet checked by hand; also a one-word change in `pages/View/View.jsx`)
  - Does: adds the shared `useTextFilter` hook (reads and clears `q` in the URL) and uses it in `SongView` with `filterSongsByText`.
  - Acceptance: `/library drivers` shows only matching songs on the Songs tab, even when another tab was open; a FilterBar shows `"drivers"` and "Show all songs" removes the filter; sorting still works on the filtered list.
  - Verify: `npm run build`; by hand, including that "filter by this song" links from the Player still work.
  - Depends on: Tasks 1 and 4.
  - Files: `hooks/useTextFilter.js`, `hooks/index.js`, `pages/View/components/Tabs/Songs/SongView.jsx`.
  - Size: S.

- [x] **Task 6: Player song list filters by `?q=`** (built; not yet checked by hand)
  - Does: makes the Player's active tab come from the URL, and uses `useTextFilter` + `filterSongsByText` in `SongList`.
  - Acceptance: `/player olivia` shows only matching songs on the Songs tab, even when typed while already on the Player; a FilterBar shows `"olivia"` and clears it; Play and Shuffle act on the filtered list; all five tabs still switch.
  - Verify: `npm run build`; by hand.
  - Depends on: Tasks 1, 4 and 5.
  - Files: `pages/Player/Player.jsx`, `pages/Player/components/SongList.jsx`.
  - Size: S.

### Checkpoint C: Complete
- [ ] Every row of the spec's Behaviour table works
- [x] `npm test` and `npm run build` pass
- [ ] All five spec success criteria met
- [x] `AGENTS.md` mentions the command bar if a convention changed
- [ ] Review with Jay

## Slice 2: key=value filters

- [x] **Task 7: `title=`, `artist=`, `album=`, `year=` filters** (built; not yet checked by hand)
  - Does: `filterSongsByText` splits the text into terms; `key=value` terms check one field, plain words check every field, and all terms must match. Tab completes a key (`ar` to `artist=`).
  - Acceptance: see "Slice 2" in the spec. `genre=` is out of scope (no genre data).
  - Verify: `npm test` (2 new tests); by hand in the bar.
  - Files: `utils/songFilter.js`, `utils/songFilter.test.js`, `utils/index.js`, `hooks/useCommandBar.js`, `components/CommandBar/CommandBar.jsx`.

### Checkpoint D
- [ ] Slices 1 and 2 checked by hand (spec Behaviour table + Slice 2 table)
- [ ] Review with Jay

## Phase 2: live filtering, value dropdown, history (built; not yet checked by hand)

Design and assumptions: "Phase 2" in `tasks/plan.md`.

- [x] **Task 8: Results update as you type**
  - Does: once the command word is complete (`library ` or `player `), the bar opens that page; each further change updates `?q=` after a short pause. Enter just closes the bar.
  - Acceptance: typing `/library ` opens the Library Songs tab without Enter; typing more narrows the list live; Back returns to the page you were on before, not to each keystroke.
  - Verify: `npm run build`; by hand on both pages, and starting from the Upload page mid-upload.
  - Depends on: Tasks 0-7.
  - Files: `hooks/useCommandBar.js`.
  - Size: S.

- [x] **Task 9: Quoted values**
  - Does: `filterSongsByText` accepts `artist="olivia rodrigo"` as one term.
  - Acceptance: a quoted value with spaces matches as a phrase in that field; unquoted input behaves exactly as now; an unclosed quote does not crash.
  - Verify: `npm test` (new cases in `songFilter.test.js`, written first).
  - Depends on: Task 7.
  - Files: `utils/songFilter.js`, `utils/songFilter.test.js`.
  - Size: S.

- [x] **Task 10: Suggest artist and album names** (built in `utils/commandParser.js`, not `songFilter.js`, to keep all bar-input helpers together)
  - Does: adds a pure `suggestValues(library, word)` that returns up to 6 artist or album names matching what is typed after `artist=` / `album=`.
  - Acceptance: `artist=ol` returns artists containing "ol", best match first; `album=` works the same from albums; any other word returns nothing.
  - Verify: `npm test` (tests written first).
  - Depends on: none.
  - Files: `utils/songFilter.js`, `utils/songFilter.test.js`, `utils/index.js`.
  - Size: S.

- [x] **Task 11: Dropdown in the bar**
  - Does: shows the Task 10 suggestions in a list under the bar; Up / Down highlight, Tab, Enter or a click inserts the value (quoted if it has a space). Not built: "Esc closes the list first" (Esc closes the whole bar, to avoid extra state).
  - Acceptance: the list appears after `artist=` or `album=` and narrows as you type; picking a value fills it in and the song list updates; the list follows the active theme.
  - Verify: `npm run build`; by hand.
  - Depends on: Tasks 8, 9, 10.
  - Files: `hooks/useCommandBar.js`, `components/CommandBar/CommandBar.jsx`, `components/CommandBar/CommandBar.module.css`.
  - Size: M.

### Checkpoint E
- [ ] `npm test` and `npm run build` pass
- [ ] Live filtering and dropdown work on both pages
- [ ] Review with Jay

- [x] **Task 12: Search history with Up / Down**
  - Does: saves each search on Enter (newest first, no duplicates, last 20, kept across restarts) and lets Up / Down step through them when no dropdown is showing.
  - Acceptance: after two searches, `/` then Up shows the latest and Up again the one before; Down goes forward and ends on an empty bar; history is still there after restarting the app.
  - Verify: `npm test` for the pure add-to-history function; `npm run build`; by hand.
  - Depends on: Task 11 (shares the arrow keys).
  - Files: `utils/commandHistory.js`, `utils/commandHistory.test.js`, `hooks/useCommandHistory.js`, `hooks/useCommandBar.js`.
  - Size: M.

### Checkpoint F: Phase 2 complete
- [x] `npm test` and `npm run build` pass
- [ ] All three features work together (arrows: dropdown first, history otherwise)
- [x] No component or hook over the AGENTS.md limits
- [x] `AGENTS.md` and the spec updated
- [ ] Review with Jay

## Slice 4: several values per key, context-aware dropdown

- [x] **Task 13: `key=a and b`** (built; not yet checked by hand)
  - Does: `parseQuery` groups the text into wanted values per field; "and" after a `key=value` adds another value, and a song may match any of them.
  - Verify: `npm test` (new case in `songFilter.test.js`, written first).
  - Files: `utils/songFilter.js`, `utils/songFilter.test.js`.

- [x] **Task 14: Dropdown follows the rest of the query** (built; not yet checked by hand)
  - Does: `suggestValues` now takes the songs and the whole query, and only offers values from songs that match the other terms. Works for every key and after "and".
  - Verify: `npm test` (2 new cases in `commandParser.test.js`, written first); by hand with the spec's Slice 4 table.
  - Files: `utils/commandParser.js`, `utils/commandParser.test.js`, `hooks/useCommandBar.js`.

### Checkpoint G
- [x] `npm test` (17) and `npm run build` pass
- [ ] Spec Slice 4 table checked by hand
- [ ] Review with Jay

## Slice 5: switch command with Shift+Tab

- [x] **Task 15: Shift+Tab swaps `library` and `player`** (built; not yet checked by hand)
  - Does: `switchCommand(input)` replaces the command word with the other one and keeps the query; the bar calls it on Shift+Tab, and live filtering then opens the other page with the same filter.
  - Acceptance: `library artist=queen` + Shift+Tab becomes `player artist=queen` and the Player shows the same filter; again swaps back; with an empty bar it gives `library `.
  - Verify: `npm test` (1 new test, written first); by hand.
  - Files: `utils/commandParser.js`, `utils/commandParser.test.js`, `utils/index.js`, `hooks/useCommandBar.js`.

## Slice 6: "|" lines and `show=`

- [x] **Task 16: `| show=` in the parser and the bar** (built; not yet checked by hand)
  - Does: `parseCommand` treats text after `|` as instructions and returns the tab from `show=`; the bar's input is now a multi-line box where `|` starts a new line, and `show=` Tab-completes with a dropdown.
  - Verify: `npm test` (2 new tests, written first); by hand.
  - Files: `utils/commandParser.js`, `utils/commandParser.test.js`, `hooks/useCommandBar.js`, `components/CommandBar/CommandBar.jsx`, `components/CommandBar/CommandBar.module.css`.

- [x] **Task 17: Artists and Albums tabs follow the query** (built; not yet checked by hand)
  - Does: `filterByQuery` keeps artists or albums with at least one matching song; used by the Library's `ArtistView` / `AlbumView` and the Player's `TabContent`, each showing a FilterBar.
  - Verify: `npm test` (1 new test, written first); by hand with the spec's Slice 6 table on both pages.
  - Files: `utils/songFilter.js`, `utils/songFilter.test.js`, `pages/View/components/Tabs/Artists/ArtistView.jsx`, `pages/View/components/Tabs/Albums/AlbumView.jsx`, `pages/Player/components/TabContent.jsx`.

- [x] **Task 18: `show=playlist`** (built; not yet checked by hand)
  - Does: `filterPlaylistsByQuery` keeps playlists containing at least one matching song; used by the Library's `PlaylistView` and the Player's `TabContent`. `playlist` added to the `show=` values.
  - Verify: `npm test` (1 new test plus 2 extra checks, written first); by hand on both pages.
  - Files: `utils/songFilter.js`, `utils/songFilter.test.js`, `utils/commandParser.js`, `utils/commandParser.test.js`, `pages/View/components/Tabs/Playlists/PlaylistView.jsx`, `pages/Player/components/TabContent.jsx`.

### Checkpoint H
- [x] `npm test` (22) and `npm run build` pass
- [ ] Slices 5 and 6 checked by hand
- [ ] Review with Jay

Note: `hooks/useCommandBar.js` is now 111 lines with 3 `useState`. Still within AGENTS.md limits, but past the ~100-line point where the plan said to consider splitting it.

## Slice 7: remove the old search box

- [x] **Task 19: Remove `LibrarySearch` from Player and Library** (built; not yet checked by hand)
  - Does: removes the search box and its handlers from `Player.jsx` and `View.jsx`, deletes the now-unused `components/LibrarySearch/` and `hooks/useLibrarySearch.js`, and updates the barrel exports and six comments that named it.
  - Acceptance: no search box on either toolbar; tabs and "View in Library" links still work; `npm run build` has no missing imports.
  - Verify: `npm test`, `npm run build`; by hand on both pages.
  - Files: `pages/Player/Player.jsx`, `pages/Player/Player.module.css`, `pages/View/View.jsx`, `components/index.js`, `hooks/index.js` (+ 5 deleted files, 6 comment-only edits).

## Slice 8: edit the active filter

- [x] **Task 20: Click "Showing:" to edit the command** (built; not yet checked by hand)
  - Does: `formatCommand` rebuilds the command from the page, query and tab; `QueryFilterBar` shows it and, on click, fires `EDIT_COMMAND_EVENT`; `CommandBar` listens and opens pre-filled. `FilterBar` gains an optional `onEdit`.
  - Acceptance: see "Slice 8" in the spec.
  - Verify: `npm test` (1 new test, written first); `npm run build`; by hand on each tab of both pages.
  - Files: `utils/commandParser.js`, `utils/commandParser.test.js`, `components/FilterBar/` (3 files), `components/index.js`, `components/CommandBar/CommandBar.jsx`, `hooks/useCommandBar.js`, plus a one-line swap in the six tab components.
  - Note: there is no linter in this repo, so `npm run build` does not catch a missing import. One was caught by reading the code (`TABS` in `PlaylistView.jsx`); the Playlists tab is the one to check first.

## Slice 9: `playlist=`

- [x] **Task 21: `playlist=` filter** (built; not yet checked by hand)
  - Does: `withPlaylistNames` tags each song with its playlists' names when `useLibrary` loads; `playlist` joins `FILTER_KEYS`; plain words skip playlist names; the dropdown unpacks the name lists.
  - Acceptance: see "Slice 9" in the spec.
  - Verify: `npm test` (2 new tests, written first; 25 total); `npm run build`; by hand on both pages, plus a quick check that play, edit and delete still work now that songs carry an extra field.
  - Files: `utils/songFilter.js`, `utils/songFilter.test.js`, `utils/commandParser.js`, `utils/commandParser.test.js`, `hooks/useLibrary.js`.

## Slice 10: button wording

- [x] **Task 22: "Clear filter" button** (built; not yet checked by hand)
  - Does: every filter bar's button now reads "Clear filter" (it was "Show all songs / albums / artists / playlists"). "Clear filter" is the `FilterBar` default, so the per-tab text props are removed.
  - Verify: `npm run build`; by hand on each tab.
  - Files: `components/FilterBar/FilterBar.jsx`, `components/FilterBar/QueryFilterBar.jsx`, and one-line removals in the six tab components.

Open question from the same request ("have the playlists auto show like songs, albums and artists"): read as "typing `playlist=` shows the dropdown of playlist names", which Task 21 already does. If the request meant "switch to the Playlists tab automatically when `playlist=` is used", that is not built.

## Bug fix: `playlist=` found nothing after editing a playlist

- [x] **Task 23: Keep playlist tags fresh** (built; not yet checked by hand)
  - Reported: `/library playlist=hi` showed no songs, and `| show=playlist` showed no playlist.
  - Cause (confirmed from the playlist file's modified time vs the app's start time): the playlist was edited in the running app, and the playlist editor saved changes without refreshing the cached library. Song tags are computed when the library loads, so they did not know about the edit. The earlier "restart the app" guess was wrong.
  - Fix: adding, removing, renaming or deleting in the playlist editor now drops the cached library, so the next page reloads it with fresh tags (the same pattern `useSongActions` uses). Also, `useLibrary` no longer reuses a cached library that has not had its playlists attached yet.
  - Side effect: returning to the Library or Player after a playlist edit reloads the library (a brief loading state).
  - Verify: by hand: edit a playlist, go back, run `/library playlist=<name>` and `| show=playlist`.
  - Files: `pages/PlaylistEdit/usePlaylistEdit.js`, `pages/PlaylistEdit/PlaylistEdit.jsx`, `hooks/useLibrary.js`.

## Slice 11: pre-fill the command for the current page

- [x] **Task 24: `/` pre-fills `library ` or `player `** (built; not yet checked by hand)
  - Does: pressing `/` on the Library opens the bar holding `library `; on the Player (and its album, artist and playlist detail pages) it holds `player `; on other pages it opens empty. Reuses `formatCommand`.
  - Also: the bar no longer navigates until the text differs from what it opened with, so pressing `/` does not clear the page's current filter or switch its tab.
  - Acceptance: on the Library with a filter active, `/` shows `library ` and the filter is untouched until you type; Shift+Tab still swaps to `player `; on Upload the bar opens empty.
  - Verify: `npm test`, `npm run build`; by hand.
  - Files: `components/CommandBar/CommandBar.jsx`, `hooks/useCommandBar.js`, `utils/commandParser.test.js`.
