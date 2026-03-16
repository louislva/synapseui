import type { Node, Edge } from "@xyflow/react"
import type { NodeData } from "../nodes/types"

export interface ConfigPayload {
  nodes: { id: string; type: string; params: Record<string, number | string | boolean> }[]
  connections: { source: string; target: string }[]
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
      source: e.source,
      target: e.target,
    })),
  }
}

export function configHash(
  nodes: Node<NodeData>[],
  edges: Edge[],
): string {
  // Use stable indices instead of random UUIDs so the hash survives
  // localStorage round-trips where node IDs are regenerated.
  const idToIndex = new Map(nodes.map((n, i) => [n.id, i]))
  const stable = {
    nodes: nodes.map((n) => ({ type: n.data.type, params: n.data.params })),
    connections: edges.map((e) => ({
      from: idToIndex.get(e.source),
      to: idToIndex.get(e.target),
    })),
  }
  return JSON.stringify(stable)
}
