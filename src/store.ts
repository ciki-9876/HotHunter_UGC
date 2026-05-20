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
  type HotEvaluationReport,
  type HotTopicCard,
  type HotTopicStatus,
  type HotTopicType,
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
import { aggregateHotTopics } from './sources/aggregator'
import { DEFAULT_SOURCE_CONFIG } from './sources/types'
import type { Platform, SourceConfigMap } from './sources/types'

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
const HOT_TYPES: HotTopicType[] = [
  '热梗',
  '联动',
  '版本节点',
  '游戏',
  '短剧/动漫',
  '本篇延伸',
  '新闻时政',
]

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
    title: '法尔伽「大团长不要停下来！」二创热梗回潮',
    hotScore: 87,
    trend: 12,
    summary:
      'B站剪辑与米游社梗图同步升温，情绪方向偏反差与挑战，适合转译为短平快的关卡挑战链。',
    tags: ['UGC', '热梗', '法尔伽', '挑战链'],
    createdAt: Date.now() - 3600 * 1000 * 2,
    topicType: '热梗',
    platforms: ['B站', '米游社', '微博'],
    signals: [
      { platform: 'B站', title: '大团长不要停下来 二创混剪冲上分区热门', heat: '高' },
      { platform: '米游社', title: '玩家复盘法尔伽梗图与关卡脑洞', heat: '中' },
      { platform: '微博', title: '角色梗话题进入玩家圈层讨论', heat: '中' },
    ],
    windowDays: 5,
    stage: 'rising',
    fitScore: 91,
    urgency: 'high',
    status: 'watching',
  },
  {
    id: 'seed-ext-1',
    source: 'external',
    title: '新版本角色预告带动「镜像试炼」玩法讨论',
    hotScore: 92,
    trend: 24,
    summary:
      '官方预告引发机制猜测，玩家正在自发讨论镜像、反制、节奏挑战，适合提前准备版本节点关卡。',
    tags: ['版本节点', '角色预告', '机制挑战'],
    createdAt: Date.now() - 3600 * 1000 * 5,
    topicType: '版本节点',
    platforms: ['原神官方', 'B站', '小红书'],
    signals: [
      { platform: '原神官方', title: '角色预告发布后评论区高频出现镜像机制', heat: '高' },
      { platform: 'B站', title: '新角色机制猜想视频连续进入热门', heat: '高' },
      { platform: '小红书', title: '轻攻略向笔记开始扩散机制关键词', heat: '中' },
    ],
    windowDays: 12,
    stage: 'rising',
    fitScore: 88,
    urgency: 'medium',
    status: 'new',
  },
  {
    id: 'seed-ugc-2',
    source: 'external',
    title: '「十秒逃离办公室」短剧梗跨圈层传播',
    hotScore: 71,
    trend: -6,
    summary:
      '短剧剪辑热度开始回落，但核心规则清晰，可低成本改造成限时逃脱小游戏。',
    tags: ['短剧/动漫', '逃脱', '低成本'],
    createdAt: Date.now() - 3600 * 1000 * 11,
    topicType: '短剧/动漫',
    platforms: ['抖音', '微博'],
    signals: [
      { platform: '抖音', title: '十秒逃离办公室挑战话题播放走高', heat: '中' },
      { platform: '微博', title: '短剧反转桥段进入热搜尾部', heat: '低' },
    ],
    windowDays: 3,
    stage: 'fading',
    fitScore: 66,
    urgency: 'high',
    status: 'new',
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

  // ---- trend radar ----
  trendLoading: boolean
  trendError: string | null
  trendLastUpdated: number | null
  sourceConfig: SourceConfigMap
  refreshHotTopics: () => Promise<void>
  setSourceEnabled: (platform: Platform, enabled: boolean) => void
  markHotTopic: (id: string, status: HotTopicStatus) => void
  evaluateHotTopic: (id: string) => void
  sendHotTopicToProduction: (id: string) => void
  addManualHotTopic: (title: string, type?: HotTopicType) => void

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

function inferHotType(title: string, tags: string[] = []): HotTopicType {
  const text = [title, ...tags].join(' ')
  if (/版本|角色|预告|公告|前瞻/.test(text)) return '版本节点'
  if (/联动|合作|品牌/.test(text)) return '联动'
  if (/短剧|动漫|番|漫画/.test(text)) return '短剧/动漫'
  if (/游戏|挑战|关卡|副本|BOSS|boss/.test(text)) return '游戏'
  if (/新闻|社会|时政/.test(text)) return '新闻时政'
  if (/剧情|原神|米游社|角色/.test(text)) return '本篇延伸'
  return '热梗'
}

function inferPlatforms(tags: string[] = [], fallback: string[] = ['B站']): string[] {
  const known = ['B站', '小红书', '微博', '米游社', '原神官方', '抖音']
  const matched = known.filter((p) => tags.some((t) => t.includes(p) || p.includes(t)))
  return matched.length > 0 ? matched : fallback
}

function enrichHotTopic(card: HotTopicCard): HotTopicCard {
  const topicType = card.topicType ?? inferHotType(card.title, card.tags)
  const platforms = card.platforms ?? inferPlatforms(card.tags, card.source === 'workflow' ? ['工作流'] : ['B站'])
  const stage =
    card.stage ?? (card.trend > 10 ? 'rising' : card.trend < -8 ? 'fading' : card.hotScore > 88 ? 'peak' : 'stable')
  const windowDays =
    card.windowDays ?? Math.max(2, Math.min(14, Math.round(15 - card.hotScore / 9 + (card.trend < 0 ? -2 : 1))))
  const fitScore = card.fitScore ?? Math.min(98, Math.max(45, card.hotScore - 4 + Math.min(6, platforms.length * 2)))
  const urgency = card.urgency ?? (windowDays <= 5 || card.hotScore >= 88 ? 'high' : windowDays <= 9 ? 'medium' : 'low')

  return {
    ...card,
    topicType,
    platforms,
    stage,
    windowDays,
    fitScore,
    urgency,
    status: card.status ?? 'new',
    signals:
      card.signals ??
      platforms.map((platform, idx) => ({
        platform,
        title: idx === 0 ? card.title : `${card.title} 的相关讨论`,
        heat: card.hotScore >= 85 ? '高' : card.hotScore >= 70 ? '中' : '低',
      })),
  }
}

function buildEvaluationReport(card: HotTopicCard): HotEvaluationReport {
  const enriched = enrichHotTopic(card)
  const score = enriched.fitScore ?? enriched.hotScore
  const highFit = score >= 82
  const mediumFit = score >= 68
  const windowDays = enriched.windowDays ?? 7
  const isTight = windowDays <= 5
  const topicType = enriched.topicType ?? '热梗'

  const primaryGameplay =
    topicType === '版本节点'
      ? '机制试炼链'
      : topicType === '短剧/动漫'
        ? '限时逃脱挑战'
        : topicType === '联动'
          ? 'IP 探索互动'
          : '关卡挑战链'

  return {
    generatedAt: Date.now(),
    trendSummary:
      enriched.stage === 'rising'
        ? `上升期，预计 ${Math.max(1, Math.min(3, Math.round(windowDays / 2)))} 天内到达峰值`
        : enriched.stage === 'peak'
          ? '峰值期，建议立刻进入生产或放弃'
          : enriched.stage === 'fading'
            ? '衰退期，仅适合低成本快反'
            : '稳定传播期，可作为常青题材观察',
    toneMatch: highFit ? 4.5 : mediumFit ? 3.8 : 2.9,
    feasibility: highFit ? '高' : mediumFit ? '中' : '低',
    targetAudience:
      topicType === '版本节点'
        ? '原神核心玩家与版本前瞻关注者'
        : '原神核心用户、梗图传播用户与轻度挑战玩家',
    emotionalDirection:
      topicType === '短剧/动漫'
        ? ['紧张', '反转', '快节奏']
        : topicType === '版本节点'
          ? ['新鲜感', '机制探索', '挑战性']
          : ['轻松', '反差萌', '挑战性'],
    windowSummary: isTight ? `可用窗口 ${windowDays} 天，窗口紧张，建议今日立项` : `可用窗口约 ${windowDays} 天，可进入排期评估`,
    peakInDays: enriched.stage === 'rising' ? Math.max(1, Math.min(4, Math.round(windowDays / 2))) : 0,
    gameplayDirections: [
      {
        title: primaryGameplay,
        retention: highFit ? '强' : '中',
        difficulty: topicType === '联动' || topicType === '版本节点' ? '中' : '低',
        reason: '情绪表达清晰、目标明确，适合用短流程挑战承接传播热度。',
      },
      {
        title: 'IP 探索互动',
        retention: mediumFit ? '强' : '中',
        difficulty: '高',
        reason: '适合沉淀为长尾内容，但制作周期更长，需要确认是否能赶上热点窗口。',
      },
      {
        title: '社交测试',
        retention: '弱',
        difficulty: '低',
        reason: '传播包装容易，但复玩与留存弱，除非热点本身强社交属性，否则不优先。',
      },
    ],
    creatorSuggestion:
      topicType === '版本节点'
        ? '优先匹配擅长机制挑战、节奏调参和版本热点包装的创作者。'
        : '优先匹配擅长像素表达、机制挑战或短流程关卡的快反型创作者。',
    productionCycleDays: topicType === '版本节点' ? 10 : isTight ? 5 : 8,
    recommendation: highFit && !isTight ? '建议立项' : highFit && isTight ? '建议立项' : mediumFit ? '谨慎立项' : '不建议',
    priority: highFit || isTight ? '高' : mediumFit ? '中' : '低',
    risks: [
      isTight ? '时效窗口紧，需要 48 小时内锁定制作人。' : '需持续观察热度斜率，避免排期过晚。',
      topicType === '新闻时政' ? '存在舆情与审核风险，建议谨慎处理表达边界。' : '需要避免只复刻梗表层，玩法必须独立成立。',
    ],
  }
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

  dashboardCards: SEED_DASHBOARD_CARDS.map(enrichHotTopic),
  projectFiles: SEED_PROJECT_FILES,

  // ---- trend radar ----
  trendLoading: false,
  trendError: null,
  trendLastUpdated: null,
  sourceConfig: { ...DEFAULT_SOURCE_CONFIG },

  refreshHotTopics: async () => {
    set({ trendLoading: true, trendError: null })
    try {
      const topics = await aggregateHotTopics({ config: get().sourceConfig })
      const now = Date.now()

      // Convert AggregatedTopic to HotTopicCard for dashboard display
      const cards: HotTopicCard[] = topics.map((t) => ({
        id: t.id,
        source: 'external' as const,
        title: t.title,
        hotScore: t.hotScore,
        trend: t.trend,
        summary: t.summary,
        tags: t.tags,
        createdAt: t.createdAt,
        topicType: inferHotType(t.title, t.tags),
        platforms: [...new Set(t.signals.map((signal) => signal.platform))],
        signals: t.signals.slice(0, 4).map((signal) => {
          const metric = signal.metrics.heatScore ?? signal.metrics.viewCount ?? 0
          const heat: '高' | '中' | '低' =
            metric > 100000 ? '高' : metric > 10000 ? '中' : '低'
          return {
            platform: signal.platform,
            title: signal.title,
            url: signal.url,
            heat,
          }
        }),
        fitScore: t.ugcFit.score,
      })).map(enrichHotTopic)

      // Merge with existing workflow-generated and seed cards, de-duplicate by id
      const existingCards = get().dashboardCards.filter(
        (c) => c.source !== 'external' || c.id.startsWith('seed-'),
      )
      const merged = [...cards, ...existingCards].slice(0, 50)

      set({
        dashboardCards: merged,
        trendLoading: false,
        trendLastUpdated: now,
        trendError: cards.length === 0 ? '未获取到热点数据（可能没有匹配 UGC 关键词的内容）' : null,
      })
    } catch (err: any) {
      set({
        trendLoading: false,
        trendError: `热点获取失败：${err?.message ?? '未知错误'}`,
      })
    }
  },

  setSourceEnabled: (platform, enabled) => {
    set((s) => ({
      sourceConfig: {
        ...s.sourceConfig,
        [platform]: { ...s.sourceConfig[platform], enabled },
      },
    }))
  },

  markHotTopic: (id, status) => {
    set((s) => ({
      dashboardCards: s.dashboardCards.map((card) =>
        card.id === id ? { ...enrichHotTopic(card), status } : card,
      ),
    }))
    const label =
      status === 'watching'
        ? '已加入我的关注'
        : status === 'ignored'
          ? '已忽略该热点'
          : status === 'in-production'
            ? '已进入生产管线'
            : '已恢复为待处理'
    get().showToast(label, 1600)
  },

  evaluateHotTopic: (id) => {
    set((s) => ({
      dashboardCards: s.dashboardCards.map((card) =>
        card.id === id
          ? {
              ...enrichHotTopic(card),
              status: card.status === 'ignored' ? 'new' : card.status,
              evaluation: buildEvaluationReport(card),
            }
          : card,
      ),
    }))
    get().showToast('热点深评报告已生成', 1600)
  },

  sendHotTopicToProduction: (id) => {
    const card = get().dashboardCards.find((c) => c.id === id)
    if (!card) return
    const enriched = enrichHotTopic(card)
    const report = enriched.evaluation ?? buildEvaluationReport(enriched)
    const brief = `# ${enriched.title} 关卡立项 Brief

## 热点判断
${enriched.summary}

- 热点类型：${enriched.topicType}
- 平台来源：${enriched.platforms?.join(' / ') ?? '未知'}
- 综合热度：${enriched.hotScore}
- 千星适配：${enriched.fitScore ?? enriched.hotScore}
- 可用窗口：${enriched.windowDays} 天

## 推荐玩法
${report.gameplayDirections
  .map((g, idx) => `${idx + 1}. ${g.title}：留存预期 ${g.retention}，制作难度 ${g.difficulty}。${g.reason}`)
  .join('\n')}

## 创作者匹配
${report.creatorSuggestion}

## 风险
${report.risks.map((risk) => `- ${risk}`).join('\n')}
`
    const file = toGiaFile(brief, enriched.title)
    set((s) => ({
      dashboardCards: s.dashboardCards.map((c) =>
        c.id === id
          ? { ...enrichHotTopic(c), status: 'in-production', evaluation: report }
          : c,
      ),
      projectFiles: [file, ...s.projectFiles].slice(0, 24),
      view: 'project',
    }))
    get().showToast('已生成立项 Brief，并写入项目中心', 2000)
  },

  addManualHotTopic: (title, type = '热梗') => {
    const trimmed = title.trim()
    if (!trimmed) {
      get().showToast('请先输入热点名称')
      return
    }
    const card = enrichHotTopic({
      id: `manual-${Date.now()}`,
      source: 'manual',
      title: trimmed,
      hotScore: 72,
      trend: 0,
      summary: '人工补录热点，等待运营补充外部信号或发起深评。',
      tags: ['人工补录', type],
      createdAt: Date.now(),
      topicType: type,
      platforms: ['人工补录'],
      signals: [{ platform: '人工补录', title: trimmed, heat: '中' }],
      windowDays: 7,
      stage: 'stable',
      fitScore: 68,
      urgency: 'medium',
      status: 'new',
    })
    set((s) => ({ dashboardCards: [card, ...s.dashboardCards].slice(0, 50) }))
    get().showToast('已补录热点', 1600)
  },

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
              dashboardCards: [enrichHotTopic(card), ...s.dashboardCards].slice(0, 24),
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
