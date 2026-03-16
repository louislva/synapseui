import { Handle, Position, type NodeProps } from "@xyflow/react"
import { NODE_TYPE_DEFS, type NodeData } from "./types"

export function BaseNode({ data, selected }: NodeProps & { data: NodeData }) {
  const def = NODE_TYPE_DEFS[data.type]
  if (!def) return null

  const inputs = def.ports.filter((p) => p.direction === "input")
  const outputs = def.ports.filter((p) => p.direction === "output")

  return (
    <div
      className={`min-w-[160px] rounded-lg border bg-background text-foreground shadow-sm ${
        selected ? "border-ring ring-2 ring-ring/30" : "border-border"
      }`}
    >
      {/* Header */}
      <div
        className="rounded-t-lg px-3 py-1.5 text-xs font-semibold text-white"
        style={{ backgroundColor: def.color }}
      >
        {data.label}
      </div>

      {/* Parameter summary */}
      <div className="px-3 py-2 space-y-0.5">
        {def.params.map((p) => (
          <div key={p.key} className="flex justify-between text-[10px]">
            <span className="text-muted-foreground">{p.label}</span>
            <span className="font-mono">
              {String(data.params[p.key])}
              {p.unit ? ` ${p.unit}` : ""}
            </span>
          </div>
        ))}
      </div>

      {/* Handles */}
      {inputs.map((port, i) => (
        <Handle
          key={port.id}
          type="target"
          position={Position.Left}
          id={port.id}
          style={{ top: `${30 + i * 20}px` }}
          className="!size-2.5 !border-2 !border-background !bg-muted-foreground"
        />
      ))}
      {outputs.map((port, i) => (
        <Handle
          key={port.id}
          type="source"
          position={Position.Right}
          id={port.id}
          style={{ top: `${30 + i * 20}px` }}
          className="!size-2.5 !border-2 !border-background !bg-muted-foreground"
        />
      ))}
    </div>
  )
}
