// 创作工程师 — 迁移自 events.js craft-engineer 模块 + gd/feasibility-reports API
import { useCallback, useEffect, useState } from 'react'
import { Markdown } from '../components/Markdown'

interface FeasibilityReport { id: number; level_name: string; plan_doc_url?: string; status: string; report_content?: string; score?: number; created_at?: string }

const SCORE_COLOR = (s?: number) =>
  s == null ? 'var(--text-quaternary)' : s >= 80 ? 'var(--c-green-500)' : s >= 50 ? 'var(--c-orange-500)' : 'var(--c-red-500)'

const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{ background: 'var(--surface-elevated)', borderRadius: 'var(--r-12)', border: '0.5px solid var(--border-default)', boxShadow: 'var(--shadow-1)', ...style }}>
    {children}
  </div>
)

const EDITOR_MODULES = [
  { name: '节点图', score: 8.2, trend: '+0.3', ok: true },
  { name: '技能',   score: 7.9, trend: '+0.1', ok: true },
  { name: '角色',   score: 7.5, trend: '0',    ok: true },
  { name: '组件',   score: 8.3, trend: '+0.2', ok: true },
  { name: '怪物',   score: 7.2, trend: '0',    ok: true },
  { name: '相机',   score: 6.5, trend: '-0.1', ok: false },
  { name: '性能',   score: 6.1, trend: '0',    ok: false },
  { name: '调试',   score: 8.0, trend: '+0.1', ok: true },
]

const CE_KPIS = [
  { label: '累计答疑工单', val: '3,847', trend: '本月 +312', icon: '📋' },
  { label: '服务创作者人次', val: '1,204', trend: '本月 +87', icon: '👤' },
  { label: '累计生成 .gia 文件', val: '639', trend: '本月 +58', icon: '📄' },
  { label: '问题解决率', val: '91.3%', trend: '已解决 3,510/3,847', icon: '✓' },
]

