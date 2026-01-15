# JP3 Organiser - OpenCode Context

## Project Overview

**JP3 Organiser** is a desktop application that prepares music files for playback on an ESP32 microcontroller AND serves as a full-featured desktop music player. It formats audio files and metadata into an optimized `library.bin` format that the ESP32 can read efficiently without RAM issues.

**Tagline:** "Turn your SD card into an MP3 Haven. Think Local Spotify - offline, and running on an ESP32."

### Core Flow
```
User's Audio Files → JP3 Organiser → library.bin → MicroSD Card → ESP32 → Music Playback
                          ↓
                   Desktop Playback (like Spotify)
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + Vite + React Router |
| Backend | Rust (Tauri 2) |
| Desktop | Tauri 2 |
| Styling | CSS Modules + Global CSS |
| Font | Geist Mono (Variable) |

## Project Structure

```
jp3_organiser/
├── src/                      # React frontend
│   ├── assets/               # Static assets (fonts, images, test files)
│   ├── components/           # Shared/reusable components
│   │   ├── ActionMenu/       # Reusable dropdown action menu for items
│   │   ├── CardList/         # Reusable grid-based card list for entities (albums, artists)
│   │   ├── ConfirmModal/     # Reusable confirmation dialog with variants and custom content via children prop
│   │   ├── EmptyState/       # Reusable empty state message
│   │   ├── ErrorState/       # Reusable error display
│   │   ├── Header/           # App header with title/description
│   │   ├── LoadingState/     # Reusable loading spinner
│   │   ├── Navbar/           # Collapsible sidebar navigation
│   │   ├── PlayerBar/        # Persistent bottom audio player bar
│   │   ├── PlaylistComboBox/ # Searchable dropdown for playlist selection
│   │   ├── QueueDrawer/      # Slide-out queue management panel
│   │   ├── SongTable/        # Reusable song list with search/pagination (table and card variants)
│   │   └── Toast/            # Dismissible notification popup
│   ├── hooks/                # Custom React hooks
│   │   ├── player/           # Audio player hooks
│   │   │   ├── useAudioElement.js   # Audio element lifecycle, blob loading
│   │   │   ├── useQueueManager.js   # Context + User Queue state management
│   │   │   └── playerUtils.js       # Helper functions, REPEAT_MODE constant
│   │   ├── useKeyboardShortcut.js  # Keyboard shortcut handler
│   │   ├── useLibraryConfig.js     # Library path configuration
│   │   ├── useLibrary.js           # Library data fetching
│   │   ├── useLibraryContext.jsx   # Library data context for autosuggest
│   │   ├── useUploadCache.jsx      # Persistent upload state context
│   │   ├── useWorkflowMachine.js   # Upload workflow state machine
│   │   ├── useDebounce.js          # Debounced value hook
│   │   ├── useAutoSuggest.js       # Fuzzy-match autosuggest hook
│   │   ├── useToast.js             # Toast notification state management
│   │   ├── useRecents.js           # Recently played items hook (resolves to full objects)
│   │   ├── useUploadModeSelector.js # Upload mode selection logic
│   │   ├── useUploadStageLogic.js  # Display state & review navigation
│   │   └── usePlayerContext.jsx    # Global audio player context
│   ├── pages/                # Route-level page components
│   │   ├── About/            # About page with info cards
│   │   ├── Player/           # Music player with library browsing
│   │   │   └── components/   # TabSelector, TabContent, SongList, AlbumList, ArtistList, PlaylistList
│   │   ├── Upload/           # File upload and metadata workflow
│   │   │   └── components/   # UploadModeSelector, ContextForm, ProcessFile, ReviewScreen, MetadataForm, SaveToLibrary
│   │   ├── View/             # Library viewer with tabs
│   │   │   └── components/   # StatsBar, ViewHeader, Tabs, DeleteConfirmModal
│   │   └── PlaylistEdit/     # Full-page playlist editor
│   ├── services/             # API services, Tauri command wrappers
│   │   ├── audioService.js   # Audio file processing & metadata
│   │   ├── libraryService.js # Library CRUD operations
│   │   └── recentsService.js # Recently played items persistence
│   ├── styles/               # Global styles
│   │   └── global.css        # Color palette, fonts, base styles
│   ├── utils/                # Utility/helper functions
│   │   ├── enums.js          # Shared enums (TABS, UPLOAD_MODE)
│   │   ├── formatters.js     # File size, duration formatters
│   │   ├── fuzzyMatch.js     # Fuzzy matching for autosuggest
│   │   └── filenameSuggester.js # Filename to title transformation
│   ├── App.jsx               # Root component with routing
│   ├── App.module.css        # App-scoped styles
│   └── main.jsx              # Entry point
├── src-tauri/                # Rust backend
│   ├── src/
│   │   ├── commands/         # Tauri command handlers
│   │   │   ├── audio.rs      # Audio processing commands
│   │   │   ├── config.rs     # Configuration commands
│   │   │   ├── library.rs    # Library management commands
│   │   │   └── playlist.rs   # Playlist management commands
│   │   ├── models/           # Data structures
│   │   │   ├── audio.rs      # TrackedAudioFile, AudioMetadata
│   │   │   ├── library.rs    # Library binary format, parsed types
│   │   │   └── playlist.rs   # Playlist binary format, parsed types
│   │   ├── services/         # Business logic services
│   │   │   ├── fingerprint_service.rs  # Audio fingerprinting + AcoustID
│   │   │   └── metadata_ranking_service.rs  # Metadata ranking algorithm
│   │   ├── lib.rs            # Tauri plugin setup and exports
│   │   └── main.rs           # Entry point
│   ├── tests/                # Integration tests
│   │   ├── library_tests.rs  # Library management tests
│   │   └── metadata_ranking_tests.rs  # Ranking algorithm tests
│   ├── Cargo.toml            # Rust dependencies
│   └── tauri.conf.json       # Tauri configuration
└── package.json              # Node dependencies
```

## Key Features

### Implemented
1. **File Upload** - Select MP3/WAV/FLAC/M4A/OGG/OPUS files via native file picker
2. **Metadata Extraction** - Read ID3 tags (MP3) + AcoustID fingerprinting for all formats
3. **Metadata Ranking** - Algorithm to select best metadata from AcoustID results
4. **Manual Metadata Entry** - Form to complete missing metadata
5. **Review Mode** - Step through incomplete files one-by-one
6. **Library Management** - Save songs to library.bin with artist/album structure
7. **Library Viewer** - Browse library by Songs, Albums, Artists, Playlists (tabs)
8. **Directory Configuration** - Set and persist library output directory
9. **Song Deletion** - Soft-delete songs with audio file removal
10. **Album/Artist Deletion** - Delete all songs in an album or by an artist
11. **Song Editing** - Edit metadata for existing songs
12. **Library Compaction** - Remove deleted entries and orphaned data
13. **Upload Caching** - Persist upload state across navigation
14. **Workflow State Machine** - Explicit state transitions for upload flow (PROCESS → REVIEW → READY_TO_SAVE)
15. **Smart Review Navigation** - Automatically navigate to first unconfirmed file when entering review
16. **Swipe Animations** - Slide animations when navigating between files in review mode
17. **Upload Mode Selection** - Choose between Add Songs, Add Album, Add Artist, or Add Playlist modes
18. **Playlist Creation** - Create playlists with songs (saves songs to library + creates playlist file)
19. **Playlist Management** - Add/remove songs from existing playlists via PlaylistEdit page
20. **Upload to Existing Playlist** - Navigate from PlaylistEdit to Upload with pre-set playlist context
21. **Duplicate Song Handling** - When uploading songs already in library, their IDs are reused for playlist inclusion
22. **Playlist Rename** - Rename playlists with duplicate name validation
23. **Desktop Music Player** - Full-featured audio playback with queue management
24. **Queue Drawer** - Slide-out panel to view, reorder, and manage playback queue
25. **Persistent PlayerBar** - Always-visible bottom bar with playback controls
26. **Home Tab** - Default Player tab with Recently Played and Recently Added sections
27. **Recently Played Tracking** - Tracks songs, albums, artists, playlists via persistent store
28. **Click-to-Play Song Rows** - Click anywhere on a song row to play (Queue button preserved)
29. **Keyboard Shortcuts** - Global player shortcuts (Space, arrows, M, N, P, S, R)
30. **Volume Control Slider** - Volume slider with mute toggle in PlayerBar
31. **CardList Component** - Shared grid-based card list for albums/artists views

### Planned
- SD Card export workflow

## Coding Standards

### React Components

- **File Structure:** Each component in its own folder with:
  - `ComponentName.jsx` - Component logic
  - `ComponentName.module.css` - Scoped styles
  - `index.js` - Barrel export
- **Naming:** PascalCase for component folders and files
- **Exports:** Use barrel files for cleaner imports
- **State:** Prefer hooks (`useState`, `useEffect`, custom hooks)
- **Size Limit:** Components should be under 250 lines; extract hooks/subcomponents if larger

```jsx
// Good import (via barrel)
import Header from '../../components/Header';

