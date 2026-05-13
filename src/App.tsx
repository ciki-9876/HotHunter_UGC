import { useCallback, useEffect, useMemo, useState } from 'react'
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  ReactFlowProvider,
  getBezierPath,
  type EdgeProps,
  type Node,
  type NodeProps,
  type Edge,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { create } from 'zustand'

/* ============================================================
 *  Types & Store
 * ============================================================ */

type NodeStatus = 'idle' | 'running' | 'done' | 'error'

type AgentKind = 'input' | 'outline' | 'writer' | 'editor' | 'output'

interface AgentNodeData {
  kind: AgentKind
  title: string
  subtitle: string
  icon: string
  /** Latest result content produced by this node */
  result: string
  status: NodeStatus
  /** Short summary shown in the card body */
  summary: string
}

interface BlueprintState {
  topic: string
  isRunning: boolean
  selectedNodeId: string | null
  toast: string | null
  nodeStatus: Record<string, NodeStatus>
  nodeResult: Record<string, string>
  nodeSummary: Record<string, string>
  setTopic: (v: string) => void
  setSelected: (id: string | null) => void
  setToast: (msg: string | null) => void
  resetRun: () => void
  startRun: () => Promise<void>
}

const NODE_IDS = {
  input: 'n-input',
  outline: 'n-outline',
  writer: 'n-writer',
  editor: 'n-editor',
  output: 'n-output',
} as const

const AGENT_ORDER = [
  NODE_IDS.outline,
  NODE_IDS.writer,
  NODE_IDS.editor,
  NODE_IDS.output,
] as const

/* --- Mock content generators (demo, no API call) --- */
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

function genOutline(topic: string): string {
  return [
    `# 《${topic}》· 文章大纲`,
    '',
    `## 第 1 章 · 引入：为什么《${topic}》值得被关注`,
    '   - 当下的背景与现状速描',
    '   - 我们要解决的核心问题',
    '',
    `## 第 2 章 · 拆解：${topic} 的三个关键支点`,
    '   - 支点一：核心概念与定义',
    '   - 支点二：实际应用中的难点',
    '   - 支点三：可复用的方法论',
    '',
    `## 第 3 章 · 行动：把《${topic}》落到日常`,
    '   - 给读者的三步行动清单',
    '   - 进一步阅读与延伸',
  ].join('\n')
}

function genArticle(topic: string): string {
  return [
    `# ${topic}`,
    '',
    `当我们谈论《${topic}》时，大多数人脑海里浮现的还是它最表层的样子。但真正驱动它的，是一组看似平常、却被反复忽视的底层规律。`,
    '',
    `## 一、为什么《${topic}》正在被重新定义`,
    `过去几年，行业对${topic}的理解经历了三次跃迁：从工具化、到方法论化、再到今天的系统化。每一次跃迁背后，都是用户需求颗粒度变细的结果。`,
    '',
    `## 二、三个常被忽略的关键支点`,
    `**支点一 · 概念**：${topic}的本质并不复杂，它是一组可被拆解、可被复用的最小单元。`,
    `**支点二 · 难点**：真正的难点不在执行，而在“判断哪件事不该做”。`,
    `**支点三 · 方法**：用最小可验证流程（MVF）替代一次性大方案，跑得快才能改得快。`,
    '',
    `## 三、把《${topic}》落到日常`,
    `1. 列出你目前正在投入${topic}的 3 件事；`,
    `2. 用 10 分钟把它们按"必要 / 重要 / 顺手"重新排序；`,
    `3. 只保留前两类，剩下的直接归档。`,
    '',
    `结尾：${topic}从来不是知识问题，而是选择问题。当你愿意舍弃一些"看起来该做"的事，它才真正开始为你工作。`,
  ].join('\n')
}

