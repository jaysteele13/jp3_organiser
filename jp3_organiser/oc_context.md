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
| Frontend | React 18 + Vite |
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
│   │   ├── Header/           # App header with logo
│   │   ├── Navbar/           # Vertical navigation bar
│   │   ├── LoadingState/     # Reusable loading spinner
│   │   ├── ErrorState/       # Reusable error display
│   │   └── EmptyState/       # Reusable empty state message
│   ├── hooks/                # Custom React hooks
│   │   ├── useKeyboardShortcut.js  # Keyboard shortcut handler
│   │   ├── useLibraryConfig.js     # Library path configuration
│   │   └── useLibrary.js           # Library data fetching
│   ├── pages/                # Route-level page components
│   │   ├── About/            # About page with info cards
│   │   ├── Upload/           # File upload and metadata workflow
│   │   │   └── components/   # DirectoryConfig, MetadataForm, UploadFile
│   │   └── View/             # Library viewer with tabs
│   │       └── components/   # StatsBar, ViewHeader, Tabs (Songs/Albums/Artists/Playlists)
│   ├── services/             # API services, Tauri command wrappers
│   │   ├── audioService.js   # Audio file processing & metadata
│   │   └── libraryService.js # Library CRUD operations
│   ├── styles/               # Global styles
│   │   └── global.css        # Color palette, fonts, base styles
│   ├── utils/                # Utility/helper functions
│   │   └── enums.js          # Shared enums (e.g., NavRoutes)
│   ├── App.jsx               # Root component with routing
│   ├── App.module.css        # App-scoped styles
│   └── main.jsx              # Entry point
├── src-tauri/                # Rust backend
│   ├── src/
│   │   ├── commands/         # Tauri command handlers
│   │   │   ├── audio.rs      # Audio processing commands
│   │   │   ├── config.rs     # Configuration commands
│   │   │   └── library.rs    # Library management commands
│   │   ├── models/           # Data structures
│   │   │   ├── audio.rs      # TrackedAudioFile, AudioMetadata
│   │   │   └── library.rs    # Library, Artist, Album, Song
│   │   ├── lib.rs            # Tauri plugin setup and exports
│   │   └── main.rs           # Entry point
│   ├── Cargo.toml            # Rust dependencies
│   └── tauri.conf.json       # Tauri configuration
└── package.json              # Node dependencies
```

## Key Features

### Implemented
1. **File Upload** - Select MP3/WAV/FLAC/M4A/OGG files via native file picker
2. **Metadata Extraction** - Read ID3 tags, mark files as Complete/Incomplete
3. **Manual Metadata Entry** - Form to complete missing metadata
4. **Review Mode** - Step through incomplete files one-by-one
5. **Library Management** - Save songs to library.bin with artist/album structure
6. **Library Viewer** - Browse library by Songs, Albums, Artists, Playlists (tabs)
7. **Directory Configuration** - Set and persist library output directory

### Planned
- AI/API enrichment for missing metadata
- Duplicate detection before adding to library
- SD Card export workflow
- Playlist creation and management

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
| `audio.rs` | `process_audio_files`, `get_audio_metadata` |
| `config.rs` | `get_library_path`, `set_library_path` |
| `library.rs` | `save_to_library`, `load_library` |

```rust
// Backend (commands/audio.rs)
#[tauri::command]
pub fn process_audio_files(file_paths: Vec<String>) -> Result<ProcessedFilesResult, String> {
    // Implementation
}
```

```jsx
// Frontend (services/audioService.js)
import { invoke } from '@tauri-apps/api/core';
const result = await invoke('process_audio_files', { filePaths });
```

### Data Models (Rust)

Models are in `src-tauri/src/models/`:

| Model | Fields |
|-------|--------|
| `TrackedAudioFile` | trackingId, filePath, fileName, fileSize, metadataStatus, metadata |
| `AudioMetadata` | title, artist, album, trackNumber, year, durationSecs |
| `Library` | artists (Vec<Artist>) |
| `Artist` | name, albums (Vec<Album>) |
| `Album` | name, year, songs (Vec<Song>) |
| `Song` | trackNumber, title, filePath |

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

## Services

### audioService.js
- `processAudioFiles(filePaths)` - Process files and extract metadata
- `getAudioMetadata(filePath)` - Get metadata for single file
- `MetadataStatus` enum - PENDING, COMPLETE, INCOMPLETE, ERROR
- `saveToLibrary(libraryPath, files)` - Save files to library.bin

### libraryService.js
- `loadLibrary(libraryPath)` - Load library.bin and return parsed data
- `getLibraryStats(library)` - Calculate artist/album/song counts

## Custom Hooks

| Hook | Purpose |
|------|---------|
| `useLibraryConfig()` | Manage library path (get/set from Rust backend) |
| `useLibrary(libraryPath)` | Fetch and return library data with loading/error states |
| `useKeyboardShortcut(key, callback)` | Register keyboard shortcuts |

## Available Tauri Plugins

- `tauri-plugin-dialog` - Native file picker dialogs
- `tauri-plugin-upload` - File upload handling
- `tauri-plugin-opener` - Open files/URLs with default apps

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

## Performance Considerations

- ESP32 has limited RAM - `library.bin` must be compact and streamable
- Avoid loading all song data at once
- Use efficient binary serialization (consider bincode or custom format)
- Deduplicate songs before export

## Future Considerations

- React Router for navigation (currently uses manual component switching via NavRoutes enum)
- State management (Context API or Zustand) as app grows
- Don't use TypeScript - this is a ReactJS project
- Testing setup (Vitest for React, Rust tests for backend)

## Known Technical Debt

### UploadFile.jsx (403 lines) - Needs Refactoring

**Current issues:**
- 8 useState hooks (too many)
- Mixed concerns: file selection, review mode, library saving, UI rendering
- Helper functions mixed with component logic

**Recommended refactoring:**

| Extract To | What | Approx Lines |
|------------|------|--------------|
| `useFileUpload.js` | File selection, processing, clearing, stats | ~50 |
| `useReviewMode.js` | Review navigation, current file, skip/save handlers | ~60 |
| `FileStats.jsx` | Stats bar rendering | ~25 |
| `FileList.jsx` | File list with status badges and edit buttons | ~40 |
| `ReviewPanel.jsx` | Review mode wrapper with progress header | ~25 |
| `utils/formatters.js` | `formatFileSize()`, `getStatusBadge()` | ~20 |

**Target:** Reduce UploadFile.jsx to ~150 lines as an orchestration component.