// Avoid
import Header from '../../components/Header/Header.jsx';
```

### Component Size Guidelines

| Metric | Guideline |
|--------|-----------|
| Lines of code | 100-200 ideal, 250 max |
| useState hooks | 3-5 max per component |
| Responsibilities | Single purpose only |

**Refactoring triggers:**
- Component exceeds 250 lines
- More than 5 useState hooks
- Multiple unrelated concerns mixed together
- Large JSX blocks that could be separate components

**Extract to:**
- Custom hooks for stateful logic (`useXxx.js`)
- Utility functions for pure logic (`utils/`)
- Subcomponents for UI sections

### Styling

- **Global styles** go in `src/styles/global.css`
- **Component styles** use CSS Modules (`*.module.css`)
- **Color palette** - Always use CSS variables:

```css
/* Use these variables - never hardcode colors */
--primary: #B64963;      /* Rose - hover states, accents */
--secondary: #99B649;    /* Lime - default buttons */
--tertiary: #49B69C;     /* Teal - cards */
--quaternary: #6649B6;   /* Purple - sections */
```

- Each color has a `-hover` variant for darker shades
- Typography uses Geist Mono font globally

### Tauri Commands (Rust)

Commands are organized into modules under `src-tauri/src/commands/`:

| Module | Commands |
|--------|----------|
| `audio.rs` | `process_audio_files`, `process_single_audio_file`, `get_audio_metadata`, `get_audio_metadata_from_acoustic_id` |
| `config.rs` | `get_library_path`, `set_library_path`, `clear_library_path` |
| `library.rs` | `initialize_library`, `get_library_info`, `save_to_library`, `load_library`, `delete_songs`, `delete_album`, `delete_artist`, `edit_song_metadata`, `get_library_stats`, `compact_library` |
| `playlist.rs` | `create_playlist`, `load_playlist`, `list_playlists`, `delete_playlist_by_name`, `rename_playlist`, `save_to_playlist`, `add_songs_to_playlist`, `remove_songs_from_playlist` |

```rust
// Backend (commands/audio.rs)
#[tauri::command]
pub async fn process_single_audio_file(file_path: String) -> Result<TrackedAudioFile, String> {
    // Implementation
}
```

```jsx
// Frontend (services/audioService.js)
import { invoke } from '@tauri-apps/api/core';
const result = await invoke('process_single_audio_file', { filePath });
```

### Rust Services

Services are in `src-tauri/src/services/`:

| Service | Purpose |
|---------|---------|
| `fingerprint_service.rs` | Audio fingerprinting via fpcalc + AcoustID API lookup |
| `metadata_ranking_service.rs` | Ranking algorithm to select best metadata from AcoustID results |
| `cover_art_service.rs` | Cover art fetching from Cover Art Archive + hash-based file naming |
| `musicbrainz_service.rs` | MusicBrainz API client for album MBID lookup |

**Fingerprint Service:**
- Uses external `fpcalc` CLI tool (must be installed)
- Requires `ACOUSTIC_ID_API_KEY` environment variable
- Rate limiting: 500ms between API calls
- Retry logic for transient errors

**Cover Art Service:**
- `cover_filename(artist, album)` - Generate stable hash-based filename from artist+album
- `fetch_and_save_cover(base_path, artist, album, mbid)` - Fetch from Cover Art Archive and cache
- `cover_exists_by_name(base_path, artist, album)` - Check if cover is cached
- `get_cover_path_by_name(base_path, artist, album)` - Get full path to cached cover
- Files stored in `jp3/covers/` directory with `.jpg` extension
- Filenames are 16-character hex hashes, stable across library compaction

**Metadata Ranking Algorithm:**
| Criterion | Points (Top 5) | Rationale |
|-----------|----------------|-----------|
| Oldest release date | 30/24/18/12/6 | Older = original release |
| Sources count | 25/20/15/10/5 | More sources = more reliable |
| Album type bonus | +10 | Prefer full albums over singles |

### Data Models (Rust)

Models are in `src-tauri/src/models/`:

#### Audio Models (`audio.rs`)

| Model | Fields |
|-------|--------|
| `MetadataStatus` | Enum: Pending, Complete, Incomplete, Error, Success, Failed |
| `AudioMetadata` | title, artist, album, trackNumber, year, durationSecs |
| `TrackedAudioFile` | trackingId, filePath, fileName, fileExtension, fileSize, metadataStatus, metadata, errorMessage |
| `ProcessedAudioFingerprint` | fingerprintId, trackingId, fingerprintStatus, errorMessage, durationSeconds |
| `ProcessedFilesResult` | files, completeCount, incompleteCount, errorCount |

#### Library Models (`library.rs`)

**Binary Format (ESP32 optimized):**

| Structure | Size | Fields |
|-----------|------|--------|
| `LibraryHeader` | 40 bytes | magic ("LIB1"), version, songCount, artistCount, albumCount, table offsets |
| `ArtistEntry` | 8 bytes | nameStringId, reserved |
| `AlbumEntry` | 16 bytes | nameStringId, artistId, year, reserved |
| `SongEntry` | 24 bytes | titleStringId, artistId, albumId, pathStringId, trackNumber, durationSec, flags |

#### Playlist Models (`playlist.rs`)

**Binary Format (bin-per-playlist, in `jp3/playlists/{id}.bin`):**

| Structure | Size | Fields |
|-----------|------|--------|
| `PlaylistHeader` | 12 bytes | magic ("PLY1"), version, songCount, nameLength |
| Name | variable | playlist name as UTF-8 bytes |
| Song IDs | variable | array of u32 song IDs (little-endian) |

**Parsed Types:**

| Model | Fields |
|-------|--------|
| `ParsedPlaylist` | id, name, songCount, songIds |
| `PlaylistSummary` | id, name, songCount |
| `CreatePlaylistResult` | playlistId, songsAdded |
| `SaveToPlaylistResult` | filesSaved, artistsAdded, albumsAdded, songsAdded, duplicatesSkipped, playlistId, playlistName |
| `DeletePlaylistResult` | deleted |
| `RenamePlaylistResult` | success, oldName, newName |

**Parsed Types (Frontend display):**

| Model | Fields |
|-------|--------|
| `ParsedLibrary` | version, artists, albums, songs |
| `ParsedArtist` | id, name |
| `ParsedAlbum` | id, name, artistId, artistName, year |
| `ParsedSong` | id, title, artistId, artistName, albumId, albumName, path, trackNumber, durationSec |
| `LibraryInfo` | initialized, jp3Path, musicBuckets, hasLibraryBin |
| `LibraryStats` | totalSongs, activeSongs, deletedSongs, shouldCompact, fileSizeBytes |
| `SaveToLibraryResult` | filesSaved, artistsAdded, albumsAdded, songsAdded, duplicatesSkipped, songIds, duplicateSongIds |
| `DeleteSongsResult` | songsDeleted, notFound, filesDeleted |
| `DeleteAlbumResult` | songsDeleted, filesDeleted, albumName, artistName |
| `DeleteArtistResult` | songsDeleted, filesDeleted, albumsAffected, artistName |
| `EditSongResult` | newSongId, artistCreated, albumCreated |
| `CompactResult` | songsRemoved, artistsRemoved, albumsRemoved, stringsRemoved, playlistsUpdated, oldSizeBytes, newSizeBytes, bytesSaved |

### File Organization

| Type | Location |
|------|----------|
| Shared components | `src/components/` |
| Page components | `src/pages/` |
| Page-specific components | `src/pages/PageName/components/` |
| Custom hooks | `src/hooks/` |
| API/Tauri wrappers | `src/services/` |
| Helpers/utilities | `src/utils/` |
| Global CSS | `src/styles/global.css` |
| Rust commands | `src-tauri/src/commands/` |
| Rust models | `src-tauri/src/models/` |
| Rust services | `src-tauri/src/services/` |
| Rust tests | `src-tauri/tests/` |

## Services

### audioService.js
- `MetadataStatus` enum - PENDING, COMPLETE, INCOMPLETE, ERROR
- `API_RATE_LIMIT_DELAY` - 500ms rate limit for AcoustID calls
- `processSingleAudioFile(filePath)` - Process one file with fingerprinting
- `processAudioFilesIncremental(filePaths, callbacks)` - Process files one-by-one with rate limiting

### recentsService.js
- `RECENT_TYPE` enum - SONG, ALBUM, ARTIST, PLAYLIST
- `MAX_RECENTS` - Maximum 20 items stored
- `RECENTS_UPDATED_EVENT` - Custom event name for updates
- `addToRecents(type, id)` - Add item to recents (deduplicates, emits event)
- `getRecents()` - Get all recent items as `{ type, id, playedAt }[]`
- `clearRecents()` - Clear all recents

**Persistence:** Uses `@tauri-apps/plugin-store` to persist recents in `recents.json`.

### libraryService.js
- `getLibraryPath()` - Get saved library path
- `setLibraryPath(path)` - Save library path
- `clearLibraryPath()` - Clear saved path
- `initializeLibrary(basePath)` - Create JP3 directory structure
- `getLibraryInfo(basePath)` - Get library info
- `saveToLibrary(basePath, files)` - Save files to library
- `loadLibrary(basePath)` - Load and parse library.bin
- `deleteSongs(basePath, songIds)` - Soft-delete songs
- `deleteAlbum(basePath, albumId)` - Delete all songs in an album
- `deleteArtist(basePath, artistId)` - Delete all songs by an artist
- `getLibraryStats(basePath)` - Get stats including compaction recommendation
- `compactLibrary(basePath)` - Remove deleted entries
- `createPlaylist(basePath, name, songIds)` - Create playlist with existing songs
- `loadPlaylist(basePath, playlistId)` - Load single playlist by ID
- `listPlaylists(basePath)` - List all playlist summaries
- `deletePlaylistByName(basePath, playlistName)` - Delete playlist file by name
- `renamePlaylist(basePath, playlistId, newName)` - Rename a playlist
- `saveToPlaylist(basePath, playlistName, files)` - Save songs to library AND create playlist
- `addSongsToPlaylist(basePath, playlistId, songIds)` - Add songs to existing playlist
- `removeSongsFromPlaylist(basePath, playlistId, songIds)` - Remove songs from playlist

### coverArtService.js
- `searchAlbumMbid(artist, album)` - Search MusicBrainz for release MBID by artist+album name
- `searchAlbumMbidsBatch(queries)` - Batch search for multiple albums (respects rate limiting)
- `fetchAlbumCover(basePath, artist, album, mbid)` - Fetch and cache album cover from Cover Art Archive
- `fetchArtistCover(basePath, artist, artistMbid)` - Fetch and cache artist cover from Fanart.tv
- `readAlbumCover(basePath, artist, album)` - Read cached album cover image bytes
- `readArtistCover(basePath, artist)` - Read cached artist cover image bytes
- `getAlbumCoverBlobUrl(basePath, artist, album)` - Create blob URL from cached album cover for img src
- `getArtistCoverBlobUrl(basePath, artist)` - Create blob URL from cached artist cover for img src

**Cover Art Flow (Albums):**
1. On save: Extract unique (artist, album) pairs from saved files
2. Batch search MusicBrainz for each album → get release MBID
3. Fall back to AcoustID MBID if MusicBrainz search fails
4. Store artist→MBID and artist+album→MBID mappings in `mbidStore.js`
5. On display: CoverArt component looks up MBID → fetches from Cover Art Archive → caches to disk

**Cover Art Flow (Artists):**
1. On save: Extract unique artists and their MBIDs from AcoustID response
2. Store artist→MBID mapping in `mbidStore.js`
3. On display: CoverArt component looks up artist MBID → fetches from Fanart.tv → caches to disk

**Cover Art File Naming (Hash-based):**
Cover art files are named using a stable hash for filenames that don't change during library compaction:
- Albums: hash of `"{artist_lowercase}|||{album_lowercase}"` → stored in `jp3/assets/albums/`
- Artists: hash of `"{artist_lowercase}|||artist"` → stored in `jp3/assets/artists/`

Example: "Pink Floyd" + "Dark Side of the Moon" → `a1b2c3d4e5f6g7h8.jpg`

**Rate Limiting:** MusicBrainz enforces strict 1 request/second limit. The Rust service uses a global mutex to ensure compliance.

### mbidStore.js
- `getAlbumMbid(artist, album)` - Get stored release MBID for an album
- `getArtistMbid(artist)` - Get stored artist MBID for an artist
- `getAllMbids()` - Get all stored MBID mappings
- `setMbid(artist, album, mbid)` - Store album MBID (first wins)
- `setArtistMbid(artist, mbid)` - Store artist MBID (first wins)
- `setMbids(entries)` - Store multiple album MBIDs at once
- `hasMbid(artist, album)` - Check if album MBID exists
- `removeMbid(artist, album)` - Remove stored MBID
- `clearMbids()` - Clear all stored MBIDs

**Persistence:** Uses `@tauri-apps/plugin-store` to persist MBIDs in `mbids.json`.
Key format: `"artist|||album"` for albums, `"artist|||"` for artists.

## Enums

### TABS (`src/utils/enums.js`)
- `HOME`, `SONGS`, `ALBUMS`, `ARTISTS`, `PLAYLISTS` - Player page tab identifiers (HOME is default)

### RECENT_TYPE (`src/services/recentsService.js`)
- `SONG`, `ALBUM`, `ARTIST`, `PLAYLIST` - Types for recently played items

### UPLOAD_MODE (`src/utils/enums.js`)
- `SONGS` - Auto-detect everything via AcousticID
- `ALBUM` - User provides album + artist, AcousticID provides title/track
- `ARTIST` - User provides artist, AcousticID provides album/title/track
- `PLAYLIST` - User provides playlist name, songs saved to library AND added to new playlist

### MetadataSource (`src/hooks/useUploadCache.jsx`)
- `UNKNOWN`, `ID3`, `FINGERPRINT`, `MANUAL` - Source of metadata for a field

### UploadStage (`src/hooks/useUploadCache.jsx`)
- `PROCESS`, `REVIEW`, `READY_TO_SAVE` - Current workflow stage

### WorkflowAction (`src/hooks/useWorkflowMachine.js`)
- `START_REVIEW`, `EXIT_REVIEW`, `COMPLETE_REVIEW`, `BACK_TO_REVIEW`, `SAVE_COMPLETE`, `RESET`

### SuggestionSource (`src/hooks/useAutoSuggest.js`)
- `FILENAME`, `LIBRARY` - Source of autosuggest suggestion

## Custom Hooks

| Hook | Purpose |
|------|---------|
| `useLibraryConfig()` | Manage library path (get/set from Rust backend), auto-initialize JP3 structure |
| `useLibrary(libraryPath)` | Fetch library data + playlists with loading/error states. Returns `library` object containing songs, albums, artists, and playlists. |
| `useLibraryContext()` | Context hook to access library data without prop drilling (used in MetadataForm for autosuggest) |
| `useKeyboardShortcut(key, callback)` | Register keyboard shortcuts with modifier support |
| `useUploadCache()` | Context hook for persistent upload state across navigation |
| `useWorkflowMachine()` | State machine for upload workflow stages (PROCESS -> REVIEW -> READY_TO_SAVE) |
| `useDebounce(value, delay)` | Debounce a value for delayed updates (used in search inputs) |
| `useAutoSuggest(inputValue, items, key)` | Fuzzy-match suggestions from a list based on input (artist/album autosuggest) |
| `useRecents(library)` | Resolves recent items to full objects from library, returns `{ recentItems, hasRecents }` |
| `useToast(duration?)` | Toast notification state management with auto-dismiss (default 5s) |
| `useUploadModeSelector()` | Upload mode selection logic - handles mode transitions, context form, and navigation state for pre-set playlist context |
| `useUploadStageLogic(cache, workflow, modeSelector)` | Consolidates display state conditions and review navigation utilities |
| `usePlayer()` | Hook to access global player context (playback, queue, controls) |
| `PlayerProvider` | Context provider for audio player state (wraps app in App.jsx) |
| `UploadCacheProvider` | Context provider wrapping app for upload state persistence |
| `LibraryProvider` | Context provider for library data (wraps UploadFile in Upload.jsx) |

## Routing

Uses React Router for navigation:

| Route | Page | Description |
|-------|------|-------------|
| `/` | Redirects to `/upload` | Default route |
| `/upload` | Upload | File upload workflow |
| `/view` | View | Library browser |
| `/player` | Player | Music player with library browsing |
| `/playlist/:id` | PlaylistEdit | Full-page playlist editor |
| `/about` | About | App information |

## Upload Page Components

The Upload page (`src/pages/Upload/`) has the most complex component structure:

| Component | Purpose |
|-----------|---------|
| `Upload.jsx` | Page wrapper, handles DirectoryConfig state |
| `UploadFile.jsx` | Main upload workflow, uses workflow state machine |
| `UploadModeSelector.jsx` | Mode selection: Add Songs, Add Album, Add Artist, Add Playlist |
| `ContextForm.jsx` | Modal form for entering album/artist/playlist context |
| `ProcessFile.jsx` | File selection via native picker, triggers metadata extraction |
| `ReviewScreen.jsx` | Step through files one-by-one with audio preview |
| `MetadataForm.jsx` | Edit form for song metadata with autosuggest |
| `SaveToLibrary.jsx` | Ready-to-save stage with confirmed files summary |

### Upload Modes

The upload workflow supports four modes to improve metadata accuracy:

| Mode | User Provides | AcousticID Provides | Use Case |
|------|---------------|---------------------|----------|
| **Add Songs** | Nothing | Everything | General upload, unknown files |
| **Add Album** | Album + Artist + Year(opt) | Title, Track # | Uploading a known album |
| **Add Artist** | Artist | Album, Title, Track # | Uploading songs by known artist |
| **Add Playlist** | Playlist name (new or existing) | Everything | Create/add to a playlist with songs |

**Rationale:** AcousticID sometimes returns incorrect album metadata (e.g., compilations instead of original album). Album/Artist modes let users override unreliable API results while still leveraging AcousticID for song identification. Playlist mode adds songs to the library and groups them into a named playlist in one operation.

**Existing Playlist Support:** When navigating from PlaylistEdit's "Upload New Songs" button, the upload page receives pre-set playlist context via React Router navigation state, automatically selecting Playlist mode and skipping the mode selector/context form.

### UploadFile Subcomponents (`src/pages/Upload/components/UploadFile/`)

| Component | Purpose |
|-----------|---------|
| `ActionButtons.jsx` | Start Review / Save to Library buttons |
| `FileList.jsx` | Scrollable file list with status indicators |
| `FileStats.jsx` | Summary bar with file counts (complete/incomplete/error) |
| `StatusBadge.jsx` | Colored status indicator badge |
| `ReviewPanel.jsx` | Wrapper for reviewing incomplete files |

### ProcessFile Hook (`src/pages/Upload/components/ProcessFile/hooks/`)

| Hook | Purpose |
|------|---------|
| `useFileProcessor.js` | File selection and metadata extraction logic |

### ReviewScreen Subcomponents (`src/pages/Upload/components/ReviewScreen/`)

| Component | Purpose |
|-----------|---------|
| `SongCard.jsx` | Display current file metadata in card format |
| `AudioPlayer.jsx` | Audio preview with play/pause/progress |
| `NavigationControls.jsx` | Previous/Next/Confirm/Edit buttons with progress indicator |
| `MetadataDisplay.jsx` | Metadata fields with source indicator (ID3/AcoustID/Manual) |
| `hooks/useReviewNavigation.js` | Navigation state + slide direction for animations |
| `hooks/useAudioPlayer.js` | Audio playback state and controls |

## View Page Components

The View page (`src/pages/View/`) displays the library content:

| Component | Purpose |
|-----------|---------|
| `View.jsx` | Page wrapper with library loading and tab state |
| `ViewHeader.jsx` | Header with library path and action buttons |
| `StatsBar.jsx` | Stats display with song/artist/album counts |
| `DeleteConfirmModal.jsx` | Confirmation dialog for song deletion |

### Tabs Components (`src/pages/View/components/Tabs/`)

| Component | Purpose |
|-----------|---------|
| `TabSelector.jsx` | Tab button selector (Songs/Albums/Artists/Playlists) |
| `TabContent.jsx` | Tab content switcher based on active tab |
| `Songs/SongView.jsx` | Songs list view with duration and actions |
| `Albums/AlbumView.jsx` | Albums list view grouped by artist |
| `Artists/ArtistView.jsx` | Artists list view |
| `Playlists/PlaylistView.jsx` | Playlists view with expandable cards and Manage button (navigates to PlaylistEdit) |

## PlaylistEdit Page

The PlaylistEdit page (`src/pages/PlaylistEdit/`) provides a full-screen editor for managing playlist contents:

| Component/Hook | Purpose |
|----------------|---------|
| `PlaylistEdit.jsx` | Two-column layout with current songs and song picker |
| `usePlaylistEdit.js` | Hook managing playlist state, add/remove/rename song operations |

**Features:**
- Two-column layout: current playlist songs (left) and library song picker (right)
- Search/filter library songs by title, artist, or album
- Batch selection with checkboxes for adding multiple songs
- Remove songs with one click
- Rename playlist with pen icon button (validates duplicate names)
- Delete playlist with confirmation modal
- "Upload New Songs" button navigates to Upload with pre-set playlist context
- Back button returns to View page with Playlists tab active

## Player Page

The Player page (`src/pages/Player/`) provides a Spotify-like music browsing and playback experience:

| Component | Purpose |
|-----------|---------|
| `Player.jsx` | Main page with library loading, stats, and tabbed browsing |
| `TabSelector.jsx` | Tab buttons for Home/Songs/Albums/Artists/Playlists |
| `TabContent.jsx` | Switches content based on active tab |
| `SongList.jsx` | Song list - click row to play, Queue button to add to queue |
| `AlbumList.jsx` | Expandable album list with album-level Play/Queue |
| `ArtistList.jsx` | Expandable artist list with artist-level Play All/Queue |
| `PlaylistList.jsx` | Expandable playlist list with Play/Queue |
| `PlayerSongCard.jsx` | Reusable song row - click to play, Queue button preserved |

### Home Tab Components (`src/pages/Player/components/Home/`)

| Component | Purpose |
|-----------|---------|
| `HomeView.jsx` | Main home view with Recently Played and Recently Added sections |
| `SectionHeader.jsx` | Section title with count (internal component) |
| `RecentRow.jsx` | Horizontal scrollable carousel for recently played items (internal) |
| `SongPreview.jsx` | Song list preview using PlayerSongCard (internal) |

**Note:** Only `HomeView` is exported from `index.js` - other components are internal implementation details.

**Features:**
- **Home tab** is the default tab when opening Player
- **Recently Played** - Shows last 6 songs, albums, artists, or playlists played (horizontal carousel)
- **Recently Added** - Shows 8 newest songs by ID (vertical list)
- Browse library by Songs, Albums, Artists, or Playlists
- Click song row to play (Play button removed for cleaner UX)
- Queue button preserved for adding to queue
- Current track highlighting in lists
- Expandable groups (albums show their songs when clicked)

## PlayerBar Component

The PlayerBar (`src/components/PlayerBar/`) is always visible at the bottom of the app:

| Component | Purpose |
|-----------|---------|
| `PlayerBar.jsx` | Main container, manages queue drawer state |
| `TrackInfo.jsx` | Displays current track title/artist/album |
| `PlaybackControls.jsx` | Play/pause, prev/next, shuffle, repeat buttons |
| `ProgressSlider.jsx` | Seekable progress bar with time display |

**Features:**
- Always visible (shows "No track selected" when empty)
- Play/Pause, Previous, Next controls
- Shuffle toggle and repeat mode cycling (Off → All → One)
- Progress slider with seek functionality
- Queue button showing track count

## QueueDrawer Component

The QueueDrawer (`src/components/QueueDrawer/`) slides out from the right:

**Sections:**
1. **Now Playing** - Current track with "Queue" badge if from user queue
2. **Next in Queue** - User-added songs (draggable, removable, consumed when played)
3. **Up Next** - Remaining context tracks (clickable to jump)

**Features:**
- Current track highlighting
- Click context tracks to jump to them
- Drag-to-reorder user queue tracks
- Remove individual tracks from user queue
- Clear user queue or clear all buttons
- Track count in footer
- Backdrop click to close

## Audio Player Architecture

The player system uses a layered hook architecture with two key concepts:

1. **Context** - The album/playlist/artist you're playing from. Immutable during playback. Navigate freely with Next/Prev without songs being removed.

2. **User Queue** - Songs explicitly added via "Add to Queue" button. These play next (before context continues) and are consumed (removed) when played.

This matches Spotify/Apple Music behavior.

```
App.jsx
└── PlayerProvider (usePlayerContext.jsx)
    ├── useAudioElement.js  - Audio element lifecycle
    │   └── HTML5 Audio API, blob URL loading via Tauri readFile
    └── useQueueManager.js  - Context + User Queue state management
        ├── context[]       - Album/playlist being played (immutable)
        ├── contextIndex    - Current position in context
        ├── userQueue[]     - User-added songs (consumed when played)
        └── playingFromUserQueue - Whether currently playing a user queue item
