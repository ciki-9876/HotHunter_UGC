/**
 * persistenceStore — snapshots, auto-save, view tab, toast
 */
import { create } from 'zustand'
import {
  loadSnapshots, persistSnapshots, isValidSnapshot, newSnapshotId,
  type WorkflowSnapshot,
} from '../agent/snapshots'
import type { NodeConfig } from '../types'
import type { Node, Edge } from 'reactflow'

export type ViewTab = 'workflow' | 'dashboard' | 'project' | 'tokens' | 'dau' | 'level-center' | 'knowledge' | 'lab' | 'settings' | 'creator' | 'agent-cluster' | 'gameplay-designer' | 'recommend-analyst' | 'craft-engineer' | 'sentiment-analyst' | 'version-worker' | 'site-admin'
export type PanelTab = 'result' | 'config'

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info' | 'warn'
}

interface PersistenceState {
  view: ViewTab
  setView: (v: ViewTab) => void

  panelTab: PanelTab
  setPanelTab: (t: PanelTab) => void

  snapshots: WorkflowSnapshot[]
  saveSnapshot: (
    name: string,
    nodes: Node[],
    edges: Edge[],
    nodeConfigs: Record<string, NodeConfig>,
    topic: string,
  ) => void
  loadSnapshot: (
    snap: WorkflowSnapshot,
    setNodes: (n: Node[]) => void,
    setEdges: (e: Edge[]) => void,
    setBulkConfigs: (c: Record<string, NodeConfig>) => void,
    setTopic: (t: string) => void,
  ) => void
  deleteSnapshot: (id: string) => void
  exportSnapshot: (id: string) => void
  importSnapshot: (file: File, onDone: (snap: WorkflowSnapshot) => void) => void

  toasts: Toast[]
  showToast: (message: string, type?: Toast['type']) => void
  dismissToast: (id: string) => void
}

export const usePersistenceStore = create<PersistenceState>((set, get) => ({
  view: 'workflow',
  setView: (v) => set({ view: v }),

  panelTab: 'result',
  setPanelTab: (t) => set({ panelTab: t }),

  snapshots: loadSnapshots(),

  saveSnapshot: (name, nodes, edges, nodeConfigs, topic) => {
    const snap: WorkflowSnapshot = {
      id: newSnapshotId(),
      name,
      savedAt: Date.now(),
      topic,
      nodes,
      edges,
      nodeConfigs,
      version: 1,
    }
    set((s) => {
      const next = [snap, ...s.snapshots].slice(0, 32)
      persistSnapshots(next)
      return { snapshots: next }
    })
    get().showToast(`已保存「${name}」`, 'success')
  },

  loadSnapshot: (snap, setNodes, setEdges, setBulkConfigs, setTopic) => {
    setNodes(snap.nodes)
    setEdges(snap.edges)
    setBulkConfigs(snap.nodeConfigs)
    setTopic(snap.topic)
    get().showToast(`已加载「${snap.name}」`, 'success')
  },

  deleteSnapshot: (id) => {
    set((s) => {
      const next = s.snapshots.filter((x) => x.id !== id)
      persistSnapshots(next)
      return { snapshots: next }
    })
  },

  exportSnapshot: (id) => {
    const snap = get().snapshots.find((s) => s.id === id)
    if (!snap) return
    const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${snap.name.replace(/\s+/g, '_')}.flow.json`
    a.click()
    URL.revokeObjectURL(url)
  },

  importSnapshot: (file, onDone) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const raw = JSON.parse(e.target?.result as string)
        if (!isValidSnapshot(raw)) { get().showToast('无效的工作流文件', 'error'); return }
        const snap = { ...raw, id: newSnapshotId(), savedAt: Date.now() } as WorkflowSnapshot
        set((s) => {
          const next = [snap, ...s.snapshots].slice(0, 32)
          persistSnapshots(next)
          return { snapshots: next }
        })
        onDone(snap)
        get().showToast(`已导入「${snap.name}」`, 'success')
      } catch { get().showToast('文件解析失败', 'error') }
    }
    reader.readAsText(file)
  },

  toasts: [],
  showToast: (message, type = 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }))
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    }, 3000)
  },
  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
