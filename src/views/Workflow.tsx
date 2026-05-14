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
  topicInput:          TopicInputNode,
  outputNode:          OutputNode,
  criticNode:          CriticNodeComponent,
  dispatchNode:        DispatchNodeComponent,
  human_approval:      HumanApprovalNode,
  condition:           ConditionNode,
  outlineAgent:        AgentNode,
  writerAgent:         AgentNode,
  editorAgent:         AgentNode,
  genericAgent:        AgentNode,
  llm:                 AgentNode,
  http_request:        AgentNode,
  notify:              AgentNode,
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

              {node && !['dispatchNode', 'criticNode', 'condition', 'human_approval'].includes(node.type ?? '') && (
                <>
                  <div className="form-row">
                    <label>System Prompt</label>
                    <textarea rows={4} value={cfg.systemPrompt}
                      onChange={(e) => updateNodeConfig(selectedNodeId!, { systemPrompt: e.target.value })} />
                  </div>
                  <div className="form-row">
                    <label>User Prompt 模板
                      <span style={{ color: 'var(--text-tertiary)', marginLeft: 6 }}>( {'{topic}'} / {'{input}'} )</span>
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
                      <input type="number" min={100} max={8000} step={100} value={cfg.maxTokens}
                        onChange={(e) => updateNodeConfig(selectedNodeId!, { maxTokens: parseInt(e.target.value) || 2000 })} />
                    </div>
                  </div>
                </>
              )}

              {/* API config */}
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
function Palette() {
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
  const nodeStatus  = useExecutionStore((s) => s.nodeStatus)

  const decoratedNodes = nodes.map((n) => ({
    ...n,
    selected: n.id === selectedNodeId,
  }))

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    selectNode(node.id)
  }, [selectNode])

  const onPaneClick = useCallback(() => selectNode(null), [selectNode])

  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, connectionState: any) => {
      if (!connectionState?.isValid) {
        const { clientX, clientY } = 'changedTouches' in event ? event.changedTouches[0] : event
        const domNode = document.querySelector('.react-flow__renderer')
        if (!domNode) return
        const rect = domNode.getBoundingClientRect()
        addNodeOfType(
          'genericAgent',
          { x: clientX - rect.left, y: clientY - rect.top },
          connectionState?.fromNode
            ? { fromNodeId: connectionState.fromNode.id, handleType: connectionState.fromHandle?.type ?? 'source' }
            : undefined,
        )
      }
    },
    [addNodeOfType],
  )

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeId) {
      deleteNode(selectedNodeId)
    }
  }, [selectedNodeId, deleteNode])

  return (
    <div className="workflow-view" onKeyDown={onKeyDown} tabIndex={0}
         style={{ display: 'flex', position: 'absolute', inset: 0 }}>
      <Palette />
      <ReactFlow
        style={{ flex: 1 }}
        nodes={decoratedNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={(changes: NodeChange[]) => applyNC(changes)}
        onEdgesChange={(changes: EdgeChange[]) => applyEC(changes)}
        onConnect={onConnect}
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
      <SidePanel />
    </div>
  )
}
