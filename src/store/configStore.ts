/**
 * configStore — ProviderConfig, per-node NodeConfig, scene settings
 */
import { create } from 'zustand'
import { defaultProviderConfig } from '../agent/presets'
import type { NodeConfig, ProviderConfig } from '../types'
import {
  DEFAULT_NODE_CONFIGS,
  GENERIC_AGENT_CONFIG,
  SEED_AGENT_IDS,
} from '../agent/defaults'

const LS_PROVIDER = 'agent-blueprint:provider'
const LS_NODES    = 'agent-blueprint:nodes'

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback
  try { return JSON.parse(raw) as T } catch { return fallback }
}

function loadProvider(): ProviderConfig {
  return {
    ...defaultProviderConfig(),
    ...safeParse<Partial<ProviderConfig>>(localStorage.getItem(LS_PROVIDER), {}),
  }
}

function loadNodeConfigs(): Record<string, NodeConfig> {
  const persisted = safeParse<Partial<Record<string, NodeConfig>>>(
    localStorage.getItem(LS_NODES), {},
  )
  const base: Record<string, NodeConfig> = {}
  for (const id of SEED_AGENT_IDS) {
    base[id] = { ...DEFAULT_NODE_CONFIGS[id], ...(persisted[id] ?? {}) }
  }
  for (const [id, cfg] of Object.entries(persisted)) {
    if (!base[id] && cfg) base[id] = cfg
  }
  return base
}

interface ConfigState {
  provider: ProviderConfig
  nodeConfigs: Record<string, NodeConfig>

  setProvider: (p: ProviderConfig) => void
  setNodeConfig: (id: string, cfg: NodeConfig) => void
  updateNodeConfig: (id: string, patch: Partial<NodeConfig>) => void
  resetNodeConfig: (id: string) => void
  removeNodeConfig: (id: string) => void
  getNodeConfig: (id: string) => NodeConfig
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  provider: loadProvider(),
  nodeConfigs: loadNodeConfigs(),

  setProvider: (p) => {
    localStorage.setItem(LS_PROVIDER, JSON.stringify(p))
    set({ provider: p })
  },

  setNodeConfig: (id, cfg) => {
    set((s) => {
      const next = { ...s.nodeConfigs, [id]: cfg }
      localStorage.setItem(LS_NODES, JSON.stringify(next))
      return { nodeConfigs: next }
    })
  },

  updateNodeConfig: (id, patch) => {
    set((s) => {
      const existing = s.nodeConfigs[id] ?? GENERIC_AGENT_CONFIG
      const next = { ...s.nodeConfigs, [id]: { ...existing, ...patch } }
      localStorage.setItem(LS_NODES, JSON.stringify(next))
      return { nodeConfigs: next }
    })
  },

  resetNodeConfig: (id) => {
    set((s) => {
      const defaultCfg = DEFAULT_NODE_CONFIGS[id] ?? GENERIC_AGENT_CONFIG
      const next = { ...s.nodeConfigs, [id]: { ...defaultCfg } }
      localStorage.setItem(LS_NODES, JSON.stringify(next))
      return { nodeConfigs: next }
    })
  },

  removeNodeConfig: (id) => {
    set((s) => {
      const { [id]: _, ...rest } = s.nodeConfigs
      localStorage.setItem(LS_NODES, JSON.stringify(rest))
      return { nodeConfigs: rest }
    })
  },

  getNodeConfig: (id) => {
    const s = get()
    return s.nodeConfigs[id] ?? DEFAULT_NODE_CONFIGS[id] ?? GENERIC_AGENT_CONFIG
  },
}))
