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
│   │   └── Header/
│   ├── hooks/                # Custom React hooks
│   ├── pages/                # Route-level page components
│   │   ├── About/
│   │   └── Upload/
│   │       └── components/   # Page-specific components
│   ├── services/             # API services, Tauri command wrappers
│   ├── styles/               # Global styles
│   │   └── global.css        # Color palette, fonts, base styles
│   ├── utils/                # Utility/helper functions
│   ├── App.jsx               # Root component
│   ├── App.module.css        # App-scoped styles
│   └── main.jsx              # Entry point
├── src-tauri/                # Rust backend
│   ├── src/
│   │   ├── lib.rs            # Tauri commands and plugin setup
│   │   └── main.rs           # Entry point
│   ├── Cargo.toml            # Rust dependencies
│   └── tauri.conf.json       # Tauri configuration
└── package.json              # Node dependencies
```

## Key Features (Planned)

1. **File Upload** - Select MP3/WAV files via native file picker
2. **Metadata Extraction** - Read ID3 tags, use APIs/AI for missing data
3. **Duplicate Detection** - Prevent duplicate songs in library
4. **Library Generation** - Create optimized `library.bin` for ESP32
5. **SD Card Export** - Write formatted library to MicroSD

## Coding Standards

### React Components

- **File Structure:** Each component in its own folder with:
  - `ComponentName.jsx` - Component logic
  - `ComponentName.module.css` - Scoped styles
  - `index.js` - Barrel export
- **Naming:** PascalCase for component folders and files
- **Exports:** Use barrel files for cleaner imports
- **State:** Prefer hooks (`useState`, `useEffect`, custom hooks)

```jsx
// Good import (via barrel)
import Header from '../../components/Header';

// Avoid
import Header from '../../components/Header/Header.jsx';
```

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

- Define commands in `src-tauri/src/lib.rs`
- Use `#[tauri::command]` attribute
- Register in `invoke_handler`
- Call from React via `@tauri-apps/api`

```rust
// Backend (lib.rs)
#[tauri::command]
fn process_audio(path: &str) -> Result<String, String> {
    // Implementation
}
```

```jsx
// Frontend
import { invoke } from '@tauri-apps/api/core';
const result = await invoke('process_audio', { path: filePath });
```

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

- React Router for navigation (currently manual component switching)
- State management (Context API or Zustand) as app grows
- Don't use TypeScript migration for type safety as this is ReactJS
- Testing setup (Vitest for React, Rust tests for backend)
