// 知识库视图 — 迁移自 events.js 知识库相关逻辑
// 严格只使用 index.css 设计令牌

import { useCallback, useEffect, useState } from 'react'
import { apiPost, apiDel } from '../api/client'

/* ══════════ 类型 ══════════ */
interface PlanDoc {
  id: number; level_name: string; version?: string
  km_url?: string; status?: string; note?: string
  analyze_status?: 'idle'|'pending'|'done'|'error'
  analyze_result?: string; created_at?: string
}

/* ══════════ 常量 ══════════ */
const KB_TABS = [
  { id: 'plan-docs',  label: '策划案库',      icon: '📄', desc: '关卡策划案 KM 文档，可一键 AI 分析' },
  { id: 'team',       label: '团队知识库',     icon: '📚', desc: '内部规范、产品文档、运营经验' },
  { id: 'editor',     label: '编辑器技术文档', icon: '⚙️', desc: 'GIA 节点能力、API 文档' },
  { id: 'gameplay',   label: '玩法设计库',     icon: '🎮', desc: '玩法原子库、历史案例' },
  { id: 'reports',    label: '近期数分报告',   icon: '📊', desc: '历史数分报告、经验卡片' },
] as const
type KbTab = (typeof KB_TABS)[number]['id']

/* ══════════ 公共组件 ══════════ */
const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{ background: 'var(--surface-elevated)', borderRadius: 'var(--r-12)', border: '0.5px solid var(--border-default)', boxShadow: 'var(--shadow-1)', ...style }}>
    {children}
  </div>
)

const EmptyState = ({ icon, text }: { icon: string; text: string }) => (
  <div style={{ padding: 'var(--s-12)', textAlign: 'center', color: 'var(--text-quaternary)' }}>
    <div style={{ fontSize: 32, marginBottom: 'var(--s-4)' }}>{icon}</div>
    <p style={{ margin: 0, fontSize: 'var(--fs-13)' }}>{text}</p>
  </div>
)

