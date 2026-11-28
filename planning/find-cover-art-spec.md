# Spec: Edit Cover Art

Status: **APPROVED 2026-11-28**. Intent confirmed by interview on 2026-11-28.

## Objective

In the Library (View) page, an "Edit Cover Art" option on any album or artist opens a small modal. It shows real images found online; I pick one and it becomes the cover. Fun avatars can always be added to the choices.

User: me, tidying my library. Why: the automatic lookup sometimes finds nothing or the wrong image, and there is no manual fix today.

## What the code looks like today (verified)

- **Albums** are fetched from Cover Art Archive by MusicBrainz ID. Deezer is tried only if that fails. **Artists** are fetched from Deezer by name. Both take the first result only.
- Covers are saved as `{library}/jp3/assets/albums/{hash}.jpg` and `.../artists/{hash}.jpg`. The hash comes from `cover_filename(artist, album)` in `cover_art_service.rs` (artists use the literal `"artist"` as the second part).
- `download_image(url)` and `save_cover_image(url, dir, filename)` in `cover_art_service.rs` already download a URL and write the `.jpg`. They are private to that file.
- `CoverArt.jsx` keeps an in-memory `blobUrlCache`. Only `clearCoverArtCache()` (clears everything) is exported; there is no way to drop one entry.
- `coverArtNotFoundStore.js` remembers "not found" for 3 days, then lets the automatic lookup retry. It already exports `markAlbumCoverNotFound` / `markArtistCoverNotFound` and `removeAlbumNotFound` / `removeArtistNotFound`.
- **Library albums tab** (`AlbumView.jsx`): `CardList` rows with a `getActions` menu: `Edit Album`, `Delete Album`.
- **Library artists tab** (`ArtistView.jsx`): left-click on an `ArtistCard` shows `Go to Artist`, `Edit Artist`, `Delete Artist` from `getActions`.
- `View.jsx` owns the edit/delete modals and passes `onEditAlbum`, `onEditArtist` etc. down through `TabContent.jsx`.
- `ConfirmModal` is a reusable modal that renders `children` between the message and the buttons.
- The header's "♻ CoverArt" button deletes **every** cached `.jpg` and re-fetches automatically.
- `tauri.conf.json` has `"csp": null`, so the modal can show remote thumbnails with a plain `<img src>`.
- Rust already has `reqwest` (0.11, json) and `urlencoding`. No new dependencies are needed.

## Research: image sources (all tested live on 2026-11-28, no API key)

| Source | Used for | Call |
|--------|----------|------|
| Deezer | albums, artists | `api.deezer.com/search/album?q=…` and `/search/artist?q=…` |
| iTunes Search | albums only (it has no artist images) | `itunes.apple.com/search?term=…&entity=album`; swap `100x100bb` for `600x600bb` in the URL for a larger image |
| TheAudioDB | artists | `theaudiodb.com/api/v1/json/123/search.php?s=…` (`123` is the public free key; returns thumb, fanart, logo) |
| DiceBear | fun avatars | `api.dicebear.com/9.x/{style}/jpg?seed=…&size=512` returns a JPG |

## Decisions

