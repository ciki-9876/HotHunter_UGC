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
import { defaultProviderConfig } from './agent/presets'
import type { NodeConfig, ProviderConfig } from './agent/types'

export type NodeStatus = 'idle' | 'running' | 'done' | 'error'
export type PanelTab = 'result' | 'config'
export type ViewTab = 'workflow' | 'dashboard' | 'project'

export type CustomNodeKind =
  | 'topicInput'
  | 'outlineAgent'
  | 'writerAgent'
  | 'editorAgent'
  | 'genericAgent'
  | 'outputNode'
  | 'dispatchNode'

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

  // ---- per-node UI state ----
  collapsedNodes: Record<string, boolean>
  toggleNodeCollapsed: (id: string) => void

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

        // Agent-like node (outlineAgent / writerAgent / editorAgent / genericAgent)
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

        set((s) => ({
          nodeStatus: { ...s.nodeStatus, [nodeId]: 'running' },
          nodeSummary: { ...s.nodeSummary, [nodeId]: '生成中…' },
        }))

        let acc = ''
        if (useMock) {
          // Stream a canned mock for demo feel
          const full =
            nodeId === NODE_IDS.outline
              ? mockOutline(topic)
              : nodeId === NODE_IDS.writer
                ? mockArticle(topic)
                : nodeId === NODE_IDS.editor
                  ? mockEdited(topic)
                  : `# ${cfg.label}\n\n基于以下输入生成的内容（mock）：\n\n${upstreamText || topic}\n\n— 这是一个 mock 输出，配置 API Key 后即可走真实模型。`
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
}))
