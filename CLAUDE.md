# SynapseUI

> **Do NOT start dev servers (frontend, backend, or simulator) unless explicitly asked by the user.**

## Frontend

- **Location:** `frontend/`
- **Stack:** Vite 8, React 19, TypeScript 5.9
- **Entry point:** `src/main.tsx` renders `<App />` into `#root`

### Commands

- `npm run dev` — Start dev server
- `npm run build` — Type-check (`tsc -b`) then build for production
- `npm run lint` — ESLint
- `npm run preview` — Preview production build

### Key Libraries

- **@xyflow/react** (React Flow v12) — node graph editor for signal chain canvas
- **zustand** v5 — state management (graph store, config store, device store)
- **Tailwind CSS** v4.2 + shadcn/ui — styling and components
- **lucide-react** — icons

### Project Structure

```
frontend/src/
├── main.tsx                    # App entry point
├── App.tsx                     # Root component: toolbar, sidebars, canvas layout
├── index.css                   # Global styles + React Flow theme overrides
├── store/
│   ├── useGraphStore.ts        # Zustand: nodes, edges, selection, CRUD, DAG validation
│   ├── useConfigStore.ts       # Zustand: saved configs (localStorage), active config
│   └── useDeviceStore.ts       # Zustand: selected device URI, deployed config hashes
├── nodes/
│   ├── types.ts                # Node type registry (NodeTypeDef, ParamDef, NodeData)
│   ├── BaseNode.tsx            # Generic React Flow node component (all types)
│   └── index.ts                # nodeTypes map for React Flow
├── components/
│   ├── NodeEditor.tsx          # React Flow canvas + background + controls + minimap
│   ├── NodeContextMenu.tsx     # Right-click menus (canvas: add node, node: tap/delete)
│   ├── ConfigsSidebar.tsx      # Left sidebar: saved configs list
│   └── ParameterPanel.tsx      # Right panel: edit selected node parameters
├── hooks/
│   └── useDevices.ts           # Device discovery polling + simulator management
├── lib/
│   ├── serialize.ts            # Graph → backend config JSON + config hashing
│   └── utils.ts                # cn() classname utility
└── components/ui/
    └── button.tsx              # shadcn Button component
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

- `GET /api/devices` — Discover devices (returns `uri`, name, serial, status)
- `POST /api/devices/configure?uri=<host:port>` — Deploy signal chain config to device
- `POST /api/devices/start?uri=<host:port>` — Start device (returns new status)
- `POST /api/devices/stop?uri=<host:port>` — Stop device (returns new status)
- `GET /api/simulators` — List running simulators
- `POST /api/simulators` — Launch a simulator
- `DELETE /api/simulators/{id}` — Kill a simulator

### Project Structure

```
backend/
├── main.py          # FastAPI app with all endpoints
└── pyproject.toml   # Project config and dependencies
```

### Synapse Library Notes

- `syn.Device(uri)` connects directly — no discovery needed when you have `host:port`
- Device identification uses `uri` (`host:port`) everywhere, not serial
- `device.configure(config)`, `device.start()`, `device.stop()` are the core control methods
- `discover()` broadcasts on the network and is slow (~1s timeout); avoid in hot paths
- Node types: `syn.BroadbandSource`, `syn.SpectralFilter`, `syn.SpikeDetector`
- Device states: Unknown, Initializing, Stopped, Running, Error (from `DeviceState` protobuf)

## Simulator

The `science-synapse` package provides a device simulator for local development.

### Running

Start the simulator from `backend/`:

```
uv run synapse-sim --iface-ip 127.0.0.1
```

Optional flags: `--name <name>`, `--serial <serial>`, `--rpc-port`, `--discovery-port`, `--discovery-addr`, `-v`.

## Running All Services

Start both dev servers in separate terminals (or as background tasks):

1. **Backend:** `cd backend && uv run uvicorn main:app --reload`
2. **Frontend:** `cd frontend && npm run dev`

Optionally, also start the simulator for local device emulation:

3. **Simulator (optional):** `cd backend && uv run synapse-sim --iface-ip 127.0.0.1`