| # | Decision | Why |
|---|----------|-----|
| 1 | Menu label is **"Edit Cover Art"** on both tabs, placed before the Delete item | Matches `Edit Album` / `Edit Artist` |
| 2 | Both tabs use their **existing click menus** (`getActions`). No right-click menus | Smallest change; that is where edits already happen |
| 3 | New Rust command `search_cover_candidates(kind, artist, album)` returns up to 8 `{ url, thumbUrl, source }`, de-duplicated by URL. `kind` is `"album"` or `"artist"` | One call for the modal. Rust already owns all HTTP for cover art |
| 4 | Each source is one small function that turns a JSON string into candidates. If one source fails, the others still return | Pure functions are easy to unit test with a saved JSON sample, with no network |
| 5 | New Rust command `set_cover_from_url(basePath, kind, artist, album, url)` downloads the image and overwrites the existing `{hash}.jpg`, reusing `save_cover_image` and `cover_filename` | No new storage. `CoverArt` reads the same file as before |
| 6 | `set_cover_from_url` only accepts `https` URLs whose host is on a short allow-list (Deezer, Apple, TheAudioDB, DiceBear image hosts) | The command downloads whatever URL it is given, so it must not be usable to fetch arbitrary addresses |
| 7 | After saving: remove the "not found" entry, drop that one entry from `blobUrlCache` via a new small export in `CoverArt.jsx`, then refresh the library so the cover re-mounts | Same refresh approach the "♻ CoverArt" button uses, but for one cover |
| 8 | New `components/CoverArtPicker/` (component + CSS module + barrel export), built on `ConfirmModal` with the image grid as `children`. Loading and searching live in `hooks/useCoverCandidates.js` | Reuse the modal; keep the component small per AGENTS.md |
| 9 | Click an image to select it, then **Save**. Cancel or clicking outside changes nothing | Avoids saving by accident |
| 10 | A "Show fun avatars" button is **always** offered once the search has finished. It adds the avatars after any real images, then hides | Changed 2026-11-28 after trying the app: Jay wants avatars available regardless |
| 11 | Avatar URLs are built in the frontend by a pure function `utils/avatarCandidates.js`: 5 styles (`pixel-art`, `personas`, `open-peeps`, `croodles`, `big-ears`) × 2 seeds = 10 avatars. Seed is the artist name (artist) or `artist + album` (album) | No backend call needed to list them; the same name always gives the same avatars; easy to unit test |
| 12 | Avatars are saved through the same `set_cover_from_url` | One save path |
| 13 | Offline fallback: if DiceBear cannot be reached, show the bundled images that already exist (`assets/artist_placeholders/0-3.png` and `assets/icon_placeholder/album_placeholder.png`). Saving one needs a second small command `set_cover_from_bytes` because they are local files, not URLs | Confirmed 2026-11-28: stays in this feature. Kept as the last slice because it is the only part needing an extra command |
| 14 | The modal **always** shows a "No cover" tile, for albums and artists. Saving it deletes the cached `.jpg` (new command `remove_cover`) so the generic placeholder shows again | Requested 2026-11-28 |
| 15 | **Remove the 3-day expiry** from `coverArtNotFoundStore.js` (`EXPIRATION_MS`, `isExpired`, the startup cleanup and `cleanupExpiredEntries`). A "not found" entry now stays until the cover is set by hand, a new song is uploaded for that album/artist, or "♻ CoverArt" is pressed. "No cover" then simply reuses the existing `markAlbumCoverNotFound` / `markArtistCoverNotFound` | Requested 2026-11-28: retrying automatically is no longer needed now that a cover can be set by hand. It also makes "No cover" stick with no new store code |
| 16 | The "♻ CoverArt" button still wipes everything, including manual picks and "No cover" choices | Accepted 2026-11-28. Remembering manual picks is a later ticket |
| 17 | Avatars are offered for albums as well as artists | Confirmed 2026-11-28 |

## Behaviour

| Action | Result |
|--------|--------|
| Albums tab → row menu → Edit Cover Art | Modal opens titled with the album name, shows "Searching…", then up to 8 images |
| Artists tab → click artist → Edit Cover Art | Same, for the artist |
| Click an image | It is highlighted; Save becomes enabled |
| Save | Image is downloaded and replaces the cover; modal closes; the new cover shows without restarting; toast "Cover art updated" |
| Cancel / click outside | Modal closes; nothing changes |
| No real images found | Message "No cover art found" |
| Show fun avatars (always offered after the search) | 10 DiceBear avatars are added after any real images, selectable and saved the same way |
| DiceBear unreachable | Bundled placeholder images are shown instead |
| Select "No cover" → Save | The cover is removed and the generic placeholder shows; it stays that way after restart and after 3 days |
| Search or save fails | Error toast; the existing cover is left untouched |

## Tech stack

Tauri 2, React 18, Vite 6, Vitest 5, Rust with `reqwest` 0.11. **No new dependencies.**

## Commands (run from `jp3_organiser/`)

```bash
npm test                              # Vitest (frontend unit tests)
npm run build                         # Frontend production build
npm run tauri dev                     # Run the full app for manual checks
cd src-tauri && cargo test cover_art  # Rust tests for this feature
cd src-tauri && cargo check           # Rust type check
```

## Project structure

```
src-tauri/src/services/cover_art_service.rs   → candidate search, host allow-list, save (extended)
src-tauri/src/commands/cover_art.rs           → search_cover_candidates, set_cover_from_url, remove_cover (new commands)
src-tauri/src/lib.rs                          → register the new commands
src/services/coverArtService.js               → invoke wrappers (extended)
src/utils/avatarCandidates.js (+ .test.js)    → DiceBear URL builder (new)
src/hooks/useCoverCandidates.js               → search / select / save state (new)
src/services/coverArtNotFoundStore.js         → remove the 3-day expiry (code deleted)
src/components/CoverArtPicker/                → modal (new)
src/components/CoverArt/CoverArt.jsx          → export to drop one cached cover (small addition)
src/pages/View/View.jsx                       → owns the picker modal, like the edit modals
src/pages/View/components/Tabs/…              → pass onEditCover; add the menu item
```

## Code style

Follow AGENTS.md. Menu items follow the existing shape:

```jsx
const getActions = useCallback((album) => [
  { label: 'Edit Album', onClick: () => onEditAlbum?.(album) },
  { label: 'Edit Cover Art', onClick: () => onEditCover?.(album) },
  { label: 'Delete Album', onClick: () => onDeleteAlbum?.(album), variant: 'danger' },
], [onEditAlbum, onEditCover, onDeleteAlbum]);
```

Rust parsing functions are pure (`fn parse_deezer_albums(body: &str) -> Vec<CoverCandidate>`), with HTTP kept in a thin wrapper.

## Testing strategy

