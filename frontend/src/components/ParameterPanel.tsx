import { Trash2 } from "lucide-react"
import { useGraphStore } from "../store/useGraphStore"
import { NODE_TYPE_DEFS } from "../nodes/types"

export function ParameterPanel() {
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId)
  const nodes = useGraphStore((s) => s.nodes)
  const updateNodeParam = useGraphStore((s) => s.updateNodeParam)
  const removeNode = useGraphStore((s) => s.removeNode)

  const node = nodes.find((n) => n.id === selectedNodeId)
  if (!node) return null

  const def = NODE_TYPE_DEFS[node.data.type]
  if (!def) return null

  return (
    <div className="w-64 border-l border-border bg-background p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: def.color }}
            />
            <h2 className="text-sm font-medium">{node.data.label}</h2>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {def.category}
          </p>
        </div>
        <button
          onClick={() => removeNode(node.id)}
          className="inline-flex items-center justify-center rounded-md size-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      <div className="space-y-3">
        {def.params.map((p) => {
          const value = node.data.params[p.key]

          if (p.type === "select") {
            return (
              <label key={p.key} className="block">
                <span className="text-xs text-muted-foreground">{p.label}</span>
                <select
                  value={String(value)}
                  onChange={(e) => {
                    const opt = p.options?.find(
                      (o) => String(o.value) === e.target.value,
                    )
                    if (opt) updateNodeParam(node.id, p.key, opt.value)
                  }}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                >
                  {p.options?.map((o) => (
                    <option key={String(o.value)} value={String(o.value)}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            )
          }

          if (p.type === "boolean") {
            return (
              <label
                key={p.key}
                className="flex items-center justify-between gap-2"
              >
                <span className="text-xs text-muted-foreground">{p.label}</span>
                <input
                  type="checkbox"
                  checked={Boolean(value)}
                  onChange={(e) =>
                    updateNodeParam(node.id, p.key, e.target.checked)
                  }
                  className="rounded border-border"
                />
              </label>
            )
          }

          if (p.type === "number") {
            return (
              <label key={p.key} className="block">
                <span className="text-xs text-muted-foreground">
                  {p.label}
                  {p.unit ? ` (${p.unit})` : ""}
                </span>
                <input
                  type="number"
                  value={Number(value)}
                  min={p.min}
                  max={p.max}
                  step={p.step}
                  onChange={(e) =>
                    updateNodeParam(node.id, p.key, Number(e.target.value))
                  }
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm font-mono outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                />
              </label>
            )
          }

          // string
          return (
            <label key={p.key} className="block">
              <span className="text-xs text-muted-foreground">{p.label}</span>
              <input
                type="text"
                value={String(value)}
                onChange={(e) =>
                  updateNodeParam(node.id, p.key, e.target.value)
                }
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              />
            </label>
          )
        })}
      </div>
    </div>
  )
}
