// 玩法设计师 — 迁移自 gameplay-designer.js + level-content-strategy.js
import { useCallback, useEffect, useState } from 'react'
import { Markdown } from '../components/Markdown'
import { apiPost } from '../api/client'

/* ── 类型 ── */
interface StrategyItem { id: number; title: string; created_at?: string; raw_result?: string }
interface ResearchReport { id: number; game_name: string; basic_info?: string; core_exp?: string; status: string; full_report?: string; cover_url?: string; created_at?: string }
interface Template { id: number; title: string; content?: string; created_at?: string }
interface DesignDoc { id: number; title: string; km_url?: string; note?: string; created_at?: string }

const TABS = [
  { id: 'strategy', label: '关卡策略' },
  { id: 'research', label: '玩法调研' },
  { id: 'templates', label: '策划模板' },
  { id: 'designdocs', label: '设计文档' },
] as const
type Tab = (typeof TABS)[number]['id']

const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{ background: 'var(--surface-elevated)', borderRadius: 'var(--r-12)', border: '0.5px solid var(--border-default)', boxShadow: 'var(--shadow-1)', ...style }}>
    {children}
  </div>
)

/* ═══ 关卡策略 ═══ */
function StrategyTab() {
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [result, setResult]   = useState('')
  const [history, setHistory] = useState<StrategyItem[]>([])
  const [expanded, setExpanded] = useState<number | null>(null)

  const loadHistory = useCallback(async () => {
    const r = await fetch('/api/gd/strategy-results')
    const d = await r.json()
    if (d.ok) setHistory(d.results ?? [])
  }, [])
  useEffect(() => { loadHistory() }, [loadHistory])

  const run = async () => {
    setRunning(true); setElapsed(0); setResult('')
    const timer = setInterval(() => setElapsed((n) => n + 1), 1000)
    try {
      const cfgR = await fetch('/api/settings/ai/scenes?scene_key=monitor')
      const cfgD = await cfgR.json()
      const agentId = cfgD.merged?.echo_agent_id
      if (!agentId) throw new Error('未配置 Echo Agent，请先在「系统管理 → 场景 Agent」中绑定玩法设计师')

      let levelData = '（暂无关卡数据）'
      try {
        const km = await fetch('/api/km/doc-content?doc_id=mh100lr6j4ke')
        const kd = await km.json()
        if (kd.ok && kd.content) levelData = kd.content.trim().slice(0, 3000)
      } catch {}

      const prompt = `你是千星奇域 UGC 平台的玩法策略顾问。请综合以下信号，产出两类关卡操作策略建议：

【信号1 — 关卡数据】${levelData}

【信号2 — 舆情与外部热点（请自行搜索最新信息）】请主动搜索：当前热门 UGC 游戏玩法趋势（Roblox/蛋仔派对/绿洲启元）、当前热门游戏话题、千星奇域玩家社区近期反馈。

每类输出至少3条：

## 线上关卡优化策略
格式：**[策略标题]** — 具体操作建议；依据：[来源]；优先级：P0/P1/P2

## 玩法立项参考策略
格式：**[策略标题]** — 具体创作方向；灵感来源：[参考]；机会判断：[信号]`

      const res = await fetch('/api/dashboard/chat/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: agentId, message: prompt, reasoning_effort: 'medium' })
      })
      const sub = await res.json()
      if (!sub.ok) throw new Error(sub.error || '提交失败')

      let answer = ''
      for (let i = 0; i < 200; i++) {
        await new Promise((r) => setTimeout(r, 5000))
        const poll = await fetch(`/api/dashboard/chat/status/${sub.session_id}`)
        const pd   = await poll.json()
        if (pd.status === 'completed') { answer = pd.answer ?? ''; break }
        if (pd.status === 'failed') throw new Error(pd.error || '分析失败')
      }
      setResult(answer)
      // 保存到知识库
      await fetch('/api/gd/strategy-results', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: new Date().toLocaleDateString('zh-CN') + ' 关卡策略分析', raw_result: answer })
      })
      await loadHistory()
    } catch (e: any) { setResult('❌ ' + (e.message ?? '分析失败')) }
    finally { clearInterval(timer); setRunning(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-6)' }}>
      {/* 操作栏 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-4)' }}>
        <button className="primary-btn" onClick={run} disabled={running}>
          {running ? <><span className="spinner" style={{ marginRight: 6 }} />分析中… {elapsed}s</> : '▶ 运行策略分析'}
        </button>
        <span style={{ fontSize: 'var(--fs-12)', color: 'var(--text-tertiary)' }}>由 Agent 综合关卡数据 + 网络热点生成</span>
      </div>
      {/* 当前结果 */}
      {result && (
        <Card style={{ padding: 'var(--s-6)' }}>
          <Markdown source={result} />
        </Card>
      )}
      {/* 历史列表 */}
      {history.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' }}>
          <p style={{ margin: 0, fontSize: 'var(--fs-12)', color: 'var(--text-tertiary)', fontWeight: 'var(--fw-semi)' }}>历史分析记录</p>
          {history.map((h) => (
            <Card key={h.id} style={{ overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-4)', padding: 'var(--s-4) var(--s-5)', cursor: 'pointer' }} onClick={() => setExpanded(expanded === h.id ? null : h.id)}>
                <span style={{ flex: 1, fontSize: 'var(--fs-13)', color: 'var(--text-primary)' }}>{h.title}</span>
                <span style={{ fontSize: 11, color: 'var(--text-quaternary)', fontFamily: 'var(--font-mono)' }}>{(h.created_at ?? '').slice(0, 10)}</span>
                <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{expanded === h.id ? '▲' : '▼'}</span>
              </div>
              {expanded === h.id && h.raw_result && (
                <div style={{ padding: 'var(--s-4) var(--s-6) var(--s-5)', borderTop: '0.5px solid var(--border-subtle)' }}>
                  <Markdown source={h.raw_result} />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

/* ═══ 玩法调研 ═══ */
function ResearchTab() {
  const [list, setList]       = useState<ResearchReport[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm]       = useState({ game_name: '', platform: '', km_url: '' })
  const [creating, setCreating] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/gd/gameplay-reports')
      const d = await r.json()
      if (d.ok) setList(d.reports ?? [])
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const create = async () => {
    if (!form.game_name.trim()) return
    setCreating(true)
    try {
      await fetch('/api/gd/gameplay-reports', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      setForm({ game_name: '', platform: '', km_url: '' })
      await load()
    } finally { setCreating(false) }
  }

  if (loading) return <div style={{ padding: 'var(--s-12)', textAlign: 'center' }}><span className="spinner" /></div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-6)' }}>
      <Card style={{ padding: 'var(--s-5)' }}>
        <p style={{ margin: '0 0 var(--s-4)', fontSize: 'var(--fs-13)', fontWeight: 'var(--fw-semi)', color: 'var(--text-primary)' }}>添加新调研</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s-4)' }}>
          <div className="form-row"><label>游戏名称 *</label><input value={form.game_name} onChange={(e) => setForm((f) => ({ ...f, game_name: e.target.value }))} placeholder="如：Roblox Doors" /></div>
          <div className="form-row"><label>平台</label><input value={form.platform} onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))} placeholder="Roblox / 蛋仔派对…" /></div>
          <div className="form-row" style={{ gridColumn: '1/-1' }}><label>KM 文档链接</label><input value={form.km_url} onChange={(e) => setForm((f) => ({ ...f, km_url: e.target.value }))} placeholder="https://km.mihoyo.com/doc/…" /></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--s-4)' }}>
          <button className="primary-btn" onClick={create} disabled={creating || !form.game_name.trim()}>
            {creating ? <><span className="spinner" style={{ marginRight: 6 }} />生成报告中…</> : '生成调研报告'}
          </button>
        </div>
      </Card>

      {!list.length ? (
        <div style={{ padding: 'var(--s-12)', textAlign: 'center', color: 'var(--text-quaternary)', fontSize: 'var(--fs-13)' }}>暂无调研报告</div>
      ) : list.map((r) => (
        <Card key={r.id} style={{ overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-4)', padding: 'var(--s-4) var(--s-5)', cursor: 'pointer' }} onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--r-8)', background: 'var(--accent-tint-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'var(--fw-bold)', fontSize: 'var(--fs-14)', color: 'var(--accent-base)', flexShrink: 0 }}>{r.game_name.slice(0, 1)}</div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontWeight: 'var(--fw-medium)', fontSize: 'var(--fs-13)', color: 'var(--text-primary)' }}>{r.game_name}</p>
              <p style={{ margin: 0, fontSize: 'var(--fs-11)', color: 'var(--text-tertiary)' }}>{r.basic_info || (r.status === 'pending' ? '生成中…' : '暂无摘要')}</p>
            </div>
            <span style={{ fontSize: r.status === 'done' ? 11 : 11, padding: '2px 8px', borderRadius: 'var(--r-4)', background: r.status === 'done' ? 'var(--c-green-100)' : r.status === 'pending' ? 'var(--c-orange-100)' : 'var(--c-red-100)', color: r.status === 'done' ? 'var(--c-green-500)' : r.status === 'pending' ? 'var(--c-orange-500)' : 'var(--c-red-500)' }}>
              {r.status === 'done' ? '已完成' : r.status === 'pending' ? '生成中' : '失败'}
            </span>
            <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{expanded === r.id ? '▲' : '▼'}</span>
          </div>
          {expanded === r.id && (
            <div style={{ padding: 'var(--s-4) var(--s-6) var(--s-5)', borderTop: '0.5px solid var(--border-subtle)' }}>
              {r.core_exp && <p style={{ margin: '0 0 var(--s-4)', fontSize: 'var(--fs-13)', color: 'var(--text-secondary)' }}>核心体验：{r.core_exp}</p>}
              {r.full_report && <Markdown source={r.full_report} />}
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}

/* ═══ 策划模板 ═══ */
function TemplatesTab() {
  const [list, setList]   = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm]   = useState({ title: '', content: '' })
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)

  const load = useCallback(async () => {
    try { const r = await fetch('/api/gd/plan-templates'); const d = await r.json(); if (d.ok) setList(d.templates ?? []) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    try { await fetch('/api/gd/plan-templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }); setForm({ title: '', content: '' }); await load() }
    finally { setSaving(false) }
  }
  const del = async (id: number) => { if (!confirm('确认删除？')) return; await fetch(`/api/gd/plan-templates/${id}`, { method: 'DELETE' }); await load() }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-5)' }}>
      <Card style={{ padding: 'var(--s-5)' }}>
        <div className="form-row" style={{ marginBottom: 'var(--s-4)' }}><label>模板标题 *</label><input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="如：竞技跑酷关卡策划案模板" /></div>
        <div className="form-row" style={{ marginBottom: 'var(--s-4)' }}>
          <label>模板内容（Markdown）</label>
          <textarea className="field-input" rows={8} style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)' }} value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} placeholder="## 关卡概述&#10;## 核心玩法&#10;## 关卡节奏…" />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="primary-btn" onClick={save} disabled={saving || !form.title.trim()}>{saving ? <><span className="spinner" style={{ marginRight: 6 }} />保存中</> : '保存模板'}</button>
        </div>
      </Card>
      {loading ? <div style={{ textAlign: 'center' }}><span className="spinner" /></div> : !list.length ? (
        <div style={{ padding: 'var(--s-12)', textAlign: 'center', color: 'var(--text-quaternary)', fontSize: 'var(--fs-13)' }}>暂无模板</div>
      ) : list.map((t) => (
        <Card key={t.id} style={{ overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-4)', padding: 'var(--s-4) var(--s-5)' }}>
            <span style={{ flex: 1, fontWeight: 'var(--fw-medium)', fontSize: 'var(--fs-13)', color: 'var(--text-primary)', cursor: 'pointer' }} onClick={() => setExpanded(expanded === t.id ? null : t.id)}>{t.title}</span>
            <span style={{ fontSize: 10, color: 'var(--text-quaternary)', fontFamily: 'var(--font-mono)' }}>{(t.created_at ?? '').slice(0, 10)}</span>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-red-500)', fontSize: 12, padding: '4px 8px' }} onClick={() => del(t.id)}>删除</button>
          </div>
          {expanded === t.id && t.content && (
            <div style={{ padding: '0 var(--s-6) var(--s-5)', borderTop: '0.5px solid var(--border-subtle)', paddingTop: 'var(--s-4)' }}>
              <Markdown source={t.content} />
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}

/* ═══ 设计文档 ═══ */
function DesignDocsTab() {
  const [list, setList]   = useState<DesignDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm]   = useState({ title: '', km_url: '', note: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try { const r = await fetch('/api/gd/design-docs'); const d = await r.json(); if (d.ok) setList(d.docs ?? []) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    try { await fetch('/api/gd/design-docs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }); setForm({ title: '', km_url: '', note: '' }); await load() }
    finally { setSaving(false) }
  }
  const del = async (id: number) => { if (!confirm('确认删除？')) return; await fetch(`/api/gd/design-docs/${id}`, { method: 'DELETE' }); await load() }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-5)' }}>
      <Card style={{ padding: 'var(--s-5)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s-4)' }}>
          <div className="form-row" style={{ gridColumn: '1/-1' }}><label>文档标题 *</label><input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="如：月之六版本关卡设计规范" /></div>
          <div className="form-row"><label>KM 链接</label><input value={form.km_url} onChange={(e) => setForm((f) => ({ ...f, km_url: e.target.value }))} placeholder="https://km.mihoyo.com/doc/…" /></div>
          <div className="form-row"><label>备注</label><input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="（选填）" /></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--s-4)' }}>
          <button className="primary-btn" onClick={save} disabled={saving || !form.title.trim()}>{saving ? <><span className="spinner" style={{ marginRight: 6 }} />保存中</> : '添加文档'}</button>
        </div>
      </Card>
      {loading ? <div style={{ textAlign: 'center' }}><span className="spinner" /></div> : !list.length ? (
        <div style={{ padding: 'var(--s-12)', textAlign: 'center', color: 'var(--text-quaternary)', fontSize: 'var(--fs-13)' }}>暂无设计文档</div>
      ) : list.map((d) => (
        <Card key={d.id} style={{ padding: 'var(--s-4) var(--s-5)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-4)' }}>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontWeight: 'var(--fw-medium)', fontSize: 'var(--fs-13)', color: 'var(--text-primary)' }}>{d.title}</p>
              {d.note && <p style={{ margin: 0, fontSize: 'var(--fs-11)', color: 'var(--text-tertiary)' }}>{d.note}</p>}
            </div>
            {d.km_url && <a href={d.km_url} target="_blank" rel="noreferrer"><button className="ghost-btn small">打开 KM</button></a>}
            <span style={{ fontSize: 10, color: 'var(--text-quaternary)', fontFamily: 'var(--font-mono)' }}>{(d.created_at ?? '').slice(0, 10)}</span>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-red-500)', fontSize: 12, padding: '4px 8px' }} onClick={() => del(d.id)}>删除</button>
          </div>
        </Card>
      ))}
    </div>
  )
}

/* ═══ 主视图 ═══ */
export default function GameplayDesigner() {
  const [tab, setTab] = useState<Tab>('strategy')
  return (
    <div style={{ padding: 'var(--s-8) var(--s-9)', display: 'flex', flexDirection: 'column', gap: 'var(--s-7)', maxWidth: 1080, margin: '0 auto' }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 'var(--fs-22)', fontWeight: 'var(--fw-semi)', color: 'var(--text-primary)' }}>玩法设计师</h1>
        <p style={{ margin: '4px 0 0', fontSize: 'var(--fs-13)', color: 'var(--text-tertiary)' }}>关卡策略分析 · 玩法调研 · 策划模板 · 设计文档</p>
      </div>
      <div className="view-tabs">
        {TABS.map(({ id, label }) => (
          <button key={id} className={`view-tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      {tab === 'strategy'   && <StrategyTab />}
      {tab === 'research'   && <ResearchTab />}
      {tab === 'templates'  && <TemplatesTab />}
      {tab === 'designdocs' && <DesignDocsTab />}
    </div>
  )
}
