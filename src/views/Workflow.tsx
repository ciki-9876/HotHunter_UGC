import { useCallback, useRef, useState } from 'react'
import ReactFlow, {
  Background, Controls, MiniMap,
  type Connection, type EdgeChange, type NodeChange, type Node,
  type NodeProps, Position, Handle, type EdgeProps,
  getStraightPath,
} from 'reactflow'
import 'reactflow/dist/style.css'

import { useGraphStore, useConfigStore, useExecutionStore, usePersistenceStore } from '../store'
import { getNodeDef, getNodeDefsByCategory } from '../nodes/registry'
import type { NodeDefinition } from '../types'
import { autoLayout } from '../agent/layout'
import { DEFAULT_CRITIC_DATA, type CriticNodeData } from '../agent/critic'
import type { DispatchNodeData } from '../store/executionStore'
import type { NodeConfig } from '../types'
import { Markdown } from '../components/Markdown'

/* ── helpers ──────────────────────────────────────────────────────────────── */
function statusClass(s?: string) {
  if (s === 'running') return 'is-running'
  if (s === 'done')    return 'is-done'
  if (s === 'error')   return 'is-error'
  return ''
}

function StatusPill({ status }: { status?: string }) {
  if (status === 'running') return (
    <span className="status-pill running">
      <span className="spinner" style={{ width: 8, height: 8, marginRight: 0 }} />
      运行中
    </span>
  )
  if (status === 'done')    return <span className="status-pill done">已完成</span>
  if (status === 'error')   return <span className="status-pill error">失败</span>
  if (status === 'waiting') return <span className="status-pill" style={{ background: 'var(--status-warn-bg)', color: 'var(--status-warn-fg)' }}>⏸ 等待审批</span>
  return <span className="status-pill">待运行</span>
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  Node components — all use classes from index.css
 * ═══════════════════════════════════════════════════════════════════════════ */

function AgentNode({ id, selected }: NodeProps) {
  const status    = useExecutionStore((s) => s.nodeStatus[id])
  const result    = useExecutionStore((s) => s.nodeResult[id])
  const summary   = useExecutionStore((s) => s.nodeSummary[id])
  const isRunning = useExecutionStore((s) => s.isRunning)
  const collapsed = useExecutionStore((s) => s.collapsedNodes[id] ?? false)
  const toggleCollapsed = useExecutionStore((s) => s.toggleNodeCollapsed)
  const cfg = useConfigStore((s) => s.getNodeConfig(id))
  const updateNodeConfig = useConfigStore((s) => s.updateNodeConfig)
  const setPanelTab = usePersistenceStore((s) => s.setPanelTab)
  const selectNode = useGraphStore((s) => s.selectNode)
  const nodeType = useGraphStore((s) => s.nodes.find((n) => n.id === id)?.type ?? 'genericAgent')
  const nodeDef = getNodeDef(nodeType)
  const accent = nodeDef?.accentColor ?? '#4B8EF1'

  return (
    <div className={`node-card node-agent ${statusClass(status)} ${selected ? 'is-selected' : ''}`}>
      <div className="node-header">
        <div className="node-icon" style={{ background: `${accent}22`, color: accent }}>
          {nodeDef?.icon ?? '⚡'}
        </div>
        <div className="node-name-block">
          <div className="node-title">{cfg.label || nodeDef?.title}</div>
          <div className="node-subtitle">{nodeDef?.description?.slice(0, 28) ?? 'Agent'}</div>
        </div>
        <div className="node-status-dot" />
      </div>
      <textarea
        className="extra-prompt-input nodrag"
        placeholder="补充指令（选填）…"
        rows={2}
        value={cfg.extraPrompt ?? ''}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => updateNodeConfig(id, { extraPrompt: e.target.value })}
        disabled={isRunning}
      />
      {!collapsed && (
        <div className="node-output">
          <div className="node-output-body">
            {result ? <Markdown source={result} /> : <span style={{ color: 'var(--text-quaternary)' }}>{summary || '等待上游输入…'}</span>}
          </div>
        </div>
      )}
      <div className="node-footer">
        <StatusPill status={status} />
        <button className="config-link nodrag" onClick={() => { selectNode(id); setPanelTab('config') }}>
          ⚙ 配置
        </button>
        <button className="config-link nodrag" onClick={() => toggleCollapsed(id)} style={{ padding: '4px 6px' }}>
          {collapsed ? '▼' : '▲'}
        </button>
      </div>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

function TopicInputNode({ id, selected }: NodeProps) {
  const topic     = useExecutionStore((s) => s.topic)
  const setTopic  = useExecutionStore((s) => s.setTopic)
  const status    = useExecutionStore((s) => s.nodeStatus[id])
  const isRunning = useExecutionStore((s) => s.isRunning)
  const stopRun   = useExecutionStore((s) => s.stopRun)
  const startRun  = useExecutionStore((s) => s.startRun)
  const nodes     = useGraphStore((s) => s.nodes)
  const edges     = useGraphStore((s) => s.edges)
  const provider  = useConfigStore((s) => s.provider)
  const nodeConfigs = useConfigStore((s) => s.nodeConfigs)
  const showToast = usePersistenceStore((s) => s.showToast)

  return (
    <div className={`node-card node-input ${statusClass(status)} ${selected ? 'is-selected' : ''}`}>
      <div className="node-header">
        <div className="node-icon" style={{ background: 'var(--accent-tint)', color: 'var(--accent-base)' }}>▶</div>
        <div className="node-name-block">
          <div className="node-title">主题输入</div>
          <div className="node-subtitle">工作流起点</div>
        </div>
        <div className="node-status-dot" />
      </div>
      <div className="nodrag" style={{ display: 'flex', gap: 6 }}>
        <input
          style={{
            flex: 1, background: 'var(--field-bg)', border: '0.5px solid var(--field-border)',
            borderRadius: 'var(--r-8)', padding: '7px 10px', fontSize: 'var(--fs-13)',
            color: 'var(--field-fg)', outline: 'none',
          }}
          placeholder="输入主题或热点关键词…"
          value={topic}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !isRunning) startRun(nodes, edges, provider, nodeConfigs, showToast) }}
          disabled={isRunning}
        />
        <button
          className={isRunning ? 'ghost-btn' : 'primary-btn'}
          onClick={() => isRunning ? stopRun() : startRun(nodes, edges, provider, nodeConfigs, showToast)}
        >
          {isRunning ? '■ 停止' : '▶ 运行'}
        </button>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

function OutputNode({ id, selected }: NodeProps) {
  const result    = useExecutionStore((s) => s.nodeResult[id])
  const status    = useExecutionStore((s) => s.nodeStatus[id])
  const showToast = usePersistenceStore((s) => s.showToast)

  return (
    <div className={`node-card ${statusClass(status)} ${selected ? 'is-selected' : ''}`}>
      <div className="node-header">
        <div className="node-icon" style={{ background: 'var(--status-done-bg)', color: 'var(--status-done-fg)' }}>📄</div>
        <div className="node-name-block">
          <div className="node-title">输出展示</div>
          <div className="node-subtitle">最终成果</div>
        </div>
        <div className="node-status-dot" />
      </div>
      <div className="node-output">
        <div className="node-output-body" style={{ maxHeight: 220, overflowY: 'auto' }}>
          {result
            ? <Markdown source={result} />
            : <span style={{ color: 'var(--text-quaternary)' }}>等待上游输入…</span>}
        </div>
      </div>
      {result && (
        <div className="node-footer">
          <button className="ghost-btn small" onClick={() => { navigator.clipboard.writeText(result); showToast('已复制', 'success') }}>
            复制全文
          </button>
        </div>
      )}
      <Handle type="target" position={Position.Left} />
    </div>
  )
}

function CriticNodeComponent({ id, selected, data }: NodeProps<CriticNodeData>) {
  const status    = useExecutionStore((s) => s.nodeStatus[id])
  const runtime   = useExecutionStore((s) => s.criticRuntime[id])
  const summary   = useExecutionStore((s) => s.nodeSummary[id])
  const isRunning = useExecutionStore((s) => s.isRunning)
  const setNodes  = useGraphStore((s) => s.setNodes)
  const nodes     = useGraphStore((s) => s.nodes)
  const updateData = (patch: Partial<CriticNodeData>) =>
    setNodes(nodes.map((n) => n.id === id ? { ...n, data: { ...n.data, ...patch } } : n))

  const threshold = data?.threshold ?? DEFAULT_CRITIC_DATA.threshold
  const maxIter   = data?.maxIterations ?? DEFAULT_CRITIC_DATA.maxIterations
  const rubric    = data?.rubric ?? DEFAULT_CRITIC_DATA.rubric

  return (
    <div className={`node-card node-critic ${statusClass(status)} ${selected ? 'is-selected' : ''}`}>
      <div className="node-header">
        <div className="node-icon" style={{ background: 'var(--status-error-bg)', color: 'var(--status-error-fg)' }}>⚖</div>
        <div className="node-name-block">
          <div className="node-title">评审 Critic</div>
          <div className="node-subtitle">阈值 ≥ {threshold} · 最多 {maxIter} 轮</div>
        </div>
        <div className="node-status-dot" />
      </div>
      <textarea className="extra-prompt-input nodrag" placeholder="评分标准 rubric…" rows={2}
        value={rubric} onClick={(e) => e.stopPropagation()}
        onChange={(e) => updateData({ rubric: e.target.value })} disabled={isRunning} />
      <div className="critic-knobs nodrag" onClick={(e) => e.stopPropagation()}
        style={{ display: 'flex', gap: 8 }}>
        <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, fontSize: 'var(--fs-11)', color: 'var(--text-secondary)' }}>
          阈值
          <input type="number" min={0} max={100} value={threshold} disabled={isRunning}
            style={{ background: 'var(--field-bg)', border: '0.5px solid var(--field-border)', borderRadius: 'var(--r-6)', padding: '4px 8px', fontSize: 'var(--fs-12)', color: 'var(--text-primary)', outline: 'none' }}
            onChange={(e) => updateData({ threshold: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} />
        </label>
        <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, fontSize: 'var(--fs-11)', color: 'var(--text-secondary)' }}>
          最大轮
          <input type="number" min={1} max={8} value={maxIter} disabled={isRunning}
            style={{ background: 'var(--field-bg)', border: '0.5px solid var(--field-border)', borderRadius: 'var(--r-6)', padding: '4px 8px', fontSize: 'var(--fs-12)', color: 'var(--text-primary)', outline: 'none' }}
            onChange={(e) => updateData({ maxIterations: Math.max(1, Math.min(8, Number(e.target.value) || 1)) })} />
        </label>
      </div>
      <div className="node-output">
        <div className="node-output-body">
          {runtime ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: runtime.passed ? 'var(--status-done-fg)' : 'var(--status-error-fg)', fontVariantNumeric: 'tabular-nums' }}>{runtime.score}</span>
                <span style={{ fontSize: 'var(--fs-11)', color: 'var(--text-secondary)' }}>
                  {runtime.passed ? '✓ 通过' : '⚠ 未达阈值'} · 第 {runtime.iteration} 轮
                </span>
              </div>
              {runtime.feedback && <div style={{ fontSize: 'var(--fs-11)', color: 'var(--text-secondary)', lineHeight: 'var(--lh-snug)' }}>{runtime.feedback}</div>}
            </div>
          ) : <span style={{ color: 'var(--text-quaternary)' }}>{summary || '等待上游内容评审…'}</span>}
        </div>
      </div>
      <div className="node-footer">
        <StatusPill status={status} />
        <span style={{ fontSize: 'var(--fs-11)', color: 'var(--text-tertiary)' }}>点击查看完整反馈</span>
      </div>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

