import { create } from "zustand"
import type { Node, Edge } from "@xyflow/react"
import type { NodeData } from "../nodes/types"
import { useGraphStore } from "./useGraphStore"

export interface SavedConfig {
  id: string
  name: string
  nodes: Node<NodeData>[]
  edges: Edge[]
  updatedAt: number
}

interface ConfigState {
  configs: SavedConfig[]
  activeConfigId: string | null

  createConfig: (name?: string) => string
  saveActiveConfig: () => void
  deleteConfig: (id: string) => void
  duplicateConfig: (id: string) => void
  renameConfig: (id: string, name: string) => void
  setActiveConfig: (id: string) => void
}

const STORAGE_KEY = "synapseui-configs"

function loadFromStorage(): SavedConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (e) {
    console.error("Failed to load configs from localStorage:", e)
    return []
  }
}

function saveToStorage(configs: SavedConfig[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(configs))
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  configs: loadFromStorage(),
  activeConfigId: null,

  createConfig: (name) => {
    const id = crypto.randomUUID()
    const config: SavedConfig = {
      id,
      name: name ?? `Config ${get().configs.length + 1}`,
      nodes: [],
      edges: [],
      updatedAt: Date.now(),
    }
    const configs = [...get().configs, config]
    saveToStorage(configs)
    set({ configs, activeConfigId: id })

    useGraphStore.getState().loadGraph([], [])
    return id
  },

  saveActiveConfig: () => {
    const { activeConfigId, configs } = get()
    if (!activeConfigId) return
    const { nodes, edges } = useGraphStore.getState()
    const updated = configs.map((c) =>
      c.id === activeConfigId
        ? { ...c, nodes, edges, updatedAt: Date.now() }
        : c,
    )
    saveToStorage(updated)
    set({ configs: updated })
  },

  deleteConfig: (id) => {
    const configs = get().configs.filter((c) => c.id !== id)
    saveToStorage(configs)
    const activeConfigId =
      get().activeConfigId === id ? null : get().activeConfigId
    if (activeConfigId === null) {
      useGraphStore.getState().clearGraph()
    }
    set({ configs, activeConfigId })
  },

  duplicateConfig: (id) => {
    const source = get().configs.find((c) => c.id === id)
    if (!source) return
    const newId = crypto.randomUUID()
    const config: SavedConfig = {
      ...source,
      id: newId,
      name: `${source.name} (copy)`,
      updatedAt: Date.now(),
    }
    const configs = [...get().configs, config]
    saveToStorage(configs)
    set({ configs })
  },

  renameConfig: (id, name) => {
    const configs = get().configs.map((c) =>
      c.id === id ? { ...c, name, updatedAt: Date.now() } : c,
    )
    saveToStorage(configs)
    set({ configs })
  },

  setActiveConfig: (id) => {
    const config = get().configs.find((c) => c.id === id)
    if (!config) return
    set({ activeConfigId: id })
    useGraphStore.getState().loadGraph(config.nodes, config.edges)
  },
}))

// Auto-save: persist the active config whenever the graph changes.
let _saveTimer: ReturnType<typeof setTimeout> | null = null

useGraphStore.subscribe((state, prev) => {
  if (state.nodes === prev.nodes && state.edges === prev.edges) return
  const { activeConfigId } = useConfigStore.getState()
  if (!activeConfigId) return

  // Debounce to avoid thrashing localStorage during drags
  if (_saveTimer) clearTimeout(_saveTimer)
  _saveTimer = setTimeout(() => {
    useConfigStore.getState().saveActiveConfig()
  }, 500)
})
