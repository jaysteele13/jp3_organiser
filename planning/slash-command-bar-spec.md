# Spec: Slash command bar (slice 1)

Status: **APPROVED 2026-11-27**. Intent comes from `planning/slash-command-bar.md`.

## Objective

Pressing `/` anywhere opens a command bar. Typing `l` or `p` suggests `library` or `player`; Tab completes it. Typing plain text and pressing Enter goes to that page showing only songs whose title, artist or album contains it. Esc closes the bar.

User: me, navigating by keyboard. This is the foundation for a later `key=value` query language.

## What the code looks like today (verified)

- `utils/commandParser.js` already exists (uncommitted) with `parseCommand` and `suggestCommand`, plus 3 passing Vitest tests. `library` maps to `/view`, `player` maps to `/player`.
- **Neither page can filter songs by text yet.** `SongView` only filters to one exact song by id (`song.id === songFilter.id`). The Player `SongList` passes every song to `SongTable`, which has no search. So text filtering is new work, not reuse.
- `LibrarySearch` is a dropdown that picks one item. It is not reused here (a live results list is out of scope).
- `FilterBar` (label + "Show all" button) is reused to show the active filter.
- `useKeyboardShortcut` always swallows the key, even inside a text box. Used as-is for `/` it would stop you typing `/` in any input.
- `usePlayerKeyboardShortcuts.js` has a private `isInputElement(target)` helper that already answers "is the cursor in a text box?".
- Player already reads `?tab=` from the URL with `useSearchParams`. View uses `location.state`.

## Decisions

| # | Decision | Why |
|---|----------|-----|
| 1 | The filter text travels in the URL: `/view?q=drivers` and `/player?tab=<songs>&q=drivers` | One mechanism for both pages, Player already uses URL params, and the filter is visible and survives a refresh |
| 2 | Plain text matches if the song's title, artist name **or** album name contains it, case-insensitive, in a new pure function `filterSongsByText(songs, text)` in `utils/` | Typing `olivia` shows everything for Olivia, the same fields `LibrarySearch` uses. Narrowing to one field (`title=olivia`) is the later `key=value` ticket. One function shared by both pages; easy to unit test |
| 9 | `View.jsx` (388 lines) gets a one-word change only (the tab-sync effect now runs on every navigation, not just when the tab name changes). The song lists (`SongView`, `SongList`) read `?q=` themselves through one small shared hook, `useTextFilter` | Nothing is threaded through `View.jsx`. The one-word change is needed so a second `/library ...` typed from another tab switches back to Songs |
| 10 | Player's active tab is read straight from the URL instead of being copied into state | Today the tab is only read once on load, so `/player ...` typed while already on the Player would not switch to Songs. Deriving it removes a `useState` rather than adding a sync effect |
| 3 | `/` is ignored while the cursor is in an input, textarea, select or editable element | Otherwise you cannot type `/` in a form. Move `isInputElement` to `utils/` and add an `ignoreInInputs` option to `useKeyboardShortcut` |
| 4 | New `components/CommandBar/` (component + CSS module + barrel export) with its logic in `hooks/useCommandBar.js`, mounted once in `AppLayout` | Follows AGENTS.md: logic in hooks, component stays small |
| 5 | The active filter shows in the existing `FilterBar` as `"drivers"`; "Show all" removes `q` from the URL | Reuse; gives a way out by mouse |
| 6 | Enter with an unknown command keeps the bar open and shows "Unknown command" | Nothing surprising happens |
| 7 | Enter with a command but no text (`/library`) just goes to the page, unfiltered | Useful as plain navigation |
| 8 | Tab completes to the command plus a space (`library `) so you can keep typing | Fewer keystrokes |

## Behaviour

