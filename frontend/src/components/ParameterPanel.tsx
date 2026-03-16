import { AlertTriangle, Trash2 } from "lucide-react"
import { useGraphStore } from "../store/useGraphStore"
import { NODE_TYPE_DEFS } from "../nodes/types"
import { Button } from "./ui/button"
import type { Node, Edge } from "@xyflow/react"
import type { NodeData } from "../nodes/types"

function getUpstreamSampleRate(
  nodeId: string,
  nodes: Node<NodeData>[],
  edges: Edge[],
): number | null {
  const inEdge = edges.find((e) => e.target === nodeId)
  if (!inEdge) return null
  const srcNode = nodes.find((n) => n.id === inEdge.source)
  if (!srcNode) return null
  const sr = srcNode.data.params["sample_rate_hz"]
  if (typeof sr === "number") return sr
  // recurse upstream (e.g. filter chained to filter)
  return getUpstreamSampleRate(srcNode.id, nodes, edges)
}

function getFilterWarnings(
  node: Node<NodeData>,
  nodes: Node<NodeData>[],
  edges: Edge[],
): string[] {
  if (node.data.type !== "spectral_filter") return []
  const sampleRate = getUpstreamSampleRate(node.id, nodes, edges)
  if (!sampleRate) return []

  const nyquist = sampleRate / 2
  const warnings: string[] = []
  const method = node.data.params["method"]
  const low = node.data.params["low_cutoff_hz"] as number
  const high = node.data.params["high_cutoff_hz"] as number

  if (method === "kHighPass" || method === "kBandPass" || method === "kBandStop") {
    if (low >= nyquist) {
      warnings.push(`Low cutoff (${low} Hz) must be below Nyquist (${nyquist} Hz)`)
    }
  }
  if (method === "kLowPass" || method === "kBandPass" || method === "kBandStop") {
    if (high >= nyquist) {
      warnings.push(`High cutoff (${high} Hz) must be below Nyquist (${nyquist} Hz)`)
    }
  }
  if ((method === "kBandPass" || method === "kBandStop") && low >= high) {
    warnings.push(`Low cutoff must be less than high cutoff`)
  }

  return warnings
}

export function ParameterPanel() {
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId)
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const updateNodeParam = useGraphStore((s) => s.updateNodeParam)
  const removeNode = useGraphStore((s) => s.removeNode)

  const node = nodes.find((n) => n.id === selectedNodeId)
  if (!node) return null

  const def = NODE_TYPE_DEFS[node.data.type]
  if (!def) return null

  const warnings = getFilterWarnings(node, nodes, edges)

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
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => removeNode(node.id)}
          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="size-3.5" />
        </Button>
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

      {warnings.length > 0 && (
        <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 space-y-1.5">
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs text-amber-400">
              <AlertTriangle className="size-3.5 mt-0.5 shrink-0" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