export default function CraftEngineer() {
  const [reports, setReports]   = useState<FeasibilityReport[]>([])
  const [loading, setLoading]   = useState(true)
  const [form, setForm]         = useState({ level_name: '', plan_doc_url: '', plan_content: '' })
  const [submitting, setSubmitting] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [polling, setPolling]   = useState<Record<number, boolean>>({})

  const load = useCallback(async () => {
    try { const r = await fetch('/api/gd/feasibility-reports'); const d = await r.json(); if (d.ok) setReports(d.reports ?? []) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const submit = async () => {
    if (!form.level_name.trim()) return
    setSubmitting(true)
    try {
      const r  = await fetch('/api/gd/feasibility-reports', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const d = await r.json()
      if (d.ok) {
        setForm({ level_name: '', plan_doc_url: '', plan_content: '' })
        await load()
        // 自动轮询新生成的报告
        const id = d.id
        setPolling((p) => ({ ...p, [id]: true }))
        for (let i = 0; i < 72; i++) {
          await new Promise((r) => setTimeout(r, 5000))
          const pd = await (await fetch(`/api/gd/status?table=gd_feasibility_reports&id=${id}`)).json()
          if (pd.ok && pd.status !== 'pending') { await load(); break }
        }
        setPolling((p) => { const n = { ...p }; delete n[id]; return n })
      }
    } finally { setSubmitting(false) }
  }

  return (
    <div style={{ padding: 'var(--s-8) var(--s-9)', display: 'flex', flexDirection: 'column', gap: 'var(--s-7)', maxWidth: 1080, margin: '0 auto' }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 'var(--fs-22)', fontWeight: 'var(--fw-semi)', color: 'var(--text-primary)' }}>创作工程师</h1>
        <p style={{ margin: '4px 0 0', fontSize: 'var(--fs-13)', color: 'var(--text-tertiary)' }}>编辑器满意度 · 答疑数据 · GIA 可行性评估</p>
      </div>

      {/* 编辑器满意度 */}
      <Card style={{ padding: 'var(--s-6)' }}>
        <p style={{ margin: '0 0 var(--s-5)', fontSize: 'var(--fs-14)', fontWeight: 'var(--fw-semi)', color: 'var(--text-primary)' }}>编辑器满意度 · 月之六版本</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--s-4)', marginBottom: 'var(--s-5)' }}>
          {[{ label: '整体 NPS', val: '7.2', max: 10, pct: 72, ok: true }, { label: '易用性', val: '4.2', max: 5, pct: 84, ok: true }, { label: '满足度', val: '3.9', max: 5, pct: 78, ok: false }].map(({ label, val, max, pct, ok }) => (
            <div key={label} style={{ background: 'var(--c-neutral-50)', borderRadius: 'var(--r-8)', padding: 'var(--s-4)', border: '0.5px solid var(--border-subtle)' }}>
              <p style={{ margin: '0 0 var(--s-2)', fontSize: 'var(--fs-12)', color: 'var(--text-tertiary)' }}>{label}</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 'var(--s-3)' }}>
                <span style={{ fontSize: 'var(--fs-26)', fontWeight: 'var(--fw-bold)', color: ok ? 'var(--c-green-500)' : 'var(--c-orange-500)', fontFamily: 'var(--font-mono)' }}>{val}</span>
                <span style={{ fontSize: 'var(--fs-12)', color: 'var(--text-quaternary)' }}>/ {max}</span>
              </div>
              <div style={{ height: 4, borderRadius: 2, background: 'var(--c-neutral-200)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: ok ? 'var(--c-green-500)' : 'var(--c-orange-500)', borderRadius: 2 }} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--s-3)' }}>
          {EDITOR_MODULES.map(({ name, score, trend, ok }) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-3)', padding: 'var(--s-3) var(--s-4)', borderRadius: 'var(--r-6)', background: 'var(--c-neutral-50)', border: '0.5px solid var(--border-subtle)' }}>
              <span style={{ flex: 1, fontSize: 'var(--fs-12)', color: 'var(--text-secondary)' }}>{name}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-13)', fontWeight: 'var(--fw-bold)', color: ok ? 'var(--text-primary)' : 'var(--c-orange-500)' }}>{score}</span>
              <span style={{ fontSize: 10, color: trend.startsWith('+') ? 'var(--c-green-500)' : trend.startsWith('-') ? 'var(--c-red-500)' : 'var(--text-quaternary)' }}>{trend}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* 答疑数据 KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--s-4)' }}>
        {CE_KPIS.map(({ label, val, trend, icon }) => (
          <Card key={label} style={{ padding: 'var(--s-5)', textAlign: 'center' }}>
            <p style={{ margin: '0 0 var(--s-2)', fontSize: 20 }}>{icon}</p>
            <p style={{ margin: 0, fontSize: 'var(--fs-22)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{val}</p>
            <p style={{ margin: 'var(--s-2) 0 var(--s-1)', fontSize: 'var(--fs-12)', color: 'var(--text-secondary)' }}>{label}</p>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--c-green-500)' }}>{trend}</p>
          </Card>
        ))}
      </div>

      {/* GIA 可行性评估 */}
      <div>
        <h2 style={{ margin: '0 0 var(--s-5)', fontSize: 'var(--fs-16)', fontWeight: 'var(--fw-semi)', color: 'var(--text-primary)' }}>GIA 可行性评估</h2>
        <Card style={{ padding: 'var(--s-5)', marginBottom: 'var(--s-5)' }}>
          <p style={{ margin: '0 0 var(--s-4)', fontSize: 'var(--fs-13)', fontWeight: 'var(--fw-semi)', color: 'var(--text-primary)' }}>提交新评估</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s-4)' }}>
            <div className="form-row"><label>关卡名称 *</label><input value={form.level_name} onChange={(e) => setForm((f) => ({ ...f, level_name: e.target.value }))} placeholder="填写待评估的关卡名称" /></div>
            <div className="form-row"><label>策划案 KM 链接</label><input value={form.plan_doc_url} onChange={(e) => setForm((f) => ({ ...f, plan_doc_url: e.target.value }))} placeholder="https://km.mihoyo.com/doc/…" /></div>
            <div className="form-row" style={{ gridColumn: '1/-1' }}>
              <label>策划案内容摘要（可选，粘贴关键内容加速评估）</label>
              <textarea className="field-input" rows={4} value={form.plan_content} onChange={(e) => setForm((f) => ({ ...f, plan_content: e.target.value }))} placeholder="粘贴策划案核心玩法描述…" />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--s-4)' }}>
            <button className="primary-btn" onClick={submit} disabled={submitting || !form.level_name.trim()}>
              {submitting ? <><span className="spinner" style={{ marginRight: 6 }} />评估中…</> : '提交评估'}
            </button>
          </div>
        </Card>

        {loading ? (
          <div style={{ padding: 'var(--s-12)', textAlign: 'center' }}><span className="spinner" /></div>
        ) : !reports.length ? (
          <div style={{ padding: 'var(--s-12)', textAlign: 'center', color: 'var(--text-quaternary)', fontSize: 'var(--fs-13)' }}>暂无评估报告</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' }}>
            {reports.map((r) => {
              const sc = SCORE_COLOR(r.score)
              const isPolling = polling[r.id]
              return (
                <Card key={r.id} style={{ overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-4)', padding: 'var(--s-4) var(--s-5)', cursor: 'pointer' }} onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-3)', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 'var(--fw-medium)', fontSize: 'var(--fs-13)', color: 'var(--text-primary)' }}>{r.level_name}</span>
                        <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 'var(--r-4)', background: r.status === 'done' ? 'var(--c-green-100)' : r.status === 'pending' ? 'var(--c-orange-100)' : 'var(--c-red-100)', color: r.status === 'done' ? 'var(--c-green-500)' : r.status === 'pending' ? 'var(--c-orange-500)' : 'var(--c-red-500)' }}>
                          {isPolling ? '评估中…' : r.status === 'done' ? '已完成' : r.status === 'pending' ? '排队中' : '失败'}
                        </span>
                        {isPolling && <span className="spinner" style={{ width: 12, height: 12 }} />}
                      </div>
                      {r.plan_doc_url && <a href={r.plan_doc_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--c-blue-500)', textDecoration: 'none' }}>{r.plan_doc_url.slice(0, 50)}…</a>}
                    </div>
                    {r.score != null && <span style={{ fontSize: 'var(--fs-19)', fontWeight: 'var(--fw-bold)', color: sc, fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{r.score}</span>}
                    <span style={{ fontSize: 10, color: 'var(--text-quaternary)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{(r.created_at ?? '').slice(0, 10)}</span>
                    <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{expanded === r.id ? '▲' : '▼'}</span>
                  </div>
                  {expanded === r.id && r.report_content && (
                    <div style={{ padding: 'var(--s-4) var(--s-6) var(--s-5)', borderTop: '0.5px solid var(--border-subtle)' }}>
                      <Markdown source={r.report_content} />
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