function DispatchNodeComponent({ id, selected, data }: NodeProps<DispatchNodeData>) {
  const status    = useExecutionStore((s) => s.nodeStatus[id])
  const summary   = useExecutionStore((s) => s.nodeSummary[id])
  const isRunning = useExecutionStore((s) => s.isRunning)
  const setNodes  = useGraphStore((s) => s.setNodes)
  const nodes     = useGraphStore((s) => s.nodes)
  const target = data?.target ?? 'dashboard'

  return (
    <div className={`node-card node-dispatch ${statusClass(status)} ${selected ? 'is-selected' : ''}`}>
      <div className="node-header">
        <div className="node-icon" style={{ background: 'oklch(94% .04 250)', color: 'oklch(42% .18 250)' }}>↩</div>
        <div className="node-name-block">
          <div className="node-title">输出回传</div>
          <div className="node-subtitle">{target === 'dashboard' ? '数据看板' : '项目中心'}</div>
        </div>
        <div className="node-status-dot" />
      </div>
      <div className="nodrag" onClick={(e) => e.stopPropagation()} style={{ padding: '2px 0' }}>
        <select className="dispatch-select" value={target} disabled={isRunning}
          style={{ width: '100%', background: 'var(--field-bg)', border: '0.5px solid var(--field-border)', borderRadius: 'var(--r-6)', padding: '6px 8px', fontSize: 'var(--fs-12)', color: 'var(--text-primary)', outline: 'none' }}
          onChange={(e) => setNodes(nodes.map((n) => n.id === id ? { ...n, data: { ...n.data, target: e.target.value } } : n))}>
          <option value="dashboard">数据看板 · HotTopicCard</option>
          <option value="project">项目中心 · .gia 策划文档</option>
        </select>
      </div>
      <div className="node-footer">
        <StatusPill status={status} />
        <span style={{ fontSize: 'var(--fs-11)', color: 'var(--text-tertiary)' }}>{summary || '待运行'}</span>
      </div>
      <Handle type="target" position={Position.Left} />
    </div>
  )
}

