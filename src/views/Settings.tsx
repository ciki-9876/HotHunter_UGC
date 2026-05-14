// 系统管理视图 — 迁移自 settings.js + AI 配置 + KM 数据源
// 严格只使用 index.css 设计令牌

import { useCallback, useEffect, useState } from 'react'
import { apiPost } from '../api/client'

/* ══════════ 类型 ══════════ */
interface SharedConfig {
  echo_api_key?: string; echo_base_url?: string
  model?: string; api_key?: string; max_tokens?: number; temperature?: number
}
interface SceneConfig {
  scene_key: string; agent_name?: string; echo_agent_id?: string
  echo_api_key?: string; connection_scope?: string
}
interface DataSource {
  id: number | string; name: string; doc_id?: string; doc_type?: string; note?: string
}

/* ══════════ 场景预设 ══════════ */
const SCENE_CATALOG: Record<string, { title: string; pageLabel: string; summary: string }> = {
  dau_monitor:        { title: '大盘监控分析',    pageLabel: '大盘数据',    summary: '负责千星奇域大盘数据分析与日报/周报生成' },
  level_review:       { title: '关卡策划案评审',  pageLabel: '关卡中心',   summary: '对关卡策划案进行 AI 智能评审与建议' },
  ctr_predict:        { title: 'CTR 吸量预测',    pageLabel: '实验室',     summary: '素材吸量评分与多资源位 CTR 预测' },
  gameplay_strategy:  { title: '玩法策略分析',    pageLabel: '玩法设计师', summary: '关卡玩法竞品分析与策略建议' },
  hotspot_analysis:   { title: '热点内容分析',    pageLabel: '工作流',     summary: '热点评估、玩法匹配、爽点提取' },
  experience_card:    { title: '经验卡片生成',    pageLabel: '工作流',     summary: '关卡生命周期经验自动沉淀' },
  creator_match:      { title: '创作者匹配',      pageLabel: '创作者运营', summary: '根据玩法品类智能匹配合适创作者' },
  report_generate:    { title: '报告生成',        pageLabel: '大盘数据',   summary: '综合数分报告生成与知识库回写' },
}

const MODELS = ['gpt-5.4', 'gpt-4o', 'gpt-4o-mini', 'claude-3-5-sonnet', 'claude-3-7-sonnet', 'deepseek-chat']