```

### Queue Behavior

| Action | Behavior |
|--------|----------|
| Click song in any list | Sets that list as context, plays from clicked song. Next/Prev work within context. |
| Press Next | User queue consumed first (if any), then advances in context |
| Press Prev | If >3s into track, restarts. If in user queue, back to context. Otherwise back in context. |
| Add to Queue button | Adds to user queue (plays next, before context continues) |
| Song finishes | Same as Next |
| Repeat ALL | Loops through context indefinitely |
| Repeat ONE | Repeats current song |
| Shuffle toggle | Shuffles context when playing a new track |

### Player Context API (`usePlayer()`)

| Property/Method | Type | Description |
|-----------------|------|-------------|
| `context` | Track[] | Current playback context (album/playlist) |
| `contextIndex` | number | Index in context (-1 if none) |
| `userQueue` | Track[] | User-added queue (consumed when played) |
| `currentTrack` | Track \| null | Currently playing track |
| `playingFromUserQueue` | boolean | Whether playing from user queue |
| `displayQueue` | object | Combined queue data for UI display |
| `isPlaying` | boolean | Whether audio is playing |
| `isLoading` | boolean | Whether audio is loading |
| `position` | number | Current position in seconds |
| `duration` | number | Track duration in seconds |
| `shuffle` | boolean | Shuffle mode enabled |
| `repeatMode` | REPEAT_MODE | OFF, ALL, or ONE |
| `hasNext` | boolean | Whether next track exists |
| `hasPrev` | boolean | Whether previous track exists |
| `playTrack(track, context)` | function | Play track within context (album/playlist) |
| `playNow(track)` | function | Play single track, clear everything |
| `addToQueue(tracks)` | function | Add track(s) to user queue |
| `clearQueue()` | function | Stop playback, clear context + user queue |
| `clearUserQueue()` | function | Clear only user queue |
| `togglePlayPause()` | function | Toggle play/pause |
| `next()` | function | Skip to next track |
| `prev()` | function | Go to previous (or restart if >3s in) |
| `seek(seconds)` | function | Seek to position |
| `skipToIndex(index)` | function | Jump to context index |
| `removeFromUserQueue(index)` | function | Remove track from user queue |
| `reorderUserQueue(from, to)` | function | Reorder user queue (drag-drop) |
| `toggleShuffle()` | function | Toggle shuffle mode |
| `cycleRepeatMode()` | function | Cycle OFF → ALL → ONE → OFF |
| `setLibraryPath(path)` | function | Set library path for audio loading |
| `isCurrentTrack(id)` | function | Check if track is currently playing |

### Audio Path Resolution

Songs in the library have relative paths (e.g., `00/001.mp3`). The player resolves absolute paths:

```
{libraryPath}/jp3/music/{relativePath}
```

Audio is loaded via Tauri's `readFile` command and converted to blob URLs for the HTML5 Audio element.

### REPEAT_MODE Constant

```javascript
const REPEAT_MODE = {
  OFF: 'off',   // Stop at end of queue
  ALL: 'all',   // Loop entire queue
  ONE: 'one',   // Loop current track
};
```

## Available Tauri Plugins

- `tauri-plugin-dialog` - Native file picker dialogs
- `tauri-plugin-upload` - File upload handling
- `tauri-plugin-opener` - Open files/URLs with default apps
- `tauri-plugin-store` - Persistent key-value storage (used for recents.json)

## Development

```bash
# Start development server
npm run tauri dev