- **Rust unit tests** (in `cover_art_service.rs`): each parser against a small saved JSON sample; an empty or malformed body returns an empty list; the allow-list accepts the four hosts and rejects `http://`, other hosts and look-alike hosts. No test touches the network.
- **Vitest**: `avatarCandidates.test.js` checks 10 URLs, the 5 allowed styles only, same input gives same output, and names with spaces or symbols are encoded.
- **Manual** (`npm run tauri dev`): the Behaviour table above, once for an album and once for an artist.

## Boundaries

- **Always:** reuse `cover_filename`, `save_cover_image`, `ConfirmModal`, `getActions`; keep each slice small with its own mini ticket; run the commands above before calling a slice done.
- **Ask first:** adding any dependency; changing the automatic lookup in `CoverArt.jsx` beyond decision 15; changing what the "♻ CoverArt" button does.
- **Never:** push or open a PR (Jay approved one local commit per task on 2026-11-28; the `wlp-controls` hook blocks agent commits, so Jay commits); add an API that needs a key or account; touch the Player page.

## Out of scope

Player page, right-click menus, songs and playlists, uploading your own image file, changing where the automatic lookup searches (only its 3-day retry is removed), a shuffle button for more avatars.

## Success criteria

1. Both Library tabs show "Edit Cover Art" in their existing menus.
2. For an album and an artist that exist online, the modal shows at least one real image, and saving it replaces the cover on screen without a restart.
3. The new cover is still there after restarting the app.
4. For a made-up name, the modal shows "No cover art found" and the avatars button; a chosen avatar saves the same way.
5. `set_cover_from_url` rejects a URL outside the allow-list.
6. "No cover" is always offered; choosing it shows the generic placeholder, and the old cover does not come back by itself.
7. `npm test`, `npm run build` and `cargo test cover_art` pass.

## Proposed slices (detail comes in the plan phase)

| # | Slice | What you can see when it is done |
|---|-------|----------------------------------|
| 1 | Rust: `search_cover_candidates` for albums (Deezer + iTunes) | Tests pass; command returns candidates |
| 2 | Rust: add artists (Deezer + TheAudioDB) | Tests pass |
| 3 | Rust: `set_cover_from_url` with the host allow-list | Tests pass |
| 4 | Frontend: `CoverArtPicker` modal wired to the Albums tab, including the cover refresh | Album covers can be changed end to end |
| 5 | Frontend: wire the Artists tab | Artist covers can be changed |
| 6 | Remove the 3-day expiry from `coverArtNotFoundStore.js` | A cover that was not found is no longer re-searched after 3 days |
| 7 | "No cover" tile: `remove_cover` command, then mark as not found | A cover can be reset to the placeholder and stays reset |
| 8 | Avatars: `avatarCandidates.js` and the "Show fun avatars" step | Avatars can be added to the choices |
| 9 | Offline fallback with bundled placeholders (`set_cover_from_bytes`) | Works with no internet |

## Mini ticket (copy and paste)

**Title:** Edit Cover Art from the Library

**As a** library owner **I want** to pick a cover image for any album or artist **so that** missing or wrong covers can be fixed by hand.

**Acceptance criteria**
- Albums tab row menu and Artists tab click menu both have "Edit Cover Art".
- The modal shows up to 8 real images (albums: Deezer, iTunes; artists: Deezer, TheAudioDB).
- Selecting an image and pressing Save replaces the cover immediately and after restart.
- A "Show fun avatars" button, always offered, adds 10 DiceBear avatars (pixel-art, personas, open-peeps, croodles, big-ears).
- A "No cover" option is always shown; choosing it resets to the generic placeholder and it stays reset.
- With no internet, bundled placeholder images are offered instead.
- Only image URLs from the four known hosts can be saved.

**Out of scope:** Player page, right-click menus, songs, playlists, uploading a file.

## Changes made while building (2026-11-28)

- **Cover refresh uses an event, not a library refresh.** A library refresh does not re-mount covers, so `refreshCover()` in `CoverArt.jsx` drops the cached image and fires `coverart-updated`; mounted `CoverArt` components showing that cover reload it. This replaces decision 7's "refresh the library" step.
- **`set_cover_from_url` returns nothing on success** and an error message on failure, instead of the `FetchCoverResult` shape. Nothing used the path.
- **Deezer artist results are filtered to the exact artist name.** Its search also returns related artists (searching Radiohead returned Blur and others).
- **Deezer's blank "no picture" image is skipped**, so empty tiles never show.
- **TheAudioDB offers thumb, fanart 1 to 3 and logo.**
- **`ConfirmModal` gained an optional `confirmDisabled` prop** so Save stays disabled until an image is selected.
- **Frontend tests follow AGENTS.md** (logic only, no component tests): `avatarCandidates`, `useCoverCandidates` and `coverArtNotFoundStore`. The Rust parser tests live inside `cover_art_service.rs` because the parsers are private.

## Open questions

None. Answered 2026-11-28: see decisions 13 to 17.