/* ══════════ 公共 ══════════ */
const Card = ({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) => (
  <div style={{ background: 'var(--surface-elevated)', borderRadius: 'var(--r-12)', border: '0.5px solid var(--border-default)', boxShadow: 'var(--shadow-1)', overflow: 'hidden' }}>
    <div style={{ padding: 'var(--s-5) var(--s-6)', borderBottom: '0.5px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <h3 style={{ margin: 0, fontSize: 'var(--fs-14)', fontWeight: 'var(--fw-semi)', color: 'var(--text-primary)' }}>{title}</h3>
      {action}
    </div>
    <div style={{ padding: 'var(--s-6)' }}>{children}</div>
  </div>
)

const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
    <label style={{ fontSize: 'var(--fs-12)', fontWeight: 'var(--fw-medium)', color: 'var(--text-secondary)' }}>{label}</label>
    {children}
    {hint && <span style={{ fontSize: 11, color: 'var(--text-quaternary)', lineHeight: 'var(--lh-snug)' }}>{hint}</span>}
  </div>
)

const StatusDot = ({ ok }: { ok: boolean | null }) => (
  <span style={{ width: 8, height: 8, borderRadius: 'var(--r-full)', flexShrink: 0, background: ok === null ? 'var(--c-neutral-400)' : ok ? 'var(--c-green-500)' : 'var(--c-red-500)', display: 'inline-block' }} />
)

const SETTINGS_TABS = [
  { id: 'ai',       label: 'AI 配置',     icon: '🤖' },
  { id: 'scenes',   label: '场景 Agent',  icon: '⚡' },
  { id: 'datasrc',  label: 'KM 数据源',  icon: '🗂️' },
] as const
type SettingsTab = (typeof SETTINGS_TABS)[number]['id']

/* ══════════ 共享 AI 配置 ══════════ */
function SharedAiCard() {
  const [cfg, setCfg]       = useState<SharedConfig>({})
  const [saved, setSaved]   = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [revealKey, setRevealKey] = useState(false)

  useEffect(() => {
    fetch('/api/settings/ai').then((r) => r.json()).then((d) => {
      if (d) setCfg({ echo_api_key: '', echo_base_url: 'http://10.236.134.33:8006', model: 'gpt-5.4', ...d })
    }).catch(() => {})
  }, [])

  const save = async () => {
    await apiPost('/api/settings/ai', cfg)
    setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  const test = async () => {
    setTesting(true); setTestResult(null)
    try {
      const res  = await fetch('/api/test-echo-agent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: cfg.echo_api_key, base_url: cfg.echo_base_url ?? 'http://10.236.134.33:8006' })
      })
      const d = await res.json()
      setTestResult({ ok: d.ok, msg: d.ok ? d.message ?? '连接成功' : d.error ?? '连接失败' })
    } catch (e: any) { setTestResult({ ok: false, msg: String(e.message ?? e) })
    } finally { setTesting(false) }
  }

  return (
    <Card title="共享连接 · Echo Agent">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-5)' }}>
        <Field label="Echo API Key" hint="供各模块复用，未单独配置的模块会使用此 Key">
          <div style={{ display: 'flex', gap: 'var(--s-3)' }}>
            <input className="field-input" type={revealKey ? 'text' : 'password'} style={{ flex: 1 }}
              placeholder="填写 Echo 使用指南里的 User Key / Agent Key"
              value={cfg.echo_api_key ?? ''} onChange={(e) => setCfg((c) => ({ ...c, echo_api_key: e.target.value }))} />
            <button className="ghost-btn small" onClick={() => setRevealKey((r) => !r)}>{revealKey ? '隐藏' : '显示'}</button>
          </div>
        </Field>
        <Field label="Echo Base URL（已固定）">
          <input className="field-input" value="http://10.236.134.33:8006" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }} />
        </Field>

        <details style={{ border: '0.5px solid var(--border-subtle)', borderRadius: 'var(--r-8)', padding: 'var(--s-4) var(--s-5)' }}>
          <summary style={{ fontSize: 'var(--fs-12)', color: 'var(--text-tertiary)', cursor: 'pointer', userSelect: 'none' }}>兼容旧版：模型直连配置（通常无需填写）</summary>
          <div style={{ marginTop: 'var(--s-4)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s-4)' }}>
            <Field label="模型">
              <select className="field-input" value={cfg.model ?? 'gpt-5.4'} onChange={(e) => setCfg((c) => ({ ...c, model: e.target.value }))}>
                {MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="API Key">
              <input className="field-input" type="password" value={cfg.api_key ?? ''} placeholder="仅旧版直连时使用"
                onChange={(e) => setCfg((c) => ({ ...c, api_key: e.target.value }))} />
            </Field>
            <Field label="Max Tokens">
              <input className="field-input" type="number" value={cfg.max_tokens ?? 2048}
                onChange={(e) => setCfg((c) => ({ ...c, max_tokens: +e.target.value }))} />
            </Field>
            <Field label="Temperature">
              <input className="field-input" type="number" step="0.1" min="0" max="2" value={cfg.temperature ?? 0.3}
                onChange={(e) => setCfg((c) => ({ ...c, temperature: +e.target.value }))} />
            </Field>
          </div>
        </details>

        <div style={{ display: 'flex', gap: 'var(--s-3)', alignItems: 'center' }}>
          {testResult && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)', fontSize: 'var(--fs-12)', color: testResult.ok ? 'var(--c-green-500)' : 'var(--c-red-500)' }}>
              <StatusDot ok={testResult.ok} />{testResult.msg}
            </span>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--s-3)' }}>
            <button className="ghost-btn small" onClick={test} disabled={testing}>
              {testing ? <><span className="spinner" style={{ marginRight: 4 }} />测试中</> : '测试连接'}
            </button>
            <button className="primary-btn small" onClick={save}>
              {saved ? '✓ 已保存' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </Card>
  )
}