/* ══════════ 策划案库 ══════════ */
function PlanDocsTab() {
  const [docs, setDocs]       = useState<PlanDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm]       = useState({ level_name: '', version: '', km_url: '', status: '待评审', note: '' })
  const [saving, setSaving]   = useState(false)
  const [analyzing, setAnalyzing] = useState<Record<number, boolean>>({})

  const load = useCallback(async () => {
    try {
      const res  = await fetch('/api/knowledge/plan-docs')
      const data = await res.json()
      if (data.ok) setDocs(data.docs ?? [])
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!form.level_name.trim() || !form.km_url.trim()) return
    setSaving(true)
    try {
      await apiPost('/api/knowledge/plan-docs', form)
      setShowAdd(false); setForm({ level_name: '', version: '', km_url: '', status: '待评审', note: '' })
      await load()
    } finally { setSaving(false) }
  }

  const del = async (id: number) => {
    if (!confirm('确认删除该策划案？')) return
    await apiDel(`/api/knowledge/plan-docs/${id}`)
    await load()
  }

  const analyze = async (id: number) => {
    setAnalyzing((a) => ({ ...a, [id]: true }))
    try {
      await apiPost(`/api/knowledge/plan-docs/${id}/analyze`, {})
      // 轮询结果
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 5000))
        const res  = await fetch(`/api/knowledge/plan-docs/${id}/analyze-result`)
        const data = await res.json()
        if (data.ok && data.status !== 'pending') { await load(); break }
      }
    } finally { setAnalyzing((a) => ({ ...a, [id]: false })) }
  }

  const STATUS_COLOR: Record<string, string> = {
    '待评审': 'var(--c-orange-500)', '已评审': 'var(--c-green-500)',
    '已归档': 'var(--text-quaternary)', '草稿': 'var(--text-tertiary)',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-5)' }}>
      {/* 工具栏 */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="primary-btn" onClick={() => setShowAdd(true)}>＋ 添加策划案</button>
      </div>

      {/* 添加表单 */}
      {showAdd && (
        <Card style={{ padding: 'var(--s-6)' }}>
          <p style={{ margin: '0 0 var(--s-5)', fontSize: 'var(--fs-14)', fontWeight: 'var(--fw-semi)', color: 'var(--text-primary)' }}>新增策划案</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s-4)' }}>
            {[
              { label: '关卡名称 *', key: 'level_name', placeholder: '填写关卡名称' },
              { label: '版本',       key: 'version',    placeholder: '如 5.4' },
            ].map(({ label, key, placeholder }) => (
              <div key={key}>
                <label style={{ display: 'block', fontSize: 'var(--fs-12)', color: 'var(--text-secondary)', marginBottom: 'var(--s-2)' }}>{label}</label>
                <input className="field-input" placeholder={placeholder}
                  value={(form as any)[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
              </div>
            ))}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: 'var(--fs-12)', color: 'var(--text-secondary)', marginBottom: 'var(--s-2)' }}>策划案 KM 链接 *</label>
              <input className="field-input" placeholder="https://km.mihoyo.com/doc/..."
                value={form.km_url} onChange={(e) => setForm((f) => ({ ...f, km_url: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--fs-12)', color: 'var(--text-secondary)', marginBottom: 'var(--s-2)' }}>状态</label>
              <select className="field-input" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                {['待评审','已评审','草稿','已归档'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--fs-12)', color: 'var(--text-secondary)', marginBottom: 'var(--s-2)' }}>备注</label>
              <input className="field-input" placeholder="（选填）" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--s-3)', justifyContent: 'flex-end', marginTop: 'var(--s-5)' }}>
            <button className="ghost-btn" onClick={() => setShowAdd(false)}>取消</button>
            <button className="primary-btn" onClick={save} disabled={saving || !form.level_name.trim() || !form.km_url.trim()}>
              {saving && <span className="spinner" style={{ marginRight: 6 }} />}保存
            </button>
          </div>
        </Card>
      )}

      {/* 列表 */}
      {loading ? (
        <div style={{ padding: 'var(--s-12)', textAlign: 'center' }}><span className="spinner" /></div>
      ) : !docs.length ? (
        <EmptyState icon="📄" text="暂无策划案，点击「添加策划案」导入 KM 文档" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' }}>
          {docs.map((doc) => {
            const isAnalyzing = analyzing[doc.id]
            const sc = STATUS_COLOR[doc.status ?? ''] ?? 'var(--text-tertiary)'
            return (
              <Card key={doc.id} style={{ padding: 'var(--s-5) var(--s-6)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--s-5)', flexWrap: 'wrap' }}>
                  {/* 主信息 */}
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-3)', flexWrap: 'wrap', marginBottom: 'var(--s-2)' }}>
                      <span style={{ fontWeight: 'var(--fw-semi)', fontSize: 'var(--fs-14)', color: 'var(--text-primary)' }}>{doc.level_name}</span>
                      {doc.version && <span style={{ fontSize: 'var(--fs-11)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>v{doc.version}</span>}
                      {doc.status && (
                        <span style={{ fontSize: 'var(--fs-11)', padding: '2px 8px', borderRadius: 'var(--r-4)', background: `color-mix(in srgb, ${sc} 12%, transparent)`, color: sc, border: `0.5px solid color-mix(in srgb, ${sc} 25%, transparent)` }}>
                          {doc.status}
                        </span>
                      )}
                      {doc.analyze_status === 'done' && <span style={{ fontSize: 'var(--fs-11)', color: 'var(--c-green-500)' }}>✓ AI 已分析</span>}
                      {doc.analyze_status === 'pending' && <span style={{ fontSize: 'var(--fs-11)', color: 'var(--c-orange-500)' }}>分析中…</span>}
                    </div>
                    {doc.km_url && (
                      <a href={doc.km_url} target="_blank" rel="noreferrer"
                        style={{ fontSize: 'var(--fs-12)', color: 'var(--c-blue-500)', textDecoration: 'none', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: 400 }}>
                        {doc.km_url}
                      </a>
                    )}
                    {doc.note && <p style={{ margin: 'var(--s-2) 0 0', fontSize: 'var(--fs-12)', color: 'var(--text-tertiary)' }}>{doc.note}</p>}
                    {doc.analyze_result && (
                      <div style={{ marginTop: 'var(--s-3)', padding: 'var(--s-3) var(--s-4)', background: 'var(--c-neutral-50)', borderRadius: 'var(--r-6)', fontSize: 'var(--fs-12)', color: 'var(--text-secondary)', lineHeight: 'var(--lh-snug)', borderLeft: '2px solid var(--c-green-500)' }}>
                        {doc.analyze_result.slice(0, 200)}{doc.analyze_result.length > 200 ? '…' : ''}
                      </div>
                    )}
                  </div>
                  {/* 操作 */}
                  <div style={{ display: 'flex', gap: 'var(--s-2)', flexShrink: 0, alignItems: 'flex-start' }}>
                    <button className="ghost-btn small" onClick={() => analyze(doc.id)} disabled={isAnalyzing}>
                      {isAnalyzing ? <><span className="spinner" style={{ marginRight: 4 }} />分析中</> : 'AI 分析'}
                    </button>
                    {doc.km_url && (
                      <a href={doc.km_url} target="_blank" rel="noreferrer">
                        <button className="ghost-btn small">打开 KM</button>
                      </a>
                    )}
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--fs-12)', color: 'var(--c-red-500)', padding: '5px 8px' }} onClick={() => del(doc.id)}>删除</button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ══════════ 静态知识库 Tab（团队/编辑器/玩法/报告）══════════ */
function StaticKbTab({ tab }: { tab: KbTab }) {
  const [search, setSearch] = useState('')
  const [items, setItems]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // 各 tab 对应的接口
  const API_MAP: Record<string, string> = {
    team:     '/api/knowledge/team-docs',
    editor:   '/api/knowledge/editor-docs',
    gameplay: '/api/knowledge/gameplay-docs',
    reports:  '/api/knowledge/reports',
  }

  useEffect(() => {
    const url = API_MAP[tab]
    if (!url) { setLoading(false); return }
    fetch(url)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setItems(d.docs ?? d.items ?? d.reports ?? []) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [tab])

  const filtered = search
    ? items.filter((it) => JSON.stringify(it).toLowerCase().includes(search.toLowerCase()))
    : items

  if (loading) return <div style={{ padding: 'var(--s-12)', textAlign: 'center' }}><span className="spinner" /></div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-5)' }}>
      {/* 搜索 */}
      <div style={{ display: 'flex', gap: 'var(--s-4)', alignItems: 'center' }}>
        <input className="field-input" style={{ width: 280 }} placeholder="搜索文档…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <span style={{ fontSize: 'var(--fs-12)', color: 'var(--text-tertiary)' }}>{filtered.length} 篇</span>
      </div>

      {!filtered.length ? (
        <EmptyState icon="📭" text="暂无文档数据" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' }}>
          {filtered.map((it, i) => (
            <Card key={i} style={{ padding: 'var(--s-4) var(--s-6)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-4)', justifyContent: 'space-between' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 'var(--fw-medium)', fontSize: 'var(--fs-13)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {it.title ?? it.level_name ?? it.name ?? `文档 #${i + 1}`}
                  </p>
                  {(it.note ?? it.summary ?? it.desc) && (
                    <p style={{ margin: '2px 0 0', fontSize: 'var(--fs-12)', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {it.note ?? it.summary ?? it.desc}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 'var(--s-2)', flexShrink: 0, alignItems: 'center' }}>
                  {it.created_at && <span style={{ fontSize: 'var(--fs-11)', color: 'var(--text-quaternary)', fontFamily: 'var(--font-mono)' }}>{it.created_at.slice(0, 10)}</span>}
                  {(it.km_url ?? it.url) && (
                    <a href={it.km_url ?? it.url} target="_blank" rel="noreferrer">
                      <button className="ghost-btn small">打开 KM</button>
                    </a>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

/* ══════════ 主视图 ══════════ */
export default function KnowledgeBase() {
  const [tab, setTab] = useState<KbTab>('plan-docs')
  const cur = KB_TABS.find((t) => t.id === tab)!

  return (
    <div style={{ padding: 'var(--s-8) var(--s-9)', display: 'flex', flexDirection: 'column', gap: 'var(--s-7)', maxWidth: 1080, margin: '0 auto' }}>
      {/* 页头 */}
      <div>
        <h1 style={{ margin: 0, fontSize: 'var(--fs-22)', fontWeight: 'var(--fw-semi)', color: 'var(--text-primary)' }}>知识库</h1>
        <p style={{ margin: '4px 0 0', fontSize: 'var(--fs-13)', color: 'var(--text-tertiary)' }}>团队知识沉淀与 AI 分析加速</p>
      </div>

      {/* Tab 栏 */}
      <div className="view-tabs">
        {KB_TABS.map(({ id, label, icon }) => (
          <button key={id} className={`view-tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
            <span className="view-tab-icon">{icon}</span>{label}
          </button>
        ))}
      </div>

      {/* Tab 描述 */}
      <p style={{ margin: 0, fontSize: 'var(--fs-13)', color: 'var(--text-tertiary)' }}>{cur.desc}</p>

      {/* 内容 */}
      {tab === 'plan-docs' ? <PlanDocsTab /> : <StaticKbTab tab={tab} />}
    </div>
  )
}
