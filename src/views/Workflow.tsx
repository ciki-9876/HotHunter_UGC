import { useCallback, useRef, useState } from 'react'
import ReactFlow, {
  Background, Controls, MiniMap, Panel,
  type Connection, type EdgeChange, type NodeChange, type Node,
  type NodeProps, Position, Handle,
  getStraightPath, EdgeLabelRenderer,
  type EdgeProps,
} from 'reactflow'
import 'reactflow/dist/style.css'

import { useGraphStore, useConfigStore, useExecutionStore, usePersistenceStore, NODE_IDS } from '../store'
import { getNodeDef, getNodeDefsByCategory } from '../nodes/registry'
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
  if (s === 'waiting') return 'is-waiting'
  return ''
}

function NodeStatusLabel({ status }: { status?: string }) {
  if (status === 'running') return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span className="spinner" /> 运行中</span>
  if (status === 'done')    return <span style={{ color: 'var(--status-done-fg)' }}>已完成</span>
  if (status === 'error')   return <span style={{ color: 'var(--status-error-fg)' }}>失败</span>
  if (status === 'waiting') return <span style={{ color: 'var(--status-warn-fg, #ff9f0a)' }}>⏸ 等待审批</span>
  return <span>待运行</span>
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  Node components
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Generic agent-like node (llm / outlineAgent / writerAgent / editorAgent / genericAgent) */
function AgentNode({ id, selected }: NodeProps) {
  const status   = useExecutionStore((s) => s.nodeStatus[id])
  const result   = useExecutionStore((s) => s.nodeResult[id])
  const summary  = useExecutionStore((s) => s.nodeSummary[id])
  const isRunning = useExecutionStore((s) => s.isRunning)
  const collapsed = useExecutionStore((s) => s.collapsedNodes[id] ?? false)
  const toggleCollapsed = useExecutionStore((s) => s.toggleNodeCollapsed)
  const cfg = useConfigStore((s) => s.getNodeConfig(id))
  const updateNodeConfig = useConfigStore((s) => s.updateNodeConfig)
  const setPanel = usePersistenceStore((s) => s.setPanelTab)
  const selectNode = useGraphStore((s) => s.selectNode)
  const def = getNodeDef(id.split('-')[0]) // fallback

  const nodeType = useGraphStore((s) => s.nodes.find((n) => n.id === id)?.type ?? 'genericAgent')
  const nodeDef = getNodeDef(nodeType)
  const accentColor = nodeDef?.accentColor ?? '#4B8EF1'

  return (
    <div className={`node-card node-agent ${statusClass(status)} ${selected ? 'is-selected' : ''}`}
         style={{ '--node-accent': accentColor } as React.CSSProperties}>
      <div className="node-header">
        <span className="node-icon">{nodeDef?.icon ?? '⚡'}</span>
        <div className="node-name-block">
          <div className="node-title">{cfg.label || nodeDef?.title}</div>
          <div className="node-model-line">{nodeDef?.description?.slice(0, 32) ?? 'Agent'}</div>
        </div>
        <span className="node-status-dot" />
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
            {result ? <Markdown source={result} /> : (summary || '等待上游输入…')}
          </div>
        </div>
      )}
      <div className="node-footer">
        <NodeStatusLabel status={status} />
        <span className="hint-text" onClick={() => { selectNode(id); setPanel('config') }}
          style={{ cursor: 'pointer' }}>⚙ 配置</span>
        <button className="collapse-btn nodrag" onClick={() => toggleCollapsed(id)}>
          {collapsed ? '▼' : '▲'}
        </button>
      </div>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

function TopicInputNode({ id, selected }: NodeProps) {
  const topic = useExecutionStore((s) => s.topic)
  const setTopic = useExecutionStore((s) => s.setTopic)
  const status = useExecutionStore((s) => s.nodeStatus[id])
  const isRunning = useExecutionStore((s) => s.isRunning)
  const stopRun = useExecutionStore((s) => s.stopRun)
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const provider = useConfigStore((s) => s.provider)
  const nodeConfigs = useConfigStore((s) => s.nodeConfigs)
  const showToast = usePersistenceStore((s) => s.showToast)
  const startRun = useExecutionStore((s) => s.startRun)

  return (
    <div className={`node-card node-input ${statusClass(status)} ${selected ? 'is-selected' : ''}`}>
      <div className="node-header">
        <span className="node-icon">▶</span>
        <div className="node-name-block">
          <div className="node-title">主题输入</div>
          <div className="node-model-line">工作流起点</div>
        </div>
        <span className="node-status-dot" />
      </div>
      <div className="topic-input-area nodrag">
        <input
          className="topic-input"
          placeholder="输入主题或热点关键词…"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !isRunning) startRun(nodes, edges, provider, nodeConfigs, showToast) }}
          disabled={isRunning}
        />
        <button
          className={isRunning ? 'stop-btn' : 'run-btn'}
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
  const result = useExecutionStore((s) => s.nodeResult[id])
  const status = useExecutionStore((s) => s.nodeStatus[id])
  const showToast = usePersistenceStore((s) => s.showToast)

  return (
    <div className={`node-card node-output-card ${statusClass(status)} ${selected ? 'is-selected' : ''}`}>
      <div className="node-header">
        <span className="node-icon">📄</span>
        <div className="node-name-block">
          <div className="node-title">输出展示</div>
          <div className="node-model-line">最终成果</div>
        </div>
        <span className="node-status-dot" />
      </div>
      <div className="node-output">
        <div className="node-output-body" style={{ maxHeight: 260, overflowY: 'auto' }}>
          {result ? <Markdown source={result} /> : <span className="muted">等待上游输入…</span>}
        </div>
      </div>
      {result && (
        <div className="node-footer">
          <button className="copy-btn" onClick={() => { navigator.clipboard.writeText(result); showToast('已复制', 'success') }}>
            复制全文
          </button>
        </div>
      )}
      <Handle type="target" position={Position.Left} />
    </div>
  )
}

