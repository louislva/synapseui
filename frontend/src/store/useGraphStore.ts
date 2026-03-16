import { create } from "zustand"
import {
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type Connection,
  applyNodeChanges,
  applyEdgeChanges,
} from "@xyflow/react"
import {
  type NodeData,
  type NodeTypeDef,
  NODE_TYPE_DEFS,
  createDefaultParams,
} from "../nodes/types"

export interface GraphState {
  nodes: Node<NodeData>[]
  edges: Edge[]
  selectedNodeId: string | null

  onNodesChange: OnNodesChange<Node<NodeData>>
  onEdgesChange: OnEdgesChange
  onConnect: OnConnect

  addNode: (typeDef: NodeTypeDef, position: { x: number; y: number }) => void
  removeNode: (id: string) => void
  selectNode: (id: string | null) => void
  updateNodeParam: (
    nodeId: string,
    key: string,
    value: number | string | boolean,
  ) => void

  loadGraph: (nodes: Node<NodeData>[], edges: Edge[]) => void
  clearGraph: () => void
}

function hasCycle(
  edges: Edge[],
  newSource: string,
  newTarget: string,
): boolean {
  const adj = new Map<string, string[]>()
  for (const e of edges) {
    const list = adj.get(e.source) ?? []
    list.push(e.target)
    adj.set(e.source, list)
  }
  const srcList = adj.get(newSource) ?? []
  srcList.push(newTarget)
  adj.set(newSource, srcList)

  const visited = new Set<string>()
  const stack = [newSource]
  while (stack.length > 0) {
    const node = stack.pop()!
    if (node === newSource && visited.has(newSource)) return true
    if (visited.has(node)) continue
    visited.add(node)
    for (const next of adj.get(node) ?? []) {
      if (next === newSource) return true
      stack.push(next)
    }
  }
  return false
}

function isValidConnection(
  connection: Connection,
  nodes: Node<NodeData>[],
): boolean {
  const sourceNode = nodes.find((n) => n.id === connection.source)
  const targetNode = nodes.find((n) => n.id === connection.target)
  if (!sourceNode || !targetNode) return false

  const sourceDef = NODE_TYPE_DEFS[sourceNode.data.type]
  const targetDef = NODE_TYPE_DEFS[targetNode.data.type]
  if (!sourceDef || !targetDef) return false

  const sourcePort = sourceDef.ports.find(
    (p) => p.id === connection.sourceHandle,
  )
  const targetPort = targetDef.ports.find(
    (p) => p.id === connection.targetHandle,
  )
  if (!sourcePort || !targetPort) return false

  return (
    sourcePort.direction === "output" && targetPort.direction === "input"
  )
}

export const useGraphStore = create<GraphState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,

  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges<Node<NodeData>>(changes, get().nodes) })
  },

  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) })
  },

  onConnect: (connection) => {
    const { edges, nodes } = get()
    if (!isValidConnection(connection, nodes)) return
    if (hasCycle(edges, connection.source, connection.target)) return

    const newEdge: Edge = {
      id: `e-${connection.source}-${connection.sourceHandle}-${connection.target}-${connection.targetHandle}`,
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
      type: "smoothstep",
    }
    set({ edges: [...edges, newEdge] })
  },

  addNode: (typeDef, position) => {
    const id = crypto.randomUUID()
    const newNode: Node<NodeData> = {
      id,
      type: "synapse_node",
      position,
      data: {
        type: typeDef.type,
        label: typeDef.label,
        params: createDefaultParams(typeDef),
      },
    }
    set({ nodes: [...get().nodes, newNode] })
  },

  removeNode: (id) => {
    set({
      nodes: get().nodes.filter((n) => n.id !== id),
      edges: get().edges.filter((e) => e.source !== id && e.target !== id),
      selectedNodeId: get().selectedNodeId === id ? null : get().selectedNodeId,
    })
  },

  selectNode: (id) => {
    set({ selectedNodeId: id })
  },

  updateNodeParam: (nodeId, key, value) => {
    set({
      nodes: get().nodes.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, params: { ...n.data.params, [key]: value } } }
          : n,
      ),
    })
  },

  loadGraph: (nodes, edges) => {
    set({ nodes, edges, selectedNodeId: null })
  },

  clearGraph: () => {
    set({ nodes: [], edges: [], selectedNodeId: null })
  },
}))
