# AGENTS.md - JP3 Organiser

Guidelines for AI coding agents working in this repository.

## Project Overview

JP3 Organiser is a Tauri 2 desktop app (React frontend + Rust backend) that:
- Prepares music files for ESP32 microcontroller playback
- Serves as a full-featured desktop music player (like Spotify)

## Build & Run Commands

### Frontend (React + Vite)
```bash
npm run dev          # Start Vite dev server only
npm run build        # Production build
npm run preview      # Preview production build
```

### Full Application (Tauri)
```bash
npm run tauri dev    # Start full app (frontend + Rust backend)
npm run tauri build  # Production build
npm run tauri-clean  # Clean Rust build cache (rm -rf src-tauri/target)
```

### Rust Backend
```bash
cd src-tauri
cargo build          # Build Rust backend
cargo test           # Run all tests
cargo test <name>    # Run single test by name
cargo test library   # Run tests matching "library"
cargo check          # Type check without building
```

### Single Test Examples
```bash
cd src-tauri
cargo test test_save_to_library_basic           # Run specific test
cargo test metadata_ranking                      # Run all ranking tests
cargo test -- --nocapture                        # Show println! output
```

## Code Style Guidelines

### React/JavaScript

**File Structure** - Each component in its own folder:
```
ComponentName/
  ComponentName.jsx      # Component logic
  ComponentName.module.css  # Scoped styles
  index.js               # Barrel export: export { default } from './ComponentName';
```

**Imports** - Use barrel exports:
```jsx
// Good
import Header from '../../components/Header';
import { usePlayer, useLibraryConfig } from '../../hooks';

// Bad
import Header from '../../components/Header/Header.jsx';
```

**Naming Conventions**:
- Components: `PascalCase` (folders and files)
- Hooks: `useXxxxx.js` (camelCase with "use" prefix)
- Utils: `camelCase.js`
- CSS Modules: `ComponentName.module.css`

**Component Guidelines**:
- Max 250 lines per component
- Max 5 useState hooks per component
- Extract complex logic to custom hooks (`useXxx.js`)
- Extract pure logic to `utils/`
- Single responsibility principle

**State Management**:
- Use React hooks (`useState`, `useEffect`, `useCallback`, `useMemo`)
- Context for global state (`usePlayer`, `useUploadCache`, `useLibraryContext`)
- No Redux/Zustand - keep it simple

**Error Handling**:
```jsx
try {
  const result = await invoke('command_name', { args });
} catch (err) {
  console.error('Operation failed:', err);
  // Show user-friendly error via Toast or ErrorState
}
```

### CSS

**Use CSS Variables** - Never hardcode colors:
```css
--primary: #B64963;      /* Rose - hover states, accents */
--secondary: #99B649;    /* Lime - default buttons */
--tertiary: #49B69C;     /* Teal - cards */
--quaternary: #6649B6;   /* Purple - sections */
```

Each has a `-hover` variant. Global styles in `src/styles/global.css`.

### Rust

**File Organization**:
```
src-tauri/src/
  commands/    # Tauri command handlers (audio.rs, library.rs, etc.)
  models/      # Data structures with Serialize/Deserialize
  services/    # Business logic (fingerprint_service.rs, etc.)
  lib.rs       # Plugin setup and exports
  main.rs      # Entry point
```

**Tauri Commands**:
```rust
#[tauri::command]
pub async fn my_command(arg: String) -> Result<MyResponse, String> {
    // Return Result<T, String> - errors become JS exceptions
}
```

**Error Handling**:
```rust
// Use Result<T, String> for Tauri commands
// Use anyhow for internal error chaining
fn internal_fn() -> anyhow::Result<T> {
    let result = operation().context("Failed to do X")?;
    Ok(result)
}
```

**Naming**:
- Structs/Enums: `PascalCase`
- Functions/variables: `snake_case`
- Constants: `SCREAMING_SNAKE_CASE`

## Architecture Notes

### Audio Player (Context + User Queue)
- **Context**: Album/playlist being played. Navigate with Next/Prev.
- **User Queue**: Songs added via "Add to Queue". Consumed when played.

### Tauri Command Pattern
```jsx
// Frontend (services/*.js)
import { invoke } from '@tauri-apps/api/core';
const result = await invoke('command_name', { argName: value });

// Backend (commands/*.rs)
#[tauri::command]
pub async fn command_name(arg_name: String) -> Result<T, String>
```

### Key Hooks
| Hook | Purpose |
|------|---------|
| `usePlayer()` | Audio playback, queue management |
| `useLibrary(path)` | Fetch library data |
| `useLibraryConfig()` | Library path config |
| `useUploadCache()` | Persistent upload state |
| `useToast()` | Notification management |

## Testing

### Rust Tests
Located in `src-tauri/tests/`. Use `tempfile` for test directories.

```rust
fn setup_test_library() -> (tempfile::TempDir, String) {
    let temp_dir = tempfile::TempDir::new().unwrap();
    let base_path = temp_dir.path().to_string_lossy().to_string();
    initialize_library(base_path.clone()).unwrap();
    (temp_dir, base_path)
}
```

### No Frontend Tests Yet
React testing not configured. Focus on Rust integration tests.

## Environment Requirements

- `fpcalc` CLI tool (audio fingerprinting): `brew install chromaprint`
- `ACOUSTIC_ID_API_KEY` in `.env.local`

## Common Patterns

### Service Layer
```jsx
// services/libraryService.js wraps Tauri commands
export async function loadLibrary(basePath) {
  return invoke('load_library', { basePath });
}
```

### JSDoc for Complex Functions
```jsx
/**
 * Play a track within a context (album, playlist, etc.)
 * @param {Object} track - Track to play
 * @param {Array} trackContext - Full list of tracks in context
 */
const playTrack = useCallback((track, trackContext) => { ... }, []);
```
