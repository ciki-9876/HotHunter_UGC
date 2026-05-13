import { useEffect, useState } from 'react'
import { useBlueprint, type ViewTab } from './store'
import { AGENT_ORDER } from './agent/defaults'
import { PRESETS, presetById } from './agent/presets'
import WorkflowView from './views/Workflow'
import DashboardView from './views/Dashboard'
import ProjectCenterView from './views/ProjectCenter'
import TokensView from './views/Tokens'

/* ============================================================
 *  Settings modal
 * ============================================================ */

function SettingsModal() {
  const open = useBlueprint((s) => s.settingsOpen)
  const setOpen = useBlueprint((s) => s.setSettingsOpen)
  const provider = useBlueprint((s) => s.provider)
  const updateProvider = useBlueprint((s) => s.updateProvider)
  const resetProvider = useBlueprint((s) => s.resetProvider)
  const showToast = useBlueprint((s) => s.showToast)

  const [reveal, setReveal] = useState(false)

  if (!open) return null
  const preset = presetById(provider.presetId)

  const onSelectPreset = (id: string) => {
    const p = presetById(id)
    updateProvider({
      presetId: p.id,
      provider: p.provider,
      baseURL: p.baseURL,
      model: p.defaultModel || provider.model,
    })
  }

  return (
    <div
      className="modal-mask"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false)
      }}
    >
      <div className="modal-card">
        <div className="modal-header">
          <span className="modal-title">⚙ 模型配置</span>
          <span className="modal-subtitle">
            支持任意 OpenAI 兼容接口 + Anthropic 原生接口
          </span>
          <button className="close-btn" onClick={() => setOpen(false)}>
            关闭
          </button>
        </div>

        <div className="modal-body">
          <div className="form-row">
            <label>Provider 预设</label>
            <select
              value={provider.presetId}
              onChange={(e) => onSelectPreset(e.target.value)}
            >
              {PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label>协议类型</label>
            <select
              value={provider.provider}
              onChange={(e) =>
                updateProvider({
                  provider: e.target.value as
                    | 'openai-compatible'
                    | 'anthropic',
                })
              }
            >
              <option value="openai-compatible">
                OpenAI 兼容 (/chat/completions)
              </option>
              <option value="anthropic">Anthropic (/messages)</option>
            </select>
          </div>

          <div className="form-row">
            <label>Base URL</label>
            <input
              type="text"
              placeholder="https://api.openai.com/v1"
              value={provider.baseURL}
              onChange={(e) => updateProvider({ baseURL: e.target.value })}
            />
          </div>

          <div className="form-row">
            <label>模型</label>
            <input
              type="text"
              list="model-options"
              placeholder="模型 id"
              value={provider.model}
              onChange={(e) => updateProvider({ model: e.target.value })}
            />
            <datalist id="model-options">
              {preset.models.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>

          <div className="form-row">
            <label>API Key</label>
            <div className="key-row">
              <input
                type={reveal ? 'text' : 'password'}
                placeholder={
                  preset.apiKeyHint ?? '本地仅存储在浏览器 localStorage'
                }
                value={provider.apiKey}
                onChange={(e) => updateProvider({ apiKey: e.target.value })}
              />
              <button
                type="button"
                className="ghost-btn"
                onClick={() => setReveal((v) => !v)}
              >
                {reveal ? '隐藏' : '显示'}
              </button>
            </div>
            {preset.apiKeyHint && (
              <span className="form-hint">{preset.apiKeyHint}</span>
            )}
          </div>

          <div className="form-callout">
            <b>提示：</b>
            未填 API Key 时，画布会走 mock 数据完成全流程演示（不联网）。
            <br />
            填写后请求会通过 Vite dev 服务转发，绕过浏览器 CORS。
          </div>
        </div>

        <div className="modal-footer">
          <button
            className="ghost-btn"
            onClick={() => {
              resetProvider()
              showToast('已重置全局配置')
            }}
          >
            重置默认
          </button>
          <span className="spacer" />
          <button
            className="primary-btn"
            onClick={() => {
              setOpen(false)
              showToast('配置已保存（localStorage）✓', 1600)
            }}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}

/* ============================================================
 *  Top bar (brand · view tabs · status · settings)
 * ============================================================ */

const VIEW_TABS: { id: ViewTab; label: string; icon: string }[] = [
  { id: 'workflow', label: '工作流', icon: '⌘' },
  { id: 'dashboard', label: '数据看板', icon: '◧' },
  { id: 'project', label: '项目中心', icon: '▤' },
  { id: 'tokens', label: '设计令牌', icon: '◇' },
]

function TopBar() {
  const view = useBlueprint((s) => s.view)
  const setView = useBlueprint((s) => s.setView)
  const isRunning = useBlueprint((s) => s.isRunning)
  const statuses = useBlueprint((s) => s.nodeStatus)
  const provider = useBlueprint((s) => s.provider)
  const setSettingsOpen = useBlueprint((s) => s.setSettingsOpen)
  const cardsCount = useBlueprint((s) => s.dashboardCards.length)
  const filesCount = useBlueprint((s) => s.projectFiles.length)

  const allDone = AGENT_ORDER.every((id) => statuses[id] === 'done')

  let pillCls = 'status-pill'
  let pillLabel = '就绪 · 等待运行'
  if (isRunning) {
    pillCls += ' running'
    pillLabel = '执行中 · 请稍候'
  } else if (allDone) {
    pillCls += ' done'
    pillLabel = '已完成 · 点击节点查看'
  }

  const modelLabel = provider.apiKey
    ? `${provider.model || '未设置'} · ${provider.presetId}`
    : '演示模式 (mock)'

  const badgeFor = (id: ViewTab): number | undefined => {
    if (id === 'dashboard') return cardsCount
    if (id === 'project') return filesCount
    return undefined
  }

  return (
    <div className="top-bar">
      <span className="brand">
        <span className="brand-mark" />
        Agent 蓝图
      </span>

      <nav className="view-tabs" role="tablist">
        {VIEW_TABS.map((t) => {
          const badge = badgeFor(t.id)
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={view === t.id}
              className={`view-tab ${view === t.id ? 'active' : ''}`}
              onClick={() => setView(t.id)}
            >
              <span className="view-tab-icon">{t.icon}</span>
              {t.label}
              {badge !== undefined && (
                <span className="view-tab-badge">{badge}</span>
              )}
            </button>
          )
        })}
      </nav>

      <span className="spacer" />
      {view === 'workflow' && <span className={pillCls}>{pillLabel}</span>}
      <button
        className="settings-btn"
        onClick={() => setSettingsOpen(true)}
        title="模型配置"
      >
        <span className="settings-cog">
          <CogIcon />
        </span>
        <span className="settings-btn-label">{modelLabel}</span>
      </button>
    </div>
  )
}

function CogIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="2.2" />
      <path
        d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.5 3.5l1.5 1.5M11 11l1.5 1.5M3.5 12.5l1.5-1.5M11 5l1.5-1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function Toast() {
  const toast = useBlueprint((s) => s.toast)
  if (!toast) return null
  return <div className="toast">{toast}</div>
}

/* ============================================================
 *  App root
 * ============================================================ */

export default function App() {
  const view = useBlueprint((s) => s.view)
  const resetCanvas = useBlueprint((s) => s.resetCanvas)
  useEffect(() => {
    resetCanvas()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="app-shell">
      <TopBar />
      <main className="app-main">
        {view === 'workflow' && <WorkflowView />}
        {view === 'dashboard' && <DashboardView />}
        {view === 'project' && <ProjectCenterView />}
        {view === 'tokens' && <TokensView />}
      </main>
      <SettingsModal />
      <Toast />
    </div>
  )
}
