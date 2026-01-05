# JP3 Organiser - OpenCode Context

## Project Overview

**JP3 Organiser** is a desktop application that prepares music files for playback on an ESP32 microcontroller. It formats audio files and metadata into an optimized `library.bin` format that the ESP32 can read efficiently without RAM issues.

**Tagline:** "Turn your SD card into an MP3 Haven. Think Local Spotify - offline, and running on an ESP32."

### Core Flow
```
User's Audio Files → JP3 Organiser → library.bin → MicroSD Card → ESP32 → Music Playback
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
│   │   ├── ConfirmModal/     # Reusable confirmation dialog with variants
│   │   ├── EmptyState/       # Reusable empty state message
│   │   ├── ErrorState/       # Reusable error display
│   │   ├── Header/           # App header with title/description
│   │   ├── LoadingState/     # Reusable loading spinner
│   │   ├── Navbar/           # Collapsible sidebar navigation
│   │   └── Toast/            # Dismissible notification popup
│   ├── hooks/                # Custom React hooks
│   │   ├── useKeyboardShortcut.js  # Keyboard shortcut handler
│   │   ├── useLibraryConfig.js     # Library path configuration
│   │   ├── useLibrary.js           # Library data fetching
│   │   ├── useLibraryContext.jsx   # Library data context for autosuggest
│   │   ├── useUploadCache.jsx      # Persistent upload state context
│   │   ├── useWorkflowMachine.js   # Upload workflow state machine
│   │   ├── useDebounce.js          # Debounced value hook
│   │   ├── useAutoSuggest.js       # Fuzzy-match autosuggest hook
│   │   ├── useToast.js             # Toast notification state management
│   │   ├── useUploadModeSelector.js # Upload mode selection logic
│   │   └── useUploadStageLogic.js  # Display state & review navigation
│   ├── pages/                # Route-level page components
│   │   ├── About/            # About page with info cards
│   │   ├── Upload/           # File upload and metadata workflow
│   │   │   └── components/   # UploadModeSelector, ContextForm, ProcessFile, ReviewScreen, MetadataForm, SaveToLibrary
│   │   └── View/             # Library viewer with tabs
│   │       └── components/   # StatsBar, ViewHeader, Tabs, DeleteConfirmModal
│   ├── services/             # API services, Tauri command wrappers
│   │   ├── audioService.js   # Audio file processing & metadata
│   │   └── libraryService.js # Library CRUD operations
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
10. **Song Editing** - Edit metadata for existing songs
11. **Library Compaction** - Remove deleted entries and orphaned data
12. **Upload Caching** - Persist upload state across navigation
13. **Workflow State Machine** - Explicit state transitions for upload flow (PROCESS → REVIEW → READY_TO_SAVE)
14. **Smart Review Navigation** - Automatically navigate to first unconfirmed file when entering review
15. **Swipe Animations** - Slide animations when navigating between files in review mode
16. **Upload Mode Selection** - Choose between Add Songs, Add Album, Add Artist, or Add Playlist modes
17. **Playlist Creation** - Create playlists with songs (saves songs to library + creates playlist file)
18. **Playlist Management** - Add/remove songs from existing playlists via PlaylistEditor modal

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
| `library.rs` | `initialize_library`, `get_library_info`, `save_to_library`, `load_library`, `delete_songs`, `edit_song_metadata`, `get_library_stats`, `compact_library` |
| `playlist.rs` | `create_playlist`, `load_playlist`, `list_playlists`, `delete_playlist`, `save_to_playlist`, `add_songs_to_playlist`, `remove_songs_from_playlist` |

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

**Fingerprint Service:**
- Uses external `fpcalc` CLI tool (must be installed)
- Requires `ACOUSTIC_ID_API_KEY` environment variable
- Rate limiting: 500ms between API calls
- Retry logic for transient errors

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

**Parsed Types (Frontend display):**

| Model | Fields |
|-------|--------|
| `ParsedLibrary` | version, artists, albums, songs |
| `ParsedArtist` | id, name |
| `ParsedAlbum` | id, name, artistId, artistName, year |
| `ParsedSong` | id, title, artistId, artistName, albumId, albumName, path, trackNumber, durationSec |
| `LibraryInfo` | initialized, jp3Path, musicBuckets, hasLibraryBin |
| `LibraryStats` | totalSongs, activeSongs, deletedSongs, shouldCompact, fileSizeBytes |
| `SaveToLibraryResult` | filesSaved, artistsAdded, albumsAdded, songsAdded, duplicatesSkipped |
| `DeleteSongsResult` | songsDeleted, notFound, filesDeleted |
| `EditSongResult` | newSongId, artistCreated, albumCreated |
| `CompactResult` | songsRemoved, artistsRemoved, albumsRemoved, stringsRemoved, bytesSaved |

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
- `processAudioFiles(filePaths)` - Legacy batch processing
- `getAudioMetadata(filePath)` - Get ID3 metadata only (no AcoustID)

### libraryService.js
- `getLibraryPath()` - Get saved library path
- `setLibraryPath(path)` - Save library path
- `clearLibraryPath()` - Clear saved path
- `initializeLibrary(basePath)` - Create JP3 directory structure
- `getLibraryInfo(basePath)` - Get library info
- `saveToLibrary(basePath, files)` - Save files to library
- `loadLibrary(basePath)` - Load and parse library.bin
- `deleteSongs(basePath, songIds)` - Soft-delete songs
- `getLibraryStats(basePath)` - Get stats including compaction recommendation
- `compactLibrary(basePath)` - Remove deleted entries
- `createPlaylist(basePath, name, songIds)` - Create playlist with existing songs
- `loadPlaylist(basePath, playlistId)` - Load single playlist by ID
- `listPlaylists(basePath)` - List all playlist summaries
- `deletePlaylist(basePath, playlistId)` - Delete playlist file
- `saveToPlaylist(basePath, playlistName, files)` - Save songs to library AND create playlist
- `addSongsToPlaylist(basePath, playlistId, songIds)` - Add songs to existing playlist
- `removeSongsFromPlaylist(basePath, playlistId, songIds)` - Remove songs from playlist

## Enums

### TABS (`src/utils/enums.js`)
- `SONGS`, `ALBUMS`, `ARTISTS`, `PLAYLISTS` - View page tab identifiers

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
| `useToast(duration?)` | Toast notification state management with auto-dismiss (default 5s) |
| `useUploadModeSelector()` | Upload mode selection logic - handles mode transitions and context form |
| `useUploadStageLogic(cache, workflow, modeSelector)` | Consolidates display state conditions and review navigation utilities |
| `UploadCacheProvider` | Context provider wrapping app for upload state persistence |
| `LibraryProvider` | Context provider for library data (wraps UploadFile in Upload.jsx) |

## Routing

Uses React Router for navigation:

| Route | Page | Description |
|-------|------|-------------|
| `/` | Redirects to `/upload` | Default route |
| `/upload` | Upload | File upload workflow |
| `/view` | View | Library browser |
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
| **Add Playlist** | Playlist name | Everything | Create a new playlist with songs |

**Rationale:** AcousticID sometimes returns incorrect album metadata (e.g., compilations instead of original album). Album/Artist modes let users override unreliable API results while still leveraging AcousticID for song identification. Playlist mode adds songs to the library and groups them into a named playlist in one operation.

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
| `Playlists/PlaylistView.jsx` | Playlists view with expandable cards and Manage button |
| `Playlists/PlaylistEditor/` | Modal for adding/removing songs from a playlist |

### PlaylistEditor Components (`src/pages/View/components/Tabs/Playlists/PlaylistEditor/`)

| Component/Hook | Purpose |
|----------------|---------|
| `PlaylistEditor.jsx` | Modal with current songs list and song picker for adding |
| `usePlaylistEditor.js` | Hook managing editor state, open/close, add/remove operations |

## Available Tauri Plugins

- `tauri-plugin-dialog` - Native file picker dialogs
- `tauri-plugin-upload` - File upload handling
- `tauri-plugin-opener` - Open files/URLs with default apps
- `tauri-plugin-store` - Persistent key-value storage

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
    └── Upload.jsx
        └── LibraryProvider (library data for autosuggest)
            └── UploadFile → ReviewScreen → MetadataForm
```

## Future Considerations

- State management (Context API or Zustand) as app grows
- Don't use TypeScript - this is a ReactJS project
- Testing setup (Vitest for React, Rust tests for backend)

## Known Technical Debt

### SongView.jsx has duplicate formatDuration
- `formatDuration` function is duplicated in SongView instead of using `utils/formatters.js`
- Should consolidate to single utility function
