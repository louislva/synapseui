import { useCallback, useRef, useState } from "react"
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type ReactFlowInstance,
  type NodeMouseHandler,
} from "@xyflow/react"
import type { NodeData } from "../nodes/types"
import "@xyflow/react/dist/style.css"

import { nodeTypes } from "../nodes"
import { useGraphStore } from "../store/useGraphStore"
import { useConfigStore } from "../store/useConfigStore"
import {
  CanvasContextMenu,
  NodeContextMenu,
} from "./NodeContextMenu"
import { Button } from "./ui/button"

type ContextMenu =
  | { kind: "canvas"; x: number; y: number; flowPosition: { x: number; y: number } }
  | { kind: "node"; x: number; y: number; nodeId: string }
  | null

export function NodeEditor() {
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const onNodesChange = useGraphStore((s) => s.onNodesChange)
  const onEdgesChange = useGraphStore((s) => s.onEdgesChange)
  const onConnect = useGraphStore((s) => s.onConnect)
  const selectNode = useGraphStore((s) => s.selectNode)
  const activeConfigId = useConfigStore((s) => s.activeConfigId)
  const createConfig = useConfigStore((s) => s.createConfig)

  const [menu, setMenu] = useState<ContextMenu>(null)
  const rfInstance = useRef<ReactFlowInstance<Node<NodeData>> | null>(null)

  const closeMenu = useCallback(() => setMenu(null), [])

  const onPaneContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent) => {
      event.preventDefault()
      if (!rfInstance.current || !activeConfigId) return
      const flowPosition = rfInstance.current.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })
      setMenu({ kind: "canvas", x: event.clientX, y: event.clientY, flowPosition })
    },
    [activeConfigId],
  )

  const onNodeContextMenu: NodeMouseHandler = useCallback(
    (event, node) => {
      event.preventDefault()
      setMenu({ kind: "node", x: event.clientX, y: event.clientY, nodeId: node.id })
    },
    [],
  )

  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      selectNode(node.id)
      closeMenu()
    },
    [selectNode, closeMenu],
  )

  const onPaneClick = useCallback(() => {
    selectNode(null)
    closeMenu()
  }, [selectNode, closeMenu])

  if (!activeConfigId) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-3">
            No config selected.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => createConfig()}
          >
            New Config
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex-1">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={(instance) => {
          rfInstance.current = instance
        }}
        nodeTypes={nodeTypes}
        onPaneContextMenu={onPaneContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        defaultEdgeOptions={{ type: "smoothstep" }}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} size={1} />
        <Controls />
        <MiniMap
          nodeStrokeWidth={3}
          className="!bg-muted/50 !border-border"
        />
      </ReactFlow>

      {menu?.kind === "canvas" && (
        <CanvasContextMenu
          x={menu.x}
          y={menu.y}
          flowPosition={menu.flowPosition}
          onClose={closeMenu}
        />
      )}
      {menu?.kind === "node" && (
        <NodeContextMenu
          x={menu.x}
          y={menu.y}
          nodeId={menu.nodeId}
          onClose={closeMenu}
        />
      )}
    </div>
  )
}