# Build for production
npm run tauri build

# Clean Rust build cache
npm run tauri-clean
```

**Note:** On `npm run tauri dev`, there's a race condition where Tauri may start before Vite is ready. If you see a white screen, reload the app.

**Requirements:**
- `fpcalc` CLI tool must be installed for audio fingerprinting
- `ACOUSTIC_ID_API_KEY` environment variable must be set (in `.env.local`)

## Testing

### Rust Integration Tests (`src-tauri/tests/`)

| Test File | Purpose |
|-----------|---------|
| `library_tests.rs` | Library management: string deduplication, duplicate detection, soft delete, edit, compaction |
| `metadata_ranking_tests.rs` | Metadata ranking algorithm: source counting, date ranking, album type bonus |

Run tests:
```bash
cd src-tauri
cargo test
```

## Performance Considerations

- ESP32 has limited RAM - `library.bin` must be compact and streamable
- Binary format uses little-endian, fixed-size entries for minimal parsing
- String deduplication reduces storage (single string table with ID references)
- Soft delete pattern minimizes SD card write cycles
- Bucketed file storage: `music/00/`, `music/01/`, etc. (256 files per bucket)
- Incremental processing with rate limiting (500ms) for better UX

## Architectural Patterns

### Soft Delete Pattern
- Songs marked with `DELETED` flag rather than removed
- Audio files ARE immediately deleted (frees disk space)
- Metadata cleanup deferred to explicit `compact_library` call
- Minimizes SD card write cycles (important for embedded devices)

### Incremental Updates
- `save_to_library` loads existing data and merges
- Duplicate detection by (title, artist_id, album_id) tuple
- New entries appended rather than rebuilding entire file
- Returns both `songIds` (new) and `duplicateSongIds` (existing) for playlist inclusion

### Upload State Persistence
- `UploadCacheProvider` wraps app for persistent upload state
- State survives navigation between pages
- Cleared on successful library save or user action
- **Persisted state includes:**
  - `trackedFiles` - Processed audio files with metadata
  - `uploadMode` - Selected mode (SONGS, ALBUM, ARTIST, PLAYLIST)
  - `uploadContext` - Album/artist/playlist context for Album/Artist/Playlist modes
  - `modeSelected` - Whether user has selected a mode
  - `workflowState` - Current stage, review index, edit mode

### Upload Workflow State Machine
The upload workflow uses an explicit state machine (`useWorkflowMachine`) to manage stages:

```
┌─────────┐  START_REVIEW   ┌────────┐  COMPLETE_REVIEW   ┌───────────────┐
│ PROCESS │ ───────────────→│ REVIEW │ ─────────────────→ │ READY_TO_SAVE │
└─────────┘                 └────────┘                    └───────────────┘
     ↑                          ↑  │                            │
     │      EXIT_REVIEW         │  │     BACK_TO_REVIEW         │
     └──────────────────────────┘  └────────────────────────────┘