| Typed | Result |
|-------|--------|
| `/` (not in a text box) | Bar opens, focused, showing `/` |
| `/` (in a text box) | A normal `/` is typed; bar does not open |
| `l` | Greyed suggestion `library` |
| Tab | Input becomes `library ` |
| `library drivers` + Enter | `/view?q=drivers`, Songs tab, only songs whose title, artist or album contains "drivers", FilterBar shows `"drivers"` |
| `player olivia` + Enter | Player Songs tab, every song by Olivia (plus any title or album containing "olivia"), FilterBar shows `"olivia"` |
| `settings x` + Enter | Bar stays open, "Unknown command" |
| Esc | Bar closes, page unchanged |

## Tech stack

React 18, react-router-dom 7, Vite 6, Tauri 2, Vitest 5. No new dependencies.

## Commands (run from `jp3_organiser/`)

```
Test:  npm test
Build: npm run build
Dev:   npm run tauri dev
```

## Project structure

```
src/utils/commandParser.js          existing - parse + suggest
src/utils/songFilter.js             new - filterSongsByText (+ songFilter.test.js)
src/utils/dom.js                    new - isInputElement moved here
src/hooks/useKeyboardShortcut.js    edit - ignoreInInputs option
src/hooks/useCommandBar.js          new - open/close, input, Tab, Enter, Esc
src/components/CommandBar/          new - CommandBar.jsx, .module.css, index.js
src/hooks/useTextFilter.js          new - read / clear ?q=
src/App.jsx                         edit - mount CommandBar in AppLayout
src/pages/View/.../SongView.jsx     edit - filter by ?q=, show FilterBar
src/pages/Player/Player.jsx         edit - active tab derived from URL
src/pages/Player/.../SongList.jsx   edit - filter by ?q=, show FilterBar
```

Plan and tasks: `tasks/plan.md`, `tasks/todo.md`.

## Code style

Follow `jp3_organiser/AGENTS.md`: max 250 lines and 5 `useState` per component, CSS variables only, barrel exports. Match the existing parser:

```js
/**
 * Keep songs whose title, artist or album contains the text (case-insensitive).
 * @param {Array} songs
 * @param {string} text
 */
export function filterSongsByText(songs, text) {
  const query = text.trim().toLowerCase();
  if (!query) return songs;
  return songs.filter((song) =>
    [song.title, song.artistName, song.albumName].some((field) => field?.toLowerCase().includes(query))
  );
}
```

## Testing strategy

- Vitest on pure logic in `utils/` only, test file beside the code, about 3 tests per file (per AGENTS.md).
- New tests: `songFilter.test.js` (match, no match, empty text returns all).
- No component tests. The bar and pages are checked by hand against the Behaviour table in `npm run tauri dev`.

## Boundaries

- **Always:** run `npm test` and `npm run build` after each slice; keep each slice to about 5 files; explain each change at a high level.
- **Ask first:** new dependencies; changing `LibrarySearch`, `SongTable` or Rust code; changing what `library` / `player` map to.
- **Never:** `git add`, commit or open a PR; build anything in "Out of scope".

## Out of scope (later tickets)

`genre=` (songs have no genre; see Slice 2), value autocomplete, wildcards and regex, a live results list in the bar, playing a song from the bar, refactoring `View.jsx`.

## Slice 2: key=value filters (added 2026-11-27)

Requested after slice 1: "type in keys like artist, album, title, genre, year".

| Typed after the command | Result |
|-------------------------|--------|
| `title=olivia` | Only songs whose title contains "olivia" |
| `artist=olivia` | Only songs whose artist contains "olivia" |
| `album=sour` | Only songs whose album contains "sour" |
| `year=2021` | Only songs from albums dated 2021 (`year=202` gives the 2020s) |
| `olivia year=2021` | Both must match: any field contains "olivia" **and** year contains "2021" |
| `ar` then Tab | Completes to `artist=` |

Decisions:

