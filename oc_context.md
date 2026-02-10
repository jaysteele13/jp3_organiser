# OpenCode Context - JP3 Organiser

## Project Overview

**JP3 Organiser** is a Tauri 2 desktop app (React frontend + Rust backend) that:
- Prepares music files for ESP32 microcontroller playback
- Serves as a full-featured desktop music player (like Spotify)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + Vite + React Router |
| Backend | Rust (Tauri 2) |
| Desktop | Tauri 2 |
| Styling | CSS Modules + Global CSS |
| Font | Geist Mono (Variable) |

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
```

## Project Structure

```
jp3_organiser/
├── src/                      # React frontend
│   ├── assets/               # Static assets (fonts, images)
│   ├── components/           # Shared/reusable components
│   │   └── ComponentName/   # Each component in its own folder
│   │       ├── ComponentName.jsx
│   │       ├── ComponentName.module.css
│   │       └── index.js
│   ├── hooks/                # Custom React hooks
│   ├── pages/                # Route-level page components
│   ├── services/             # API services, Tauri command wrappers
│   ├── styles/               # Global styles
│   │   └── global.css
│   ├── utils/                # Utility/helper functions
│   ├── App.jsx               # Root component with routing
│   └── main.jsx              # Entry point
└── src-tauri/                # Rust backend
```

## Coding Standards

### React Components

**File Structure:** Each component in its own folder with:
- `ComponentName.jsx` - Component logic
- `ComponentName.module.css` - Scoped styles
- `index.js` - Barrel export

**Naming Conventions:**
- Components: `PascalCase` (folders and files)
- Hooks: `useXxxxx.js` (camelCase with "use" prefix)
- CSS Modules: `ComponentName.module.css`

**Imports:** Use barrel exports:
```jsx
// Good
import Header from '../../components/Header';

// Bad
import Header from '../../components/Header/Header.jsx';
```

**Component Guidelines:**
- Max 250 lines per component
- Extract complex logic to custom hooks (`useXxx.js`)
- Extract pure logic to `utils/`
- Single responsibility principle

**State Management:**
- Use React hooks (`useState`, `useEffect`, `useCallback`, `useMemo`)
- Context for global state
- No Redux/Zustand - keep it simple

### CSS

**Use CSS Variables** - Never hardcode colors:
```css
:root {
  --primary: #242424;
  --secondary: #9785c9;
  --tertiary: #548478;
  --sketch-bg: #F5F5F1;
}
```

**Global styles** go in `src/styles/global.css`
**Component styles** use CSS Modules (`*.module.css`)

### Animations

Follow the pattern used in AboutCard for consistent animations:
```css
.element {
  animation: fadeInUp 0.6s ease-out forwards;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(15px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

## Routing

| Route | Page |
|-------|------|
| `/` | Redirects to `/upload` |
| `/upload` | Upload |
| `/view` | View |
| `/player` | Player |
| `/about` | About |

## Key Components

### SplashScreen (`src/components/SplashScreen/`)
- Shows on first app load only (uses sessionStorage)
- Displays `/jp3_splash.gif` with scale animation
- Shows tagline "your lil pocket pal" with fade-in
- Auto-navigates to `/upload` after animation

### PlayerBar (`src/components/PlayerBar/`)
- Persistent bottom bar with playback controls
- Queue drawer for queue management

### Navbar (`src/components/Navbar/`)
- Collapsible sidebar navigation
- Toggle with Ctrl+S

## Common Patterns

### Service Layer
```jsx
// services/libraryService.js wraps Tauri commands
import { invoke } from '@tauri-apps/api/core';
const result = await invoke('command_name', { argName: value });
```

### Context Providers Hierarchy
```
App.jsx
└── UploadCacheProvider
    └── PlayerProvider
        └── AppContent
            ├── Navbar
            ├── Routes
            └── PlayerBar
```

## Testing

- Rust tests in `src-tauri/tests/`
- Run with: `cd src-tauri && cargo test`

## Development Notes

- `fpcalc` CLI tool required for audio fingerprinting
- `ACOUSTIC_ID_API_KEY` environment variable must be set
