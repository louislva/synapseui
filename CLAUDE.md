# SynapseUI

## Frontend

- **Location:** `frontend/`
- **Stack:** Vite 8, React 19, TypeScript 5.9
- **Entry point:** `src/main.tsx` renders `<App />` into `#root`

### Commands

- `npm run dev` — Start dev server
- `npm run build` — Type-check (`tsc -b`) then build for production
- `npm run lint` — ESLint
- `npm run preview` — Preview production build

### Project Structure

```
frontend/
├── src/
│   ├── main.tsx        # App entry point
│   ├── App.tsx         # Root component
│   ├── App.css         # App styles
│   ├── index.css       # Global styles
│   └── assets/         # Static assets (images, SVGs)
├── vite.config.ts      # Vite config (React plugin)
├── tsconfig.json       # TS project references
├── tsconfig.app.json   # App TS config
├── tsconfig.node.json  # Node/Vite TS config
└── eslint.config.js    # ESLint flat config
```

## Backend

- **Location:** `backend/`
- **Stack:** Python 3.10+, FastAPI, Uvicorn
- **Package manager:** uv
- **Dependencies:** `fastapi`, `uvicorn[standard]`, `science-synapse`

### Commands

- `uv run uvicorn main:app --reload` — Start dev server (from `backend/`)
- `uv sync` — Install dependencies

### API Endpoints

- `GET /api/devices` — Discover and return available Synapse devices

### Project Structure

```
backend/
├── main.py          # FastAPI app with device discovery endpoint
└── pyproject.toml   # Project config and dependencies
```
