# Refactor Prompt: View.jsx (incremental, low-context-budget mode)

## Role & constraints

You are refactoring a single React component: `View.jsx` (and its rendered
children where noted). You have a **small context window** — do not attempt
to hold the whole plan in working memory at once. Work through the phases
below **one at a time, in order**. Each phase is self-contained: it tells you
exactly which files to open, what to change, and what "done" looks like.

Hard rules for every phase:
1. **Read before you write.** Open only the file(s) named in the phase.
   Do not re-read or re-summarize files from earlier phases unless the
   current phase explicitly names them.
2. **One phase, one commit.** Do not start the next phase's changes in the
   same pass. Stop after each phase and report what changed.
3. **No unrelated cleanup.** If you notice unrelated issues (typos, unused
   imports, style nits) outside the scope of the current phase, leave a
   `// TODO:` comment instead of fixing it inline. Do not expand scope.
4. **Preserve behavior exactly.** Every phase must be behavior-preserving
   (a refactor, not a feature change). If a phase seems to require a
   behavior change to work, stop and flag it instead of guessing.
5. **After each phase**, output a short diff summary (files touched,
   lines changed, one sentence on what moved where) — not the full file
   unless asked.
6. **Do not proceed to the next phase until told to.** End your turn after
   each phase's summary.

---

## Phase 1 — Extract `pluralize` utility

**Files:** `View.jsx` only (create a new small util file if the project
already has a `utils/` folder — check for one first; otherwise define it
locally at the top of `View.jsx`).

**Task:**
- Create `pluralize(n, word) => \`${n} ${word}${n !== 1 ? 's' : ''}\``.
- Replace every inline `${n} word${n !== 1 ? 's' : ''}` pattern in
  `View.jsx` with a call to `pluralize`. There are occurrences in:
  - `handleConfirmDeleteSong` (via `deleteSongs` result, if present)
  - `handleConfirmDeleteAlbum`
  - `handleConfirmDeleteArtist` (two occurrences — songs affected AND
    albums affected, check both)
  - `handleConfirmEditAlbum`
  - `handleConfirmEditArtist` (two occurrences)
- Do not touch any other handler logic.

**Done when:** all pluralized toast strings use the helper, and the
toast text produced is byte-for-byte identical to before for both
singular and plural cases.

---

## Phase 2 — Consolidate the four filter states into one

**Files:** `View.jsx`. You will also need to open
`components/Tabs/TabContent.jsx` to update its filter props — read it
first to see exactly which props it destructures before changing anything.

**Task:**
- Replace `songFilter`, `albumFilter`, `artistFilter`, `playlistFilter`
  (four `useState`s) with a single:
  ```js
  const [filter, setFilter] = useState(null); // { type: 'song'|'album'|'artist'|'playlist', value } | null
  ```
- Rewrite `clearAllFilters` to `setFilter(null)`.
- Rewrite `handleSelectSong/Album/Artist/Playlist` to call
  `setFilter({ type: '...', value })` then `setActiveTab(...)`. Consider a
  small shared helper `selectAndSwitchTab(type, value, tab)` to avoid
  repeating the two-line body four times — but only do this if it doesn't
  require touching more than these four handlers.
- Update the "navigate from Player" `useEffect` (the one reading
  `location.state.filterSong` / `filterAlbum` / `filterArtist` /
  `filterPlaylist`) to set the new consolidated `filter` state instead of
  four separate setters.
- Update the JSX where `songFilter`, `albumFilter`, etc. are passed to
  `TabContent`, and the four `onClear*Filter` callbacks, to match
  whatever prop shape `TabContent` expects. **If `TabContent` expects four
  separate filter props, do NOT change `TabContent`'s interface — instead
  derive the four values from `filter` at the call site**, e.g.:
  ```js
  songFilter={filter?.type === 'song' ? filter.value : null}
  ```
  This keeps the blast radius contained to `View.jsx`. Only refactor
  `TabContent`'s internals if you're explicitly told to in a later phase.

**Done when:** there is exactly one filter-related `useState` in
`View.jsx`, all four select handlers and the Player-navigation effect use
it, and `TabContent` receives the same props (same names, same shape) it
did before.

---

## Phase 3 — `useEntityModal` hook for delete/edit modal state

**Files:** `View.jsx`, plus a new hook file — check whether the project
has a `hooks/` folder (per the existing `../../hooks` import) and put the
new hook there as `useEntityModal.js`; otherwise define it at the top of
`View.jsx`.

**Task:**
- Create:
  ```js
  function useEntityModal() {
    const [item, setItem] = useState(null);
    const [isOpen, setIsOpen] = useState(false);
    const open = useCallback((entity) => { setItem(entity); setIsOpen(true); }, []);
    const close = useCallback(() => { setItem(null); setIsOpen(false); }, []);
    return { item, isOpen, open, close, setItem, setIsOpen };
  }
  ```
- Replace these six state pairs with `useEntityModal()` instances:
  - `albumToDelete` / `showDeleteAlbumModal` → `albumDelete`
  - `artistToDelete` / `showDeleteArtistModal` → `artistDelete`
  - `albumToEdit` / `showEditAlbumModal` → `albumEdit`
  - `artistToEdit` / `showEditArtistModal` → `artistEdit`
  - Leave `songToEdit`/`showEditModal` and
    `songsToDelete`/`showDeleteModal` **as-is for this phase** — song
    delete/edit have a slightly different shape (array vs single item,
    and an `isDeleting`/`isSaving` flag shared across entities). Handle
    those in Phase 4 if needed, don't force them into this hook now.
- Update `handleDeleteAlbumRequest`, `handleCancelDeleteAlbum`,
  `handleEditAlbumRequest`, `handleCancelEditAlbum`, and the artist
  equivalents to use `.open(...)` / `.close()` instead of the two
  separate setters. Keep the async `handleConfirmDelete*` /
  `handleConfirmEdit*` functions' internal logic (API calls, toasts)
  completely unchanged — only touch the lines that reset modal state at
  the start/end of those functions (e.g. replace
  `setShowDeleteAlbumModal(false); setAlbumToDelete(null);` with
  `albumDelete.close();`).
- Update the JSX where `albumToDelete`, `showDeleteAlbumModal`, etc. are
  referenced (the `ConfirmModal` / `EditAlbumModal` / `EditArtistModal`
  blocks near the bottom of the file) to read from `.item` / `.isOpen`.

**Done when:** album and artist delete/edit modal state each come from
one `useEntityModal()` call instead of two `useState`s, and the rendered
modals behave identically (same open/close/cancel-while-loading guard
behavior).

---

## Phase 4 (optional — do only if asked): apply `useEntityModal` to songs

Song delete takes an **array** (`songsToDelete`) not a single item, and
song edit shares state names slightly differently. This needs a small
variant or a second look before forcing it into the same hook. Do not
attempt this phase unless explicitly instructed — flag it as a follow-up
instead.

---

## Phase 5 (optional — larger, do only if asked): split into per-entity hooks

Extract `useAlbumActions(libraryPath, handleRefresh, toast)`,
`useArtistActions(...)`, `useSongActions(...)` — each bundling that
entity's modal state (from Phase 3/4) with its
request/confirm/cancel handlers. This is the highest-risk, highest-payoff
phase and should only be attempted after Phases 1–3 are verified working,
with the file open side-by-side for careful line-by-line migration.

---

## After each phase, report using this format:

```
### Phase N complete
Files touched: ...
Lines changed: ~N
Summary: one or two sentences
Anything flagged/skipped: ...
```

Then stop and wait for confirmation before starting the next phase.