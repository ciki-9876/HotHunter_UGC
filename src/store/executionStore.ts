/**
 * executionStore — runtime state: node status, results, critic loop, abort
 */
import { create } from 'zustand'
import { runAgent } from '../agent/client'
import {
  DEFAULT_CRITIC_DATA, MOCK_CRITIC_SEQUENCE,
  criticPrompts, parseCriticJudgement,
  type CriticNodeData,
} from '../agent/critic'
import {
  DEFAULT_NODE_CONFIGS, GENERIC_AGENT_CONFIG,
  NODE_IDS, mockArticle, mockEdited, mockOutline,
} from '../agent/defaults'
import { toGiaFile, toHotTopicCard, type DispatchTarget } from '../agent/dispatch'
import type { NodeStatus } from '../types'
import type { Node, Edge } from 'reactflow'

// ── BFS execution planner ────────────────────────────────────────────────────
interface ExecPlan {
  order: string[]
  upstreams: Record<string, string[]>
}

export function planExecution(nodes: Node[], edges: Edge[], startId: string): ExecPlan {
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

// ── Prompt template fill ─────────────────────────────────────────────────────
function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '')
}
function summarize(text: string, len = 72): string {
  const cleaned = text.replace(/[#*`_~]/g, '').replace(/\s+/g, ' ').trim()
  return cleaned.length > len ? cleaned.slice(0, len) + '…' : cleaned
}
function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

// ── Store interface ───────────────────────────────────────────────────────────
interface CriticRuntime {
  iteration: number
  score: number
  feedback: string
  passed: boolean
}

export interface DispatchNodeData { target: DispatchTarget }

interface ExecutionState {
  isRunning: boolean
  topic: string
  nodeStatus: Record<string, NodeStatus>
  nodeResult: Record<string, string>
  nodeSummary: Record<string, string>
  nodeError: Record<string, string>
  criticRuntime: Record<string, CriticRuntime>
  collapsedNodes: Record<string, boolean>
  abortController: AbortController | null

  // Dashboard / project data
  dashboardCards: ReturnType<typeof toHotTopicCard>[]
  projectFiles: ReturnType<typeof toGiaFile>[]

  setTopic: (t: string) => void
  toggleNodeCollapsed: (id: string) => void
  clearNodeState: (id: string) => void
  stopRun: () => void
  resetCanvas: () => void

  startRun: (
    nodes: Node[],
    edges: Edge[],
    provider: import('../types').ProviderConfig,
    nodeConfigs: Record<string, import('../types').NodeConfig>,
    showToast: (msg: string, type?: 'success'|'error'|'info'|'warn') => void,
  ) => Promise<void>
}

// ── seed data ─────────────────────────────────────────────────────────────────
import { SEED_DASHBOARD_CARDS, SEED_PROJECT_FILES } from '../agent/defaults'

export const useExecutionStore = create<ExecutionState>((set, get) => ({
  isRunning: false,
  topic: '',
  nodeStatus: {},
  nodeResult: {},
  nodeSummary: {},
  nodeError: {},
  criticRuntime: {},
  collapsedNodes: {},
  abortController: null,
  dashboardCards: SEED_DASHBOARD_CARDS,
  projectFiles: SEED_PROJECT_FILES,

  setTopic: (t) => set({ topic: t }),

  toggleNodeCollapsed: (id) =>
    set((s) => ({ collapsedNodes: { ...s.collapsedNodes, [id]: !s.collapsedNodes[id] } })),

  clearNodeState: (id) =>
    set((s) => {
      const ns = { ...s.nodeStatus }; delete ns[id]
      const nr = { ...s.nodeResult }; delete nr[id]
      const nm = { ...s.nodeSummary }; delete nm[id]
      const ne = { ...s.nodeError }; delete ne[id]
      return { nodeStatus: ns, nodeResult: nr, nodeSummary: nm, nodeError: ne }
    }),

  stopRun: () => {
    get().abortController?.abort()
    set({ isRunning: false, abortController: null })
  },

  resetCanvas: () =>
    set({
      nodeStatus: {}, nodeResult: {}, nodeSummary: {},
      nodeError: {}, criticRuntime: {},
    }),

  startRun: async (nodes, edges, provider, nodeConfigs, showToast) => {
    const state = get()
    if (state.isRunning) return
    const topic = state.topic.trim()
    if (!topic) { showToast('请先输入主题', 'warn'); return }

    state.resetCanvas()
    const abort = new AbortController()
    set({
      isRunning: true,
      abortController: abort,
      nodeResult: { [NODE_IDS.input]: topic },
      nodeSummary: { [NODE_IDS.input]: topic },
    })

    const useMock = !provider.apiKey.trim()
    const { order, upstreams } = planExecution(nodes, edges, NODE_IDS.input)

    const gatherInput = (nodeId: string): string =>
      (upstreams[nodeId] ?? [])
        .map((u) => get().nodeResult[u] ?? '')
        .filter(Boolean)
        .join('\n\n---\n\n')

    // ── resolve provider (node-level override) ──────────────────────────────
    function resolveCfg(base: typeof provider, override?: Partial<typeof provider>) {
      if (!override) return base
      return { ...base, ...Object.fromEntries(Object.entries(override).filter(([, v]) => v)) }
    }

    // ── execute a single agent node ─────────────────────────────────────────
    const runAgentNode = async (
      nodeId: string,
      upstreamText: string,
      extraFeedback?: string,
    ): Promise<string> => {
      const cfg = nodeConfigs[nodeId] ?? DEFAULT_NODE_CONFIGS[nodeId] ?? GENERIC_AGENT_CONFIG
      const resolved = resolveCfg(provider, cfg.override)
      let userPrompt = fillTemplate(cfg.userPromptTemplate, {
        topic,
        input: upstreamText || topic,
      })
      if (cfg.extraPrompt?.trim()) userPrompt += `\n\n额外要求：\n${cfg.extraPrompt}`
      if (extraFeedback?.trim())
        userPrompt += `\n\n上一版评审反馈，请基于此改进：\n${extraFeedback}\n\n请输出改进后的新版本。`

      set((s) => ({
        nodeStatus: { ...s.nodeStatus, [nodeId]: 'running' },
        nodeSummary: { ...s.nodeSummary, [nodeId]: extraFeedback ? '基于反馈重新生成…' : '生成中…' },
        nodeResult:  { ...s.nodeResult,  [nodeId]: '' },
      }))

      let acc = ''
      if (useMock) {
        const baseFull =
          nodeId === NODE_IDS.outline ? mockOutline(topic) :
          nodeId === NODE_IDS.writer  ? mockArticle(topic) :
          nodeId === NODE_IDS.editor  ? mockEdited(topic) :
          `# ${cfg.label}\n\n基于以下输入（mock）：\n\n${upstreamText || topic}\n\n— 配置 API Key 后可走真实模型。`
        const full = extraFeedback ? `${baseFull}\n\n_（已根据评审反馈改进）_` : baseFull
        const step = Math.max(2, Math.floor(full.length / 60))
        for (let i = 0; i < full.length; i += step) {
          if (abort.signal.aborted) throw new Error('已取消')
          acc = full.slice(0, i + step)
          set((s) => ({ nodeResult: { ...s.nodeResult, [nodeId]: acc }, nodeSummary: { ...s.nodeSummary, [nodeId]: summarize(acc) } }))
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
          set((s) => ({ nodeResult: { ...s.nodeResult, [nodeId]: snap }, nodeSummary: { ...s.nodeSummary, [nodeId]: summarize(snap) } }))
        }
      }

      set((s) => ({
        nodeStatus:  { ...s.nodeStatus,  [nodeId]: 'done' },
        nodeResult:  { ...s.nodeResult,  [nodeId]: acc },
        nodeSummary: { ...s.nodeSummary, [nodeId]: summarize(acc) },
      }))
      return acc
    }

    // ── judge for critic node ───────────────────────────────────────────────
    const judgeOnce = async (candidateText: string, data: CriticNodeData, iter: number) => {
      if (useMock) {
        const seq = MOCK_CRITIC_SEQUENCE
        await wait(600)
        return seq[Math.min(iter - 1, seq.length - 1)]
      }
      const { systemPrompt, userPrompt } = criticPrompts(data.rubric, candidateText)
      let raw = ''
      for await (const chunk of runAgent(provider, {
        systemPrompt, userPrompt, temperature: 0.2, maxTokens: 400, signal: abort.signal,
      })) raw += chunk
      return parseCriticJudgement(raw)
    }

    try {
      for (const nodeId of order) {
        if (abort.signal.aborted) throw new Error('已取消')
        const node = nodes.find((n) => n.id === nodeId)
        if (!node) continue

        const inputs = (upstreams[nodeId] ?? []).map((u) => get().nodeResult[u] ?? '').filter(Boolean)
        const upstreamText = inputs.join('\n\n---\n\n')

        if (node.type === 'topicInput') {
          set((s) => ({
            nodeStatus:  { ...s.nodeStatus,  [nodeId]: 'done' },
            nodeResult:  { ...s.nodeResult,  [nodeId]: topic },
            nodeSummary: { ...s.nodeSummary, [nodeId]: topic },
          }))
          continue
        }

        if (node.type === 'outputNode') {
          set((s) => ({ nodeStatus: { ...s.nodeStatus, [nodeId]: 'running' } }))
          await wait(350)
          set((s) => ({
            nodeStatus:  { ...s.nodeStatus,  [nodeId]: 'done' },
            nodeResult:  { ...s.nodeResult,  [nodeId]: upstreamText },
            nodeSummary: { ...s.nodeSummary, [nodeId]: summarize(upstreamText) },
          }))
          continue
        }

        if (node.type === 'dispatchNode') {
          const target = ((node.data as DispatchNodeData | undefined)?.target) ?? 'dashboard'
          set((s) => ({ nodeStatus: { ...s.nodeStatus, [nodeId]: 'running' }, nodeSummary: { ...s.nodeSummary, [nodeId]: target === 'dashboard' ? '格式转换 → HotTopicCard…' : '格式转换 → .gia 文档…' } }))
          await wait(500)
          if (target === 'dashboard') {
            const card = toHotTopicCard(upstreamText, topic)
            set((s) => ({
              dashboardCards: [card, ...s.dashboardCards].slice(0, 24),
              nodeStatus:  { ...s.nodeStatus,  [nodeId]: 'done' },
              nodeResult:  { ...s.nodeResult,  [nodeId]: JSON.stringify(card, null, 2) },
              nodeSummary: { ...s.nodeSummary, [nodeId]: `已写入看板 · 热度 ${card.hotScore}` },
            }))
          } else {
            const file = toGiaFile(upstreamText, topic)
            set((s) => ({
              projectFiles: [file, ...s.projectFiles].slice(0, 24),
              nodeStatus:  { ...s.nodeStatus,  [nodeId]: 'done' },
              nodeResult:  { ...s.nodeResult,  [nodeId]: JSON.stringify(file, null, 2) },
              nodeSummary: { ...s.nodeSummary, [nodeId]: `已生成 ${file.filename}` },
            }))
          }
          continue
        }

        // ── Human Approval node ───────────────────────────────────────────
        if (node.type === 'human_approval') {
          set((s) => ({
            nodeStatus:  { ...s.nodeStatus,  [nodeId]: 'waiting' },
            nodeSummary: { ...s.nodeSummary, [nodeId]: '⏸ 等待审批…' },
            nodeResult:  { ...s.nodeResult,  [nodeId]: upstreamText },
          }))
          // In mock/local mode: auto-approve after 2s
          if (useMock) {
            await wait(2000)
            set((s) => ({
              nodeStatus:  { ...s.nodeStatus,  [nodeId]: 'done' },
              nodeSummary: { ...s.nodeSummary, [nodeId]: '✓ 已自动通过（mock）' },
            }))
          }
          continue
        }

        // ── Condition node ────────────────────────────────────────────────
        if (node.type === 'condition') {
          set((s) => ({ nodeStatus: { ...s.nodeStatus, [nodeId]: 'done' }, nodeSummary: { ...s.nodeSummary, [nodeId]: '分支判断完成' }, nodeResult: { ...s.nodeResult, [nodeId]: upstreamText } }))
          continue
        }

        // ── Critic node ───────────────────────────────────────────────────
        if (node.type === 'criticNode') {
          const data = (node.data as CriticNodeData | undefined) ?? DEFAULT_CRITIC_DATA
          const upstreamId = (upstreams[nodeId] ?? [])[0]
          if (!upstreamId) {
            set((s) => ({ nodeStatus: { ...s.nodeStatus, [nodeId]: 'error' }, nodeError: { ...s.nodeError, [nodeId]: '评审节点缺少上游 Agent' }, nodeSummary: { ...s.nodeSummary, [nodeId]: '缺少上游—请先连线' } }))
            continue
          }
          let candidate = get().nodeResult[upstreamId] ?? upstreamText
          let passed = false; let lastScore = 0; let lastFeedback = ''; let iter = 0
          for (iter = 1; iter <= data.maxIterations; iter++) {
            if (abort.signal.aborted) throw new Error('已取消')
            set((s) => ({ nodeStatus: { ...s.nodeStatus, [nodeId]: 'running' }, nodeSummary: { ...s.nodeSummary, [nodeId]: `评审第 ${iter}/${data.maxIterations} 轮…` } }))
            const j = await judgeOnce(candidate, data, iter)
            lastScore = j.score; lastFeedback = j.feedback
            set((s) => ({ criticRuntime: { ...s.criticRuntime, [nodeId]: { iteration: iter, score: j.score, feedback: j.feedback, passed: j.score >= data.threshold } } }))
            if (j.score >= data.threshold) { passed = true; break }
            if (iter === data.maxIterations) break
            candidate = await runAgentNode(upstreamId, gatherInput(upstreamId), j.feedback)
          }
          const summary = passed ? `✓ 通过 (${lastScore} 分, ${iter} 轮)` : `⚠ 未通过 (${lastScore} 分, 已达上限)`
          set((s) => ({
            nodeStatus:  { ...s.nodeStatus,  [nodeId]: 'done' },
            nodeResult:  { ...s.nodeResult,  [nodeId]: candidate },
            nodeSummary: { ...s.nodeSummary, [nodeId]: summary },
            ...(!passed ? { nodeError: { ...s.nodeError, [nodeId]: `最终得分 ${lastScore}，反馈：${lastFeedback}` } } : {}),
          }))
          continue
        }

        // ── Default: agent-like node ──────────────────────────────────────
        await runAgentNode(nodeId, upstreamText)
      }

      set({ isRunning: false })
      showToast('工作流运行完成 ✦', 'success')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg !== '已取消') {
        set({ isRunning: false })
        showToast(`运行失败：${msg}`, 'error')
      } else {
        set({ isRunning: false })
        showToast('已停止运行', 'info')
      }
    }
  },
}))
