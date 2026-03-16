import type { Node, Edge } from "@xyflow/react"
import type { NodeData } from "../nodes/types"

export interface ConfigPayload {
  nodes: { id: string; type: string; params: Record<string, number | string | boolean> }[]
  connections: { from: string; to: string }[]
}

export function serializeGraph(
  nodes: Node<NodeData>[],
  edges: Edge[],
): ConfigPayload {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.data.type,
      params: { ...n.data.params },
    })),
    connections: edges.map((e) => ({
      from: e.source,
      to: e.target,
    })),
  }
}
