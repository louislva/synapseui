import { NODE_TYPE_LIST, type NodeTypeDef } from "../nodes/types"
import { useGraphStore } from "../store/useGraphStore"
import { Button } from "./ui/button"

interface CanvasMenuProps {
  x: number
  y: number
  flowPosition: { x: number; y: number }
  onClose: () => void
}

const categories = ["Sources", "Filters", "Stimulation"] as const

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
              <Button
                key={def.type}
                variant="ghost"
                size="sm"
                onClick={() => handleAdd(def)}
                className="w-full justify-start"
              >
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: def.color }}
                />
                {def.label}
              </Button>
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
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          removeNode(nodeId)
          onClose()
        }}
        className="w-full justify-start text-destructive hover:bg-destructive/10"
      >
        Delete
      </Button>
    </div>
  )
}
