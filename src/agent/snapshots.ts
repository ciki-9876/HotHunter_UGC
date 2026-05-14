import type { Edge, Node } from 'reactflow'
import type { NodeConfig } from './types'

export interface WorkflowSnapshot {
  id: string
  name: string
  savedAt: number
  topic: string
  nodes: Node[]
  edges: Edge[]
  nodeConfigs: Record<string, NodeConfig>
  /** Schema version so future loaders can migrate / refuse old payloads */
  version: 1
}

const LS_KEY = 'agent-blueprint:workflows'

export function loadSnapshots(): WorkflowSnapshot[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidSnapshot)
  } catch {
    return []
  }
}

export function persistSnapshots(snaps: WorkflowSnapshot[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(snaps))
}

export function isValidSnapshot(o: unknown): o is WorkflowSnapshot {
  if (!o || typeof o !== 'object') return false
  const s = o as WorkflowSnapshot
  return (
    typeof s.id === 'string' &&
    typeof s.name === 'string' &&
    typeof s.savedAt === 'number' &&
    Array.isArray(s.nodes) &&
    Array.isArray(s.edges) &&
    typeof s.nodeConfigs === 'object'
  )
}

export function newSnapshotId(): string {
  return `wf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}
