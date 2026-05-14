import {
  applyEdgeChanges,
  applyNodeChanges,
  addEdge as rfAddEdge,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from 'reactflow'
import { create } from 'zustand'
import { runAgent } from './agent/client'
import {
  DEFAULT_CRITIC_DATA,
  MOCK_CRITIC_SEQUENCE,
  criticPrompts,
  parseCriticJudgement,
  type CriticNodeData,
} from './agent/critic'
import {
  DEFAULT_NODE_CONFIGS,
  GENERIC_AGENT_CONFIG,
  NODE_IDS,
  SEED_AGENT_IDS,
  mockArticle,
  mockEdited,
  mockOutline,
} from './agent/defaults'
import {
  toGiaFile,
  toHotTopicCard,
  type DispatchTarget,
  type GiaFile,
  type HotTopicCard,
} from './agent/dispatch'
import { autoLayout } from './agent/layout'
import { defaultProviderConfig } from './agent/presets'
import {
  isValidSnapshot,
  loadSnapshots,
  newSnapshotId,
  persistSnapshots,
  type WorkflowSnapshot,
} from './agent/snapshots'
import type { NodeConfig, ProviderConfig } from './agent/types'

export type NodeStatus = 'idle' | 'running' | 'done' | 'error'
export type PanelTab = 'result' | 'config'
export type ViewTab = 'workflow' | 'dashboard' | 'project' | 'tokens'

export type CustomNodeKind =
  | 'topicInput'
  | 'outlineAgent'
  | 'writerAgent'
  | 'editorAgent'
  | 'genericAgent'
  | 'outputNode'
  | 'dispatchNode'
  | 'criticNode'

export interface DispatchNodeData {
  target: DispatchTarget
}

const LS_PROVIDER = 'agent-blueprint:provider'
const LS_NODES = 'agent-blueprint:nodes'
const LS_TOPIC = 'agent-blueprint:topic'

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function loadProvider(): ProviderConfig {
  const fallback = defaultProviderConfig()
  return {
    ...fallback,
    ...safeParse<Partial<ProviderConfig>>(
      localStorage.getItem(LS_PROVIDER),
      {},
    ),
  }
}

function loadNodeConfigs(): Record<string, NodeConfig> {
  const persisted = safeParse<Partial<Record<string, NodeConfig>>>(
    localStorage.getItem(LS_NODES),
    {},
  )
  const base: Record<string, NodeConfig> = {}
  for (const id of SEED_AGENT_IDS) {
    base[id] = {
      ...DEFAULT_NODE_CONFIGS[id],
      ...(persisted[id] ?? {}),
    }
  }
  // also load any user-added agents that were persisted
  for (const [id, cfg] of Object.entries(persisted)) {
    if (!base[id] && cfg) base[id] = cfg
  }
  return base
}

/* ---------------- Seed graph ---------------- */

function makeSeedNodes(): Node[] {
  return [
    {
      id: NODE_IDS.input,
      type: 'topicInput',
      position: { x: 40, y: 220 },
      data: {},
    },
    {
      id: NODE_IDS.outline,
      type: 'outlineAgent',
      position: { x: 380, y: 240 },
      data: {},
    },
    {
      id: NODE_IDS.writer,
      type: 'writerAgent',
      position: { x: 700, y: 240 },
      data: {},
    },
    {
      id: NODE_IDS.editor,
      type: 'editorAgent',
      position: { x: 1020, y: 240 },
      data: {},
    },
    {
      id: NODE_IDS.output,
      type: 'outputNode',
      position: { x: 1340, y: 220 },
      data: {},
    },
  ]
}

function makeSeedEdges(): Edge[] {
  return [
    { id: 'e-input-outline', source: NODE_IDS.input, target: NODE_IDS.outline, type: 'flow' },
    { id: 'e-outline-writer', source: NODE_IDS.outline, target: NODE_IDS.writer, type: 'flow' },
    { id: 'e-writer-editor', source: NODE_IDS.writer, target: NODE_IDS.editor, type: 'flow' },
    { id: 'e-editor-output', source: NODE_IDS.editor, target: NODE_IDS.output, type: 'flow' },
  ]
}

/* ---------------- Seed dashboard / project data ---------------- */

const SEED_DASHBOARD_CARDS: HotTopicCard[] = [
  {
    id: 'seed-ugc-1',
    source: 'external',
    title: 'UGC 关卡：剑灵之路 · 通关率突破 38%',
    hotScore: 87,
    trend: 12,
    summary:
      '新发布的玩家自制关卡今日热度激增，平均通关时长 4 分 12 秒，玩家好评率持续走高。',
    tags: ['UGC', '关卡', '热度'],
    createdAt: Date.now() - 3600 * 1000 * 2,
  },
  {
    id: 'seed-ext-1',
    source: 'external',
    title: '外部热点：AI 工作流持续登顶产品榜',
    hotScore: 92,
    trend: 24,
    summary:
      '过去 24 小时，多款 AI 工作流类产品在主流平台增长显著，搜索指数环比 +24%。',
    tags: ['AI', '工作流', '增长'],
    createdAt: Date.now() - 3600 * 1000 * 5,
  },
  {
    id: 'seed-ugc-2',
    source: 'external',
    title: 'UGC 关卡：低谷镇副本 · 玩家停留时长创新高',
    hotScore: 71,
    trend: -6,
    summary:
      '玩家平均停留 17 分钟，社交分享率 23%，建议补强后段奖励曲线以延续热度。',
    tags: ['UGC', '副本', '复盘'],
    createdAt: Date.now() - 3600 * 1000 * 11,
  },
]

const SEED_PROJECT_FILES: GiaFile[] = [
  {
    id: 'seed-gia-1',
    filename: 'ugc_season3_brief_20260512.gia',
    extension: '.gia',
    topic: 'UGC S3 赛季策划纲要',
    summary:
      'S3 赛季围绕"玩家共创"主题，目标拉升日均创作量 +40%，新增三类协作工具。',
    sections: [
      {
        heading: '一、目标',
        body: '日均创作量 +40%，作品平均完播 ≥ 60%，社交分享率 +12pp。',
      },
      {
        heading: '二、核心机制',
        body: '引入"双人协作沙箱"，作品可被 fork；新增热度榜 + 编辑器周报。',
      },
      {
        heading: '三、节奏',
        body: '6.01 内测、6.20 全量、7.05 大版本，每周一次数据复盘。',
      },
    ],
    wordCount: 312,
    generatedAt: Date.now() - 3600 * 1000 * 28,
  },
]

/* ============================================================
 *  Store
 * ============================================================ */

export interface BlueprintState {
  // ---- view ----
  view: ViewTab
  setView: (v: ViewTab) => void

  // ---- canvas graph ----
  nodes: Node[]
  edges: Edge[]
  applyNodeChanges: (changes: NodeChange[]) => void
  applyEdgeChanges: (changes: EdgeChange[]) => void
  onConnect: (conn: Connection) => void
  addAgentNode: (templateId?: string) => void
  /**
   * Create a generic Agent node at a specific canvas position, optionally
   * wiring an edge to/from an existing node.
   */
  addAgentNodeAt: (
    position: { x: number; y: number },
    connection?: { fromNodeId: string; handleType: 'source' | 'target' },
  ) => void
  addDispatchNode: (target?: DispatchTarget) => void
  setDispatchTarget: (id: string, target: DispatchTarget) => void
  addCriticNode: () => void
  updateCriticData: (id: string, patch: Partial<CriticNodeData>) => void

  // ---- canvas layout ----
  applyAutoLayout: () => void

  // ---- per-node UI state ----
  collapsedNodes: Record<string, boolean>
  toggleNodeCollapsed: (id: string) => void

  // ---- per-node critic runtime info (iteration / score) ----
  criticRuntime: Record<
    string,
    { iteration: number; score: number; feedback: string; passed: boolean }
  >

  // ---- run state ----
  topic: string
  isRunning: boolean
  abortController: AbortController | null
  nodeStatus: Record<string, NodeStatus>
  nodeResult: Record<string, string>
  nodeSummary: Record<string, string>
  nodeError: Record<string, string>

  // ---- UI state ----
  selectedNodeId: string | null
  panelTab: PanelTab
  settingsOpen: boolean
  toast: string | null

  // ---- config ----
  provider: ProviderConfig
  nodeConfigs: Record<string, NodeConfig>

  // ---- downstream data tabs ----
  dashboardCards: HotTopicCard[]
  projectFiles: GiaFile[]

  // ---- actions ----
  setTopic: (v: string) => void
  setSelected: (id: string | null, tab?: PanelTab) => void
  setPanelTab: (tab: PanelTab) => void
  setSettingsOpen: (open: boolean) => void
  setToast: (msg: string | null) => void
  showToast: (msg: string, ms?: number) => void

  updateProvider: (patch: Partial<ProviderConfig>) => void
  resetProvider: () => void
  updateNodeConfig: (id: string, patch: Partial<NodeConfig>) => void
  resetNodeConfig: (id: string) => void

  startRun: () => Promise<void>
  cancelRun: () => void
  resetCanvas: () => void

  removeDashboardCard: (id: string) => void
  removeProjectFile: (id: string) => void

  // ---- workflow snapshots ----
  snapshots: WorkflowSnapshot[]
  saveSnapshot: (name: string) => void
  loadSnapshot: (id: string) => void
  deleteSnapshot: (id: string) => void
  exportSnapshot: (id: string) => void
  importSnapshotJson: (json: string) => boolean
}

function summarize(text: string, limit = 56): string {
  const plain = text.replace(/^#.*$/gm, '').replace(/\s+/g, ' ').trim()
  return plain.length > limit ? plain.slice(0, limit) + '…' : plain
}

function fillTemplate(
  tpl: string,
  vars: { topic: string; input: string },
): string {
  return tpl.split('{topic}').join(vars.topic).split('{input}').join(vars.input)
}

function resolveCfg(
  global: ProviderConfig,
  override?: Partial<ProviderConfig>,
): ProviderConfig {
  if (!override) return global
  return { ...global, ...override }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

const TOPIC_DEFAULTS: Record<string, () => string> = {
  [NODE_IDS.outline]: () => '',
  [NODE_IDS.writer]: () => '',
  [NODE_IDS.editor]: () => '',
}

function makeNodeId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36).slice(-4)}`
}

function persistNodeConfigs(cfgs: Record<string, NodeConfig>) {
  localStorage.setItem(LS_NODES, JSON.stringify(cfgs))
}

/* ---------------- BFS executor ---------------- */

interface ExecPlan {
  /** ordered list of nodes to execute (BFS, prerequisites first) */
  order: string[]
  /** for each node, the upstream node ids whose results form its input */
  upstreams: Record<string, string[]>
}

function planExecution(nodes: Node[], edges: Edge[], startId: string): ExecPlan {
  const adj: Record<string, string[]> = {}
  const upstreams: Record<string, string[]> = {}
  const pending: Record<string, number> = {}
  for (const e of edges) {
    ;(adj[e.source] ??= []).push(e.target)
    ;(upstreams[e.target] ??= []).push(e.source)
    pending[e.target] = (pending[e.target] ?? 0) + 1
  }
  const nodeIds = new Set(nodes.map((n) => n.id))
  const order: string[] = []
  const ready: string[] = [startId]
  const visited = new Set<string>()
  while (ready.length > 0) {
    const id = ready.shift()!
    if (visited.has(id) || !nodeIds.has(id)) continue
    visited.add(id)
    order.push(id)
    for (const down of adj[id] ?? []) {
      pending[down] = (pending[down] ?? 1) - 1
      if (pending[down] <= 0) ready.push(down)
    }
  }
  return { order, upstreams }
}

/* ============================================================
 *  Store implementation
 * ============================================================ */

export const useBlueprint = create<BlueprintState>((set, get) => ({
  view: 'workflow',
  setView: (v) => set({ view: v }),

  nodes: makeSeedNodes(),
  edges: makeSeedEdges(),
  applyNodeChanges: (changes) =>
    set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) })),
  applyEdgeChanges: (changes) =>
    set((s) => ({ edges: applyEdgeChanges(changes, s.edges) })),
  onConnect: (conn) => {
    if (!conn.source || !conn.target || conn.source === conn.target) return
    set((s) => {
      // prevent dup edges between the same pair
      const exists = s.edges.some(
        (e) => e.source === conn.source && e.target === conn.target,
      )
      if (exists) return {}
      const edge: Edge = {
        id: `e-${conn.source}-${conn.target}-${Math.random()
          .toString(36)
          .slice(2, 6)}`,
        source: conn.source!,
        target: conn.target!,
        type: 'flow',
      }
      return { edges: rfAddEdge(edge, s.edges) }
    })
  },

  addAgentNode: () => {
    const id = makeNodeId('agent')
    const cfg: NodeConfig = { ...GENERIC_AGENT_CONFIG }
    set((s) => {
      const nextCfgs = { ...s.nodeConfigs, [id]: cfg }
      persistNodeConfigs(nextCfgs)
      const newNode: Node = {
        id,
        type: 'genericAgent',
        position: { x: 480 + Math.random() * 200, y: 480 + Math.random() * 80 },
        data: {},
      }
      return {
        nodes: [...s.nodes, newNode],
        nodeConfigs: nextCfgs,
        nodeStatus: { ...s.nodeStatus, [id]: 'idle' },
        nodeResult: { ...s.nodeResult, [id]: '' },
        nodeSummary: { ...s.nodeSummary, [id]: '等待上游输入…' },
      }
    })
    get().showToast('已添加新 Agent 节点 — 点击配置可调整', 1800)
  },

  addAgentNodeAt: (position, connection) => {
    const id = makeNodeId('agent')
    const cfg: NodeConfig = { ...GENERIC_AGENT_CONFIG }
    set((s) => {
      const nextCfgs = { ...s.nodeConfigs, [id]: cfg }
      persistNodeConfigs(nextCfgs)
      // Offset so the cursor sits on the card center, not the corner
      const newNode: Node = {
        id,
        type: 'genericAgent',
        position: { x: position.x - 120, y: position.y - 60 },
        data: {},
      }
      let nextEdges = s.edges
      if (connection) {
        const { fromNodeId, handleType } = connection
        // handleType describes which side the *drag was started from*:
        //   'source' → drag came out of a source handle, new node is the TARGET
        //   'target' → drag came out of a target handle, new node is the SOURCE
        const source =
          handleType === 'source' ? fromNodeId : id
        const target =
          handleType === 'source' ? id : fromNodeId
        if (source !== target) {
          const dup = nextEdges.some(
            (e) => e.source === source && e.target === target,
          )
          if (!dup) {
            nextEdges = [
              ...nextEdges,
              {
                id: `e-${source}-${target}-${Math.random()
                  .toString(36)
                  .slice(2, 6)}`,
                source,
                target,
                type: 'flow',
              },
            ]
          }
        }
      }
      return {
        nodes: [...s.nodes, newNode],
        edges: nextEdges,
        nodeConfigs: nextCfgs,
        nodeStatus: { ...s.nodeStatus, [id]: 'idle' },
        nodeResult: { ...s.nodeResult, [id]: '' },
        nodeSummary: { ...s.nodeSummary, [id]: '等待上游输入…' },
      }
    })
    get().showToast('已在落点创建并连接新 Agent 节点', 1800)
  },

  collapsedNodes: {},
  toggleNodeCollapsed: (id) =>
    set((s) => ({
      collapsedNodes: { ...s.collapsedNodes, [id]: !s.collapsedNodes[id] },
    })),

  addDispatchNode: (target = 'dashboard') => {
    const id = makeNodeId('dispatch')
    set((s) => {
      const newNode: Node = {
        id,
        type: 'dispatchNode',
        position: { x: 1340 + Math.random() * 80, y: 460 + Math.random() * 60 },
        data: { target } as DispatchNodeData,
      }
      return {
        nodes: [...s.nodes, newNode],
        nodeStatus: { ...s.nodeStatus, [id]: 'idle' },
        nodeResult: { ...s.nodeResult, [id]: '' },
        nodeSummary: {
          ...s.nodeSummary,
          [id]: target === 'dashboard' ? '等待输出 → 数据看板' : '等待输出 → 项目中心',
        },
      }
    })
    get().showToast('已添加输出回传节点', 1800)
  },

  setDispatchTarget: (id, target) => {
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id
          ? { ...n, data: { ...(n.data ?? {}), target } }
          : n,
      ),
    }))
  },

  addCriticNode: () => {
    const id = makeNodeId('critic')
    set((s) => {
      const newNode: Node = {
        id,
        type: 'criticNode',
        position: { x: 880 + Math.random() * 80, y: 540 + Math.random() * 60 },
        data: { ...DEFAULT_CRITIC_DATA } as CriticNodeData,
      }
      return {
        nodes: [...s.nodes, newNode],
        nodeStatus: { ...s.nodeStatus, [id]: 'idle' },
        nodeResult: { ...s.nodeResult, [id]: '' },
        nodeSummary: { ...s.nodeSummary, [id]: '等待上游内容评审…' },
      }
    })
    get().showToast('已添加评审节点 — 连到 Agent 上游可启用闭环', 1800)
  },

  updateCriticData: (id, patch) => {
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id
          ? { ...n, data: { ...(n.data ?? {}), ...patch } }
          : n,
      ),
    }))
  },

  applyAutoLayout: () => {
    set((s) => ({ nodes: autoLayout(s.nodes, s.edges) }))
    get().showToast('画布已重新排版', 1400)
  },

  criticRuntime: {},

  topic: localStorage.getItem(LS_TOPIC) ?? '如何在不确定中保持高效',
  isRunning: false,
  abortController: null,
  nodeStatus: {
    [NODE_IDS.input]: 'done',
    [NODE_IDS.outline]: 'idle',
    [NODE_IDS.writer]: 'idle',
    [NODE_IDS.editor]: 'idle',
    [NODE_IDS.output]: 'idle',
  },
  nodeResult: {
    [NODE_IDS.input]: '',
    [NODE_IDS.outline]: '',
    [NODE_IDS.writer]: '',
    [NODE_IDS.editor]: '',
    [NODE_IDS.output]: '',
  },
  nodeSummary: {
    [NODE_IDS.input]: '',
    [NODE_IDS.outline]: '等待大纲生成…',
    [NODE_IDS.writer]: '等待正文写作…',
    [NODE_IDS.editor]: '等待润色…',
    [NODE_IDS.output]: '等待最终文章…',
  },
  nodeError: {},

  selectedNodeId: null,
  panelTab: 'result',
  settingsOpen: false,
  toast: null,

  provider: loadProvider(),
  nodeConfigs: loadNodeConfigs(),

  dashboardCards: SEED_DASHBOARD_CARDS,
  projectFiles: SEED_PROJECT_FILES,

  setTopic: (v) => {
    localStorage.setItem(LS_TOPIC, v)
    set({ topic: v })
  },
  setSelected: (id, tab) =>
    set((s) => ({
      selectedNodeId: id,
      panelTab: tab ?? s.panelTab,
    })),
  setPanelTab: (tab) => set({ panelTab: tab }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setToast: (msg) => set({ toast: msg }),
  showToast: (msg, ms = 2200) => {
    set({ toast: msg })
    setTimeout(() => {
      if (get().toast === msg) set({ toast: null })
    }, ms)
  },

  updateProvider: (patch) => {
    const next = { ...get().provider, ...patch }
    localStorage.setItem(LS_PROVIDER, JSON.stringify(next))
    set({ provider: next })
  },
  resetProvider: () => {
    const next = defaultProviderConfig()
    localStorage.removeItem(LS_PROVIDER)
    set({ provider: next })
  },
  updateNodeConfig: (id, patch) => {
    const next = {
      ...get().nodeConfigs,
      [id]: {
        ...(get().nodeConfigs[id] ?? GENERIC_AGENT_CONFIG),
        ...patch,
      },
    }
    persistNodeConfigs(next)
    set({ nodeConfigs: next })
  },
  resetNodeConfig: (id) => {
    const fallback =
      DEFAULT_NODE_CONFIGS[id] ?? GENERIC_AGENT_CONFIG
    const next = { ...get().nodeConfigs, [id]: { ...fallback } }
    persistNodeConfigs(next)
    set({ nodeConfigs: next })
  },

  resetCanvas: () =>
    set((s) => {
      const ids = s.nodes.map((n) => n.id)
      const status: Record<string, NodeStatus> = {}
      const summary: Record<string, string> = {}
      const result: Record<string, string> = {}
      for (const id of ids) {
        status[id] = id === NODE_IDS.input ? 'done' : 'idle'
        result[id] = id === NODE_IDS.input ? s.topic : ''
        const n = s.nodes.find((x) => x.id === id)!
        if (n.type === 'dispatchNode') {
          const t = (n.data as DispatchNodeData | undefined)?.target ?? 'dashboard'
          summary[id] =
            t === 'dashboard' ? '等待输出 → 数据看板' : '等待输出 → 项目中心'
        } else if (n.type === 'outputNode') {
          summary[id] = '等待最终文章…'
        } else if (n.type === 'topicInput') {
          summary[id] = s.topic
        } else if (n.type === 'criticNode') {
          summary[id] = '等待上游内容评审…'
        } else {
          summary[id] = '等待上游输入…'
        }
      }
      return {
        isRunning: false,
        abortController: null,
        selectedNodeId: null,
        nodeStatus: status,
        nodeResult: result,
        nodeSummary: summary,
        nodeError: {},
        criticRuntime: {},
      }
    }),

  cancelRun: () => {
    const c = get().abortController
    if (c) c.abort()
    set({ isRunning: false, abortController: null })
  },

  startRun: async () => {
    const state = get()
    if (state.isRunning) return
    const topic = state.topic.trim()
    if (!topic) {
      get().showToast('请先输入一个文章主题')
      return
    }

    // reset canvas
    get().resetCanvas()
    set((s) => ({
      isRunning: true,
      nodeResult: { ...s.nodeResult, [NODE_IDS.input]: topic },
      nodeSummary: { ...s.nodeSummary, [NODE_IDS.input]: topic },
    }))

    const abort = new AbortController()
    set({ abortController: abort })
    const useMock = !state.provider.apiKey.trim()

    const { order, upstreams } = planExecution(
      state.nodes,
      state.edges,
      NODE_IDS.input,
    )

    const gatherInput = (nodeId: string): string =>
      (upstreams[nodeId] ?? [])
        .map((u) => get().nodeResult[u] ?? '')
        .filter(Boolean)
        .join('\n\n---\n\n')

    /**
     * Execute a single agent-like node and stream its output back into the
     * store. Used by both the main BFS loop and the critic feedback loop.
     */
    const runAgentNode = async (
      nodeId: string,
      upstreamText: string,
      extraFeedback?: string,
    ): Promise<string> => {
      const node = state.nodes.find((n) => n.id === nodeId)
      const cfg =
        get().nodeConfigs[nodeId] ??
        DEFAULT_NODE_CONFIGS[nodeId] ??
        GENERIC_AGENT_CONFIG
      const resolved = resolveCfg(state.provider, cfg.override)
      let userPrompt = fillTemplate(cfg.userPromptTemplate, {
        topic,
        input: upstreamText || TOPIC_DEFAULTS[nodeId]?.() || topic,
      })
      const extra = cfg.extraPrompt?.trim()
      if (extra) {
        userPrompt = `${userPrompt}\n\n额外要求：\n${extra}`
      }
      if (extraFeedback?.trim()) {
        userPrompt = `${userPrompt}\n\n上一版评审反馈，请基于此改进：\n${extraFeedback}\n\n请输出改进后的新版本。`
      }

      set((s) => ({
        nodeStatus: { ...s.nodeStatus, [nodeId]: 'running' },
        nodeSummary: {
          ...s.nodeSummary,
          [nodeId]: extraFeedback ? '基于反馈重新生成…' : '生成中…',
        },
        nodeResult: { ...s.nodeResult, [nodeId]: '' },
      }))

      let acc = ''
      if (useMock) {
        const baseFull =
          nodeId === NODE_IDS.outline
            ? mockOutline(topic)
            : nodeId === NODE_IDS.writer
              ? mockArticle(topic)
              : nodeId === NODE_IDS.editor
                ? mockEdited(topic)
                : `# ${cfg.label}\n\n基于以下输入生成的内容（mock）：\n\n${
                    upstreamText || topic
                  }\n\n— 这是一个 mock 输出，配置 API Key 后即可走真实模型。`
        const full = extraFeedback
          ? `${baseFull}\n\n_（已根据评审反馈改进，本轮迭代）_`
          : baseFull
        const step = Math.max(2, Math.floor(full.length / 60))
        for (let i = 0; i < full.length; i += step) {
          if (abort.signal.aborted) throw new Error('已取消')
          acc = full.slice(0, i + step)
          const snap = acc
          set((s) => ({
            nodeResult: { ...s.nodeResult, [nodeId]: snap },
            nodeSummary: { ...s.nodeSummary, [nodeId]: summarize(snap) },
          }))
          await wait(28)
        }
        acc = full
      } else {
        for await (const chunk of runAgent(resolved, {
          systemPrompt: cfg.systemPrompt,
          userPrompt,
          temperature: cfg.temperature,
          maxTokens: cfg.maxTokens,
          signal: abort.signal,
        })) {
          acc += chunk
          const snap = acc
          set((s) => ({
            nodeResult: { ...s.nodeResult, [nodeId]: snap },
            nodeSummary: { ...s.nodeSummary, [nodeId]: summarize(snap) },
          }))
        }
      }

      set((s) => ({
        nodeStatus: { ...s.nodeStatus, [nodeId]: 'done' },
        nodeResult: { ...s.nodeResult, [nodeId]: acc },
        nodeSummary: { ...s.nodeSummary, [nodeId]: summarize(acc) },
      }))
      void node // keep ref for potential future use
      return acc
    }

    /** Run the critic LLM judge once and parse the verdict. */
    const judgeOnce = async (
      candidateText: string,
      data: CriticNodeData,
      iter: number,
    ) => {
      if (useMock) {
        const seq = MOCK_CRITIC_SEQUENCE
        const idx = Math.min(iter - 1, seq.length - 1)
        // gradual reveal so the loop feels alive even in mock
        await wait(600)
        return seq[idx]
      }
      const { systemPrompt, userPrompt } = criticPrompts(
        data.rubric,
        candidateText,
      )
      let raw = ''
      for await (const chunk of runAgent(state.provider, {
        systemPrompt,
        userPrompt,
        temperature: 0.2,
        maxTokens: 400,
        signal: abort.signal,
      })) {
        raw += chunk
      }
      return parseCriticJudgement(raw)
    }

    try {
      for (const nodeId of order) {
        if (abort.signal.aborted) throw new Error('已取消')
        const node = state.nodes.find((n) => n.id === nodeId)
        if (!node) continue

        const inputs = (upstreams[nodeId] ?? [])
          .map((u) => get().nodeResult[u] ?? '')
          .filter(Boolean)
        const upstreamText = inputs.join('\n\n---\n\n')

        if (node.type === 'topicInput') {
          // start node: already 'done', set its result to topic
          set((s) => ({
            nodeStatus: { ...s.nodeStatus, [nodeId]: 'done' },
            nodeResult: { ...s.nodeResult, [nodeId]: topic },
            nodeSummary: { ...s.nodeSummary, [nodeId]: topic },
          }))
          continue
        }

        if (node.type === 'outputNode') {
          set((s) => ({
            nodeStatus: { ...s.nodeStatus, [nodeId]: 'running' },
            nodeSummary: { ...s.nodeSummary, [nodeId]: '汇总中…' },
          }))
          await wait(350)
          set((s) => ({
            nodeStatus: { ...s.nodeStatus, [nodeId]: 'done' },
            nodeResult: { ...s.nodeResult, [nodeId]: upstreamText },
            nodeSummary: {
              ...s.nodeSummary,
              [nodeId]: summarize(upstreamText),
            },
          }))
          continue
        }

        if (node.type === 'dispatchNode') {
          const target =
            (node.data as DispatchNodeData | undefined)?.target ?? 'dashboard'
          set((s) => ({
            nodeStatus: { ...s.nodeStatus, [nodeId]: 'running' },
            nodeSummary: {
              ...s.nodeSummary,
              [nodeId]:
                target === 'dashboard'
                  ? '格式转换 → HotTopicCard…'
                  : '格式转换 → .gia 文档…',
            },
          }))
          await wait(500)
          if (target === 'dashboard') {
            const card = toHotTopicCard(upstreamText, topic)
            set((s) => ({
              dashboardCards: [card, ...s.dashboardCards].slice(0, 24),
              nodeStatus: { ...s.nodeStatus, [nodeId]: 'done' },
              nodeResult: {
                ...s.nodeResult,
                [nodeId]: JSON.stringify(card, null, 2),
              },
              nodeSummary: {
                ...s.nodeSummary,
                [nodeId]: `已写入数据看板 · 热度 ${card.hotScore}`,
              },
            }))
          } else {
            const file = toGiaFile(upstreamText, topic)
            set((s) => ({
              projectFiles: [file, ...s.projectFiles].slice(0, 24),
              nodeStatus: { ...s.nodeStatus, [nodeId]: 'done' },
              nodeResult: {
                ...s.nodeResult,
                [nodeId]: JSON.stringify(file, null, 2),
              },
              nodeSummary: {
                ...s.nodeSummary,
                [nodeId]: `已生成 ${file.filename}`,
              },
            }))
          }
          continue
        }

        if (node.type === 'criticNode') {
          const data = (node.data as CriticNodeData | undefined) ?? DEFAULT_CRITIC_DATA
          const upstreamIds = upstreams[nodeId] ?? []
          const upstreamId = upstreamIds[0]
          if (!upstreamId) {
            set((s) => ({
              nodeStatus: { ...s.nodeStatus, [nodeId]: 'error' },
              nodeError: {
                ...s.nodeError,
                [nodeId]: '评审节点缺少上游 Agent。请把它连到一个 Agent 节点后面。',
              },
              nodeSummary: {
                ...s.nodeSummary,
                [nodeId]: '缺少上游 — 请先连线',
              },
            }))
            continue
          }
          let candidate = get().nodeResult[upstreamId] ?? upstreamText
          let passed = false
          let lastScore = 0
          let lastFeedback = ''
          let iter = 0
          for (iter = 1; iter <= data.maxIterations; iter++) {
            if (abort.signal.aborted) throw new Error('已取消')
            set((s) => ({
              nodeStatus: { ...s.nodeStatus, [nodeId]: 'running' },
              nodeSummary: {
                ...s.nodeSummary,
                [nodeId]: `评审第 ${iter}/${data.maxIterations} 轮…`,
              },
            }))
            const judgement = await judgeOnce(candidate, data, iter)
            lastScore = judgement.score
            lastFeedback = judgement.feedback
            set((s) => ({
              criticRuntime: {
                ...s.criticRuntime,
                [nodeId]: {
                  iteration: iter,
                  score: judgement.score,
                  feedback: judgement.feedback,
                  passed: judgement.score >= data.threshold,
                },
              },
            }))
            if (judgement.score >= data.threshold) {
              passed = true
              break
            }
            if (iter === data.maxIterations) break
            // Re-run upstream with feedback
            const upstreamInput = gatherInput(upstreamId)
            candidate = await runAgentNode(
              upstreamId,
              upstreamInput,
              judgement.feedback,
            )
          }
          const summary = passed
            ? `✓ 通过 (${lastScore} 分, ${iter} 轮)`
            : `⚠ 未通过 (${lastScore} 分, 已达 ${data.maxIterations} 轮上限)`
          set((s) => ({
            nodeStatus: { ...s.nodeStatus, [nodeId]: 'done' },
            nodeResult: { ...s.nodeResult, [nodeId]: candidate },
            nodeSummary: { ...s.nodeSummary, [nodeId]: summary },
            nodeError: passed
              ? s.nodeError
              : {
                  ...s.nodeError,
                  [nodeId]: `${summary}\n最后反馈：${lastFeedback}`,
                },
          }))
          continue
        }

        // Agent-like node (outlineAgent / writerAgent / editorAgent / genericAgent)
        await runAgentNode(nodeId, upstreamText)
      }

      set({ isRunning: false, abortController: null })
      get().showToast(useMock ? '演示完成（mock）✓' : '工作流执行完成 ✓')
    } catch (err: any) {
      const message = String(err?.message ?? err)
      const cancelled = abort.signal.aborted
      const statuses = get().nodeStatus
      const erroredId = Object.entries(statuses).find(
        ([, s]) => s === 'running',
      )?.[0]
      if (erroredId) {
        set((s) => ({
          nodeStatus: {
            ...s.nodeStatus,
            [erroredId]: cancelled ? 'idle' : 'error',
          },
          nodeError: { ...s.nodeError, [erroredId]: message },
          nodeSummary: {
            ...s.nodeSummary,
            [erroredId]: cancelled
              ? '已取消'
              : `失败：${summarize(message, 40)}`,
          },
        }))
      }
      set({ isRunning: false, abortController: null })
      if (!cancelled) get().showToast(`执行失败：${summarize(message, 60)}`)
    }
  },

  removeDashboardCard: (id) =>
    set((s) => ({ dashboardCards: s.dashboardCards.filter((c) => c.id !== id) })),
  removeProjectFile: (id) =>
    set((s) => ({ projectFiles: s.projectFiles.filter((f) => f.id !== id) })),

  snapshots: loadSnapshots(),
  saveSnapshot: (name) => {
    const s = get()
    const id = newSnapshotId()
    // shallow-clone graph data so subsequent edits don't mutate the snapshot
    const snap: WorkflowSnapshot = {
      id,
      name: name.trim() || `未命名 ${new Date().toLocaleString()}`,
      savedAt: Date.now(),
      topic: s.topic,
      nodes: JSON.parse(JSON.stringify(s.nodes)),
      edges: JSON.parse(JSON.stringify(s.edges)),
      nodeConfigs: JSON.parse(JSON.stringify(s.nodeConfigs)),
      version: 1,
    }
    const next = [snap, ...s.snapshots].slice(0, 32)
    persistSnapshots(next)
    set({ snapshots: next })
    get().showToast(`已保存工作流：${snap.name}`, 1800)
  },
  loadSnapshot: (id) => {
    const snap = get().snapshots.find((x) => x.id === id)
    if (!snap) return
    // bring graph state in line with the snapshot; preserve provider config
    const status: Record<string, NodeStatus> = {}
    const result: Record<string, string> = {}
    const summary: Record<string, string> = {}
    for (const n of snap.nodes) {
      status[n.id] = n.id === NODE_IDS.input ? 'done' : 'idle'
      result[n.id] = n.id === NODE_IDS.input ? snap.topic : ''
      if (n.type === 'topicInput') summary[n.id] = snap.topic
      else if (n.type === 'dispatchNode') {
        const t = (n.data as DispatchNodeData | undefined)?.target ?? 'dashboard'
        summary[n.id] =
          t === 'dashboard' ? '等待输出 → 数据看板' : '等待输出 → 项目中心'
      } else if (n.type === 'outputNode') summary[n.id] = '等待最终文章…'
      else if (n.type === 'criticNode') summary[n.id] = '等待上游内容评审…'
      else summary[n.id] = '等待上游输入…'
    }
    persistNodeConfigs(snap.nodeConfigs)
    localStorage.setItem(LS_TOPIC, snap.topic)
    set({
      nodes: snap.nodes,
      edges: snap.edges,
      nodeConfigs: snap.nodeConfigs,
      topic: snap.topic,
      nodeStatus: status,
      nodeResult: result,
      nodeSummary: summary,
      nodeError: {},
      criticRuntime: {},
      collapsedNodes: {},
      selectedNodeId: null,
    })
    get().showToast(`已加载：${snap.name}`, 1600)
  },
  deleteSnapshot: (id) => {
    const next = get().snapshots.filter((x) => x.id !== id)
    persistSnapshots(next)
    set({ snapshots: next })
  },
  exportSnapshot: (id) => {
    const snap = get().snapshots.find((x) => x.id === id)
    if (!snap) return
    const blob = new Blob([JSON.stringify(snap, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${snap.name.replace(/[^\w一-龥-]+/g, '_')}.flow.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  },
  importSnapshotJson: (json) => {
    try {
      const parsed = JSON.parse(json)
      if (!isValidSnapshot(parsed)) {
        get().showToast('文件结构无效')
        return false
      }
      // Give it a new id to avoid collision
      const snap: WorkflowSnapshot = {
        ...parsed,
        id: newSnapshotId(),
        name: `${parsed.name}（导入）`,
        savedAt: Date.now(),
      }
      const next = [snap, ...get().snapshots].slice(0, 32)
      persistSnapshots(next)
      set({ snapshots: next })
      get().showToast(`已导入：${snap.name}`)
      return true
    } catch {
      get().showToast('导入失败：JSON 解析错误')
      return false
    }
  },
}))
