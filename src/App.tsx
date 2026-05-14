import { useState } from 'react'
import { useConfigStore, usePersistenceStore, useExecutionStore } from './store'
import { PRESETS, presetById } from './agent/presets'
import WorkflowView from './views/Workflow'
import DashboardView from './views/Dashboard'
import ProjectCenterView from './views/ProjectCenter'
import TokensView from './views/Tokens'
import DauView from './views/DauView'
import LevelCenter from './views/LevelCenter'
import CreatorCenter from './views/CreatorCenter'
import KnowledgeBase from './views/KnowledgeBase'
import Lab from './views/Lab'
import SettingsView from './views/Settings'

/* ── Settings modal ─────────────────────────────────────────────────────── */
function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const provider   = useConfigStore((s) => s.provider)
  const setProvider = useConfigStore((s) => s.setProvider)
  const showToast  = usePersistenceStore((s) => s.showToast)
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
          <span className="modal-title">模型配置</span>
          <span className="modal-subtitle">支持任意 OpenAI 兼容接口 + Anthropic 原生接口</span>
          <button className="close-btn" onClick={onClose}>✕</button>
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
            <select value={provider.provider}
              onChange={(e) => setProvider({ ...provider, provider: e.target.value as 'openai-compatible' | 'anthropic' })}>
              <option value="openai-compatible">OpenAI 兼容</option>
              <option value="anthropic">Anthropic 原生</option>
            </select>
          </div>
          <div className="form-row">
            <label>Base URL</label>
            <input value={provider.baseURL}
              onChange={(e) => setProvider({ ...provider, baseURL: e.target.value })}
              placeholder="https://api.openai.com/v1" />
          </div>
          <div className="form-row">
            <label>模型</label>
            <input value={provider.model}
              onChange={(e) => setProvider({ ...provider, model: e.target.value })}
              placeholder={preset.defaultModel || 'gpt-4o'} />
          </div>
          <div className="form-row">
            <label>API Key</label>
            <div className="key-row">
              <input type={reveal ? 'text' : 'password'} value={provider.apiKey}
                onChange={(e) => setProvider({ ...provider, apiKey: e.target.value })}
                placeholder="sk-..." />
              <button className="ghost-btn small" onClick={() => setReveal((r) => !r)}>
                {reveal ? '隐藏' : '显示'}
              </button>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="ghost-btn" onClick={() => { setProvider({ ...provider, apiKey: '' }); showToast('API Key 已清除') }}>
            清除 Key
          </button>
          <div style={{ flex: 1 }} />
          <button className="primary-btn" onClick={() => { showToast('配置已保存', 'success'); onClose() }}>
            保存
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Toast layer ────────────────────────────────────────────────────────── */
function ToastLayer() {
  const toasts = usePersistenceStore((s) => s.toasts)
  const dismiss = usePersistenceStore((s) => s.dismissToast)
  return (
    <>
      {toasts.map((t) => (
        <div key={t.id} className="toast" onClick={() => dismiss(t.id)}
          style={{ bottom: 28 + toasts.indexOf(t) * 52 }}>
          {t.message}
        </div>
      ))}
    </>
  )
}

/* ── Top bar ────────────────────────────────────────────────────────────── */
function TopBar({ onSettings }: { onSettings: () => void }) {
  const view    = usePersistenceStore((s) => s.view)
  const setView = usePersistenceStore((s) => s.setView)
  const dashboardCards = useExecutionStore((s) => s.dashboardCards)
  const projectFiles   = useExecutionStore((s) => s.projectFiles)
  const isRunning      = useExecutionStore((s) => s.isRunning)

  const tabs = [
    { id: 'workflow'      as const, icon: '⬡', label: '工作流' },
    { id: 'dau'           as const, icon: '◈', label: '大盘数据' },
    { id: 'level-center'  as const, icon: '◫', label: '关卡中心' },
    { id: 'creator'       as const, icon: '👥', label: '创作者运营' },
    { id: 'knowledge'     as const, icon: '📚', label: '知识库' },
    { id: 'lab'           as const, icon: '🧪', label: '实验室' },
    { id: 'settings'      as const, icon: '⚙️', label: '系统管理' },
  ]

  return (
    <header className="top-bar">
      <div className="brand">
        <div className="brand-mark" />
        <span>HotRadar</span>
      </div>

      <div className="view-tabs">
        {tabs.map((t) => (
          <button key={t.id} className={`view-tab ${view === t.id ? 'active' : ''}`}
            onClick={() => setView(t.id)}>
            <span className="view-tab-icon">{t.icon}</span>
            {t.label}
            {'badge' in t && t.badge !== undefined && (
              <span className="view-tab-badge">{(t as any).badge}</span>
            )}
          </button>
        ))}
      </div>

      <div className="spacer" />

      {isRunning && (
        <span className="status-pill running">运行中</span>
      )}

      <button className="settings-btn" onClick={onSettings}>
        <span className="settings-cog">⚙</span>
        <span className="settings-btn-label">模型配置</span>
      </button>
    </header>
  )
}

/* ── App root ───────────────────────────────────────────────────────────── */
export default function App() {
  const view = usePersistenceStore((s) => s.view)
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <div className="app-shell">
      <TopBar onSettings={() => setSettingsOpen(true)} />
      <main className="app-main">
        {view === 'workflow'      && <WorkflowView />}
        {view === 'dau'           && <DauView />}
        {view === 'level-center'  && <LevelCenter />}
        {view === 'creator'       && <CreatorCenter />}
        {view === 'knowledge'     && <KnowledgeBase />}
        {view === 'lab'           && <Lab />}
        {view === 'settings'      && <SettingsView />}
        {view === 'dashboard'     && <DashboardView />}
        {view === 'project'       && <ProjectCenterView />}
        {view === 'tokens'        && <TokensView />}
      </main>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ToastLayer />
    </div>
  )
}
