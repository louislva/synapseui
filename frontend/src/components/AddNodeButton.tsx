import { useState, useRef, useEffect } from "react"
import { useReactFlow } from "@xyflow/react"
import { Plus } from "lucide-react"
import { NODE_TYPE_LIST, type NodeTypeDef } from "../nodes/types"
import { useGraphStore } from "../store/useGraphStore"
import { Button } from "./ui/button"

const categories = ["Sources", "Filters", "Stimulation"] as const

export function AddNodeButton() {
  const [open, setOpen] = useState(false)
  const addNode = useGraphStore((s) => s.addNode)
  const rf = useReactFlow()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  const handleAdd = (def: NodeTypeDef) => {
    const container = document.querySelector(".react-flow")
    const w = container?.clientWidth ?? 800
    const h = container?.clientHeight ?? 600
    const center = rf.screenToFlowPosition({ x: w / 2, y: h / 2 })
    addNode(def, center)
    setOpen(false)
  }

  return (
    <div ref={ref} className="absolute top-3 left-3 z-10">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(!open)}
        className="shadow-md bg-background"
      >
        <Plus className="size-3.5" />
        Add Node
      </Button>

      {open && (
        <div className="absolute top-full left-0 mt-1 min-w-[160px] rounded-lg border border-border bg-popover p-1 shadow-lg">
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
      )}
    </div>
  )
}