function MiliastraNode({ id, selected }: NodeProps) {
  const status    = useExecutionStore((s) => s.nodeStatus[id])
  const result    = useExecutionStore((s) => s.nodeResult[id])
  const summary   = useExecutionStore((s) => s.nodeSummary[id])
  const isRunning = useExecutionStore((s) => s.isRunning)
  const cfg = useConfigStore((s) => s.getNodeConfig(id))
  const updateNodeConfig = useConfigStore((s) => s.updateNodeConfig)
  const selectNode = useGraphStore((s) => s.selectNode)
  const setPanelTab = usePersistenceStore((s) => s.setPanelTab)
  const nodeType = useGraphStore((s) => s.nodes.find((n) => n.id === id)?.type ?? 'hotspot_fetch')
  const nodeDef = getNodeDef(nodeType)
  const accent = nodeDef?.accentColor ?? '#FF375F'

  return (
    <div className={`node-card ${statusClass(status)} ${selected ? 'is-selected' : ''}`}
         style={{ borderTop: `2px solid ${accent}` }}>
      <div className="node-header">
        <div className="node-icon" style={{ background: `${accent}22`, color: accent, fontSize: 15 }}>
          {nodeDef?.icon ?? '🔥'}
        </div>
        <div className="node-name-block">
          <div className="node-title">{cfg.label || nodeDef?.title}</div>
          <div className="node-subtitle" style={{ color: accent, opacity: 0.85 }}>千星专属节点</div>
        </div>
        <div className="node-status-dot" />
      </div>
      <textarea
        className="extra-prompt-input nodrag"
        placeholder="覆盖 System Prompt（选填）…"
        rows={2}
        value={cfg.extraPrompt ?? ''}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => updateNodeConfig(id, { extraPrompt: e.target.value })}
        disabled={isRunning}
      />
      <div className="node-output">
        <div className="node-output-body" style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-11)' }}>
          {result
            ? <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{result.slice(0, 300)}{result.length > 300 ? '\n…' : ''}</pre>
            : <span style={{ color: 'var(--text-quaternary)' }}>{summary || '等待上游输入…'}</span>}
        </div>
      </div>
      <div className="node-footer">
        <StatusPill status={status} />
        <button className="config-link nodrag" onClick={() => { selectNode(id); setPanelTab('config') }}>
          ⚙ 配置 API
        </button>
      </div>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