/* ══════════ 场景 Agent 配置 ══════════ */
function SceneAgentCard({ sceneKey }: { sceneKey: string }) {
  const meta = SCENE_CATALOG[sceneKey]!
  const [cfg, setCfg]         = useState<SceneConfig>({ scene_key: sceneKey })
  const [expanded, setExpanded] = useState(false)
  const [saved, setSaved]     = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)

  useEffect(() => {
    fetch(`/api/settings/ai/scenes?scene_key=${sceneKey}`).then((r) => r.json()).then((d) => {
      if (d.scene) setCfg((c) => ({ ...c, ...d.scene }))
    }).catch(() => {})
  }, [sceneKey])

  const save = async () => {
    await apiPost('/api/settings/ai/scenes', { scene_key: sceneKey, agent_name: cfg.agent_name, echo_agent_id: cfg.echo_agent_id, echo_api_key: cfg.echo_api_key, connection_scope: cfg.connection_scope })
    setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  const test = async () => {
    setTesting(true); setTestResult(null)
    try {
      const res = await fetch('/api/test-echo-agent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: cfg.echo_agent_id, api_key: cfg.echo_api_key, base_url: 'http://10.236.134.33:8006', scene_key: sceneKey })
      })
      const d = await res.json()
      setTestResult({ ok: d.ok, msg: d.ok ? d.message ?? '连接成功' : d.error ?? '连接失败' })
    } catch (e: any) { setTestResult({ ok: false, msg: String(e.message ?? e) })
    } finally { setTesting(false) }
  }

  const isBound = !!cfg.echo_agent_id

  return (
    <div style={{ border: '0.5px solid var(--border-default)', borderRadius: 'var(--r-10)', overflow: 'hidden' }}>
      {/* 头部 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-4)', padding: 'var(--s-4) var(--s-5)', cursor: 'pointer', background: expanded ? 'var(--c-neutral-50)' : 'transparent', transition: 'background 0.15s' }}
        onClick={() => setExpanded((e) => !e)}>
        <StatusDot ok={isBound} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 'var(--fs-13)', fontWeight: 'var(--fw-medium)', color: 'var(--text-primary)' }}>{meta.title}</p>
          <p style={{ margin: '1px 0 0', fontSize: 'var(--fs-11)', color: 'var(--text-tertiary)' }}>
            {meta.pageLabel} · {isBound ? <span style={{ color: 'var(--c-green-500)' }}>已绑定 {cfg.echo_agent_id}</span> : '未配置'}
          </p>
        </div>
        <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-12)', flexShrink: 0 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div style={{ padding: 'var(--s-5)', borderTop: '0.5px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 'var(--s-4)' }}>
          <p style={{ margin: 0, fontSize: 'var(--fs-12)', color: 'var(--text-tertiary)', lineHeight: 'var(--lh-snug)' }}>{meta.summary}</p>

          <Field label="EchoAgent ID" hint="最常用配置：填写 Agent ID，复用共享连接里的 Echo API Key">
            <div style={{ display: 'flex', gap: 'var(--s-3)' }}>
              <input className="field-input" style={{ flex: 1 }} placeholder="agent_xxxxxxxx"
                value={cfg.echo_agent_id ?? ''} onChange={(e) => setCfg((c) => ({ ...c, echo_agent_id: e.target.value }))} />
              <button className="ghost-btn small" onClick={save}>绑定</button>
            </div>
          </Field>

          <details style={{ border: '0.5px solid var(--border-subtle)', borderRadius: 'var(--r-6)', padding: 'var(--s-3) var(--s-4)' }}>
            <summary style={{ fontSize: 'var(--fs-12)', color: 'var(--text-quaternary)', cursor: 'pointer' }}>高级配置（可选）</summary>
            <div style={{ marginTop: 'var(--s-3)', display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' }}>
              <Field label="Agent 名称">
                <input className="field-input" value={cfg.agent_name ?? ''} placeholder={meta.title}
                  onChange={(e) => setCfg((c) => ({ ...c, agent_name: e.target.value }))} />
              </Field>
              <Field label="连接策略">
                <select className="field-input" value={cfg.connection_scope ?? 'shared'} onChange={(e) => setCfg((c) => ({ ...c, connection_scope: e.target.value }))}>
                  <option value="shared">复用共享连接（推荐）</option>
                  <option value="custom">本模块独立连接</option>
                </select>
              </Field>
              {cfg.connection_scope === 'custom' && (
                <Field label="本模块 Echo API Key">
                  <input className="field-input" type="password" value={cfg.echo_api_key ?? ''} placeholder="留空则复用共享连接"
                    onChange={(e) => setCfg((c) => ({ ...c, echo_api_key: e.target.value }))} />
                </Field>
              )}
            </div>
          </details>

          <div style={{ display: 'flex', gap: 'var(--s-3)', alignItems: 'center' }}>
            {testResult && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)', fontSize: 'var(--fs-12)', color: testResult.ok ? 'var(--c-green-500)' : 'var(--c-red-500)' }}>
                <StatusDot ok={testResult.ok} />{testResult.msg}
              </span>
            )}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--s-3)' }}>
              <button className="ghost-btn small" onClick={test} disabled={testing || !cfg.echo_agent_id}>
                {testing ? <><span className="spinner" style={{ marginRight: 4 }} />测试中</> : '测试连接'}
              </button>
              <button className="ghost-btn small" onClick={save}>{saved ? '✓ 已保存' : '保存高级配置'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ══════════ KM 数据源 ══════════ */
function DataSourceCard() {
  const [sources, setSources] = useState<DataSource[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm]       = useState({ name: '', km_url: '', doc_type: '', note: '' })
  const [binding, setBinding] = useState(false)
  const [progress, setProgress] = useState('')

  const load = useCallback(async () => {
    const res  = await fetch('/api/monitor/datasources')
    const data = await res.json()
    if (data.ok) setSources(data.datasources ?? [])
  }, [])
  useEffect(() => { load() }, [load])

  const add = async () => {
    if (!form.name.trim() || !form.km_url.trim()) return
    setBinding(true); setProgress('连接 KM 中…')
    try {
      // 提取 doc_id
      const match = form.km_url.match(/\/doc\/([a-z0-9]+)/)
      const docId = match ? match[1] : form.km_url.trim()
      const res   = await fetch('/api/monitor/datasources', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, doc_id: docId, doc_type: form.doc_type, note: form.note })
      })
      const data = await res.json()
      if (data.ok) {
        setProgress('同步成功'); await load()
        setShowAdd(false); setForm({ name: '', km_url: '', doc_type: '', note: '' })
      } else { setProgress(data.error ?? '绑定失败') }
    } finally { setBinding(false); setTimeout(() => setProgress(''), 3000) }
  }

  const del = async (id: number | string) => {
    if (!confirm('确认移除该数据源？')) return
    await fetch(`/api/monitor/datasources/${id}`, { method: 'DELETE' })
    await load()
  }

  return (
    <Card title="KM 数据源" action={<button className="ghost-btn small" onClick={() => setShowAdd((s) => !s)}>＋ 添加</button>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-4)' }}>
        {showAdd && (
          <div style={{ border: '0.5px solid var(--border-default)', borderRadius: 'var(--r-8)', padding: 'var(--s-5)', display: 'flex', flexDirection: 'column', gap: 'var(--s-4)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s-4)' }}>
              <Field label="数据源名称 *">
                <input className="field-input" placeholder="如：版本数据表" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </Field>
              <Field label="数据类型">
                <input className="field-input" placeholder="如：DAU数据、Banner指标" value={form.doc_type} onChange={(e) => setForm((f) => ({ ...f, doc_type: e.target.value }))} />
              </Field>
              <div style={{ gridColumn: '1 / -1' }}>
                <Field label="KM 文档链接 *">
                  <input className="field-input" placeholder="https://km.mihoyo.com/doc/…" value={form.km_url} onChange={(e) => setForm((f) => ({ ...f, km_url: e.target.value }))} />
                </Field>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <Field label="备注">
                  <input className="field-input" placeholder="（选填）" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
                </Field>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--s-3)', alignItems: 'center', justifyContent: 'flex-end' }}>
              {progress && <span style={{ fontSize: 'var(--fs-12)', color: 'var(--text-tertiary)' }}>{progress}</span>}
              <button className="ghost-btn small" onClick={() => setShowAdd(false)}>取消</button>
              <button className="primary-btn small" onClick={add} disabled={binding || !form.name.trim() || !form.km_url.trim()}>
                {binding ? <><span className="spinner" style={{ marginRight: 4 }} />绑定中</> : '确认绑定'}
              </button>
            </div>
          </div>
        )}

        {!sources.length ? (
          <div style={{ padding: 'var(--s-8)', textAlign: 'center', color: 'var(--text-quaternary)', fontSize: 'var(--fs-13)' }}>
            尚未添加数据源，分析时将无真实数据可用
          </div>
        ) : sources.map((s) => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-4)', padding: 'var(--s-4) var(--s-5)', borderRadius: 'var(--r-8)', background: 'var(--c-neutral-50)', border: '0.5px solid var(--border-subtle)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: 'var(--fw-medium)', fontSize: 'var(--fs-13)', color: 'var(--text-primary)' }}>{s.name}</p>
              <p style={{ margin: '2px 0 0', fontSize: 'var(--fs-11)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.doc_id}{s.doc_type ? ` · ${s.doc_type}` : ''}{s.note ? ` · ${s.note}` : ''}
              </p>
            </div>
            <a href={`https://km.mihoyo.com/doc/${s.doc_id}`} target="_blank" rel="noreferrer">
              <button className="ghost-btn small">打开</button>
            </a>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--fs-12)', color: 'var(--c-red-500)', padding: '5px 8px' }} onClick={() => del(s.id)}>移除</button>
          </div>
        ))}
      </div>
    </Card>
  )
}

