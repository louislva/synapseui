import { useState } from "react"
import { Plus, Copy, Trash2, Check, X } from "lucide-react"
import { useConfigStore } from "../store/useConfigStore"

export function ConfigsSidebar() {
  const { configs, activeConfigId, createConfig, setActiveConfig, deleteConfig, duplicateConfig, renameConfig } =
    useConfigStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")

  const startRename = (id: string, currentName: string) => {
    setEditingId(id)
    setEditName(currentName)
  }

  const commitRename = () => {
    if (editingId && editName.trim()) {
      renameConfig(editingId, editName.trim())
    }
    setEditingId(null)
  }

  return (
    <div className="w-64 border-r border-border bg-background p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-muted-foreground">Configs</h2>
        <button
          onClick={() => createConfig()}
          className="inline-flex items-center justify-center rounded-md size-6 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <Plus className="size-3.5" />
        </button>
      </div>

      {configs.length === 0 && (
        <p className="text-sm text-muted-foreground">No configs yet.</p>
      )}

      <ul className="space-y-1">
        {configs.map((config) => (
          <li
            key={config.id}
            className={`group rounded-md border p-2 cursor-pointer transition-colors ${
              config.id === activeConfigId
                ? "border-ring bg-muted/50"
                : "border-border hover:bg-muted/30"
            }`}
            onClick={() => setActiveConfig(config.id)}
          >
            {editingId === config.id ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename()
                    if (e.key === "Escape") setEditingId(null)
                  }}
                  className="flex-1 rounded border border-border bg-background px-1.5 py-0.5 text-sm outline-none focus:border-ring"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    commitRename()
                  }}
                  className="size-5 inline-flex items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  <Check className="size-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditingId(null)
                  }}
                  className="size-5 inline-flex items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              </div>
            ) : (
              <>
                <div
                  className="text-sm font-medium"
                  onDoubleClick={(e) => {
                    e.stopPropagation()
                    startRename(config.id, config.name)
                  }}
                >
                  {config.name}
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-muted-foreground">
                    {config.nodes.length} node{config.nodes.length !== 1 ? "s" : ""}
                  </span>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        duplicateConfig(config.id)
                      }}
                      className="size-5 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    >
                      <Copy className="size-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteConfig(config.id)
                      }}
                      className="size-5 inline-flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
