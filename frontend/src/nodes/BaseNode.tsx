import { Handle, Position, useEdges, useNodes, type Node, type NodeProps } from "@xyflow/react"
import { AlertTriangle, Radio } from "lucide-react"
import { NODE_TYPE_DEFS, type NodeData } from "./types"
import { useDeviceStore } from "../store/useDeviceStore"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/ui/tooltip"

/** Normalize a string for fuzzy matching: lowercase, strip underscores/spaces */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[_\s-]/g, "")
}

export function BaseNode({ data, id, selected }: NodeProps & { data: NodeData }) {
  const def = NODE_TYPE_DEFS[data.type]
  const taps = useDeviceStore((s) => s.taps)
  const requestStreamTap = useDeviceStore((s) => s.requestStreamTap)
  const allNodes = useNodes<Node<NodeData>>()
  const allEdges = useEdges()

  if (!def) return null

  // Check for Nyquist violations on spectral filter nodes
  let nyquistTooltip = ""
  if (data.type === "spectral_filter") {
    const inEdge = allEdges.find((e) => e.target === id)
    if (inEdge) {
      const srcNode = allNodes.find((n) => n.id === inEdge.source)
      const sr = srcNode?.data?.params?.["sample_rate_hz"]
      if (typeof sr === "number") {
        const nyquist = sr / 2
        const method = data.params["method"]
        const low = data.params["low_cutoff_hz"] as number
        const high = data.params["high_cutoff_hz"] as number
        const issues: string[] = []
        if ((method === "kLowPass" || method === "kBandPass" || method === "kBandStop") && high >= nyquist) {
          issues.push(`High cutoff (${high} Hz) ≥ Nyquist (${nyquist} Hz)`)
        }
        if ((method === "kHighPass" || method === "kBandPass" || method === "kBandStop") && low >= nyquist) {
          issues.push(`Low cutoff (${low} Hz) ≥ Nyquist (${nyquist} Hz)`)
        }
        if (issues.length) {
          nyquistTooltip = issues.join("\n")
        }
      }
    }
  }

  const inputs = def.ports.filter((p) => p.direction === "input")
  const outputs = def.ports.filter((p) => p.direction === "output")

  // Match taps to this node by comparing normalized names
  const nodeNorm = normalize(data.type)
  const labelNorm = normalize(data.label)
  const matchingTap = taps.find((t) => {
    const tapNorm = normalize(t.name)
    return tapNorm.includes(nodeNorm) || tapNorm.includes(labelNorm)
      || nodeNorm.includes(tapNorm) || labelNorm.includes(tapNorm)
  })

  return (
    <div
      className={`min-w-[160px] rounded-lg border bg-background text-foreground shadow-sm ${
        selected ? "border-ring ring-2 ring-ring/30" : "border-border"
      }`}
    >
      {/* Header */}
      <div
        className="rounded-t-lg px-3 py-1.5 text-xs font-semibold text-white flex items-center justify-between"
        style={{ backgroundColor: def.color }}
      >
        {data.label}
        {nyquistTooltip && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <AlertTriangle className="size-3.5 text-amber-200" />
              </TooltipTrigger>
              <TooltipContent side="right">
                {nyquistTooltip}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
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

      {/* Tap link */}
      {matchingTap && (
        <div className="px-3 pb-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              requestStreamTap(matchingTap.name)
            }}
            className="inline-flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
          >
            <Radio className="size-2.5" />
            <span className="underline">Stream</span>
          </button>
        </div>
      )}

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
