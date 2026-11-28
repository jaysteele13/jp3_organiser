# Spec: Playlist Pictures

Status: **APPROVED 2026-11-28**. Intent confirmed by interview on 2026-11-28; open questions answered the same day.

Note: the code for this was written on 2026-11-28, before this spec. The spec records what was agreed and what was built, so anything you change here means a code change. Nothing is committed.

## Objective

Every playlist shows a square picture made from the album covers of its songs, like Spotify. I can replace it with my own image from my computer, and go back to the song covers whenever I want.

User: me, browsing playlists in the Player and the Library. Why: playlists have no picture today, so they are hard to tell apart at a glance.

## Assumptions

1. Desktop app only. Playlist pictures are not sent to the ESP32 device.
2. A playlist's songs are already loaded wherever a playlist is shown (`useLibrary` loads `songIds` for every playlist).
3. Playlist IDs stay the same when a playlist is renamed, and are reused after the highest-numbered playlist is deleted (`get_next_playlist_id` is "highest ID + 1").
4. No new dependencies. The file chooser and file reading use the Tauri plugins already installed (`plugin-dialog`, `plugin-fs`).

## Tech stack

Tauri 2, React 18 with Vite 6 and CSS modules, Rust backend, Vitest 5 with Testing Library for frontend tests, `cargo test` with `tempfile` for backend tests.

## Commands

Run from `jp3_organiser/`:

```bash
npm run tauri dev                 # Run the full app
npm run build                     # Frontend production build
npm test                          # Frontend tests (vitest run)
cd src-tauri && cargo test cover     # Backend cover tests
cd src-tauri && cargo test playlist  # Backend playlist tests
```

The Rust build needs `src-tauri/.env` to exist (it is git-ignored).

## Decisions

| # | Decision | Why |
|---|----------|-----|
| 1 | Tiles are the **different albums** in the playlist, in playlist order. The same album by the same artist counts once (case-insensitive). Songs without an artist or album name are skipped | Ten songs from one album should not give four identical tiles |
| 2 | 4 or more albums: first four in a 2x2 grid. 2 or 3 albums: first two as left and right halves. 1 album: full square. 0 albums: the existing playlist placeholder image | Chosen in the interview (option A) |
| 3 | The rule is one pure function, `collageAlbums(songs)` in `utils/playlistCovers.js` | Easy to unit test with no rendering |
| 4 | New `components/PlaylistCover/` draws the picture. Each tile is the existing `CoverArt` component with a new `fill` prop | Album covers keep their existing loading, caching and fallback |
| 5 | `PlaylistCover` takes the same `size` names as `CoverArt` (`small`, `medium`, `large`, `xlarge`). With no size it fills its parent's width | Consistent sizes across the app |
| 6 | An uploaded image, if there is one, replaces the collage | Requested |
| 7 | The uploaded image is saved as `{library}/jp3/assets/playlists/{hash}.jpg`, where the hash is made from the **playlist ID** | Next to album and artist covers; a rename keeps the image |
| 8 | Backend: a third `CoverKind`, `Playlist`. The existing `set_cover_from_bytes`, `set_cover_from_url` and `remove_cover` commands then work for playlists unchanged. One new command, `read_cover(basePath, kind, artist, album)`, reads any kind of cover | Reuse over new commands |
| 9 | `search_cover_candidates` returns nothing for a playlist | There is nothing to search for |
| 10 | Deleting a playlist also deletes its uploaded image | IDs are reused, so the old image would otherwise appear on a new playlist |
| 11 | Editing reuses the existing "Edit Cover Art" modal (`CoverArtPicker`). For a playlist it adds an **"Upload image"** button, and the "No cover" tile is labelled **"Song covers"** | Same UI everywhere, as requested |
| 12 | "Upload image" opens a file chooser for `jpg`, `jpeg`, `png` and `webp`. The chosen image appears as the first tile, already selected. Nothing is saved until **Save** | Matches how the modal already works: pick, then Save |
| 13 | The only place to open the modal for a playlist is the **Manage page**: right-click the picture beside the playlist name, then "Change Playlist Picture" | Requested 2026-11-28 |
| 14 | The picture is shown in five places: Player playlist cards, Player playlist detail header, Library playlist cards (replacing the `☰` icon), the Home "recently played" row, and the Manage page | Confirmed 2026-11-28 |
| 15 | After saving, every `PlaylistCover` showing that playlist reloads, and a toast says "Cover art updated" | Same behaviour as album and artist covers |
| 16 | Uploads are saved as-is: no cropping, resizing or converting. A non-square image is cropped by the display only (centre crop) | Keeps the change small |
| 17 | "Show fun avatars" stays available for playlists | Answered 2026-11-28: "might as well keep it" |
| 18 | The "♻ CoverArt" button also deletes uploaded playlist pictures, so playlists go back to their song covers. They are not counted in the button's "Cleared N images" message | Answered 2026-11-28: playlist pictures are treated the same as album covers |
| 19 | An uploaded file over **5 MB** is refused. The modal shows "That image is larger than 5 MB. Choose a smaller one." and nothing is selected | Answered 2026-11-28 |
| 20 | Three albums shows two covers | Confirmed 2026-11-28: three tiles would be awkward to lay out |

## Behaviour

