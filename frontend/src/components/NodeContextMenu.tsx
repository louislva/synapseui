import { NODE_TYPE_LIST, type NodeTypeDef } from "../nodes/types"
import { useGraphStore } from "../store/useGraphStore"

interface CanvasMenuProps {
  x: number
  y: number
  flowPosition: { x: number; y: number }
  onClose: () => void
}

const categories = ["Sources", "Filters", "Detectors"] as const

export function CanvasContextMenu({
  x,
  y,
  flowPosition,
  onClose,
}: CanvasMenuProps) {
  const addNode = useGraphStore((s) => s.addNode)

  const handleAdd = (def: NodeTypeDef) => {
    addNode(def, flowPosition)
    onClose()
  }

  return (
    <div
      className="fixed z-50 min-w-[160px] rounded-lg border border-border bg-popover p-1 shadow-lg"
      style={{ left: x, top: y }}
    >
      <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
        Add Node
      </div>
      {categories.map((cat) => {
        const items = NODE_TYPE_LIST.filter((d) => d.category === cat)
        if (items.length === 0) return null
        return (
          <div key={cat}>
            <div className="px-2 pt-2 pb-0.5 text-[10px] text-muted-foreground">
              {cat}
            </div>
            {items.map((def) => (
              <button
                key={def.type}
                onClick={() => handleAdd(def)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors"
              >
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: def.color }}
                />
                {def.label}
              </button>
            ))}
          </div>
        )
      })}
    </div>
  )
}

interface NodeMenuProps {
  x: number
  y: number
  nodeId: string
  onClose: () => void
}

export function NodeContextMenu({ x, y, nodeId, onClose }: NodeMenuProps) {
  const removeNode = useGraphStore((s) => s.removeNode)

  return (
    <div
      className="fixed z-50 min-w-[140px] rounded-lg border border-border bg-popover p-1 shadow-lg"
      style={{ left: x, top: y }}
    >
      <button
        onClick={() => {
          // Placeholder — will open live data viewer later
          onClose()
        }}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors"
      >
        Tap Output
      </button>
      <button
        onClick={() => {
          removeNode(nodeId)
          onClose()
        }}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
      >
        Delete
      </button>
    </div>
  )
}