```

**States:**
- `PROCESS` - User selects files, metadata is extracted
- `REVIEW` - User confirms/edits each file one-by-one
- `READY_TO_SAVE` - All files confirmed, ready to save to library

**Smart Navigation:** When entering review mode, the app finds the first unconfirmed file instead of starting at index 0.

**Swipe Animation:** Navigation between files in review mode uses slide animations (0.25s ease-out) for visual feedback.

### Context Providers Hierarchy
```
App.jsx
└── UploadCacheProvider (upload state persists across navigation)
    └── PlayerProvider (global audio player state)
        └── AppContent
            ├── Navbar
            ├── Routes (Upload, View, Player, PlaylistEdit, About)
            └── PlayerBar (always visible)
```

## Future Considerations

- State management (Context API or Zustand) as app grows
- Don't use TypeScript - this is a ReactJS project
- Testing setup (Vitest for React, Rust tests for backend)

### Artist Images (Implemented)

Artist images are fetched from Fanart.tv using MusicBrainz Artist IDs:

**Flow:**
1. Artist MBID is extracted from AcoustID response during file processing
2. Artist MBID is stored in `mbidStore.js` when saving files to library
3. CoverArt component with `imageCoverType={IMAGE_COVER_TYPE.ARTIST}` fetches from Fanart.tv
4. Images are cached in `jp3/assets/artists/{hash}.jpg`

**API:** Fanart.tv: `https://webservice.fanart.tv/v3/music/{artist_mbid}?api_key=XXX`
- Response includes: `artistthumb`, `artistbackground`, `hdmusiclogo`
- We use the first `artistthumb` (ordered by likes)

**Requirements:**
- `FANART_PROJECT_KEY` environment variable must be set (in `.env.local`)
- Register for free API key at https://fanart.tv/get-an-api-key/

## Known Issues / Technical Debt

### Duration Not Displayed
Songs don't show duration in the Player page because:
1. ID3 tags often don't include duration (TLEN frame)
2. The fingerprint service (`fpcalc`) DOES return duration, but it's not being passed through to `AudioMetadata` when saving

**Potential fix:** In `src-tauri/src/commands/audio.rs`, after fingerprint processing, set:
```rust
tracked_file.metadata.duration_secs = Some(audio_finger_print.duration_seconds);
```
This needs to be added in both `process_audio_files()` and `process_single_audio_file()` functions.