/* ── Code Tool Node ─────────────────────────────────────────────────────── */
function CodeToolNode({ id, selected }: NodeProps) {
  const status  = useExecutionStore((s) => s.nodeStatus[id])
  const cfg     = useConfigStore((s) => s.getNodeConfig(id))
  const selectNode = useGraphStore((s) => s.selectNode)
  const setPanelTab = usePersistenceStore((s) => s.setPanelTab)
  const lang    = cfg.codeLanguage ?? 'python'
  const accent  = 'oklch(62% 0.18 150)'   // green-500

  return (
    <div className={`node-card node-agent ${statusClass(status)} ${selected ? 'is-selected' : ''}`}
         style={{ borderTop: `2px solid ${accent}` }}>
      <div className="node-header">
        <div className="node-icon" style={{ background: `oklch(62% 0.18 150 / 0.12)`, color: accent, fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{'{ }'}</div>
        <div className="node-name-block">
          <div className="node-title">{cfg.label || '代码工具'}</div>
          <div className="node-subtitle">{lang === 'python' ? 'Python' : 'JavaScript'} 脚本</div>
        </div>
        <div className="node-status-dot" />
      </div>
      <div className="node-footer">
        <StatusPill status={status} />
        <button className="config-link nodrag" onClick={() => { selectNode(id); setPanelTab('config') }}>⚙ 配置</button>
      </div>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

/* ── Module Output Node ─────────────────────────────────────────────────── */
function ModuleOutputNode({ id, selected }: NodeProps) {
  const status  = useExecutionStore((s) => s.nodeStatus[id])
  const cfg     = useConfigStore((s) => s.getNodeConfig(id))
  const accent  = 'oklch(72% 0.18 60)'   // orange-500
  const MODULE_LABELS: Record<string, string> = {
    dau: '大盘数据', 'level-center': '关卡中心', creator: '创作者运营',
    knowledge: '知识库', lab: '实验室', hotspot: '热点看板',
  }
  const target = cfg.targetModule ?? 'dau'

  return (
    <div className={`node-card node-agent ${statusClass(status)} ${selected ? 'is-selected' : ''}`}
         style={{ borderTop: `2px solid ${accent}` }}>
      <div className="node-header">
        <div className="node-icon" style={{ background: `oklch(72% 0.18 60 / 0.12)`, color: accent, fontSize: 16 }}>↗</div>
        <div className="node-name-block">
          <div className="node-title">{cfg.label || '模块输出'}</div>
          <div className="node-subtitle">→ {MODULE_LABELS[target] ?? target}</div>
        </div>
        <div className="node-status-dot" />
      </div>
      <div className="node-footer"><StatusPill status={status} /></div>
      <Handle type="target" position={Position.Left} />
    </div>
  )
}

/* ── Loop Node ──────────────────────────────────────────────────────────── */
function LoopNode({ id, selected }: NodeProps) {
  const status  = useExecutionStore((s) => s.nodeStatus[id])
  const accent  = 'oklch(62% 0.18 290)'
  return (
    <div className={`node-card ${statusClass(status)} ${selected ? 'is-selected' : ''}`}
         style={{ borderTop: `2px solid ${accent}` }}>
      <div className="node-header">
        <div className="node-icon" style={{ background: `oklch(62% 0.18 290 / 0.12)`, color: accent, fontSize: 18 }}>↻</div>
        <div className="node-name-block">
          <div className="node-title">循环</div>
          <div className="node-subtitle">逐项处理数组</div>
        </div>
        <div className="node-status-dot" />
      </div>
      <div className="node-footer"><StatusPill status={status} /></div>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

/* ── Notify Node ────────────────────────────────────────────────────────── */
function NotifyNode({ id, selected }: NodeProps) {
  const status  = useExecutionStore((s) => s.nodeStatus[id])
  const cfg     = useConfigStore((s) => s.getNodeConfig(id))
  const accent  = 'oklch(62% 0.18 250)'
  return (
    <div className={`node-card ${statusClass(status)} ${selected ? 'is-selected' : ''}`}
         style={{ borderTop: `2px solid ${accent}` }}>
      <div className="node-header">
        <div className="node-icon" style={{ background: `oklch(62% 0.18 250 / 0.12)`, color: accent, fontSize: 16 }}>📨</div>
        <div className="node-name-block">
          <div className="node-title">{cfg.label || '发送通知'}</div>
          <div className="node-subtitle">Wave / Email</div>
        </div>
        <div className="node-status-dot" />
      </div>
      <div className="node-footer"><StatusPill status={status} /></div>
      <Handle type="target" position={Position.Left} />
    </div>
  )
}

function HumanApprovalNode({ id, selected }: NodeProps) {
  const status  = useExecutionStore((s) => s.nodeStatus[id])
  const summary = useExecutionStore((s) => s.nodeSummary[id])

  return (
    <div className={`node-card ${statusClass(status)} ${selected ? 'is-selected' : ''}`}
         style={{ borderTop: '2px solid var(--status-error-fg)' }}>
      <div className="node-header">
        <div className="node-icon" style={{ background: 'var(--status-error-bg)', color: 'var(--status-error-fg)' }}>⏸</div>
        <div className="node-name-block">
          <div className="node-title">人工审批</div>
          <div className="node-subtitle">等待确认后继续</div>
        </div>
        <div className="node-status-dot" />
      </div>
      <div className="node-footer">
        <StatusPill status={status} />
        <span style={{ fontSize: 'var(--fs-11)', color: 'var(--text-tertiary)' }}>{summary || '待运行'}</span>
      </div>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

function ConditionNode({ id, selected }: NodeProps) {
  const status  = useExecutionStore((s) => s.nodeStatus[id])

  return (
    <div className={`node-card ${statusClass(status)} ${selected ? 'is-selected' : ''}`}
         style={{ borderTop: '2px solid var(--status-warn-fg)' }}>
      <div className="node-header">
        <div className="node-icon" style={{ background: 'var(--status-warn-bg)', color: 'var(--status-warn-fg)', fontSize: 16 }}>⑂</div>
        <div className="node-name-block">
          <div className="node-title">条件分支</div>
          <div className="node-subtitle">按表达式分流</div>
        </div>
        <div className="node-status-dot" />
      </div>
      <div className="node-footer">
        <StatusPill status={status} />
      </div>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" id="out_0" position={Position.Right} style={{ top: '35%' }} />
      <Handle type="source" id="out_1" position={Position.Right} style={{ top: '65%' }} />
    </div>
  )
}

/* ── Node type map ──────────────────────────────────────────────────────────── */
const nodeTypes: Record<string, React.ComponentType<NodeProps<any>>> = {
  // 触发器
  topicInput:          TopicInputNode,
  // 核心三类
  agent:               AgentNode,
  code_tool:           CodeToolNode,
  module_output:       ModuleOutputNode,
  // 辅助四类
  condition:           ConditionNode,
  loop:                LoopNode,
  human_approval:      HumanApprovalNode,
  notify:              NotifyNode,
  // 兼容保留（旧快照）
  outputNode:          OutputNode,
  criticNode:          CriticNodeComponent,
  dispatchNode:        DispatchNodeComponent,
  // 兼容旧快照 (mapped to existing components)
  outlineAgent:        AgentNode,
  writerAgent:         AgentNode,
  editorAgent:         AgentNode,
  genericAgent:        AgentNode,
  llm:                 AgentNode,
  http_request:        AgentNode,
  hotspot_fetch:       MiliastraNode,
  hotspot_score:       MiliastraNode,
  hotspot_classify:    MiliastraNode,
  gameplay_match:      MiliastraNode,
  hook_extract:        MiliastraNode,
  gia_evaluate:        MiliastraNode,
  creator_match:       MiliastraNode,
  launch_timing:       MiliastraNode,
  experience_card_gen: MiliastraNode,
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  Animated edge
 * ═══════════════════════════════════════════════════════════════════════════ */
function FlowEdge({ id, sourceX, sourceY, targetX, targetY, source, selected }: EdgeProps) {
  const [edgePath] = getStraightPath({ sourceX, sourceY, targetX, targetY })
  const sourceStatus = useExecutionStore((s) => s.nodeStatus[source])
  const isActive = sourceStatus === 'running'
  const isDone   = sourceStatus === 'done'
  return (
    <g className={`flow-edge ${isActive ? 'is-active' : ''} ${isDone ? 'is-done' : ''} ${selected ? 'is-selected' : ''}`}>
      <path className="flow-edge-base" d={edgePath} fill="none" />
      <path className="flow-edge-glow" d={edgePath} fill="none" />
      {isActive && <path className="flow-edge-dash" d={edgePath} fill="none" />}
    </g>
  )
}
const edgeTypes = { flow: FlowEdge }

/* ═══════════════════════════════════════════════════════════════════════════
 *  Side Panel — uses .side-panel / .panel-header / .panel-tabs / .panel-body
 * ═══════════════════════════════════════════════════════════════════════════ */
function SidePanel() {
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId)
  const nodes     = useGraphStore((s) => s.nodes)
  const selectNode = useGraphStore((s) => s.selectNode)
  const tab       = usePersistenceStore((s) => s.panelTab)
  const setTab    = usePersistenceStore((s) => s.setPanelTab)
  const cfg       = useConfigStore((s) => selectedNodeId ? s.getNodeConfig(selectedNodeId) : null)
  const updateNodeConfig = useConfigStore((s) => s.updateNodeConfig)
  const resetNodeConfig  = useConfigStore((s) => s.resetNodeConfig)
  const result    = useExecutionStore((s) => selectedNodeId ? s.nodeResult[selectedNodeId] : '')
  const nodeError = useExecutionStore((s) => selectedNodeId ? s.nodeError[selectedNodeId] : '')

  const node    = nodes.find((n) => n.id === selectedNodeId)
  const nodeDef = node ? getNodeDef(node.type ?? '') : null
  const accent  = nodeDef?.accentColor ?? 'var(--accent-base)'
  const isOpen  = Boolean(selectedNodeId && cfg)

  return (
    <aside className={`side-panel ${isOpen ? 'open' : ''}`}>
      {isOpen && cfg && (
        <>
          <div className="panel-header">
            <div className="panel-icon" style={{ background: `${accent}22`, color: accent }}>
              {nodeDef?.icon ?? '⚡'}
            </div>
            <div className="panel-title">{cfg.label || nodeDef?.title}</div>
            <button className="close-btn" onClick={() => selectNode(null)}>✕</button>
          </div>

          <div className="panel-tabs">
            {(['result', 'config'] as const).map((t) => (
              <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                {t === 'result' ? '结果' : '配置'}
              </button>
            ))}
          </div>

          {tab === 'result' && (
            <div className="panel-body panel-body-md">
              {nodeError && <div className="panel-error" style={{ marginBottom: 12 }}>{nodeError}</div>}
              {result ? <Markdown source={result} /> : <span style={{ color: 'var(--text-quaternary)' }}>暂无输出</span>}
            </div>
          )}

          {tab === 'config' && (
            <div className="config-form">
              <div className="form-row">
                <label>节点名称</label>
                <input value={cfg.label}
                  onChange={(e) => updateNodeConfig(selectedNodeId!, { label: e.target.value })} />
              </div>

              {/* ── LLM Prompt 配置（agent / 兼容旧节点）─────────────────── */}
              {node && !['dispatchNode', 'criticNode', 'condition', 'human_approval',
                          'code_tool', 'module_output', 'loop', 'notify'].includes(node.type ?? '') && (
                <>
                  <div className="form-section">
                    <div className="form-section-title">Prompt 配置</div>
                    <div className="form-row">
                      <label>System Prompt</label>
                      <textarea rows={4} value={cfg.systemPrompt}
                        onChange={(e) => updateNodeConfig(selectedNodeId!, { systemPrompt: e.target.value })} />
                    </div>
                    <div className="form-row">
                      <label>User Prompt 模板
                        <span style={{ color: 'var(--text-tertiary)', marginLeft: 6, fontWeight: 400 }}>（支持 {'{topic}'} / {'{input}'}）</span>
                      </label>
                      <textarea rows={3} value={cfg.userPromptTemplate}
                        onChange={(e) => updateNodeConfig(selectedNodeId!, { userPromptTemplate: e.target.value })} />
                    </div>
                    <div className="form-row-split">
                      <div className="form-row">
                        <label>Temperature</label>
                        <input type="number" min={0} max={2} step={0.1} value={cfg.temperature}
                          onChange={(e) => updateNodeConfig(selectedNodeId!, { temperature: parseFloat(e.target.value) || 0.7 })} />
                      </div>
                      <div className="form-row">
                        <label>Max Tokens</label>
                        <input type="number" min={100} max={32000} step={100} value={cfg.maxTokens}
                          onChange={(e) => updateNodeConfig(selectedNodeId!, { maxTokens: parseInt(e.target.value) || 2000 })} />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* ── Echo Agent 配置（agent 节点专用）────────────────────── */}
              {node?.type === 'agent' && (
                <div className="form-section">
                  <div className="form-section-title">Echo Agent 配置</div>
                  <div className="form-row">
                    <label>EchoAgent ID</label>
                    <div className="key-row">
                      <input value={cfg.echoAgentId ?? ''} placeholder="agent_xxxxxxxx（留空则走 LLM 直连）"
                        onChange={(e) => updateNodeConfig(selectedNodeId!, { echoAgentId: e.target.value })} />
                    </div>
                    <span className="form-hint">绑定后优先走 Echo Agent，忽略下方 LLM 直连配置</span>
                  </div>
                  <div className="form-row">
                    <label>连接策略</label>
                    <select value={cfg.connectionScope ?? 'shared'}
                      onChange={(e) => updateNodeConfig(selectedNodeId!, { connectionScope: e.target.value as any })}>
                      <option value="shared">复用系统管理中的共享连接（推荐）</option>
                      <option value="custom">本节点独立 Echo API Key</option>
                    </select>
                  </div>
                  {cfg.connectionScope === 'custom' && (
                    <div className="form-row">
                      <label>Echo API Key（本节点专用）</label>
                      <input type="password" value={cfg.echoApiKey ?? ''} placeholder="留空则复用共享连接"
                        onChange={(e) => updateNodeConfig(selectedNodeId!, { echoApiKey: e.target.value })} />
                    </div>
                  )}
                </div>
              )}

              {/* ── 代码工具配置 ─────────────────────────────────────────── */}
              {node?.type === 'code_tool' && (
                <div className="form-section">
                  <div className="form-section-title">代码配置</div>
                  <div className="form-row">
                    <label>语言</label>
                    <select value={cfg.codeLanguage ?? 'python'}
                      onChange={(e) => updateNodeConfig(selectedNodeId!, { codeLanguage: e.target.value as 'python' | 'javascript' })}>
                      <option value="python">Python</option>
                      <option value="javascript">JavaScript</option>
                    </select>
                  </div>
                  <div className="form-row">
                    <label>代码</label>
                    <textarea rows={10} value={cfg.code ?? ''}
                      style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', lineHeight: 1.6 }}
                      placeholder={cfg.codeLanguage === 'javascript'
                        ? 'async function main(inputs) {\n  return { output: inputs };\n}'
                        : 'def main(inputs: dict) -> dict:\n    return {"output": inputs}'}
                      onChange={(e) => updateNodeConfig(selectedNodeId!, { code: e.target.value })} />
                    <span className="form-hint">
                      {cfg.codeLanguage === 'javascript'
                        ? '入口函数：async function main(inputs) { return { ... } }'
                        : '入口函数：def main(inputs: dict) -> dict: return { ... }'}
                    </span>
                  </div>
                  <div className="form-row">
                    <label>超时（秒）</label>
                    <input type="number" min={1} max={300} value={cfg.codeTimeout ?? 30}
                      onChange={(e) => updateNodeConfig(selectedNodeId!, { codeTimeout: parseInt(e.target.value) || 30 })} />
                  </div>
                </div>
              )}

              {/* ── 模块输出配置 ─────────────────────────────────────────── */}
              {node?.type === 'module_output' && (
                <div className="form-section">
                  <div className="form-section-title">输出目标配置</div>
                  <div className="form-row">
                    <label>目标模块</label>
                    <select value={cfg.targetModule ?? 'dau'}
                      onChange={(e) => updateNodeConfig(selectedNodeId!, { targetModule: e.target.value })}>
                      <option value="dau">大盘数据</option>
                      <option value="level-center">关卡中心</option>
                      <option value="creator">创作者运营</option>
                      <option value="knowledge">知识库</option>
                      <option value="lab">实验室</option>
                      <option value="hotspot">热点专项看板</option>
                    </select>
                    <span className="form-hint">工作流完成后，结果将推送到所选模块页面</span>
                  </div>
                </div>
              )}

              {/* ── API config（http_request / miliastra 兼容保留）────────── */}
              {(node?.type === 'http_request' || nodeDef?.category === 'miliastra') && (() => {
                const api = cfg.apiConfig
                if (!api) return null
                return (
                  <div className="form-section">
                    <div className="form-section-title">API 配置</div>
                    <div className="form-row">
                      <label>请求地址 (URL)</label>
                      <input value={api.url} placeholder="https://api.example.com/v1/run"
                        onChange={(e) => updateNodeConfig(selectedNodeId!, { apiConfig: { ...api, url: e.target.value } })} />
                    </div>
                    <div className="form-row-split">
                      <div className="form-row">
                        <label>方法</label>
                        <select value={api.method}
                          onChange={(e) => updateNodeConfig(selectedNodeId!, { apiConfig: { ...api, method: e.target.value as any } })}>
                          {['POST','GET','PUT','PATCH','DELETE'].map((m) => <option key={m}>{m}</option>)}
                        </select>
                      </div>
                      <div className="form-row">
                        <label>超时 (ms)</label>
                        <input type="number" value={api.timeoutMs}
                          onChange={(e) => updateNodeConfig(selectedNodeId!, { apiConfig: { ...api, timeoutMs: parseInt(e.target.value) || 5000 } })} />
                      </div>
                    </div>
                    <div className="form-row">
                      <label>认证方式</label>
                      <select value={api.authType}
                        onChange={(e) => updateNodeConfig(selectedNodeId!, { apiConfig: { ...api, authType: e.target.value as any } })}>
                        <option value="none">无认证</option>
                        <option value="bearer">Bearer Token</option>
                        <option value="basic">Basic Auth</option>
                        <option value="api_key">API Key Header</option>
                      </select>
                    </div>
                    {api.authType !== 'none' && (
                      <div className="form-row">
                        <label>凭证</label>
                        <input type="password" value={api.authToken}
                          onChange={(e) => updateNodeConfig(selectedNodeId!, { apiConfig: { ...api, authToken: e.target.value } })} />
                      </div>
                    )}
                    <div className="form-row">
                      <label>Headers (JSON)</label>
                      <textarea rows={2} value={api.headers}
                        onChange={(e) => updateNodeConfig(selectedNodeId!, { apiConfig: { ...api, headers: e.target.value } })} />
                    </div>
                    <div className="form-row">
                      <label>请求体模板</label>
                      <textarea rows={3} value={api.bodyTemplate}
                        onChange={(e) => updateNodeConfig(selectedNodeId!, { apiConfig: { ...api, bodyTemplate: e.target.value } })} />
                    </div>
                  </div>
                )
              })()}

              <div className="form-actions">
                <div className="spacer" />
                <button className="ghost-btn small" onClick={() => resetNodeConfig(selectedNodeId!)}>重置默认</button>
              </div>
            </div>
          )}
        </>
      )}
      {!isOpen && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8, color: 'var(--text-quaternary)' }}>
          <span style={{ fontSize: 28 }}>◫</span>
          <span style={{ fontSize: 'var(--fs-12)' }}>点击节点查看详情</span>
        </div>
      )}
    </aside>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  Palette — uses .palette / .palette-head / .palette-section / .palette-btn
 * ═══════════════════════════════════════════════════════════════════════════ */
function Palette({ canUndo, canRedo, onUndo, onRedo }: {
  canUndo: boolean; canRedo: boolean; onUndo: () => void; onRedo: () => void
}) {
  const addNodeOfType  = useGraphStore((s) => s.addNodeOfType)
  const setNodes       = useGraphStore((s) => s.setNodes)
  const nodes          = useGraphStore((s) => s.nodes)
  const edges          = useGraphStore((s) => s.edges)
  const nodeConfigs    = useConfigStore((s) => s.nodeConfigs)
  const topic          = useExecutionStore((s) => s.topic)
  const setTopic       = useExecutionStore((s) => s.setTopic)
  const showToast      = usePersistenceStore((s) => s.showToast)
  const snapshots      = usePersistenceStore((s) => s.snapshots)
  const saveSnapshot   = usePersistenceStore((s) => s.saveSnapshot)
  const loadSnapshot   = usePersistenceStore((s) => s.loadSnapshot)
  const deleteSnapshot = usePersistenceStore((s) => s.deleteSnapshot)
  const exportSnapshot = usePersistenceStore((s) => s.exportSnapshot)
  const importSnapshot = usePersistenceStore((s) => s.importSnapshot)
  const setEdges       = useGraphStore((s) => s.setEdges)
  const setBulkConfigs = useConfigStore((s) => (cfgs: Record<string, NodeConfig>) =>
    Object.entries(cfgs).forEach(([id, cfg]) => s.setNodeConfig(id, cfg)))

  const [collapsed, setCollapsed] = useState(false)
  const [openSections, setOpenSections] = useState({ add: true, canvas: false, mine: true })
  const toggleSection = (k: keyof typeof openSections) =>
    setOpenSections((s) => ({ ...s, [k]: !s[k] }))
  const [saveName, setSaveName] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // V3.1：只在 Palette 展示 3 类核心节点 + 4 类辅助节点
  const CORE_TYPES    = ['agent', 'code_tool', 'module_output']
  const ASSIST_TYPES  = ['condition', 'loop', 'human_approval', 'notify']
  const coreNodes    = CORE_TYPES.map((t) => getNodeDef(t)).filter(Boolean) as NodeDefinition[]
  const assistNodes  = ASSIST_TYPES.map((t) => getNodeDef(t)).filter(Boolean) as NodeDefinition[]

  if (collapsed) {
    return (
      <aside className="palette is-collapsed">
        <button className="palette-expand-btn" onClick={() => setCollapsed(false)}>
          <span className="palette-expand-label">节点</span>
        </button>
      </aside>
    )
  }

  const nodeBtn = (type: string, icon: string, label: string, color?: string) => (
    <button key={type} className="palette-btn"
      onClick={() => { addNodeOfType(type); showToast(`已添加 ${label}`, 'success') }}>
      <span className="palette-icon" style={color ? { background: `${color}22`, color } : undefined}>
        {icon}
      </span>
      {label}
    </button>
  )

  return (
    <aside className="palette">
      <div className="palette-head">
        <span className="palette-head-title">节点面板</span>
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto', marginRight: 4 }}>
          <button title="撤销 (Ctrl+Z)" onClick={onUndo} disabled={!canUndo}
            style={{ background: 'none', border: 'none', cursor: canUndo ? 'pointer' : 'not-allowed', color: canUndo ? 'var(--text-secondary)' : 'var(--text-quaternary)', fontSize: 14, padding: '3px 5px', borderRadius: 4, lineHeight: 1, transition: 'color 0.15s' }}>↩</button>
          <button title="重做 (Ctrl+Y)" onClick={onRedo} disabled={!canRedo}
            style={{ background: 'none', border: 'none', cursor: canRedo ? 'pointer' : 'not-allowed', color: canRedo ? 'var(--text-secondary)' : 'var(--text-quaternary)', fontSize: 14, padding: '3px 5px', borderRadius: 4, lineHeight: 1, transition: 'color 0.15s' }}>↪</button>
        </div>
        <button className="palette-fold-btn" onClick={() => setCollapsed(true)}>◀</button>
      </div>

      <div className="palette-body">
        {/* 添加节点 */}
        <div className="palette-section">
          <button className="palette-section-head" onClick={() => toggleSection('add')}>
            <span className="palette-section-title">添加节点</span>
            <span className="caret" style={openSections.add ? {} : { transform: 'rotate(-90deg)' }}>▾</span>
          </button>
          {openSections.add && (
            <div className="palette-section-body">
              <div style={{ padding: '2px 8px 3px', fontSize: 'var(--fs-11)', fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                核心节点
              </div>
              {coreNodes.map((d) => nodeBtn(d.type, d.icon, d.title, d.accentColor))}

              <div style={{ padding: '6px 8px 3px', fontSize: 'var(--fs-11)', fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', borderTop: '0.5px solid var(--border-subtle)', marginTop: 4 }}>
                辅助节点
              </div>
              {assistNodes.map((d) => nodeBtn(d.type, d.icon, d.title, d.accentColor))}
            </div>
          )}
        </div>

        {/* 画布 */}
        <div className="palette-section">
          <button className="palette-section-head" onClick={() => toggleSection('canvas')}>
            <span className="palette-section-title">画布操作</span>
            <span className="caret" style={openSections.canvas ? {} : { transform: 'rotate(-90deg)' }}>▾</span>
          </button>
          {openSections.canvas && (
            <div className="palette-section-body">
              <button className="palette-btn"
                onClick={() => { setNodes(autoLayout(nodes, edges)); showToast('已整理布局') }}>
                <span className="palette-icon">⊞</span>自动整理布局
              </button>
            </div>
          )}
        </div>

        {/* 我的工作流 */}
        <div className="palette-section">
          <button className="palette-section-head" onClick={() => toggleSection('mine')}>
            <span className="palette-section-title">我的工作流</span>
            <span className="palette-section-badge">{snapshots.length}</span>
            <span className="caret" style={openSections.mine ? {} : { transform: 'rotate(-90deg)' }}>▾</span>
          </button>
          {openSections.mine && (
            <div className="palette-section-body">
              <div className="snapshot-save-row">
                <input placeholder="工作流名称…" value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && saveName.trim()) {
                      saveSnapshot(saveName.trim(), nodes, edges, nodeConfigs, topic)
                      setSaveName('')
                    }
                  }} />
                <button className="primary-btn small"
                  onClick={() => { if (saveName.trim()) { saveSnapshot(saveName.trim(), nodes, edges, nodeConfigs, topic); setSaveName('') } }}>
                  保存
                </button>
              </div>

              <div className="snapshot-list">
                {snapshots.length === 0 && (
                  <p className="palette-hint">暂无保存的工作流</p>
                )}
                {snapshots.map((s) => (
                  <div key={s.id} className="snapshot-row">
                    <button className="snapshot-load"
                      onClick={() => loadSnapshot(s, setNodes, setEdges, setBulkConfigs, setTopic)}>
                      <span className="snapshot-name">{s.name}</span>
                      <span className="snapshot-meta">{s.nodes.length} 节点</span>
                    </button>
                    <button className="snapshot-icon-btn" onClick={() => exportSnapshot(s.id)} title="导出">↗</button>
                    <button className="snapshot-icon-btn" onClick={() => deleteSnapshot(s.id)}
                      title="删除" style={{ color: 'var(--status-error-fg)' }}>✕</button>
                  </div>
                ))}
              </div>

              <button className="palette-btn" onClick={() => fileRef.current?.click()}>
                <span className="palette-icon">📥</span>导入 JSON
              </button>
              <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) importSnapshot(f, (snap) => loadSnapshot(snap, setNodes, setEdges, setBulkConfigs, setTopic))
                  e.target.value = ''
                }} />
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  Main canvas view
 * ═══════════════════════════════════════════════════════════════════════════ */
export default function WorkflowView() {
  const nodes       = useGraphStore((s) => s.nodes)
  const edges       = useGraphStore((s) => s.edges)
  const applyNC     = useGraphStore((s) => s.applyNodeChanges)
  const applyEC     = useGraphStore((s) => s.applyEdgeChanges)
  const onConnect   = useGraphStore((s) => s.onConnect)
  const addNodeOfType = useGraphStore((s) => s.addNodeOfType)
  const deleteNode  = useGraphStore((s) => s.deleteNode)
  const selectNode  = useGraphStore((s) => s.selectNode)
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId)
  const canUndo     = useGraphStore((s) => s.canUndo)
  const canRedo     = useGraphStore((s) => s.canRedo)
  const undo        = useGraphStore((s) => s.undo)
  const redo        = useGraphStore((s) => s.redo)
  const nodeStatus  = useExecutionStore((s) => s.nodeStatus)

  // ── 节点选择器弹窗状态 ─────────────────────────────────────────
  const [picker, setPicker] = useState<{
    x: number; y: number        // 画布坐标（用于创建节点）
    sx: number; sy: number      // 屏幕坐标（用于弹窗定位）
    connection?: { fromNodeId: string; handleType: 'source' | 'target' }
  } | null>(null)

  const decoratedNodes = nodes.map((n) => ({
    ...n,
    selected: n.id === selectedNodeId,
  }))

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    selectNode(node.id)
  }, [selectNode])

  const onPaneClick = useCallback(() => {
    selectNode(null)
    setPicker(null)
  }, [selectNode])

  // ── Bug 修复：用 ref 记录最近一次 onConnect 的时间戳
  //    如果 onConnectEnd 在 onConnect 后 100ms 内触发，说明是接到了合法节点，不应创建新节点
  const lastConnectAt = useRef(0)
  const onConnectWrapped = useCallback((conn: Parameters<typeof onConnect>[0]) => {
    lastConnectAt.current = Date.now()
    onConnect(conn)
  }, [onConnect])

  // ── 空白处释放：弹出节点类型选择器 ───────────────────────────────
  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, connectionState: any) => {
      // 如果 100ms 内刚刚触发了 onConnect（合法连接），直接跳过
      if (Date.now() - lastConnectAt.current < 100) return
      // connectionState.isValid 在某些 ReactFlow 版本里连到合法节点时仍为 false/null
      // 改为：只有 fromNode 存在（= 用户是从某个节点拖出来的）才弹选择器
      if (!connectionState?.fromNode) return

      const { clientX, clientY } = 'changedTouches' in event ? event.changedTouches[0] : event
      const domNode = document.querySelector('.react-flow__renderer')
      if (!domNode) return
      const rect = domNode.getBoundingClientRect()

      setPicker({
        x: clientX - rect.left,
        y: clientY - rect.top,
        sx: clientX,
        sy: clientY,
        connection: {
          fromNodeId: connectionState.fromNode.id,
          handleType: connectionState.fromHandle?.type ?? 'source',
        },
      })
    },
    [],
  )

  // ── 从选择器创建节点 ──────────────────────────────────────────
  const onPickerSelect = useCallback((type: string) => {
    if (!picker) return
    addNodeOfType(type, { x: picker.x, y: picker.y }, picker.connection)
    setPicker(null)
  }, [picker, addNodeOfType])

  // ── 键盘：Delete 删除 / Ctrl+Z 撤销 / Ctrl+Y 重做 ────────────
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    const ctrl = e.ctrlKey || e.metaKey
    if (ctrl && e.key === 'z') { e.preventDefault(); undo(); return }
    if (ctrl && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) { e.preventDefault(); redo(); return }
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeId &&
        !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
      deleteNode(selectedNodeId)
    }
  }, [selectedNodeId, deleteNode, undo, redo])

  const CORE_TYPES   = ['agent', 'code_tool', 'module_output']
  const ASSIST_TYPES = ['condition', 'loop', 'human_approval', 'notify']
  const PICKER_NODES = [...CORE_TYPES, ...ASSIST_TYPES].map((t) => getNodeDef(t)).filter(Boolean) as NonNullable<ReturnType<typeof getNodeDef>>[]

  return (
    <div className="workflow-view" onKeyDown={onKeyDown} tabIndex={0}
         style={{ display: 'flex', position: 'absolute', inset: 0 }}>
      <Palette canUndo={canUndo} canRedo={canRedo} onUndo={undo} onRedo={redo} />
      <ReactFlow
        style={{ flex: 1 }}
        nodes={decoratedNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={(changes: NodeChange[]) => applyNC(changes)}
        onEdgesChange={(changes: EdgeChange[]) => applyEC(changes)}
        onConnect={onConnectWrapped}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onConnectEnd={onConnectEnd as any}
        deleteKeyCode={null}
        fitView
        minZoom={0.1}
        maxZoom={2}
      >
        <Background gap={24} size={1} color="rgba(0,0,0,0.04)" />
        <Controls />
        <MiniMap
          nodeColor={(n) => getNodeDef(n.type ?? '')?.accentColor ?? '#636366'}
          style={{ background: 'var(--surface-glass-strong)', border: '0.5px solid var(--border-subtle)', borderRadius: 10 }}
        />
      </ReactFlow>

      {/* 节点类型选择器弹窗 */}
      {picker && (
        <>
          {/* 遮罩 */}
          <div style={{ position: 'fixed', inset: 0, zIndex: 200 }} onClick={() => setPicker(null)} />
          <div style={{
            position: 'fixed',
            left: Math.min(picker.sx, window.innerWidth - 240),
            top: Math.min(picker.sy, window.innerHeight - 320),
            zIndex: 201,
            background: 'var(--surface-elevated)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-12)',
            boxShadow: 'var(--shadow-4)',
            padding: 'var(--s-3)',
            width: 220,
            animation: 'modal-in 0.12s var(--ease-spring)',
          }}>
            <p style={{ margin: '0 0 var(--s-3)', padding: '0 var(--s-2)', fontSize: 'var(--fs-11)', fontWeight: 'var(--fw-semi)', color: 'var(--text-tertiary)', letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase' }}>
              添加节点
            </p>
            {/* 分组：核心 */}
            <p style={{ margin: '0 0 var(--s-1)', padding: '0 var(--s-2)', fontSize: 10, color: 'var(--text-quaternary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>核心</p>
            {PICKER_NODES.filter((d) => CORE_TYPES.includes(d.type)).map((d) => (
              <button key={d.type} onClick={() => onPickerSelect(d.type)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 'var(--s-3)', padding: 'var(--s-2) var(--s-3)', borderRadius: 'var(--r-6)', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 0.12s' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--c-neutral-100)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
              >
                <span style={{ width: 24, height: 24, borderRadius: 'var(--r-6)', background: `color-mix(in srgb, ${d.accentColor ?? '#888'} 14%, transparent)`, color: d.accentColor ?? '#888', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>{d.icon}</span>
                <div>
                  <p style={{ margin: 0, fontSize: 'var(--fs-12)', fontWeight: 'var(--fw-medium)', color: 'var(--text-primary)' }}>{d.title}</p>
                  <p style={{ margin: 0, fontSize: 10, color: 'var(--text-quaternary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>{d.description?.slice(0, 30)}</p>
                </div>
              </button>
            ))}
            {/* 分组：辅助 */}
            <div style={{ height: '0.5px', background: 'var(--border-subtle)', margin: 'var(--s-2) var(--s-2)' }} />
            <p style={{ margin: '0 0 var(--s-1)', padding: '0 var(--s-2)', fontSize: 10, color: 'var(--text-quaternary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>辅助</p>
            {PICKER_NODES.filter((d) => ASSIST_TYPES.includes(d.type)).map((d) => (
              <button key={d.type} onClick={() => onPickerSelect(d.type)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 'var(--s-3)', padding: 'var(--s-2) var(--s-3)', borderRadius: 'var(--r-6)', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 0.12s' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--c-neutral-100)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
              >
                <span style={{ width: 24, height: 24, borderRadius: 'var(--r-6)', background: `color-mix(in srgb, ${d.accentColor ?? '#888'} 14%, transparent)`, color: d.accentColor ?? '#888', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>{d.icon}</span>
                <div>
                  <p style={{ margin: 0, fontSize: 'var(--fs-12)', fontWeight: 'var(--fw-medium)', color: 'var(--text-primary)' }}>{d.title}</p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      <SidePanel />
    </div>
  )
}
