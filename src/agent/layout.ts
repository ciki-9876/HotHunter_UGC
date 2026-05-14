import dagre from 'dagre'
import type { Edge, Node } from 'reactflow'

/** Approximate dimensions per node type, used by dagre for spacing. */
const NODE_DIMS: Record<string, { w: number; h: number }> = {
  topicInput: { w: 300, h: 200 },
  outlineAgent: { w: 280, h: 280 },
  writerAgent: { w: 280, h: 280 },
  editorAgent: { w: 280, h: 280 },
  genericAgent: { w: 280, h: 280 },
  criticNode: { w: 280, h: 240 },
  outputNode: { w: 280, h: 200 },
  dispatchNode: { w: 280, h: 220 },
}

/**
 * Compute new node positions using dagre's LR (left-to-right) hierarchical
 * layout. Returns a new nodes array with updated `position` fields; edges
 * are untouched.
 */
export function autoLayout(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph()
  g.setGraph({
    rankdir: 'LR',
    nodesep: 60,
    ranksep: 100,
    edgesep: 30,
    marginx: 40,
    marginy: 40,
  })
  g.setDefaultEdgeLabel(() => ({}))

  for (const n of nodes) {
    const d = NODE_DIMS[n.type ?? 'genericAgent'] ?? { w: 280, h: 240 }
    g.setNode(n.id, { width: d.w, height: d.h })
  }
  for (const e of edges) {
    g.setEdge(e.source, e.target)
  }

  dagre.layout(g)

  return nodes.map((n) => {
    const dn = g.node(n.id)
    if (!dn) return n
    const d = NODE_DIMS[n.type ?? 'genericAgent'] ?? { w: 280, h: 240 }
    return {
      ...n,
      position: { x: dn.x - d.w / 2, y: dn.y - d.h / 2 },
    }
  })
}