function genEdited(topic: string): string {
  return [
    `# ${topic}：少做一点，反而更快`,
    '',
    `我们对《${topic}》的误解，往往不是因为不懂，而是因为做得太多。`,
    '',
    `## 一、重新理解${topic}`,
    `过去几年，行业对它的认知经历了三次跃迁——工具化、方法论化、系统化。每一次跃迁的背后，都是同一件事：用户的需求颗粒度，正在变得越来越细。`,
    '',
    `## 二、三个被忽略的支点`,
    `**概念**：${topic}并不复杂，它是一组可拆解、可复用的最小单元。`,
    `**难点**：真正的难，不在执行，而在判断"哪件事不该做"。`,
    `**方法**：用最小可验证流程，替代一次性大方案；跑得快，才改得快。`,
    '',
    `## 三、可以今天就开始的三步`,
    `1. 写下当前正在为${topic}投入的 3 件事；`,
    `2. 花 10 分钟按"必要 / 重要 / 顺手"重新排序；`,
    `3. 只保留前两类，其它归档，不再回看。`,
    '',
    `${topic}从来不是知识问题，而是选择问题。当你愿意放下"看起来该做"的事，它才开始真正为你工作。`,
  ].join('\n')
}

function summarize(text: string, limit = 56): string {
  const plain = text.replace(/^#.*$/gm, '').replace(/\s+/g, ' ').trim()
  return plain.length > limit ? plain.slice(0, limit) + '…' : plain
}

/* --- Zustand store --- */
const useBlueprint = create<BlueprintState>((set, get) => ({
  topic: '如何在不确定中保持高效',
  isRunning: false,
  selectedNodeId: null,
  toast: null,
  nodeStatus: {
    [NODE_IDS.input]: 'idle',
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
  setTopic: (v) => set({ topic: v }),
  setSelected: (id) => set({ selectedNodeId: id }),
  setToast: (msg) => set({ toast: msg }),
  resetRun: () =>
    set({
      isRunning: false,
      selectedNodeId: null,
      nodeStatus: {
        [NODE_IDS.input]: 'done',
        [NODE_IDS.outline]: 'idle',
        [NODE_IDS.writer]: 'idle',
        [NODE_IDS.editor]: 'idle',
        [NODE_IDS.output]: 'idle',
      },
      nodeResult: {
        [NODE_IDS.input]: get().topic,
        [NODE_IDS.outline]: '',
        [NODE_IDS.writer]: '',
        [NODE_IDS.editor]: '',
        [NODE_IDS.output]: '',
      },
      nodeSummary: {
        [NODE_IDS.input]: get().topic,
        [NODE_IDS.outline]: '等待大纲生成…',
        [NODE_IDS.writer]: '等待正文写作…',
        [NODE_IDS.editor]: '等待润色…',
        [NODE_IDS.output]: '等待最终文章…',
      },
    }),
  startRun: async () => {
    const { topic, isRunning } = get()
    if (isRunning) return
    if (!topic.trim()) {
      set({ toast: '请先输入一个文章主题' })
      setTimeout(() => set({ toast: null }), 2000)
      return
    }

    // reset
    set({
      isRunning: true,
      selectedNodeId: null,
      nodeStatus: {
        [NODE_IDS.input]: 'done',
        [NODE_IDS.outline]: 'idle',
        [NODE_IDS.writer]: 'idle',
        [NODE_IDS.editor]: 'idle',
        [NODE_IDS.output]: 'idle',
      },
      nodeResult: {
        [NODE_IDS.input]: topic,
        [NODE_IDS.outline]: '',
        [NODE_IDS.writer]: '',
        [NODE_IDS.editor]: '',
        [NODE_IDS.output]: '',
      },
      nodeSummary: {
        [NODE_IDS.input]: topic,
        [NODE_IDS.outline]: '正在等待上游…',
        [NODE_IDS.writer]: '正在等待上游…',
        [NODE_IDS.editor]: '正在等待上游…',
        [NODE_IDS.output]: '正在等待上游…',
      },
    })

    const steps: Array<{ id: string; delay: number; produce: () => string }> = [
      {
        id: NODE_IDS.outline,
        delay: 1500,
        produce: () => genOutline(topic),
      },
      {
        id: NODE_IDS.writer,
        delay: 1800,
        produce: () => genArticle(topic),
      },
      {
        id: NODE_IDS.editor,
        delay: 1500,
        produce: () => genEdited(topic),
      },
      {
        id: NODE_IDS.output,
        delay: 900,
        produce: () => get().nodeResult[NODE_IDS.editor] || genEdited(topic),
      },
    ]

    for (const step of steps) {
      // mark running
      set((s) => ({
        nodeStatus: { ...s.nodeStatus, [step.id]: 'running' },
        nodeSummary: { ...s.nodeSummary, [step.id]: '生成中…' },
      }))
      await wait(step.delay)
      const result = step.produce()
      set((s) => ({
        nodeStatus: { ...s.nodeStatus, [step.id]: 'done' },
        nodeResult: { ...s.nodeResult, [step.id]: result },
        nodeSummary: { ...s.nodeSummary, [step.id]: summarize(result) },
      }))
    }

    set({ isRunning: false, toast: '工作流执行完成 ✓' })
    setTimeout(() => set({ toast: null }), 2200)
  },
}))

/* ============================================================
 *  Node Components
 * ============================================================ */

function statusClass(status: NodeStatus): string {
  switch (status) {
    case 'running':
      return 'is-running'
    case 'done':
      return 'is-done'
    case 'error':
      return 'is-error'
    default:
      return ''
  }
}

function NodeStatusLabel({ status }: { status: NodeStatus }) {
  switch (status) {
    case 'running':
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span className="spinner" />
          运行中
        </span>
      )
    case 'done':
      return <span style={{ color: '#1aa37a' }}>已完成</span>
    case 'error':
      return <span style={{ color: '#d23a4d' }}>失败</span>
    default:
      return <span>待运行</span>
  }
}

function TopicInputNode({ id, selected }: NodeProps) {
  const topic = useBlueprint((s) => s.topic)
  const setTopic = useBlueprint((s) => s.setTopic)
  const startRun = useBlueprint((s) => s.startRun)
  const isRunning = useBlueprint((s) => s.isRunning)
  const status = useBlueprint((s) => s.nodeStatus[id])

  return (
    <div
      className={`node-card node-input ${statusClass(status)} ${
        selected ? 'is-selected' : ''
      }`}
    >
      <div className="node-header">
        <span className="node-icon">✦</span>
        <span className="node-title">主题输入</span>
        <span className="node-status-dot" />
      </div>
      <div className="node-subtitle">TopicInput · 起点</div>
      <input
        className="topic-input nodrag"
        placeholder="请输入文章主题…"
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        disabled={isRunning}
      />
      <button
        className="run-btn nodrag"
        onClick={(e) => {
          e.stopPropagation()
          void startRun()
        }}
        disabled={isRunning}
      >
        {isRunning ? '运行中…' : '▶ 开始运行'}
      </button>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

interface AgentBodyProps {
  id: string
  title: string
  subtitle: string
  icon: string
  selected?: boolean
}

function AgentNode({ id, title, subtitle, icon, selected }: AgentBodyProps) {
  const status = useBlueprint((s) => s.nodeStatus[id])
  const summary = useBlueprint((s) => s.nodeSummary[id])

  return (
    <div
      className={`node-card ${statusClass(status)} ${
        selected ? 'is-selected' : ''
      }`}
    >
      <div className="node-header">
        <span className="node-icon">{icon}</span>
        <span className="node-title">{title}</span>
        <span className="node-status-dot" />
      </div>
      <div className="node-subtitle">{subtitle}</div>
      <div className="node-body">{summary}</div>
      <div className="node-footer">
        <NodeStatusLabel status={status} />
        <span style={{ color: '#8893a8' }}>点击查看 →</span>
      </div>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

function OutlineAgentNode(p: NodeProps) {
  return (
    <AgentNode
      id={p.id}
      title="大纲生成 Agent"
      subtitle="OutlineAgent · Claude"
      icon="◆"
      selected={p.selected}
    />
  )
}
function WriterAgentNode(p: NodeProps) {
  return (
    <AgentNode
      id={p.id}
      title="正文写作 Agent"
      subtitle="WriterAgent · Claude"
      icon="✎"
      selected={p.selected}
    />
  )
}
function EditorAgentNode(p: NodeProps) {
  return (
    <AgentNode
      id={p.id}
      title="润色编辑 Agent"
      subtitle="EditorAgent · Claude"
      icon="✦"
      selected={p.selected}
    />
  )
}

function OutputNode({ id, selected }: NodeProps) {
  const status = useBlueprint((s) => s.nodeStatus[id])
  const summary = useBlueprint((s) => s.nodeSummary[id])
  const result = useBlueprint((s) => s.nodeResult[id])
  const setToast = useBlueprint((s) => s.setToast)

  const copy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (!result) return
      navigator.clipboard
        .writeText(result)
        .then(() => {
          setToast('已复制到剪贴板 ✓')
          setTimeout(() => setToast(null), 1800)
        })
        .catch(() => {
          setToast('复制失败')
          setTimeout(() => setToast(null), 1800)
        })
    },
    [result, setToast],
  )

  return (
    <div
      className={`node-card node-output ${statusClass(status)} ${
        selected ? 'is-selected' : ''
      }`}
    >
      <div className="node-header">
        <span className="node-icon">⎙</span>
        <span className="node-title">最终输出</span>
        <span className="node-status-dot" />
      </div>
      <div className="node-subtitle">OutputNode · 终点</div>
      <div className="node-body">{summary}</div>
      <button
        className="copy-btn nodrag"
        onClick={copy}
        disabled={status !== 'done'}
      >
        {status === 'done' ? '📋 复制完整文章' : '尚无内容'}
      </button>
      <Handle type="target" position={Position.Left} />
    </div>
  )
}

/* ============================================================
 *  Animated edge
 * ============================================================ */

function FlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  source,
  target,
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const sourceStatus = useBlueprint((s) => s.nodeStatus[source])
  const targetStatus = useBlueprint((s) => s.nodeStatus[target])

  // Active = data is currently flowing INTO a running target,
  // Done   = source already produced and target consumed it
  const isActive =
    targetStatus === 'running' ||
    (sourceStatus === 'running' && targetStatus === 'idle')
  const isDone =
    !isActive && sourceStatus === 'done' && targetStatus === 'done'

  const cls = `flow-edge ${isActive ? 'is-active' : ''} ${
    isDone ? 'is-done' : ''
  }`

  return (
    <g className={cls}>
      <path id={id} d={edgePath} className="flow-edge-base" />
      <path d={edgePath} className="flow-edge-glow" />
      <path d={edgePath} className="flow-edge-dash" />
    </g>
  )
}

/* ============================================================
 *  Top-level App
 * ============================================================ */

const nodeTypes = {
  topicInput: TopicInputNode,
  outlineAgent: OutlineAgentNode,
  writerAgent: WriterAgentNode,
  editorAgent: EditorAgentNode,
  outputNode: OutputNode,
}

const edgeTypes = { flow: FlowEdge }

const initialNodes: Node[] = [
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

const initialEdges: Edge[] = [
  { id: 'e1', source: NODE_IDS.input, target: NODE_IDS.outline, type: 'flow' },
  {
    id: 'e2',
    source: NODE_IDS.outline,
    target: NODE_IDS.writer,
    type: 'flow',
  },
  { id: 'e3', source: NODE_IDS.writer, target: NODE_IDS.editor, type: 'flow' },
  { id: 'e4', source: NODE_IDS.editor, target: NODE_IDS.output, type: 'flow' },
]

const NODE_LABELS: Record<string, string> = {
  [NODE_IDS.input]: '主题输入',
  [NODE_IDS.outline]: '大纲生成 Agent',
  [NODE_IDS.writer]: '正文写作 Agent',
  [NODE_IDS.editor]: '润色编辑 Agent',
  [NODE_IDS.output]: '最终输出',
}

const NODE_ICONS: Record<string, string> = {
  [NODE_IDS.input]: '✦',
  [NODE_IDS.outline]: '◆',
  [NODE_IDS.writer]: '✎',
  [NODE_IDS.editor]: '✦',
  [NODE_IDS.output]: '⎙',
}

function SidePanel() {
  const selectedNodeId = useBlueprint((s) => s.selectedNodeId)
  const setSelected = useBlueprint((s) => s.setSelected)
  const result = useBlueprint((s) =>
    selectedNodeId ? s.nodeResult[selectedNodeId] : '',
  )
  const status = useBlueprint((s) =>
    selectedNodeId ? s.nodeStatus[selectedNodeId] : 'idle',
  )

  const label = selectedNodeId ? NODE_LABELS[selectedNodeId] : ''
  const icon = selectedNodeId ? NODE_ICONS[selectedNodeId] : ''
  const open = Boolean(selectedNodeId) && Boolean(result)

  return (
    <aside className={`side-panel ${open ? 'open' : ''}`}>
      <div className="panel-header">
        <span className="panel-icon">{icon}</span>
        <span className="panel-title">{label}</span>
        <button className="close-btn" onClick={() => setSelected(null)}>
          关闭
        </button>
      </div>
      <div className="panel-meta">
        <span>
          状态：<b><NodeStatusLabel status={status} /></b>
        </span>
        <span>
          字符：<b>{result?.length ?? 0}</b>
        </span>
      </div>
      <div className="panel-body">{result || '（暂无内容）'}</div>
    </aside>
  )
}

function TopBar() {
  const isRunning = useBlueprint((s) => s.isRunning)
  const statuses = useBlueprint((s) => s.nodeStatus)
  const allDone = AGENT_ORDER.every((id) => statuses[id] === 'done')

  let pillCls = 'status-pill'
  let label = '就绪 · 等待运行'
  if (isRunning) {
    pillCls += ' running'
    label = '执行中 · 请稍候'
  } else if (allDone) {
    pillCls += ' done'
    label = '已完成 · 点击节点查看结果'
  }

  return (
    <div className="top-bar">
      <span className="brand">
        <span className="brand-mark" />
        Agent 蓝图 · Blueprint
      </span>
      <span className="spacer" />
      <span className={pillCls}>{label}</span>
    </div>
  )
}

function Canvas() {
  const [nodes] = useState<Node[]>(initialNodes)
  const [edges] = useState<Edge[]>(initialEdges)
  const setSelected = useBlueprint((s) => s.setSelected)
  const selectedNodeId = useBlueprint((s) => s.selectedNodeId)
  const nodeResult = useBlueprint((s) => s.nodeResult)

  const decoratedNodes = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        selected: n.id === selectedNodeId,
      })),
    [nodes, selectedNodeId],
  )

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      // Only open panel if the node has content (skip the empty input case)
      if (node.id === NODE_IDS.input) {
        setSelected(null)
        return
      }
      if (nodeResult[node.id]) {
        setSelected(node.id)
      }
    },
    [setSelected, nodeResult],
  )

  return (
    <ReactFlow
      nodes={decoratedNodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodeClick={onNodeClick}
      onPaneClick={() => setSelected(null)}
      fitView
      fitViewOptions={{ padding: 0.25 }}
      proOptions={{ hideAttribution: true }}
      panOnScroll
      zoomOnDoubleClick={false}
      minZoom={0.4}
      maxZoom={1.6}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={22}
        size={1}
        color="#262c3a"
      />
      <Controls position="bottom-left" showInteractive={false} />
    </ReactFlow>
  )
}

function Toast() {
  const toast = useBlueprint((s) => s.toast)
  if (!toast) return null
  return <div className="toast">{toast}</div>
}

export default function App() {
  // Pre-mark input node as "done" so the very first edge starts grey, not idle.
  const resetRun = useBlueprint((s) => s.resetRun)
  useEffect(() => {
    resetRun()
  }, [resetRun])

  return (
    <ReactFlowProvider>
      <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
        <TopBar />
        <Canvas />
        <SidePanel />
        <Toast />
      </div>
    </ReactFlowProvider>
  )
}