/* ══════════ 主视图 ══════════ */
export default function SettingsView() {
  const [tab, setTab] = useState<SettingsTab>('ai')
  return (
    <div style={{ padding: 'var(--s-8) var(--s-9)', display: 'flex', flexDirection: 'column', gap: 'var(--s-7)', maxWidth: 900, margin: '0 auto' }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 'var(--fs-22)', fontWeight: 'var(--fw-semi)', color: 'var(--text-primary)' }}>系统管理</h1>
        <p style={{ margin: '4px 0 0', fontSize: 'var(--fs-13)', color: 'var(--text-tertiary)' }}>AI 连接配置、场景 Agent 绑定、KM 数据源管理</p>
      </div>

      <div className="view-tabs">
        {SETTINGS_TABS.map(({ id, label, icon }) => (
          <button key={id} className={`view-tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
            <span className="view-tab-icon">{icon}</span>{label}
          </button>
        ))}
      </div>

      {tab === 'ai' && <SharedAiCard />}

      {tab === 'scenes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' }}>
          <p style={{ margin: 0, fontSize: 'var(--fs-13)', color: 'var(--text-tertiary)' }}>
            为每个业务模块绑定专属 Echo Agent ID，未绑定的模块自动复用共享连接。
          </p>
          {Object.keys(SCENE_CATALOG).map((key) => <SceneAgentCard key={key} sceneKey={key} />)}
        </div>
      )}

      {tab === 'datasrc' && <DataSourceCard />}
    </div>
  )
}
