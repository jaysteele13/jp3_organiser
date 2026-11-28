# Tasks: Edit Cover Art

Plan: `tasks/find-cover-art-plan.md`. Spec: `planning/find-cover-art-spec.md`.

Run from `jp3_organiser/`: `npm test`, `npm run build`, `npm run tauri dev`, and `cd src-tauri && cargo test cover_art`. JS paths are under `jp3_organiser/src/`, Rust paths under `jp3_organiser/src-tauri/src/`. No push or PR. One commit per task was approved, but the `wlp-controls` hook blocks agent commits, so Jay commits. Each task title doubles as its mini ticket title.

## Phase 1: Album covers end to end

- [x] **Task 1: Search album cover candidates** (S)
  - Does: adds `CoverCandidate { url, thumb_url, source }`, pure parsers `parse_deezer_albums` and `parse_itunes_albums`, and the command `search_cover_candidates(kind, artist, album)` (albums only for now), plus the JS wrapper `searchCoverCandidates`.
  - Acceptance:
    - Returns up to 8 candidates, de-duplicated by URL; iTunes URLs use `600x600bb` for `url`.
    - An empty, malformed or failed source gives no candidates from that source and does not fail the command.
  - Verify: `cargo test cover_art` (parser tests on saved JSON, no network); `cargo check`.
  - Depends on: none.
  - Files: `services/cover_art_service.rs`, `commands/cover_art.rs`, `lib.rs`, `services/coverArtService.js`.

- [x] **Task 2: Save a cover from a chosen URL** (S)
  - Does: adds `is_allowed_image_url` and the command `set_cover_from_url(basePath, kind, artist, album, url)`, which overwrites `{hash}.jpg` using `cover_filename` and `save_cover_image`, plus the JS wrapper `setCoverFromUrl`.
  - Acceptance:
    - Accepts `https` URLs on `dzcdn.net`, `mzstatic.com`, `theaudiodb.com`, `api.dicebear.com` (and their subdomains).
    - Rejects `http://`, other hosts and look-alikes such as `evil-dzcdn.net` and `dzcdn.net.evil.com`, without downloading anything.
    - Creates the covers folder if missing; returns nothing on success and an error message on failure.
  - Verify: `cargo test cover_art` (allow-list tests); `cargo check`.
  - Depends on: none.
  - Files: `services/cover_art_service.rs`, `commands/cover_art.rs`, `lib.rs`, `services/coverArtService.js`.

- [x] **Task 3: CoverArtPicker modal** (M)
  - Does: new `components/CoverArtPicker/` built on `ConfirmModal` (image grid as `children`), and `hooks/useCoverCandidates.js` holding search, selection and save.
  - Acceptance:
    - Shows "Searching…", then a grid of thumbnails; clicking one highlights it and enables Save.
    - Empty result shows "No cover art found"; a failed search shows an error message.
    - Colours come from CSS variables; component under 250 lines.
  - Verify: `npm run build`; rendered by hand in Task 4.
  - Depends on: 1, 2.
  - Files: `components/CoverArtPicker/CoverArtPicker.jsx`, `.module.css`, `index.js`, `components/index.js`, `hooks/useCoverCandidates.js`.

- [x] **Task 4: "Edit Cover Art" on the Albums tab** (M)
  - Does: adds the menu item, a `useCoverActions` hook that View uses to open the picker, and a `CoverArt.jsx` export that drops one cached cover so the new image shows.
  - Acceptance:
    - Albums tab row menu reads `Edit Album / Edit Cover Art / Delete Album`.
    - Save replaces the cover on screen without a restart, clears the "not found" entry, and shows the toast "Cover art updated".
    - Cancel or clicking outside changes nothing; a failed save shows an error toast and keeps the old cover.
  - Verify: `npm test`; `npm run build`; by hand in `npm run tauri dev`, then restart and confirm the cover is still there.
  - Depends on: 3.
  - Files: `pages/View/View.jsx`, `pages/View/components/Tabs/TabContent.jsx`, `pages/View/components/Tabs/Albums/AlbumView.jsx`, `hooks/useCoverActions.js` (+ `hooks/index.js`), `components/CoverArt/CoverArt.jsx`.

### Checkpoint A
- [ ] `npm test`, `npm run build`, `cargo test cover_art` pass
- [ ] An album cover can be changed and survives a restart
- [ ] Review with Jay before Phase 2

## Phase 2: Artists and "No cover"

- [x] **Task 5: Search artist cover candidates** (S)
  - Does: adds `parse_deezer_artists` and `parse_theaudiodb_artist` (thumb, fanart, logo) and handles `kind = "artist"` in `search_cover_candidates`.
  - Acceptance:
    - Returns up to 8 de-duplicated candidates; missing image fields are skipped.
    - An unknown `kind` returns an error string.
  - Verify: `cargo test cover_art`.
  - Depends on: 1.
  - Files: `services/cover_art_service.rs`, `commands/cover_art.rs`.