- **Terms are split on spaces and every term must match.** So `artist=olivia rodrigo` means artist contains "olivia" and any field contains "rodrigo". No quotes syntax.
- **Plain words now also check the year**, and multi-word plain text matches word by word rather than as one phrase (`olivia sour` now finds Olivia's songs on SOUR).
- **`genre=` is not supported.** The library stores no genre for a song, album or artist, so there is nothing to filter. Adding it means changing the Rust library format and the upload flow: its own ticket. Until then `genre=pop` matches nothing.
- **No new files and no page changes.** The whole query still travels in `?q=`; only `filterSongsByText` learned the syntax, and the bar's Tab completion learned the keys (`FILTER_KEYS` in `utils/songFilter.js` is the single list).

### Mini ticket (copy and paste)

**Title:** Command bar: `title=`, `artist=`, `album=`, `year=` filters

**As** a keyboard user, **I want** to type `key=value` in the command bar, **so that** I can narrow songs by one field instead of all of them.

**Acceptance criteria**
- `title=`, `artist=`, `album=` and `year=` each match only that field, ignoring case.
- Several terms can be combined; every term must match.
- Typing the start of a key suggests it; Tab completes it with `=`.
- Plain text still matches any field.

**Out of scope:** `genre=` (no genre data exists), quoted values with spaces, wildcards, value autocomplete.

## Slice 3: live filtering, value dropdown, history (built 2026-11-27, not yet checked by hand)

Plan: "Phase 2" in `tasks/plan.md`. Tasks 8-12 in `tasks/todo.md`. This supersedes three earlier "out of scope" items: live results, value autocomplete and quoted values.

### Mini tickets (copy and paste)

**Title:** Command bar: results update as you type

**As** a keyboard user, **I want** the page to open as soon as I type `library` or `player` and the songs to narrow as I type, **so that** I see results without pressing Enter.

**Acceptance criteria**
- Completing the command word opens that page's Songs tab.
- Each change to the text updates the list after a short pause.
- Back returns to the page I started on, not to each keystroke.

---

**Title:** Command bar: pick an artist or album from a dropdown

**As** a keyboard user, **I want** a list of matching names after `artist=` or `album=`, **so that** I don't have to remember or type a full name.

**Acceptance criteria**
- The list shows up to 6 matches and narrows as I type.
- Up / Down highlight; Tab or Enter inserts the name.
- Names with spaces are inserted in quotes and filter correctly.

---

**Title:** Command bar: search history

**As** a keyboard user, **I want** Up and Down in the bar to step through my previous searches, **so that** I can repeat one quickly.

**Acceptance criteria**
- Each search is saved when I press Enter; newest first, no duplicates, last 20.
- Up / Down step through history when no dropdown is showing.
- History survives restarting the app.

## Slice 4: several values per key, and a dropdown that follows the query (built 2026-11-27, not yet checked by hand)

Requested: "artist=Queen AND sungazer", and "if we have artist=queen when we do album= only queen albums can show".

| Typed after the command | Result |
|-------------------------|--------|
| `artist=queen and sungazer` (or `AND`) | Songs by Queen **or** by Sungazer |
| `artist=queen and sungazer year=1975` | Either artist, and from 1975 |
| `artist=queen album=` | Dropdown lists only Queen's albums |
| `artist=acdc and queen album=` | Dropdown lists both artists' albums |
| `artist=queen and ` | Dropdown lists the other artists (Queen is left out) |
| `title=` | Dropdown lists song titles that fit the rest of the query |

Decisions:

- **"and" between values of one key means "any of these".** A song has one artist, so "Queen and Sungazer at once" would always be empty; the request ("both them artists albums") describes the union.
- **"and" only joins values straight after a `key=value`.** In plain text (`tom and jerry`) it stays an ordinary word. Between two different keys (`artist=queen and year=1975`) it is ignored, because separate keys must all match anyway. To search for the word itself after a key, quote it: `"and"`.
- **The dropdown is built from the songs that match everything else in the bar**, not from the full artist and album lists. That one rule gives the context filtering, and means every key gets a dropdown (`title=` and `year=` too) with no extra code.
- **No "or" keyword and no `artists=` plural.** Not requested; `artists=queen` is treated as plain text.

### Mini ticket (copy and paste)

**Title:** Command bar: several values per key, and context-aware dropdown

**As** a keyboard user, **I want** to give a key several values and have the dropdown only offer names that fit what I have already typed, **so that** I can build a precise filter quickly.

**Acceptance criteria**
- `artist=a and b` (any case of "and") shows songs matching either value.
- The dropdown after `key=` only lists values from songs matching the rest of the query.
- After `and`, the dropdown offers further values for the same key, excluding ones already chosen.
- Titles, albums, artists and years all get a dropdown.

**Out of scope:** an "or" keyword, brackets, "not".

## Slice 5: switch command with Shift+Tab (built 2026-11-27, not yet checked by hand)

Shift+Tab in the bar swaps the command word between `library` and `player` and keeps the rest of the query, so the same filter opens on the other page. With an empty or unrecognised command it gives `library `.

### Mini ticket (copy and paste)

**Title:** Command bar: Shift+Tab switches between library and player

**As** a keyboard user, **I want** Shift+Tab to swap the command, **so that** I can take the same search from the Library to the Player without retyping it.

**Acceptance criteria**
- Shift+Tab changes `library <query>` to `player <query>` and back.
- The other page opens with the same filter applied.
- With no command typed, Shift+Tab enters `library `.

## Slice 6: "|" lines and `show=` (built 2026-11-27, not yet checked by hand)

Requested: typing `|` makes a new line in the bar, and `| show=artist` (or `album`) shows that screen for the query.

```
/library artist=Queen and ACDC
| show=artist
```

| Typed | Result |
|-------|--------|
| `\|` after a command | A new line starting `\| ` |
| `sh` then Tab | Completes to `show=` and lists `song`, `album`, `artist` |
| `\| show=artist` | Artists tab, only artists with a song matching the query |
| `\| show=album` | Albums tab, only albums with a song matching the query |
| no `show=`, or an unknown value | Songs tab, as before |

Decisions:

- **Everything before the first `|` is the query; lines after it are instructions.** Only `show=` exists so far. This is the place for future ones (sort, limit, play).
- **The bar's input became a multi-line text box.** Enter still runs the search and never adds a line; only `|` does.
- **An artist or album is shown when at least one of its songs matches the query.** So `year=1975 | show=artist` lists artists with a 1975 song. One shared function, `filterByQuery`, does this for all four tabs (Library and Player, Artists and Albums).
- **`show=artists` / `albums` / `songs` (plural) also work.**
- **`show=playlist` (added after review):** opens the Playlists tab with only the playlists that contain at least one matching song (`filterPlaylistsByQuery`).
- **Not included:** a `|` inside a quoted value.

### Mini ticket (copy and paste)

**Title:** Command bar: `|` lines and `show=artist` / `show=album`

**As** a keyboard user, **I want** to add `| show=artist` or `| show=album` on a new line, **so that** I can see the artists or albums for a query instead of the songs.

**Acceptance criteria**
- Typing `|` starts a new line in the bar; Enter still runs the search.
- `show=artist` opens the Artists tab and `show=album` the Albums tab, on both Library and Player.
- Those tabs list only entries with at least one song matching the query, and show the active filter with a way to clear it.
- `show=` Tab-completes and offers its values in the dropdown.

**Out of scope:** other `|` instructions (sort, limit).

---

**Title:** Command bar: `show=playlist`

**As** a keyboard user, **I want** `| show=playlist`, **so that** I can see which playlists contain the songs I searched for.

**Acceptance criteria**
- `show=playlist` (or `playlists`) opens the Playlists tab on Library and Player.
- Only playlists containing at least one song matching the query are listed, with the active filter shown and clearable.
- `playlist` appears in the `show=` dropdown.

## Slice 7: remove the old search box (built 2026-11-27, not yet checked by hand)

Requested: the "Search playlists, artists, albums, songs" box should go from the Player and the Library, now that the slash command does the searching.

- The search box and its four select handlers are removed from `Player.jsx` and `View.jsx`.
- `components/LibrarySearch/` (4 files) and `hooks/useLibrarySearch.js` had no other users, so they are deleted. They are tracked in git and can be restored with `git restore`.
- **Behaviour that went with it:** from the Player's box you could pick a song to play it at once, or pick an album, artist or playlist to jump to its detail page. The slash bar filters lists instead; "playing a song from the bar" is still on the out-of-scope list.
- Not affected: the Player's "View in Library" links (they use `View.jsx`'s single-item filter, which stays) and the playlist editor's own search.

