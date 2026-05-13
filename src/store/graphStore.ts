/**
 * graphStore — nodes, edges, canvas state, selection
 */
import {
  applyNodeChanges, applyEdgeChanges, addEdge as rfAddEdge,
  type Connection, type Edge, type EdgeChange, type Node, type NodeChange,
} from 'reactflow'
import { create } from 'zustand'
import { getNodeDef } from '../nodes/registry'
import type { NodeConfig } from '../types'

const NODE_IDS = {
  input:   'node-input',
  outline: 'node-outline',
  writer:  'node-writer',
  editor:  'node-editor',
  output:  'node-output',
}

function makeSeedNodes(): Node[] {
  return [
    { id: NODE_IDS.input,   type: 'topicInput',   position: { x: 40,   y: 220 }, data: {} },
    { id: NODE_IDS.outline, type: 'outlineAgent', position: { x: 380,  y: 240 }, data: {} },
    { id: NODE_IDS.writer,  type: 'writerAgent',  position: { x: 700,  y: 240 }, data: {} },
    { id: NODE_IDS.editor,  type: 'editorAgent',  position: { x: 1020, y: 240 }, data: {} },
    { id: NODE_IDS.output,  type: 'outputNode',   position: { x: 1340, y: 220 }, data: {} },
  ]
}
function makeSeedEdges(): Edge[] {
  return [
    { id: 'e-input-outline',  source: NODE_IDS.input,   target: NODE_IDS.outline, type: 'flow' },
    { id: 'e-outline-writer', source: NODE_IDS.outline, target: NODE_IDS.writer,  type: 'flow' },
    { id: 'e-writer-editor',  source: NODE_IDS.writer,  target: NODE_IDS.editor,  type: 'flow' },
    { id: 'e-editor-output',  source: NODE_IDS.editor,  target: NODE_IDS.output,  type: 'flow' },
  ]
}

function makeNodeId(prefix = 'agent') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`
}

interface GraphState {
  nodes: Node[]
  edges: Edge[]
  selectedNodeId: string | null

  applyNodeChanges: (changes: NodeChange[]) => void
  applyEdgeChanges: (changes: EdgeChange[]) => void
  onConnect: (conn: Connection) => void
  selectNode: (id: string | null) => void

  addNodeOfType: (
    type: string,
    position?: { x: number; y: number },
    connection?: { fromNodeId: string; handleType: 'source' | 'target' },
    extraData?: Record<string, unknown>,
    extraConfig?: Partial<NodeConfig>,
  ) => string | null

  deleteNode: (id: string) => void
  resetGraph: () => void
  setNodes: (nodes: Node[]) => void
  setEdges: (edges: Edge[]) => void
}

export const useGraphStore = create<GraphState>((set, get) => ({
  nodes: makeSeedNodes(),
  edges: makeSeedEdges(),
  selectedNodeId: null,

  applyNodeChanges: (changes) =>
    set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) })),

  applyEdgeChanges: (changes) =>
    set((s) => ({ edges: applyEdgeChanges(changes, s.edges) })),

  onConnect: (conn) => {
    if (!conn.source || !conn.target || conn.source === conn.target) return
    set((s) => {
      const exists = s.edges.some(
        (e) => e.source === conn.source && e.target === conn.target,
      )
      if (exists) return {}
      const edge: Edge = {
        id: `e-${conn.source}-${conn.target}-${Math.random().toString(36).slice(2, 6)}`,
        source: conn.source!,
        target: conn.target!,
        type: 'flow',
      }
      return { edges: rfAddEdge(edge, s.edges) }
    })
  },

  selectNode: (id) => set({ selectedNodeId: id }),

  addNodeOfType: (type, position, connection, extraData, extraConfig) => {
    const def = getNodeDef(type)
    if (!def) {
      console.warn(`[graphStore] Unknown node type: ${type}`)
      return null
    }
    const id = makeNodeId(type)
    const pos = position ?? { x: 480 + Math.random() * 200, y: 300 + Math.random() * 80 }

    const newNode: Node = {
      id,
      type,
      position: { x: pos.x - 120, y: pos.y - 60 },
      data: { ...(def.defaultData ?? {}), ...(extraData ?? {}) },
    }

    set((s) => {
      let nextEdges = s.edges
      if (connection) {
        const { fromNodeId, handleType } = connection
        const source = handleType === 'source' ? fromNodeId : id
        const target = handleType === 'source' ? id : fromNodeId
        if (source !== target && !nextEdges.some((e) => e.source === source && e.target === target)) {
          nextEdges = [
            ...nextEdges,
            { id: `e-${source}-${target}-${Math.random().toString(36).slice(2, 6)}`, source, target, type: 'flow' },
          ]
        }
      }
      return { nodes: [...s.nodes, newNode], edges: nextEdges }
    })

    // also register config in configStore
    import('./configStore').then(({ useConfigStore }) => {
      const baseConfig = {
        label: def.title,
        systemPrompt: '',
        userPromptTemplate: '{input}',
        temperature: 0.7,
        maxTokens: 2000,
        ...def.defaultConfig,
        ...(extraConfig ?? {}),
      } as NodeConfig
      useConfigStore.getState().setNodeConfig(id, baseConfig)
    })

    return id
  },

  deleteNode: (id) => {
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.source !== id && e.target !== id),
      selectedNodeId: s.selectedNodeId === id ? null : s.selectedNodeId,
    }))
    import('./configStore').then(({ useConfigStore }) =>
      useConfigStore.getState().removeNodeConfig(id),
    )
    import('./executionStore').then(({ useExecutionStore }) =>
      useExecutionStore.getState().clearNodeState(id),
    )
  },

  resetGraph: () =>
    set({ nodes: makeSeedNodes(), edges: makeSeedEdges(), selectedNodeId: null }),

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
}))

export { NODE_IDS }