| Action | Result |
|--------|--------|
| Playlist has songs from 5 albums | 2x2 grid of the first four album covers |
| Playlist has songs from 3 albums | Two halves: the first two album covers |
| Playlist has 10 songs from 1 album | That album cover, full square |
| Playlist is empty | Playlist placeholder image |
| An album has no cover | That tile shows the album placeholder |
| Add or remove songs | The collage updates the next time the playlist is drawn |
| Right-click the picture on the Manage page | Menu with "Change Playlist Picture" |
| Upload image, then Save | The image shows everywhere the playlist does |
| Upload image, then Cancel | Nothing changes |
| Choose a file over 5 MB | The modal says it is too large; nothing is selected |
| Press "♻ CoverArt" | Uploaded playlist pictures are deleted; playlists show their song covers |
| Choose "Song covers", then Save | The uploaded image is deleted and the collage returns |
| Rename the playlist | The uploaded image stays |
| Delete the playlist | The uploaded image is deleted |
| Restart the app | The uploaded image is still there |

## Project structure

```
jp3_organiser/src/
  utils/playlistCovers.js                 # collageAlbums rule (+ .test.js)
  components/PlaylistCover/               # The picture (jsx, module.css, index.js)
  components/CoverArt/                    # + fill prop, COVER_SIZES export
  components/CoverArtPicker/              # + Upload image, Song covers label
  hooks/useCoverCandidates.js             # + uploadImage, playlist save path
  hooks/useCoverActions.js                # + handleEditPlaylistCoverRequest
  services/coverArtService.js             # + getCoverBlobUrl
  pages/PlaylistEdit/components/PlaylistCoverEditor/   # Picture + right-click menu + modal
  pages/Player/components/PlaylistList.jsx, DetailView/PlaylistDetail.jsx, Home/RecentRow.jsx
  pages/View/components/Tabs/Playlists/PlaylistView.jsx
jp3_organiser/src-tauri/src/
  services/cover_art_service.rs           # CoverKind::Playlist
  commands/cover_art.rs                   # read_cover
  commands/playlist.rs                    # delete also removes the image
```

## Code style

Follows `jp3_organiser/AGENTS.md`: one folder per component with a barrel `index.js`, CSS modules, colours from CSS variables, logic in hooks and `utils/`. Example of the style used:

```js
export function collageAlbums(songs) {
  const albums = new Map();
  for (const { artistName, albumName } of songs) {
    if (!artistName || !albumName) continue;
    const key = `${artistName}|||${albumName}`.toLowerCase();
    if (!albums.has(key)) albums.set(key, { artist: artistName, album: albumName });
  }

  const found = [...albums.values()];
  if (found.length >= GRID_TILES) return found.slice(0, GRID_TILES);
  return found.slice(0, SPLIT_TILES);
}
```

## Testing strategy

| Level | What | Where |
|-------|------|-------|
| Unit (Vitest) | The tile rule: counts each album once, 3 gives 2, 5 gives 4, empty gives none | `src/utils/playlistCovers.test.js` |
| Hook (Vitest + Testing Library) | An uploaded playlist image is saved from its bytes under the playlist ID, and the "not found" store is not touched | `src/hooks/useCoverCandidates.test.js` |
| Unit (cargo) | `"playlist"` parses as a cover kind | `cover_art_service.rs` tests |
| Hook (Vitest + Testing Library) | A file over 5 MB is refused with a message | `src/hooks/useCoverCandidates.test.js` |
| Unit (cargo, temp folder) | Deleting a playlist removes its uploaded image | `commands/playlist.rs` tests |
| Unit (cargo, temp folder) | Clearing the cover cache removes uploaded playlist pictures | `commands/cover_art.rs` tests |
| Manual, in the app | Layout in all five places, the file chooser, restart, rename, delete | See success criteria |

No test draws the collage itself; the layout is checked by eye.

## Boundaries

- **Always:** reuse `CoverArt`, `CoverArtPicker`, `ConfirmModal` and `ContextMenu`; run `npm test` and the two `cargo test` commands after a change; use CSS variables for colours.
- **Ask first:** adding a dependency; changing how album or artist covers are stored; adding a right-click menu anywhere other than the Manage page; resizing or converting uploads.
- **Never:** `git add`, commit or open a pull request; read or change `.env` files; change the playlist `.bin` file format.

## Success criteria

Automated (all pass today):

- [x] `npm test`: 48 tests pass, including the tile rule, the playlist upload save and the 5 MB limit
- [x] `cargo test cover` and `cargo test playlist` pass, including delete and "♻ CoverArt" removing the image
- [x] `npm run build` succeeds

Manual, in `npm run tauri dev` (**not yet done by anyone**):

- [ ] A playlist with 4+ albums shows a 2x2 grid; 2 or 3 shows two halves; 1 shows a full square; empty shows the placeholder
- [ ] The picture is a square, not stretched, in all five places
- [ ] Manage page: right-click the picture, "Change Playlist Picture" opens the modal
- [ ] Upload a jpg and a png; each shows in all five places after Save
- [ ] The upload is still there after restarting the app and after renaming the playlist
- [ ] "Song covers" then Save brings the collage back
- [ ] A file over 5 MB is refused with the message
- [ ] "♻ CoverArt" removes an uploaded playlist picture
- [ ] Delete a playlist with an upload, create a new one: the old image does not appear

## Out of scope

- Searching online for playlist images
- Cropping, resizing or converting the uploaded image
- Sending playlist pictures to the ESP32 device
- "Upload image" for albums or artists
- Right-click "Change Playlist Picture" on Player or Library cards

## Open questions

None. The four raised on 2026-11-28 are now decisions 17 to 20.