### Mini ticket (copy and paste)

**Title:** Remove the search box from Player and Library

**As** a user, **I want** one way to search (the `/` command bar), **so that** the toolbar is simpler and there are not two searches that behave differently.

**Acceptance criteria**
- The search box no longer appears on the Player or Library toolbar.
- The unused `LibrarySearch` component and `useLibrarySearch` hook are deleted.
- Tabs, "View in Library" links and the playlist editor search still work.

## Slice 8: edit the active filter (built 2026-11-27, not yet checked by hand)

Requested: where the page says `Showing: "query"`, it should be editable as if it were the `/` command.

- The filter bar now shows the full command that produced it, e.g. `Showing: /library artist=queen | show=album`.
- Clicking that text opens the command bar pre-filled with the command, cursor at the end, so completion, dropdowns, history and live results all work while editing. Nothing about editing is reimplemented.
- One shared component, `QueryFilterBar`, replaces six copies of the same three lines across the song, artist, album and playlist tabs.
- The filter bar tells the command bar to open through a window event (`EDIT_COMMAND_EVENT`), the same pattern `View.jsx` already uses for cover art errors, because the two sit in different parts of the page.
- Limit: the bar's suggestions follow the end of the text, so editing in the middle of a command gets no completion.

### Mini ticket (copy and paste)