function CriticNodeComponent({ id, selected, data }: NodeProps<CriticNodeData>) {
  const status  = useExecutionStore((s) => s.nodeStatus[id])
  const runtime = useExecutionStore((s) => s.criticRuntime[id])
  const summary = useExecutionStore((s) => s.nodeSummary[id])
  const isRunning = useExecutionStore((s) => s.isRunning)
  const updateCriticData = useGraphStore((s) => (patch: Partial<CriticNodeData>) => {
    s.setNodes(s.nodes.map((n) => n.id === id ? { ...n, data: { ...n.data, ...patch } } : n))
  })
  const threshold = data?.threshold ?? DEFAULT_CRITIC_DATA.threshold
  const maxIter = data?.maxIterations ?? DEFAULT_CRITIC_DATA.maxIterations
  const rubric = data?.rubric ?? DEFAULT_CRITIC_DATA.rubric

  return (
    <div className={`node-card node-critic ${statusClass(status)} ${selected ? 'is-selected' : ''}`}>
      <div className="node-header">
        <span className="node-icon critic-icon">⚖</span>
        <div className="node-name-block">
          <div className="node-title">评审 Critic</div>
          <div className="node-model-line">阈值 ≥ {threshold} · 最多 {maxIter} 轮</div>
        </div>
        <span className="node-status-dot" />
      </div>
      <textarea className="extra-prompt-input nodrag" placeholder="评分标准 rubric…" rows={2}
        value={rubric} onClick={(e) => e.stopPropagation()}
        onChange={(e) => updateCriticData({ rubric: e.target.value })} disabled={isRunning} />
      <div className="critic-knobs nodrag" onClick={(e) => e.stopPropagation()}>
        <label className="critic-knob">阈值
          <input type="number" min={0} max={100} value={threshold} disabled={isRunning}
            onChange={(e) => updateCriticData({ threshold: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} />
        </label>
        <label className="critic-knob">最大轮
          <input type="number" min={1} max={8} value={maxIter} disabled={isRunning}
            onChange={(e) => updateCriticData({ maxIterations: Math.max(1, Math.min(8, Number(e.target.value) || 1)) })} />
        </label>
      </div>
      <div className="node-output">
        <div className="node-output-body">
          {runtime ? (
            <>
              <div className={`critic-score ${runtime.passed ? 'pass' : 'fail'}`}>
                <span className="critic-score-num">{runtime.score}</span>
                <span className="critic-score-label">{runtime.passed ? '通过' : '未达阈值'} · 第 {runtime.iteration} 轮</span>
              </div>
              {runtime.feedback && <div className="critic-feedback">{runtime.feedback}</div>}
            </>
          ) : summary || '等待上游内容评审…'}
        </div>
      </div>
      <div className="node-footer"><NodeStatusLabel status={status} /><span className="hint-text">点击查看完整反馈</span></div>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

function DispatchNodeComponent({ id, selected, data }: NodeProps<DispatchNodeData>) {
  const status = useExecutionStore((s) => s.nodeStatus[id])
  const summary = useExecutionStore((s) => s.nodeSummary[id])
  const isRunning = useExecutionStore((s) => s.isRunning)
  const setNodes = useGraphStore((s) => s.setNodes)
  const nodes = useGraphStore((s) => s.nodes)
  const target = data?.target ?? 'dashboard'

  const FORMATS = [
    { value: 'dashboard', label: '数据看板 · HotTopicCard' },
    { value: 'project',   label: '项目中心 · .gia 策划文档' },
  ]

  return (
    <div className={`node-card node-dispatch ${statusClass(status)} ${selected ? 'is-selected' : ''}`}>
      <div className="node-header">
        <span className="node-icon">↩</span>
        <div className="node-name-block">
          <div className="node-title">输出回传</div>
          <div className="node-model-line">{FORMATS.find(f => f.value === target)?.label}</div>
        </div>
        <span className="node-status-dot" />
      </div>
      <div className="nodrag" style={{ padding: '6px 10px' }} onClick={(e) => e.stopPropagation()}>
        <select className="dispatch-select" value={target} disabled={isRunning}
          onChange={(e) => setNodes(nodes.map((n) => n.id === id ? { ...n, data: { ...n.data, target: e.target.value } } : n))}>
          {FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>
      <div className="node-footer"><NodeStatusLabel status={status} /><span className="muted">{summary || '待运行'}</span></div>
      <Handle type="target" position={Position.Left} />
    </div>
  )
}

/** Generic miliastra node (hotspot_fetch, gia_evaluate, etc.) */
function MiliastraNode({ id, selected }: NodeProps) {
  const status  = useExecutionStore((s) => s.nodeStatus[id])
  const result  = useExecutionStore((s) => s.nodeResult[id])
  const summary = useExecutionStore((s) => s.nodeSummary[id])
  const isRunning = useExecutionStore((s) => s.isRunning)
  const cfg = useConfigStore((s) => s.getNodeConfig(id))
  const updateNodeConfig = useConfigStore((s) => s.updateNodeConfig)
  const selectNode = useGraphStore((s) => s.selectNode)
  const setPanel = usePersistenceStore((s) => s.setPanelTab)
  const nodeType = useGraphStore((s) => s.nodes.find((n) => n.id === id)?.type ?? 'genericAgent')
  const nodeDef = getNodeDef(nodeType)
  const accentColor = nodeDef?.accentColor ?? '#FF375F'

  return (
    <div className={`node-card node-miliastra ${statusClass(status)} ${selected ? 'is-selected' : ''}`}
         style={{ '--node-accent': accentColor } as React.CSSProperties}>
      <div className="node-header">
        <span className="node-icon">{nodeDef?.icon ?? '🔥'}</span>
        <div className="node-name-block">
          <div className="node-title">{cfg.label || nodeDef?.title}</div>
          <div className="node-model-line" style={{ color: accentColor, opacity: 0.8 }}>千星专属节点</div>
        </div>
        <span className="node-status-dot" />
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
        <div className="node-output-body" style={{ fontSize: 11, fontFamily: 'var(--font-mono, monospace)' }}>
          {result
            ? (result.startsWith('{') || result.startsWith('[')
                ? <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{result.slice(0, 400)}{result.length > 400 ? '\n…' : ''}</pre>
                : summary || result.slice(0, 120))
            : summary || '等待上游输入…'}
        </div>
      </div>
      <div className="node-footer">
        <NodeStatusLabel status={status} />
        <span className="hint-text" onClick={() => { selectNode(id); setPanel('config') }} style={{ cursor: 'pointer' }}>⚙ 配置 API</span>
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
    <div className={`node-card node-approval ${statusClass(status)} ${selected ? 'is-selected' : ''}`}>
      <div className="node-header">
        <span className="node-icon">⏸</span>
        <div className="node-name-block">
          <div className="node-title">人工审批</div>
          <div className="node-model-line">等待确认后继续</div>
        </div>
        <span className="node-status-dot" />
      </div>
      <div className="node-footer"><NodeStatusLabel status={status} /><span className="muted">{summary || '待运行'}</span></div>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

function ConditionNode({ id, selected }: NodeProps) {
  const status  = useExecutionStore((s) => s.nodeStatus[id])
  const summary = useExecutionStore((s) => s.nodeSummary[id])

  return (
    <div className={`node-card node-condition ${statusClass(status)} ${selected ? 'is-selected' : ''}`}>
      <div className="node-header">
        <span className="node-icon">⑂</span>
        <div className="node-name-block">
          <div className="node-title">条件分支</div>
          <div className="node-model-line">按条件分流</div>
        </div>
        <span className="node-status-dot" />
      </div>
      <div className="node-footer"><NodeStatusLabel status={status} /><span className="muted">{summary || '待运行'}</span></div>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" id="out_0" position={Position.Right} style={{ top: '35%' }} />
      <Handle type="source" id="out_1" position={Position.Right} style={{ top: '65%' }} />
    </div>
  )
}

/* ── Node type map ──────────────────────────────────────────────────────────── */
const nodeTypes: Record<string, React.ComponentType<NodeProps<any>>> = {
  topicInput:    TopicInputNode,
  outputNode:    OutputNode,
  criticNode:    CriticNodeComponent,
  dispatchNode:  DispatchNodeComponent,
  human_approval: HumanApprovalNode,
  condition:     ConditionNode,
  // miliastra nodes
  hotspot_fetch:    MiliastraNode,
  hotspot_score:    MiliastraNode,
  hotspot_classify: MiliastraNode,
  gameplay_match:   MiliastraNode,
  hook_extract:     MiliastraNode,
  gia_evaluate:     MiliastraNode,
  creator_match:    MiliastraNode,
  launch_timing:    MiliastraNode,
  experience_card_gen: MiliastraNode,
  // everything else → AgentNode
  outlineAgent:  AgentNode,
  writerAgent:   AgentNode,
  editorAgent:   AgentNode,
  genericAgent:  AgentNode,
  llm:           AgentNode,
  http_request:  AgentNode,
  notify:        AgentNode,
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  Animated edge
 * ═══════════════════════════════════════════════════════════════════════════ */

function FlowEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, source, selected }: EdgeProps) {
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
 *  Side Panel
 * ═══════════════════════════════════════════════════════════════════════════ */

function SidePanel() {
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId)
  const nodes = useGraphStore((s) => s.nodes)
  const tab = usePersistenceStore((s) => s.panelTab)
  const setTab = usePersistenceStore((s) => s.setPanelTab)
  const cfg = useConfigStore((s) => selectedNodeId ? s.getNodeConfig(selectedNodeId) : null)
  const updateNodeConfig = useConfigStore((s) => s.updateNodeConfig)
  const resetNodeConfig  = useConfigStore((s) => s.resetNodeConfig)
  const result = useExecutionStore((s) => selectedNodeId ? s.nodeResult[selectedNodeId] : '')
  const nodeError = useExecutionStore((s) => selectedNodeId ? s.nodeError[selectedNodeId] : '')
  const selectNode = useGraphStore((s) => s.selectNode)

  const node = nodes.find((n) => n.id === selectedNodeId)
  const nodeDef = node ? getNodeDef(node.type ?? '') : null

  if (!selectedNodeId || !cfg) {
    return (
      <aside className="side-panel side-panel-empty">
        <p>点击画布节点查看详情</p>
      </aside>
    )
  }

  const api = cfg.apiConfig

  return (
    <aside className="side-panel">
      <div className="side-panel-header">
        <span className="side-panel-title">{cfg.label || nodeDef?.title || '节点详情'}</span>
        <button className="side-panel-close" onClick={() => selectNode(null)}>×</button>
      </div>

      <div className="side-tabs">
        {(['result', 'config'] as const).map((t) => (
          <button key={t} className={`side-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'result' ? '结果' : '配置'}
          </button>
        ))}
      </div>

      {tab === 'result' && (
        <div className="side-content">
          {nodeError && <div className="node-error-box">{nodeError}</div>}
          {result ? <Markdown source={result} /> : <span className="muted">暂无输出</span>}
        </div>
      )}

      {tab === 'config' && (
        <div className="side-content">
          <div className="config-row">
            <label>节点名称</label>
            <input value={cfg.label} onChange={(e) => updateNodeConfig(selectedNodeId, { label: e.target.value })} />
          </div>
          {/* Show prompt config only for agent-like nodes */}
          {node && !['dispatchNode', 'criticNode', 'condition', 'human_approval'].includes(node.type ?? '') && (
            <>
              <div className="config-row">
                <label>System Prompt</label>
                <textarea rows={4} value={cfg.systemPrompt}
                  onChange={(e) => updateNodeConfig(selectedNodeId, { systemPrompt: e.target.value })} />
              </div>
              <div className="config-row">
                <label>User Prompt 模板 <span className="muted">({'{topic}'} {'{input}'})</span></label>
                <textarea rows={3} value={cfg.userPromptTemplate}
                  onChange={(e) => updateNodeConfig(selectedNodeId, { userPromptTemplate: e.target.value })} />
              </div>
              <div className="config-row config-row-2col">
                <div>
                  <label>Temperature</label>
                  <input type="number" min={0} max={2} step={0.1} value={cfg.temperature}
                    onChange={(e) => updateNodeConfig(selectedNodeId, { temperature: parseFloat(e.target.value) || 0.7 })} />
                </div>
                <div>
                  <label>Max Tokens</label>
                  <input type="number" min={100} max={8000} step={100} value={cfg.maxTokens}
                    onChange={(e) => updateNodeConfig(selectedNodeId, { maxTokens: parseInt(e.target.value) || 2000 })} />
                </div>
              </div>
            </>
          )}
          {/* API config panel */}
          {(node?.type === 'http_request' || nodeDef?.category === 'miliastra') && api && (
            <div className="api-config-section">
              <div className="config-section-title">API 配置</div>
              <div className="config-row">
                <label>请求地址 (URL)</label>
                <input className="mono" value={api.url} placeholder="https://api.example.com/v1/run"
                  onChange={(e) => updateNodeConfig(selectedNodeId, { apiConfig: { ...api, url: e.target.value } })} />
              </div>
              <div className="config-row config-row-2col">
                <div>
                  <label>方法</label>
                  <select value={api.method}
                    onChange={(e) => updateNodeConfig(selectedNodeId, { apiConfig: { ...api, method: e.target.value as any } })}>
                    {['POST','GET','PUT','PATCH','DELETE'].map((m) => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label>超时 (ms)</label>
                  <input type="number" className="mono" value={api.timeoutMs}
                    onChange={(e) => updateNodeConfig(selectedNodeId, { apiConfig: { ...api, timeoutMs: parseInt(e.target.value) || 5000 } })} />
                </div>
              </div>
              <div className="config-row">
                <label>认证方式</label>
                <select value={api.authType}
                  onChange={(e) => updateNodeConfig(selectedNodeId, { apiConfig: { ...api, authType: e.target.value as any } })}>
                  <option value="none">无认证</option>
                  <option value="bearer">Bearer Token</option>
                  <option value="basic">Basic Auth</option>
                  <option value="api_key">API Key Header</option>
                </select>
              </div>
              {api.authType !== 'none' && (
                <div className="config-row">
                  <label>{api.authType === 'basic' ? '用户名:密码' : api.authType === 'api_key' ? 'Key: Value' : 'Token'}</label>
                  <input className="mono" type="password" value={api.authToken}
                    onChange={(e) => updateNodeConfig(selectedNodeId, { apiConfig: { ...api, authToken: e.target.value } })} />
                </div>
              )}
              <div className="config-row">
                <label>Headers (JSON)</label>
                <textarea rows={2} className="mono" value={api.headers}
                  onChange={(e) => updateNodeConfig(selectedNodeId, { apiConfig: { ...api, headers: e.target.value } })} />
              </div>
              <div className="config-row">
                <label>请求体模板</label>
                <textarea rows={3} className="mono" value={api.bodyTemplate}
                  onChange={(e) => updateNodeConfig(selectedNodeId, { apiConfig: { ...api, bodyTemplate: e.target.value } })} />
              </div>
            </div>
          )}
          <div className="config-actions">
            <button className="secondary-btn" onClick={() => resetNodeConfig(selectedNodeId)}>重置默认</button>
          </div>
        </div>
      )}
    </aside>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  Left Palette
 * ═══════════════════════════════════════════════════════════════════════════ */

function Palette() {
  const addNodeOfType = useGraphStore((s) => s.addNodeOfType)
  const showToast = usePersistenceStore((s) => s.showToast)
  const snapshots = usePersistenceStore((s) => s.snapshots)
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const nodeConfigs = useConfigStore((s) => s.nodeConfigs)
  const topic = useExecutionStore((s) => s.topic)
  const setNodes = useGraphStore((s) => s.setNodes)
  const setEdges = useGraphStore((s) => s.setEdges)
  const saveSnapshot = usePersistenceStore((s) => s.saveSnapshot)
  const loadSnapshot = usePersistenceStore((s) => s.loadSnapshot)
  const deleteSnapshot = usePersistenceStore((s) => s.deleteSnapshot)
  const exportSnapshot = usePersistenceStore((s) => s.exportSnapshot)
  const importSnapshot = usePersistenceStore((s) => s.importSnapshot)
  const setTopic = useExecutionStore((s) => s.setTopic)
  const setBulkConfigs = useConfigStore((s) => (cfgs: Record<string, NodeConfig>) => {
    Object.entries(cfgs).forEach(([id, cfg]) => s.setNodeConfig(id, cfg))
  })

  const getByCat = getNodeDefsByCategory
  const platformNodes = getByCat('platform').filter((d: any) =>
    !['topicInput','outputNode','dispatchNode','criticNode','outlineAgent','writerAgent','editorAgent'].includes(d.type)
  )
  const miliastraNodes = getByCat('miliastra')

  const [saveName, setSaveName] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const [sections, setSections] = useState({ add: true, canvas: true, mine: true })
  const toggle = (k: keyof typeof sections) => setSections((s) => ({ ...s, [k]: !s[k] }))

  return (
    <aside className="palette">
      {/* ── 添加节点 ──────────────────────────────────────────────── */}
      <div className="palette-section-header" onClick={() => toggle('add')}>
        <span>+ 添加节点</span><span>{sections.add ? '▲' : '▼'}</span>
      </div>
      {sections.add && (
        <div className="palette-section-body">
          <div className="palette-group-label">平台通用</div>
          {platformNodes.map((def: any) => (
            <button key={def.type} className="palette-item"
              onClick={() => { addNodeOfType(def.type); showToast(`已添加 ${def.title}`, 'success') }}>
              <span className="palette-icon">{def.icon}</span>{def.title}
            </button>
          ))}
          <div className="palette-group-label" style={{ color: '#FF375F', marginTop: 8 }}>千星专属</div>
          {miliastraNodes.map((def: any) => (
            <button key={def.type} className="palette-item palette-item-miliastra"
              onClick={() => { addNodeOfType(def.type); showToast(`已添加 ${def.title}`) }}>
              <span className="palette-icon">{def.icon}</span>{def.title}
            </button>
          ))}
          <div className="palette-group-label" style={{ marginTop: 8 }}>特殊节点</div>
          {[
            { type: 'dispatchNode', icon: '↩', label: '输出回传 · 看板' },
            { type: 'criticNode',   icon: '⚖', label: '评审 Critic' },
          ].map((item) => (
            <button key={item.type} className="palette-item"
              onClick={() => { addNodeOfType(item.type); showToast(`已添加 ${item.label}`) }}>
              <span className="palette-icon">{item.icon}</span>{item.label}
            </button>
          ))}
        </div>
      )}

      {/* ── 画布操作 ──────────────────────────────────────────────── */}
      <div className="palette-section-header" onClick={() => toggle('canvas')}>
        <span>🎨 画布</span><span>{sections.canvas ? '▲' : '▼'}</span>
      </div>
      {sections.canvas && (
        <div className="palette-section-body">
          <button className="palette-item" onClick={() => { setNodes(autoLayout(nodes, edges)); showToast('已自动整理布局') }}>
            <span className="palette-icon">⊞</span>自动整理布局
          </button>
        </div>
      )}

      {/* ── 我的工作流 ────────────────────────────────────────────── */}
      <div className="palette-section-header" onClick={() => toggle('mine')}>
        <span>💾 我的工作流</span><span>{sections.mine ? '▲' : '▼'}</span>
      </div>
      {sections.mine && (
        <div className="palette-section-body">
          <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
            <input className="snapshot-name-input" placeholder="工作流名称…" value={saveName}
              onChange={(e) => setSaveName(e.target.value)} />
            <button className="secondary-btn" style={{ padding: '4px 8px', fontSize: 11 }}
              onClick={() => { if (saveName.trim()) { saveSnapshot(saveName.trim(), nodes, edges, nodeConfigs, topic); setSaveName('') } }}>
              保存
            </button>
          </div>
          <div className="snapshot-list">
            {snapshots.length === 0 && <p className="muted" style={{ fontSize: 11 }}>暂无保存</p>}
            {snapshots.map((s) => (
              <div key={s.id} className="snapshot-row">
                <span className="snapshot-name" title={s.name}
                  onClick={() => loadSnapshot(s, setNodes, setEdges, setBulkConfigs, setTopic)}>
                  {s.name}
                </span>
                <span className="snapshot-meta">{s.nodes.length}节点</span>
                <button onClick={() => exportSnapshot(s.id)} title="导出">↗</button>
                <button onClick={() => deleteSnapshot(s.id)} title="删除" style={{ color: '#ff375f' }}>×</button>
              </div>
            ))}
          </div>
          <button className="palette-item" onClick={() => fileRef.current?.click()}>
            <span className="palette-icon">📥</span>导入 JSON
          </button>
          <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importSnapshot(f, (snap) => loadSnapshot(snap, setNodes, setEdges, setBulkConfigs, setTopic)); e.target.value = '' }} />
        </div>
      )}
    </aside>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  Main canvas
 * ═══════════════════════════════════════════════════════════════════════════ */

export default function WorkflowView() {
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const applyNC = useGraphStore((s) => s.applyNodeChanges)
  const applyEC = useGraphStore((s) => s.applyEdgeChanges)
  const onConnect = useGraphStore((s) => s.onConnect)
  const addNodeOfType = useGraphStore((s) => s.addNodeOfType)
  const deleteNode = useGraphStore((s) => s.deleteNode)
  const selectNode = useGraphStore((s) => s.selectNode)
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId)

  const nodeStatus = useExecutionStore((s) => s.nodeStatus)

  const decoratedNodes = nodes.map((n) => ({
    ...n,
    className: [n.className, nodeStatus[n.id] ? `status-${nodeStatus[n.id]}` : ''].filter(Boolean).join(' '),
    selected: n.id === selectedNodeId,
  }))

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    selectNode(node.id)
  }, [selectNode])

  const onPaneClick = useCallback(() => {
    selectNode(null)
  }, [selectNode])

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

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeId) {
        deleteNode(selectedNodeId)
      }
    },
    [selectedNodeId, deleteNode],
  )

  return (
    <div className="workflow-layout" onKeyDown={onKeyDown} tabIndex={0}>
      <Palette />
      <div className="canvas-wrapper">
        <ReactFlow
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
          <Background gap={24} size={1} color="rgba(255,255,255,0.04)" />
          <Controls />
          <MiniMap
            nodeColor={(n) => {
              const def = getNodeDef(n.type ?? '')
              return def?.accentColor ?? '#636366'
            }}
            style={{ background: 'rgba(20,20,30,0.8)', border: '1px solid rgba(255,255,255,0.1)' }}
          />
        </ReactFlow>
      </div>
      <SidePanel />
    </div>
  )
}
