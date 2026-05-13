import { useCallback, useRef, useState } from 'react'
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlowProvider,
  getBezierPath,
  useReactFlow,
  type EdgeProps,
  type Node,
  type NodeProps,
  type OnConnectStart,
  type OnConnectEnd,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { Markdown } from '../components/Markdown'
import {
  useBlueprint,
  type DispatchNodeData,
  type NodeStatus,
} from '../store'
import {
  GENERIC_AGENT_CONFIG,
  NODE_IDS,
  DEFAULT_NODE_CONFIGS,
} from '../agent/defaults'
import { DISPATCH_FORMATS, type DispatchTarget } from '../agent/dispatch'
import type { CriticNodeData } from '../agent/critic'

/* ============================================================
 *  helpers
 * ============================================================ */

function statusClass(status: NodeStatus | undefined): string {
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

function NodeStatusLabel({ status }: { status: NodeStatus | undefined }) {
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

/* ============================================================
 *  node components
 * ============================================================ */

function TopicInputNode({ id, selected }: NodeProps) {
  const topic = useBlueprint((s) => s.topic)
  const setTopic = useBlueprint((s) => s.setTopic)
  const startRun = useBlueprint((s) => s.startRun)
  const cancelRun = useBlueprint((s) => s.cancelRun)
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
      {isRunning ? (
        <button
          className="run-btn cancel-btn nodrag"
          onClick={(e) => {
            e.stopPropagation()
            cancelRun()
          }}
        >
          ■ 停止
        </button>
      ) : (
        <button
          className="run-btn nodrag"
          onClick={(e) => {
            e.stopPropagation()
            void startRun()
          }}
        >
          ▶ 开始运行
        </button>
      )}
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

function genericAgentMeta(id: string): { icon: string; defaultLabel: string } {
  if (id === NODE_IDS.outline) return { icon: '◆', defaultLabel: '大纲生成 Agent' }
  if (id === NODE_IDS.writer) return { icon: '✎', defaultLabel: '正文写作 Agent' }
  if (id === NODE_IDS.editor) return { icon: '✦', defaultLabel: '润色编辑 Agent' }
  return { icon: '✦', defaultLabel: '新 Agent' }
}

function AgentNode({ id, selected }: NodeProps) {
  const status = useBlueprint((s) => s.nodeStatus[id])
  const summary = useBlueprint((s) => s.nodeSummary[id])
  const config = useBlueprint(
    (s) =>
      s.nodeConfigs[id] ?? DEFAULT_NODE_CONFIGS[id] ?? GENERIC_AGENT_CONFIG,
  )
  const provider = useBlueprint((s) => s.provider)
  const updateNodeConfig = useBlueprint((s) => s.updateNodeConfig)
  const isRunning = useBlueprint((s) => s.isRunning)
  const collapsed = useBlueprint((s) => s.collapsedNodes[id] ?? false)
  const toggleCollapsed = useBlueprint((s) => s.toggleNodeCollapsed)
  const setSelected = useBlueprint((s) => s.setSelected)

  const { icon, defaultLabel } = genericAgentMeta(id)
  const label = config.label || defaultLabel
  const effectiveModel = config.override?.model ?? provider.model
  const overridden = Boolean(config.override?.model)

  return (
    <div
      className={`node-card node-agent ${statusClass(status)} ${
        selected ? 'is-selected' : ''
      }`}
    >
      {/* 1) 节点名称（含小字 model 行）*/}
      <div className="node-header">
        <span className="node-icon">{icon}</span>
        <div className="node-name-block">
          <div className="node-title">{label}</div>
          <div className="node-model-line">
            {effectiveModel || '未配置模型'}
            {overridden && <span className="badge-override">覆盖</span>}
          </div>
        </div>
        <span className="node-status-dot" />
      </div>

      {/* 2) 补充提示词输入框 */}
      <textarea
        className="extra-prompt-input nodrag"
        placeholder="补充提示词（选填）— 例如：风格更俏皮一点"
        rows={2}
        value={config.extraPrompt ?? ''}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) =>
          updateNodeConfig(id, { extraPrompt: e.target.value })
        }
        disabled={isRunning}
      />

      {/* 3) 运行时输出内容（可收起）*/}
      <div className="node-output">
        <button
          className="output-toggle nodrag"
          onClick={(e) => {
            e.stopPropagation()
            toggleCollapsed(id)
          }}
        >
          <span className={`caret ${collapsed ? 'collapsed' : ''}`}>▾</span>
          运行时输出
        </button>
        {!collapsed && (
          <div className="node-output-body">
            {summary || '等待上游输入…'}
          </div>
        )}
      </div>

      {/* 4) 状态 + 点击配置 */}
      <div className="node-footer">
        <NodeStatusLabel status={status} />
        <button
          className="config-link nodrag"
          onClick={(e) => {
            e.stopPropagation()
            setSelected(id, 'config')
          }}
        >
          ⚙ 点击配置
        </button>
      </div>

      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

function OutputNode({ id, selected }: NodeProps) {
  const status = useBlueprint((s) => s.nodeStatus[id])
  const summary = useBlueprint((s) => s.nodeSummary[id])
  const result = useBlueprint((s) => s.nodeResult[id])
  const showToast = useBlueprint((s) => s.showToast)

  const copy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (!result) return
      navigator.clipboard
        .writeText(result)
        .then(() => showToast('已复制到剪贴板 ✓', 1600))
        .catch(() => showToast('复制失败', 1600))
    },
    [result, showToast],
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
      <div className="node-body">{summary ?? '等待最终文章…'}</div>
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

function DispatchNode({ id, selected, data }: NodeProps<DispatchNodeData>) {
  const status = useBlueprint((s) => s.nodeStatus[id])
  const summary = useBlueprint((s) => s.nodeSummary[id])
  const setTarget = useBlueprint((s) => s.setDispatchTarget)
  const target = data?.target ?? 'dashboard'
  const isRunning = useBlueprint((s) => s.isRunning)

  const spec = DISPATCH_FORMATS.find((f) => f.target === target) ?? DISPATCH_FORMATS[0]

  return (
    <div
      className={`node-card node-dispatch ${statusClass(status)} ${
        selected ? 'is-selected' : ''
      }`}
    >
      <div className="node-header">
        <span className="node-icon dispatch-icon">↩</span>
        <span className="node-title">输出回传</span>
        <span className="node-status-dot" />
      </div>
      <div className="node-subtitle">DispatchNode · 写回 Tab</div>
      <select
        className="topic-input nodrag dispatch-select"
        value={target}
        disabled={isRunning}
        onChange={(e) => setTarget(id, e.target.value as DispatchTarget)}
      >
        {DISPATCH_FORMATS.map((f) => (
          <option key={f.target} value={f.target}>
            {f.label}
          </option>
        ))}
      </select>
      <div className="node-body" style={{ marginTop: 8 }}>
        {summary ?? spec.description}
      </div>
      <div className="node-footer">
        <NodeStatusLabel status={status} />
        <span className="hint-text">→ {target === 'dashboard' ? '数据看板' : '项目中心'}</span>
      </div>
      <Handle type="target" position={Position.Left} />
    </div>
  )
}

function CriticNode({ id, selected, data }: NodeProps<CriticNodeData>) {
  const status = useBlueprint((s) => s.nodeStatus[id])
  const summary = useBlueprint((s) => s.nodeSummary[id])
  const runtime = useBlueprint((s) => s.criticRuntime[id])
  const isRunning = useBlueprint((s) => s.isRunning)
  const updateCriticData = useBlueprint((s) => s.updateCriticData)
  const threshold = data?.threshold ?? 75
  const maxIter = data?.maxIterations ?? 3
  const rubric = data?.rubric ?? ''

  return (
    <div
      className={`node-card node-critic ${statusClass(status)} ${
        selected ? 'is-selected' : ''
      }`}
    >
      <div className="node-header">
        <span className="node-icon critic-icon">⚖</span>
        <div className="node-name-block">
          <div className="node-title">评审 Critic</div>
          <div className="node-model-line">
            阈值 ≥ {threshold} · 最多 {maxIter} 轮
          </div>
        </div>
        <span className="node-status-dot" />
      </div>
      <textarea
        className="extra-prompt-input nodrag"
        placeholder="评分标准 rubric…"
        rows={2}
        value={rubric}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => updateCriticData(id, { rubric: e.target.value })}
        disabled={isRunning}
      />
      <div className="critic-knobs nodrag" onClick={(e) => e.stopPropagation()}>
        <label className="critic-knob">
          阈值
          <input
            type="number"
            min={0}
            max={100}
            value={threshold}
            disabled={isRunning}
            onChange={(e) =>
              updateCriticData(id, {
                threshold: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
              })
            }
          />
        </label>
        <label className="critic-knob">
          最大轮
          <input
            type="number"
            min={1}
            max={8}
            value={maxIter}
            disabled={isRunning}
            onChange={(e) =>
              updateCriticData(id, {
                maxIterations: Math.max(1, Math.min(8, Number(e.target.value) || 1)),
              })
            }
          />
        </label>
      </div>
      <div className="node-output">
        <div className="node-output-body">
          {runtime ? (
            <>
              <div className={`critic-score ${runtime.passed ? 'pass' : 'fail'}`}>
                <span className="critic-score-num">{runtime.score}</span>
                <span className="critic-score-label">
                  {runtime.passed ? '通过' : '未达阈值'} · 第 {runtime.iteration} 轮
                </span>
              </div>
              {runtime.feedback && (
                <div className="critic-feedback">{runtime.feedback}</div>
              )}
            </>
          ) : (
            summary || '等待上游内容评审…'
          )}
        </div>
      </div>
      <div className="node-footer">
        <NodeStatusLabel status={status} />
        <span className="hint-text">点击查看完整反馈</span>
      </div>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

/* ============================================================
 *  animated edge
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
  selected,
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

  const isActive =
    targetStatus === 'running' ||
    (sourceStatus === 'running' && targetStatus === 'idle')
  const isDone =
    !isActive && sourceStatus === 'done' && targetStatus === 'done'

  const cls = `flow-edge ${isActive ? 'is-active' : ''} ${
    isDone ? 'is-done' : ''
  } ${selected ? 'is-selected' : ''}`

  return (
    <g className={cls}>
      <path id={id} d={edgePath} className="flow-edge-base" />
      <path d={edgePath} className="flow-edge-glow" />
      <path d={edgePath} className="flow-edge-dash" />
      {/* invisible thick hit area so the edge is easy to click for delete */}
      <path d={edgePath} className="flow-edge-hit" fill="none" />
    </g>
  )
}

/* ============================================================
 *  side panel — Result / Config tabs
 * ============================================================ */

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

function labelForNode(node: Node | undefined, cfgLabel?: string): string {
  if (!node) return ''
  if (cfgLabel) return cfgLabel
  if (NODE_LABELS[node.id]) return NODE_LABELS[node.id]
  if (node.type === 'genericAgent') return '新 Agent'
  if (node.type === 'dispatchNode') return '输出回传'
  if (node.type === 'criticNode') return '评审 Critic'
  return node.id
}
function iconForNode(node: Node | undefined): string {
  if (!node) return ''
  if (NODE_ICONS[node.id]) return NODE_ICONS[node.id]
  if (node.type === 'dispatchNode') return '↩'
  if (node.type === 'criticNode') return '⚖'
  return '✦'
}

function isAgentTyped(node: Node | undefined): boolean {
  return (
    node?.type === 'outlineAgent' ||
    node?.type === 'writerAgent' ||
    node?.type === 'editorAgent' ||
    node?.type === 'genericAgent'
  )
}

function ResultTab({ nodeId }: { nodeId: string }) {
  const status = useBlueprint((s) => s.nodeStatus[nodeId])
  const result = useBlueprint((s) => s.nodeResult[nodeId])
  const error = useBlueprint((s) => s.nodeError[nodeId])

  return (
    <>
      <div className="panel-meta">
        <span>
          状态：<b><NodeStatusLabel status={status} /></b>
        </span>
        <span>
          字符：<b>{result?.length ?? 0}</b>
        </span>
      </div>
      <div className="panel-body panel-body-md">
        {error && (
          <div className="panel-error">
            <b>错误：</b>
            {error}
          </div>
        )}
        {result ? (
          <Markdown source={result} />
        ) : (
          <span style={{ color: 'var(--text-dim)' }}>
            （暂无内容，先点 ▶ 开始运行）
          </span>
        )}
      </div>
    </>
  )
}

function ConfigTab({ nodeId }: { nodeId: string }) {
  const config = useBlueprint(
    (s) =>
      s.nodeConfigs[nodeId] ??
      DEFAULT_NODE_CONFIGS[nodeId] ??
      GENERIC_AGENT_CONFIG,
  )
  const updateNodeConfig = useBlueprint((s) => s.updateNodeConfig)
  const resetNodeConfig = useBlueprint((s) => s.resetNodeConfig)
  const provider = useBlueprint((s) => s.provider)
  const showToast = useBlueprint((s) => s.showToast)

  const override = config.override ?? {}
  const hasOverride = Object.keys(override).length > 0

  return (
    <div className="config-form">
      <div className="form-row">
        <label>节点名称</label>
        <input
          type="text"
          value={config.label}
          onChange={(e) => updateNodeConfig(nodeId, { label: e.target.value })}
        />
      </div>

      <div className="form-row">
        <label>System Prompt</label>
        <textarea
          rows={4}
          value={config.systemPrompt}
          onChange={(e) =>
            updateNodeConfig(nodeId, { systemPrompt: e.target.value })
          }
        />
      </div>

      <div className="form-row">
        <label>User Prompt 模板</label>
        <textarea
          rows={5}
          value={config.userPromptTemplate}
          onChange={(e) =>
            updateNodeConfig(nodeId, { userPromptTemplate: e.target.value })
          }
        />
        <span className="form-hint">
          支持占位符 <code>{'{topic}'}</code> 和 <code>{'{input}'}</code>{' '}
          （上游节点输出）
        </span>
      </div>

      <div className="form-row form-row-split">
        <div>
          <label>Temperature</label>
          <div className="slider-row">
            <input
              type="range"
              min={0}
              max={1.5}
              step={0.05}
              value={config.temperature}
              onChange={(e) =>
                updateNodeConfig(nodeId, {
                  temperature: Number(e.target.value),
                })
              }
            />
            <span className="slider-value">
              {config.temperature.toFixed(2)}
            </span>
          </div>
        </div>
        <div>
          <label>Max Tokens</label>
          <input
            type="number"
            min={64}
            max={8192}
            step={64}
            value={config.maxTokens}
            onChange={(e) =>
              updateNodeConfig(nodeId, {
                maxTokens: Number(e.target.value) || 0,
              })
            }
          />
        </div>
      </div>

      <div className="form-section">
        <div className="form-section-title">
          模型覆盖
          {hasOverride && <span className="badge-override">已启用</span>}
        </div>
        <span className="form-hint">
          留空 = 使用全局配置（当前：<b>{provider.model || '未设置'}</b>）
        </span>
        <div className="form-row">
          <label>覆盖模型 id</label>
          <input
            type="text"
            placeholder="留空则继承全局"
            value={override.model ?? ''}
            onChange={(e) => {
              const v = e.target.value
              const nextOverride = { ...override }
              if (v) nextOverride.model = v
              else delete nextOverride.model
              updateNodeConfig(nodeId, {
                override: Object.keys(nextOverride).length
                  ? nextOverride
                  : undefined,
              })
            }}
          />
        </div>
      </div>

      <div className="form-actions">
        <button
          className="ghost-btn"
          onClick={() => {
            resetNodeConfig(nodeId)
            showToast('已重置该节点配置')
          }}
        >
          重置默认
        </button>
        <span className="spacer" />
        <span className="form-hint">改动自动保存到 localStorage</span>
      </div>
    </div>
  )
}

function SidePanel() {
  const selectedNodeId = useBlueprint((s) => s.selectedNodeId)
  const setSelected = useBlueprint((s) => s.setSelected)
  const panelTab = useBlueprint((s) => s.panelTab)
  const setPanelTab = useBlueprint((s) => s.setPanelTab)
  const node = useBlueprint((s) =>
    selectedNodeId ? s.nodes.find((n) => n.id === selectedNodeId) : undefined,
  )
  const cfgLabel = useBlueprint((s) =>
    selectedNodeId ? s.nodeConfigs[selectedNodeId]?.label : undefined,
  )

  const open = Boolean(selectedNodeId)
  const isAgent = isAgentTyped(node)
  const effectiveTab = isAgent ? panelTab : 'result'

  return (
    <aside className={`side-panel ${open ? 'open' : ''}`}>
      <div className="panel-header">
        <span className="panel-icon">{iconForNode(node)}</span>
        <span className="panel-title">{labelForNode(node, cfgLabel)}</span>
        <button className="close-btn" onClick={() => setSelected(null)}>
          关闭
        </button>
      </div>

      {isAgent && (
        <div className="panel-tabs">
          <button
            className={`tab ${effectiveTab === 'result' ? 'active' : ''}`}
            onClick={() => setPanelTab('result')}
          >
            结果
          </button>
          <button
            className={`tab ${effectiveTab === 'config' ? 'active' : ''}`}
            onClick={() => setPanelTab('config')}
          >
            配置
          </button>
        </div>
      )}

      {selectedNodeId && effectiveTab === 'result' && (
        <ResultTab nodeId={selectedNodeId} />
      )}
      {selectedNodeId && isAgent && effectiveTab === 'config' && (
        <ConfigTab nodeId={selectedNodeId} />
      )}
    </aside>
  )
}

/* ============================================================
 *  palette
 * ============================================================ */

function SnapshotSection() {
  const snapshots = useBlueprint((s) => s.snapshots)
  const saveSnapshot = useBlueprint((s) => s.saveSnapshot)
  const loadSnapshot = useBlueprint((s) => s.loadSnapshot)
  const deleteSnapshot = useBlueprint((s) => s.deleteSnapshot)
  const exportSnapshot = useBlueprint((s) => s.exportSnapshot)
  const importSnapshotJson = useBlueprint((s) => s.importSnapshotJson)
  const isRunning = useBlueprint((s) => s.isRunning)
  const [naming, setNaming] = useState(false)
  const [draftName, setDraftName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const onPickFile = () => fileInputRef.current?.click()
  const onFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const text = await file.text()
    importSnapshotJson(text)
  }
  const onConfirmSave = () => {
    saveSnapshot(draftName)
    setNaming(false)
    setDraftName('')
  }

  return (
    <>
      {naming ? (
        <div className="snapshot-save-row">
          <input
            autoFocus
            type="text"
            placeholder="工作流名称…"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onConfirmSave()
              if (e.key === 'Escape') {
                setNaming(false)
                setDraftName('')
              }
            }}
          />
          <button className="primary-btn small" onClick={onConfirmSave}>
            保存
          </button>
          <button
            className="ghost-btn small"
            onClick={() => {
              setNaming(false)
              setDraftName('')
            }}
          >
            取消
          </button>
        </div>
      ) : (
        <button
          className="palette-btn"
          onClick={() => setNaming(true)}
          disabled={isRunning}
        >
          <span className="palette-icon">💾</span>
          保存当前快照
        </button>
      )}

      {snapshots.length === 0 ? (
        <div className="palette-hint" style={{ borderTop: 'none', padding: 0 }}>
          还没有保存的工作流。
        </div>
      ) : (
        <div className="snapshot-list">
          {snapshots.map((s) => (
            <div className="snapshot-row" key={s.id}>
              <button
                className="snapshot-load"
                title={`节点 ${s.nodes.length} · 边 ${s.edges.length}`}
                onClick={() => loadSnapshot(s.id)}
                disabled={isRunning}
              >
                <div className="snapshot-name">{s.name}</div>
                <div className="snapshot-meta">
                  {new Date(s.savedAt).toLocaleString()} · {s.nodes.length}/
                  {s.edges.length}
                </div>
              </button>
              <button
                className="snapshot-icon-btn"
                title="导出 JSON"
                onClick={() => exportSnapshot(s.id)}
              >
                ↗
              </button>
              <button
                className="snapshot-icon-btn danger"
                title="删除"
                onClick={() => deleteSnapshot(s.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <button className="palette-btn" onClick={onPickFile} disabled={isRunning}>
        <span className="palette-icon">📥</span>
        导入 JSON
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        onChange={onFileChosen}
      />
    </>
  )
}

interface PaletteSectionProps {
  id: string
  title: string
  defaultOpen?: boolean
  badge?: string | number
  children: React.ReactNode
}

function PaletteSection({
  title,
  defaultOpen = true,
  badge,
  children,
}: PaletteSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={`palette-section ${open ? 'open' : 'closed'}`}>
      <button
        className="palette-section-head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className={`caret ${open ? '' : 'closed'}`}>▾</span>
        <span className="palette-section-title">{title}</span>
        {badge !== undefined && badge !== '' && (
          <span className="palette-section-badge">{badge}</span>
        )}
      </button>
      {open && <div className="palette-section-body">{children}</div>}
    </div>
  )
}

function Palette() {
  const addAgent = useBlueprint((s) => s.addAgentNode)
  const addDispatch = useBlueprint((s) => s.addDispatchNode)
  const addCritic = useBlueprint((s) => s.addCriticNode)
  const applyAutoLayout = useBlueprint((s) => s.applyAutoLayout)
  const isRunning = useBlueprint((s) => s.isRunning)
  const snapshotsCount = useBlueprint((s) => s.snapshots.length)
  const [collapsed, setCollapsed] = useState(false)

  if (collapsed) {
    return (
      <div className="palette is-collapsed">
        <button
          className="palette-expand-btn"
          onClick={() => setCollapsed(false)}
          title="展开工具面板"
        >
          ▸
          <span className="palette-expand-label">工具</span>
        </button>
      </div>
    )
  }

  return (
    <div className="palette">
      <div className="palette-head">
        <span className="palette-head-title">画布工具</span>
        <button
          className="palette-fold-btn"
          onClick={() => setCollapsed(true)}
          title="收起面板"
        >
          ◂
        </button>
      </div>
      <div className="palette-body">
        <PaletteSection id="nodes" title="添加节点" defaultOpen={true}>
          <button
            className="palette-btn"
            onClick={() => addAgent()}
            disabled={isRunning}
          >
            <span className="palette-icon">✦</span>
            新 Agent
          </button>
          <button
            className="palette-btn"
            onClick={() => addCritic()}
            disabled={isRunning}
          >
            <span className="palette-icon critic">⚖</span>
            评审 Critic（闭环）
          </button>
          <button
            className="palette-btn"
            onClick={() => addDispatch('dashboard')}
            disabled={isRunning}
          >
            <span className="palette-icon">↩</span>
            输出回传 · 看板
          </button>
          <button
            className="palette-btn"
            onClick={() => addDispatch('project')}
            disabled={isRunning}
          >
            <span className="palette-icon">↩</span>
            输出回传 · 项目
          </button>
        </PaletteSection>

        <PaletteSection id="canvas" title="画布" defaultOpen={true}>
          <button
            className="palette-btn"
            onClick={() => applyAutoLayout()}
            disabled={isRunning}
          >
            <span className="palette-icon">🎨</span>
            自动整理布局
          </button>
          <div className="palette-hint">
            · 拖动节点改位置
            <br />· 拖 Handle 连线
            <br />· 拖到空白处自动建节点
            <br />· 选中边按 Delete 删除
          </div>
        </PaletteSection>

        <PaletteSection
          id="snapshots"
          title="我的工作流"
          badge={snapshotsCount || undefined}
          defaultOpen={false}
        >
          <SnapshotSection />
        </PaletteSection>
      </div>
    </div>
  )
}

/* ============================================================
 *  canvas
 * ============================================================ */

const nodeTypes = {
  topicInput: TopicInputNode,
  outlineAgent: AgentNode,
  writerAgent: AgentNode,
  editorAgent: AgentNode,
  genericAgent: AgentNode,
  outputNode: OutputNode,
  dispatchNode: DispatchNode,
  criticNode: CriticNode,
}
const edgeTypes = { flow: FlowEdge }

function CanvasInner() {
  const nodes = useBlueprint((s) => s.nodes)
  const edges = useBlueprint((s) => s.edges)
  const selectedNodeId = useBlueprint((s) => s.selectedNodeId)
  const applyNC = useBlueprint((s) => s.applyNodeChanges)
  const applyEC = useBlueprint((s) => s.applyEdgeChanges)
  const onConnect = useBlueprint((s) => s.onConnect)
  const addAgentNodeAt = useBlueprint((s) => s.addAgentNodeAt)
  const setSelected = useBlueprint((s) => s.setSelected)
  const nodeResult = useBlueprint((s) => s.nodeResult)

  const { screenToFlowPosition } = useReactFlow()
  const connectStartRef = useRef<{
    nodeId: string
    handleType: 'source' | 'target'
  } | null>(null)

  const decoratedNodes = nodes.map((n) => ({
    ...n,
    selected: n.id === selectedNodeId,
  }))

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type === 'topicInput') {
        setSelected(null)
        return
      }
      if (
        nodeResult[node.id] ||
        isAgentTyped(node) ||
        node.type === 'dispatchNode'
      ) {
        setSelected(node.id, 'result')
      }
    },
    [setSelected, nodeResult],
  )

  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (isAgentTyped(node)) {
        setSelected(node.id, 'config')
      }
    },
    [setSelected],
  )

  const onConnectStart: OnConnectStart = useCallback((_, params) => {
    if (params.nodeId && params.handleType) {
      connectStartRef.current = {
        nodeId: params.nodeId,
        handleType: params.handleType,
      }
    } else {
      connectStartRef.current = null
    }
  }, [])

  const onConnectEnd: OnConnectEnd = useCallback(
    (event) => {
      const start = connectStartRef.current
      connectStartRef.current = null
      if (!start) return

      // Identify drop target: only fire if dropped on the pane (empty space),
      // not on another handle. Handles have classes like
      // 'react-flow__handle' / 'react-flow__node' — we want the bare pane.
      const target = (event.target as HTMLElement) ?? null
      const droppedOnPane =
        !!target &&
        (target.classList?.contains('react-flow__pane') ||
          target.classList?.contains('react-flow__renderer'))
      if (!droppedOnPane) return

      // Pull viewport coordinates whether mouse or touch
      let clientX: number
      let clientY: number
      if ('touches' in event && event.touches.length > 0) {
        clientX = event.touches[0].clientX
        clientY = event.touches[0].clientY
      } else if ('changedTouches' in event && event.changedTouches.length > 0) {
        clientX = event.changedTouches[0].clientX
        clientY = event.changedTouches[0].clientY
      } else {
        clientX = (event as MouseEvent).clientX
        clientY = (event as MouseEvent).clientY
      }
      const position = screenToFlowPosition({ x: clientX, y: clientY })
      addAgentNodeAt(position, {
        fromNodeId: start.nodeId,
        handleType: start.handleType,
      })
    },
    [screenToFlowPosition, addAgentNodeAt],
  )

  return (
    <ReactFlow
      nodes={decoratedNodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={applyNC}
      onEdgesChange={applyEC}
      onConnect={onConnect}
      onConnectStart={onConnectStart}
      onConnectEnd={onConnectEnd}
      onNodeClick={onNodeClick}
      onNodeDoubleClick={onNodeDoubleClick}
      onPaneClick={() => setSelected(null)}
      fitView
      fitViewOptions={{ padding: 0.25 }}
      proOptions={{ hideAttribution: true }}
      panOnScroll
      zoomOnDoubleClick={false}
      minZoom={0.3}
      maxZoom={1.6}
      deleteKeyCode={['Delete', 'Backspace']}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={22}
        size={1}
        color="#262c3a"
      />
      <Controls position="bottom-left" showInteractive={false} />
      <MiniMap
        position="bottom-right"
        pannable
        zoomable
        ariaLabel="画布缩略图"
        maskColor="rgba(15, 17, 23, 0.7)"
        nodeColor={(n) => {
          switch (n.type) {
            case 'topicInput':
              return '#4f8cff'
            case 'criticNode':
              return '#ff9a3c'
            case 'dispatchNode':
              return '#f0b84a'
            case 'outputNode':
              return '#2bd4a5'
            default:
              return '#9aa6c2'
          }
        }}
        nodeStrokeWidth={2}
        style={{
          background: 'rgba(22, 25, 34, 0.85)',
          border: '1px solid #2a3142',
          borderRadius: 8,
        }}
      />
    </ReactFlow>
  )
}

export default function WorkflowView() {
  return (
    <ReactFlowProvider>
      <div className="workflow-view">
        <CanvasInner />
        <Palette />
        <SidePanel />
      </div>
    </ReactFlowProvider>
  )
}