- [x] **Task 6: "Edit Cover Art" on the Artists tab** (S)
  - Does: adds the item to the artist click menu and passes it through `TabContent`.
  - Acceptance:
    - Clicking an artist shows `Go to Artist / Edit Artist / Edit Cover Art / Delete Artist`.
    - Saving updates the round artist image without a restart.
  - Verify: `npm run build`; by hand in `npm run tauri dev`.
  - Depends on: 4, 5.
  - Files: `pages/View/components/Tabs/Artists/ArtistView.jsx`, `pages/View/components/Tabs/TabContent.jsx`, `pages/View/View.jsx`.

- [x] **Task 7: Remove the 3-day "not found" expiry** (XS)
  - Does: deletes `EXPIRATION_MS`, `isExpired`, the startup cleanup and `cleanupExpiredEntries` from `coverArtNotFoundStore.js`, and updates its header comment.
  - Acceptance:
    - `isAlbumCoverNotFound` / `isArtistCoverNotFound` return true for any stored entry, however old.
    - No remaining imports of the deleted functions.
  - Verify: `npm test`; `npm run build`.
  - Depends on: none.
  - Files: `services/coverArtNotFoundStore.js`.

- [x] **Task 8: "No cover" tile** (S)
  - Does: adds the command `remove_cover(basePath, kind, artist, album)` and its wrapper, and a "No cover" tile that is always first in the picker.
  - Acceptance:
    - Selecting "No cover" then Save deletes the cached `.jpg`, marks the item not found, and the generic placeholder shows straight away.
    - It stays reset after a restart; removing a cover that does not exist is not an error.
    - Picking a real image later brings a cover back.
  - Verify: `cargo test cover_art`; `npm run build`; by hand for one album and one artist.
  - Depends on: 4, 7.
  - Files: `commands/cover_art.rs`, `lib.rs`, `services/coverArtService.js`, `hooks/useCoverCandidates.js`, `components/CoverArtPicker/CoverArtPicker.jsx`.

### Checkpoint B
- [ ] All tests and the build pass
- [ ] Artists work; "No cover" resets and stays reset
- [ ] Review with Jay before Phase 3

## Phase 3: Avatars

- [x] **Task 9: Fun avatars** (S)
  - Does: adds `utils/avatarCandidates.js` (5 styles × 2 seeds, JPG, size 512) and a "Show fun avatars" button in the empty state.
  - Acceptance:
    - Exactly 10 URLs using only `pixel-art`, `personas`, `open-peeps`, `croodles`, `big-ears`; same name gives the same URLs; names are URL-encoded.
    - The button is always offered once the search has finished (changed 2026-11-28) and adds avatars after any real images; a chosen avatar saves like any other image.
  - Verify: `npm test` (new `avatarCandidates.test.js`); by hand with a made-up album name.
  - Depends on: 4.
  - Files: `utils/avatarCandidates.js`, `utils/avatarCandidates.test.js`, `hooks/useCoverCandidates.js`, `components/CoverArtPicker/CoverArtPicker.jsx`.

- [x] **Task 10: Bundled placeholders when offline** (S)
  - Does: if avatars fail to load, shows the bundled images (4 artist placeholders, 1 album placeholder) and saves a chosen one through a new command `set_cover_from_bytes`.
  - Acceptance:
    - With the network off, "Show fun avatars" shows the bundled images instead of broken tiles.
    - Saving one shows it as the cover and it survives a restart.
  - Verify: `cargo check`; `npm run build`; by hand with Wi-Fi off.
  - Depends on: 9.
  - Files: `commands/cover_art.rs`, `lib.rs`, `services/coverArtService.js`, `hooks/useCoverCandidates.js`, `components/CoverArtPicker/CoverArtPicker.jsx`.

### Build status (2026-11-28)

All 10 tasks are built. Automated checks pass: `npm test`, `npm run build`, `cargo test`. The Rust search and save were also run once against the real Deezer, iTunes, TheAudioDB and DiceBear services.

**Not yet checked by hand in the running app** (the agent cannot click through the Tauri window):
- The picker's look and layout, on both tabs
- A saved cover appearing straight away and after a restart
- "No cover" staying reset
- The offline fallback, and that a bundled PNG saved under a `.jpg` name displays

### Checkpoint C
- [ ] All 7 success criteria in the spec pass
- [x] `AGENTS.md` lists `CoverArtPicker`, the two hooks and the new commands
- [ ] Final review with Jay