**Title:** Click the active filter to edit it in the command bar

**As** a keyboard-and-mouse user, **I want** to click the "Showing:" text, **so that** I can tweak the current search instead of retyping it.

**Acceptance criteria**
- The filter bar shows the full command, including `| show=` when not on Songs.
- Clicking it opens the command bar holding that command, cursor at the end.
- Editing updates the results live; "Show all" still clears the filter.

## Success criteria

1. Every row of the Behaviour table works in the running app.
2. `npm test` passes, including the new `filterSongsByText` tests.
3. `npm run build` succeeds.
4. Existing behaviour is unchanged: Ctrl+S nav toggle, player shortcuts, `LibrarySearch`, and Player-to-View "filter by this song" links.
5. No component over 250 lines or 5 `useState`.

## Proposed slices (detail comes in the plan phase)

1. Parser - **already done** (uncommitted).
2. `filterSongsByText` + tests.
3. `/` shortcut that respects text boxes (`isInputElement`, `ignoreInInputs`).
4. `CommandBar` + `useCommandBar`: open, type, suggest, Tab, Esc, Enter navigates.
5. Library page reads `?q=` and filters.
6. Player page reads `?q=` and filters.

## Mini ticket (copy and paste)

**Title:** Slash command bar: `/library <text>` and `/player <text>`

**As** a keyboard user, **I want** to press `/` and type `library <song>` or `player <song>`, **so that** I land on that page showing only matching songs.

**Acceptance criteria**
- `/` opens the bar unless the cursor is in a text box; Esc closes it.
- Typing the start of a command suggests it; Tab completes it.
- Enter on `library <text>` / `player <text>` opens that page's song list filtered to songs whose title, artist or album contains the text.
- The active filter is shown and can be cleared.
- An unknown command shows "Unknown command" and does nothing else.

**Out of scope:** `key=value` filters, autocomplete of values, wildcards, live results, play from the bar.

## Open questions

None. Answered on 2026-11-27:

1. Plain text matches title, artist and album. Field-specific matching (`title=olivia`) is a later ticket.
2. `View.jsx` gets a one-word change only (decision 9).
3. Layouts where `/` needs Shift are not a concern.
