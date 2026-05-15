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

interface HistoryEntry { nodes: Node[]; edges: Edge[] }

interface GraphState {
  nodes: Node[]
  edges: Edge[]
  selectedNodeId: string | null

  // undo/redo history
  _past:   HistoryEntry[]
  _future: HistoryEntry[]
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
  /** 调用方在做「可撤销操作」前先 push 快照 */
  _pushHistory: () => void

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

const MAX_HISTORY = 50

export const useGraphStore = create<GraphState>((set, get) => ({
  nodes: makeSeedNodes(),
  edges: makeSeedEdges(),
  selectedNodeId: null,

  _past:   [],
  _future: [],
  canUndo: false,
  canRedo: false,

  _pushHistory: () => {
    const { nodes, edges, _past } = get()
    const entry: HistoryEntry = {
      nodes: nodes.map((n) => ({ ...n })),
      edges: edges.map((e) => ({ ...e })),
    }
    const past = [..._past, entry].slice(-MAX_HISTORY)
    set({ _past: past, _future: [], canUndo: true, canRedo: false })
  },

  undo: () => {
    const { _past, nodes, edges, _future } = get()
    if (!_past.length) return
    const prev = _past[_past.length - 1]
    const past = _past.slice(0, -1)
    const future = [{ nodes: nodes.map((n) => ({ ...n })), edges: edges.map((e) => ({ ...e })) }, ..._future].slice(0, MAX_HISTORY)
    set({ nodes: prev.nodes, edges: prev.edges, _past: past, _future: future, canUndo: past.length > 0, canRedo: true })
  },

  redo: () => {
    const { _future, nodes, edges, _past } = get()
    if (!_future.length) return
    const next = _future[0]
    const future = _future.slice(1)
    const past = [..._past, { nodes: nodes.map((n) => ({ ...n })), edges: edges.map((e) => ({ ...e })) }].slice(-MAX_HISTORY)
    set({ nodes: next.nodes, edges: next.edges, _past: past, _future: future, canUndo: true, canRedo: future.length > 0 })
  },

  applyNodeChanges: (changes) =>
    set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) })),

  applyEdgeChanges: (changes) =>
    set((s) => ({ edges: applyEdgeChanges(changes, s.edges) })),

  onConnect: (conn) => {
    if (!conn.source || !conn.target || conn.source === conn.target) return
    get()._pushHistory()
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
    get()._pushHistory()
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
    get()._pushHistory()
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
    set({ nodes: makeSeedNodes(), edges: makeSeedEdges(), selectedNodeId: null, _past: [], _future: [], canUndo: false, canRedo: false }),

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
}))

export { NODE_IDS }
