# Implementation Plan: Edit Cover Art

Spec: `planning/find-cover-art-spec.md` (approved 2026-11-28). Tasks: `tasks/find-cover-art-todo.md`.

> `tasks/plan.md` and `tasks/todo.md` still hold the slash command bar work (18 unchecked tasks), so this plan lives in its own files and those were not touched.

## Overview

In the Library page, "Edit Cover Art" on an album or artist opens a modal of real images found online. Picking one replaces the cached cover. A "No cover" tile is always there. If nothing is found, fun avatars are offered, with bundled placeholders when offline.

## How the pieces connect

```
AlbumView / ArtistView  ── "Edit Cover Art" ──>  View.jsx (useCoverActions)
                                                    │ opens
                                                    ▼
                                              CoverArtPicker  (ConfirmModal + image grid)
                                                    │ uses
                                                    ▼
                                            useCoverCandidates  (search, select, save)
                                               │              │
                          services/coverArtService.js    utils/avatarCandidates.js
                                               │
                    ┌──────────────────────────┼──────────────────────────┐
        search_cover_candidates        set_cover_from_url           remove_cover
        (Deezer, iTunes, TheAudioDB)   (allow-list, overwrite .jpg) (delete .jpg)
```

Build order follows the arrows upward: Rust command first, then the JS wrapper, then the modal, then the menu item.

## Architecture decisions

- **Rust owns all HTTP**, as it does today. The frontend only builds DiceBear URLs (pure string work).
- **Parsers are pure functions** (`&str` in, `Vec<CoverCandidate>` out) so tests use saved JSON and never touch the network. A thin async wrapper does the request.
- **One save path:** `set_cover_from_url` overwrites `{hash}.jpg` using the existing `cover_filename` and `save_cover_image`. Avatars go through it too.
- **Allow-list by host suffix**, checked with `reqwest::Url` (already a dependency): `dzcdn.net`, `mzstatic.com`, `theaudiodb.com`, `api.dicebear.com`, `https` only. The suffix check must match a whole label (`evil-dzcdn.net` is rejected).
- **`kind` is a string** `"album"` or `"artist"`, mapped once in Rust to the folder and the hash's second part.
- **Modal state lives in hooks**, not `View.jsx` (already 353 lines, over the 250-line guideline). `useCoverActions` follows the shape of `useAlbumActions` / `useArtistActions`; `useCoverCandidates` holds search, selection and save.
- **Refreshing one cover:** a new export in `CoverArt.jsx` drops one `blobUrlCache` entry, then `handleRefresh()` re-mounts covers, the same way the "♻ CoverArt" button does it.
- **Tasks are vertical where possible:** each ends with something you can run or see.

## Task list (detail in `tasks/find-cover-art-todo.md`)

### Phase 1: Album covers end to end
- Task 1: Search album candidates (Rust + JS wrapper)
- Task 2: Save a cover from a URL (Rust + JS wrapper)
- Task 3: `CoverArtPicker` modal and `useCoverCandidates`
- Task 4: Wire "Edit Cover Art" into the Albums tab

**Checkpoint A:** an album cover can be changed and survives a restart. Review with Jay.

### Phase 2: Artists and "No cover"
- Task 5: Search artist candidates (Rust)
- Task 6: Wire "Edit Cover Art" into the Artists tab
- Task 7: Remove the 3-day "not found" expiry
- Task 8: "No cover" tile

**Checkpoint B:** artists work; "No cover" resets to the placeholder and stays reset. Review with Jay.

### Phase 3: Avatars
- Task 9: DiceBear avatars when nothing is found
- Task 10: Bundled placeholders when offline

**Checkpoint C:** all 7 success criteria in the spec pass. Update AGENTS.md entries for the new component, hooks and commands.

## What can run in parallel

Tasks 1 and 2 are independent of each other. Task 5 only needs Task 1. Task 7 is independent of everything. The rest are sequential.

## Risks and mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| `handleRefresh()` may not re-mount a `CoverArt` whose props did not change, so the new image would not appear | High | Check this first in Task 4. Fallback: `CoverArt` listens for a `coverart-updated` window event, the same pattern as the existing `coverart-proxy-error` event |
| A free API changes shape, rate-limits, or TheAudioDB retires key `123` | Med | Each source fails on its own and returns an empty list; the others still show. Parsers treat every field as optional |
| iTunes returns unrelated albums for loose search terms | Low | Up to 8 results are shown and the user picks; no auto-selection |
| `download_image` follows redirects, so an allowed host could redirect elsewhere | Low | Accepted: only the four trusted hosts can start the request. Noted in a code comment |
| Bundled placeholders are PNG but covers are saved as `.jpg` and served as `image/jpeg` | Med | Verify in Task 10 that they display. If not, skip saving bytes and offer only "No cover" when offline (ask Jay first) |
| `CoverArt.jsx` is already large (about 500 lines) | Low | Only one small export is added; no refactor in this feature |

## Open questions

None.
