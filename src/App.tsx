import { useEffect, useState } from 'react'
import { useConfigStore, usePersistenceStore, useExecutionStore } from './store'
import { PRESETS, presetById } from './agent/presets'
import WorkflowView from './views/Workflow'
import DashboardView from './views/Dashboard'
import ProjectCenterView from './views/ProjectCenter'
import TokensView from './views/Tokens'

/* ============================================================
 *  Settings modal
 * ============================================================ */

function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const provider = useConfigStore((s) => s.provider)
  const setProvider = useConfigStore((s) => s.setProvider)
  const showToast = usePersistenceStore((s) => s.showToast)
  const [reveal, setReveal] = useState(false)

  if (!open) return null

  const preset = presetById(provider.presetId)
  const onSelectPreset = (id: string) => {
    const p = presetById(id)
    setProvider({ ...provider, presetId: p.id, provider: p.provider, baseURL: p.baseURL, model: p.defaultModel || provider.model })
  }

  return (
    <div className="modal-mask" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-card">
        <div className="modal-header">
          <span className="modal-title">⚙ 模型配置</span>
          <span className="modal-subtitle">支持任意 OpenAI 兼容接口 + Anthropic 原生接口</span>
          <button className="close-btn" onClick={onClose}>关闭</button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <label>Provider 预设</label>
            <select value={provider.presetId} onChange={(e) => onSelectPreset(e.target.value)}>
              {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label>协议</label>
            <select value={provider.provider} onChange={(e) => setProvider({ ...provider, provider: e.target.value as 'openai-compatible' | 'anthropic' })}>
              <option value="openai-compatible">OpenAI 兼容</option>
              <option value="anthropic">Anthropic 原生</option>
            </select>
          </div>
          <div className="form-row">
            <label>Base URL</label>
            <input value={provider.baseURL} onChange={(e) => setProvider({ ...provider, baseURL: e.target.value })} placeholder="https://api.openai.com/v1" />
          </div>
          <div className="form-row">
            <label>模型</label>
            <input value={provider.model} onChange={(e) => setProvider({ ...provider, model: e.target.value })} placeholder={preset.defaultModel || 'gpt-4o'} />
          </div>
          <div className="form-row">
            <label>API Key</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input type={reveal ? 'text' : 'password'} value={provider.apiKey} onChange={(e) => setProvider({ ...provider, apiKey: e.target.value })} placeholder="sk-..." style={{ flex: 1 }} />
              <button className="secondary-btn" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setReveal((r) => !r)}>{reveal ? '隐藏' : '显示'}</button>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="secondary-btn" onClick={() => { setProvider({ ...provider, apiKey: '' }); showToast('API Key 已清除') }}>清除 Key</button>
          <button className="primary-btn" onClick={() => { showToast('配置已保存', 'success'); onClose() }}>保存</button>
        </div>
      </div>
    </div>
  )
}

/* ============================================================
 *  Toast renderer
 * ============================================================ */

function ToastLayer() {
  const toasts = usePersistenceStore((s) => s.toasts)
  const dismiss = usePersistenceStore((s) => s.dismissToast)
  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`} onClick={() => dismiss(t.id)}>
          {t.message}
        </div>
      ))}
    </div>
  )
}

/* ============================================================
 *  Top nav
 * ============================================================ */

function TopNav({ onSettings }: { onSettings: () => void }) {
  const view = usePersistenceStore((s) => s.view)
  const setView = usePersistenceStore((s) => s.setView)
  const dashboardCards = useExecutionStore((s) => s.dashboardCards)
  const projectFiles = useExecutionStore((s) => s.projectFiles)

  const tabs = [
    { id: 'workflow' as const,  label: '工作流' },
    { id: 'dashboard' as const, label: '数据看板', badge: dashboardCards.length },
    { id: 'project' as const,   label: '项目中心', badge: projectFiles.length },
    { id: 'tokens' as const,    label: '设计令牌' },
  ]

  return (
    <header className="top-nav">
      <div className="nav-brand">
        <span className="brand-icon">⬡</span>
        <span className="brand-name">HotRadar</span>
      </div>
      <nav className="nav-tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`nav-tab ${view === t.id ? 'active' : ''}`}
            onClick={() => setView(t.id)}
          >
            {t.label}
            {t.badge !== undefined && (
              <span className="nav-badge">{t.badge}</span>
            )}
          </button>
        ))}
      </nav>
      <button className="settings-btn" onClick={onSettings} title="模型配置">⚙</button>
    </header>
  )
}

/* ============================================================
 *  App root
 * ============================================================ */

export default function App() {
  const view = usePersistenceStore((s) => s.view)
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <div className="app-shell">
      <TopNav onSettings={() => setSettingsOpen(true)} />
      <main className="app-main">
        {view === 'workflow'   && <WorkflowView />}
        {view === 'dashboard'  && <DashboardView />}
        {view === 'project'    && <ProjectCenterView />}
        {view === 'tokens'     && <TokensView />}
      </main>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ToastLayer />
    </div>
  )
}
