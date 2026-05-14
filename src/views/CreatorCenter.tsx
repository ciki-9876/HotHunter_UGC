// 创作者运营视图 — 迁移自 events.js 商单/创作者部分
// 严格只使用 index.css 设计令牌
import { useCallback, useEffect, useState } from 'react'
import { apiPost, apiPut, apiDel } from '../api/client'

/* ══════════ 类型 ══════════ */
interface LevelOrder {
  id: string; name: string; officialName?: string; idCard?: string
  owner?: string; team?: string; version?: string; teamId?: string
  deliveryDate?: string; createDate?: string; lastActionDate?: string
  stage: string; planReviewDone?: boolean
  guid?: string; feedbackGrade?: string; feedbackDate?: string
  feedbackNote?: string; feedbackRecommendReq?: string
  planDocUrl?: string; kmUrl?: string
  creatorMatch?: string; acceptRate?: string
}

/* ══════════ 常量 ══════════ */
const STAGE_COLOR: Record<string, string> = {
  '提案准备期': 'var(--text-tertiary)', '策划案评审': 'var(--c-orange-500)',
  '已完成智能评审': 'var(--c-orange-500)', '生产中': 'var(--c-orange-500)',
  '发布前审核': 'var(--c-orange-500)', '玩法验收': 'var(--c-blue-500)',
  '生态审': 'var(--c-blue-500)', '待推荐': 'var(--c-green-500)',
  '线上': 'var(--c-green-500)', '已归档': 'var(--text-quaternary)',
  '约稿中': 'var(--c-orange-500)',
}
const GRADE_COLOR: Record<string, string> = {
  S: 'var(--c-orange-500)', A: 'var(--c-green-500)',
  B: 'var(--c-blue-500)',  C: 'var(--text-tertiary)',
}
const SUB_TABS = [
  { id: 'contracts', label: '商单管理', icon: '📋' },
  { id: 'profiles',  label: '创作者档案', icon: '👤' },
] as const
type SubTab = (typeof SUB_TABS)[number]['id']

/* ══════════ 公共 ══════════ */
const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{ background: 'var(--surface-elevated)', borderRadius: 'var(--r-12)', border: '0.5px solid var(--border-default)', boxShadow: 'var(--shadow-1)', ...style }}>
    {children}
  </div>
)

/* ══════════ 新建商单弹窗 ══════════ */
function NewContractModal({ onClose, onSave }: { onClose: () => void; onSave: (d: any) => Promise<void> }) {
  const [form, setForm] = useState({
    name: '', officialName: '', owner: '', team: '', teamId: '',
    version: '', deliveryDate: '', kmUrl: '', stage: '约稿中',
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const teamFields = [
    { label: '约稿名 *',   key: 'name',         placeholder: '与创作者约定的关卡名' },
    { label: '正式关卡名', key: 'officialName',  placeholder: '上线后的正式名称（可后填）' },
    { label: '负责人',     key: 'owner',         placeholder: '' },
    { label: '团队',       key: 'team',          placeholder: '' },
    { label: 'Wave 群 ID', key: 'teamId',        placeholder: 'Wave 群 chat_id（选填）' },
    { label: '版本',       key: 'version',       placeholder: '如 5.4' },
    { label: '交付日期',   key: 'deliveryDate',  placeholder: '' },
    { label: 'KM 策划案',  key: 'kmUrl',         placeholder: 'https://km.mihoyo.com/doc/…' },
  ]

  return (
    <div className="modal-mask" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-card">
        <div className="modal-header">
          <span className="modal-title">新建商单</span>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s-4)' }}>
            {teamFields.map(({ label, key, placeholder }) => (
              <div key={key} style={{ gridColumn: key === 'name' || key === 'kmUrl' ? '1 / -1' : undefined }}>
                <label style={{ display: 'block', fontSize: 'var(--fs-12)', color: 'var(--text-secondary)', marginBottom: 'var(--s-2)' }}>{label}</label>
                {key === 'deliveryDate'
                  ? <input type="date" className="field-input" value={form.deliveryDate} onChange={(e) => set(key, e.target.value)} />
                  : <input className="field-input" placeholder={placeholder} value={(form as any)[key]} onChange={(e) => set(key, e.target.value)} />
                }
              </div>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <div style={{ flex: 1 }} />
          <button className="ghost-btn" onClick={onClose}>取消</button>
          <button className="primary-btn" disabled={saving || !form.name.trim()} onClick={async () => { setSaving(true); try { await onSave(form) } finally { setSaving(false) } }}>
            {saving && <span className="spinner" style={{ marginRight: 6 }} />}创建商单
          </button>
        </div>
      </div>
    </div>
  )
}

/* ══════════ 商单管理 ══════════ */
function ContractsTab() {
  const [orders, setOrders]   = useState<LevelOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [stageFilter, setStageFilter] = useState('all')
  const [search, setSearch]   = useState('')

  const load = useCallback(async () => {
    try {
      const res  = await fetch('/api/orders')
      const data = await res.json()
      if (data.ok) setOrders(data.orders ?? [])
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const createOrder = async (form: any) => {
    await apiPost('/api/orders', form)
    setShowAdd(false); await load()
  }

  const advance = async (id: string, nextStage: string) => {
    await apiPut(`/api/orders/${id}`, { stage: nextStage })
    await load()
  }
  const del = async (id: string) => {
    if (!confirm('确认删除该商单？')) return
    await fetch(`/api/orders/${id}`, { method: 'DELETE' }); await load()
  }

  const STAGE_NEXT: Record<string, string> = {
    '约稿中': '提案准备期', '提案准备期': '策划案评审',
    '生产中': '发布前审核', '发布前审核': '玩法验收',
    '玩法验收': '生态审', '生态审': '待推荐', '待推荐': '线上',
  }

  let filtered = orders
  if (stageFilter !== 'all') filtered = filtered.filter((o) => o.stage === stageFilter)
  if (search) filtered = filtered.filter((o) =>
    [o.name, o.officialName, o.owner, o.team, o.version].some((v) => v?.toLowerCase().includes(search.toLowerCase()))
  )

  const stages = ['all', ...Array.from(new Set(orders.map((o) => o.stage)))]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-5)' }}>
      {/* 工具栏 */}
      <div style={{ display: 'flex', gap: 'var(--s-4)', flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="field-input" style={{ width: 200 }} placeholder="搜索名称/负责人/团队…"
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="view-tabs" style={{ flex: 0 }}>
          {stages.slice(0, 8).map((s) => (
            <button key={s} className={`view-tab ${stageFilter === s ? 'active' : ''}`} style={{ padding: '5px 10px', fontSize: 'var(--fs-12)' }}
              onClick={() => setStageFilter(s)}>{s === 'all' ? '全部' : s}</button>
          ))}
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 'var(--fs-12)', color: 'var(--text-tertiary)' }}>{filtered.length} 条</span>
        <button className="primary-btn" onClick={() => setShowAdd(true)}>＋ 新建商单</button>
      </div>

      {/* 列表 */}
      {loading ? (
        <div style={{ padding: 'var(--s-12)', textAlign: 'center' }}><span className="spinner" /></div>
      ) : !filtered.length ? (
        <div style={{ padding: 'var(--s-12)', textAlign: 'center', color: 'var(--text-quaternary)', fontSize: 'var(--fs-13)' }}>
          暂无商单数据，点击「新建商单」开始约稿
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' }}>
          {filtered.map((o) => {
            const sc = STAGE_COLOR[o.stage] ?? 'var(--text-tertiary)'
            const gc = GRADE_COLOR[o.feedbackGrade ?? ''] ?? 'var(--text-quaternary)'
            const nextStage = STAGE_NEXT[o.stage]
            return (
              <Card key={o.id} style={{ padding: 'var(--s-4) var(--s-5)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--s-5)', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-3)', flexWrap: 'wrap', marginBottom: 'var(--s-2)' }}>
                      <span style={{ fontWeight: 'var(--fw-semi)', fontSize: 'var(--fs-13)', color: 'var(--text-primary)' }}>{o.officialName ?? o.name}</span>
                      {o.officialName && o.officialName !== o.name && (
                        <span style={{ fontSize: 'var(--fs-11)', color: 'var(--text-quaternary)' }}>约稿名：{o.name}</span>
                      )}
                      <span style={{ fontSize: 'var(--fs-11)', padding: '2px 8px', borderRadius: 'var(--r-4)', background: `color-mix(in srgb, ${sc} 12%, transparent)`, color: sc, border: `0.5px solid color-mix(in srgb, ${sc} 25%, transparent)` }}>{o.stage}</span>
                      {o.feedbackGrade && <span style={{ fontWeight: 'var(--fw-bold)', fontSize: 'var(--fs-13)', color: gc }}>评级 {o.feedbackGrade}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--s-4)', flexWrap: 'wrap', fontSize: 'var(--fs-12)', color: 'var(--text-tertiary)' }}>
                      {o.owner && <span>负责人：{o.owner}</span>}
                      {o.team && <span>团队：{o.team}</span>}
                      {o.version && <span>版本：{o.version}</span>}
                      {o.deliveryDate && <span>交付：{o.deliveryDate}</span>}
                    </div>
                    {o.guid && (
                      <div style={{ marginTop: 'var(--s-2)', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-quaternary)', background: 'var(--c-neutral-100)', borderRadius: 'var(--r-4)', padding: '2px 6px', display: 'inline-block' }}>{o.guid}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--s-2)', flexShrink: 0, flexWrap: 'wrap' }}>
                    {nextStage && o.stage !== '约稿中' && (
                      <button className="ghost-btn small" onClick={() => advance(o.id, nextStage)}>→ {nextStage}</button>
                    )}
                    {o.planDocUrl && (
                      <a href={o.planDocUrl} target="_blank" rel="noreferrer">
                        <button className="ghost-btn small">策划案</button>
                      </a>
                    )}
                    {o.stage !== '线上' && o.stage !== '已归档' && (
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--fs-12)', color: 'var(--c-red-500)', padding: '5px 8px' }} onClick={() => del(o.id)}>删除</button>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {showAdd && <NewContractModal onClose={() => setShowAdd(false)} onSave={createOrder} />}
    </div>
  )
}

/* ══════════ 创作者档案 ══════════ */
function ProfilesTab() {
  const [orders, setOrders]   = useState<LevelOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/orders').then((r) => r.json()).then((d) => {
      if (d.ok) setOrders(d.orders ?? [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  // 按负责人聚合
  const byOwner = orders.reduce<Record<string, { owner: string; team?: string; levels: LevelOrder[] }>>((acc, o) => {
    const key = o.owner ?? '未知'
    if (!acc[key]) acc[key] = { owner: key, team: o.team, levels: [] }
    acc[key].levels.push(o)
    return acc
  }, {})

  const profiles = Object.values(byOwner).sort((a, b) => b.levels.length - a.levels.length)

  if (loading) return <div style={{ padding: 'var(--s-12)', textAlign: 'center' }}><span className="spinner" /></div>
  if (!profiles.length) return (
    <div style={{ padding: 'var(--s-12)', textAlign: 'center', color: 'var(--text-quaternary)', fontSize: 'var(--fs-13)' }}>
      暂无创作者数据，请先在「商单管理」中录入关卡
    </div>
  )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--s-5)' }}>
      {profiles.map(({ owner, team, levels }) => {
        const online  = levels.filter((l) => l.stage === '线上').length
        const active  = levels.filter((l) => !['线上','已归档'].includes(l.stage)).length
        const grades  = levels.filter((l) => l.feedbackGrade).map((l) => l.feedbackGrade!)
        const topGrade = grades.sort((a, b) => {
          const o = ['S','A','B','C']; return o.indexOf(a) - o.indexOf(b)
        })[0]
        return (
          <Card key={owner} style={{ padding: 'var(--s-5)' }}>
            {/* 头像区 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-4)', marginBottom: 'var(--s-4)' }}>
              <div style={{ width: 44, height: 44, borderRadius: 'var(--r-full)', background: 'var(--accent-tint-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-19)', flexShrink: 0 }}>
                {owner.slice(0, 1)}
              </div>
              <div>
                <p style={{ margin: 0, fontWeight: 'var(--fw-semi)', fontSize: 'var(--fs-14)', color: 'var(--text-primary)' }}>{owner}</p>
                {team && <p style={{ margin: 0, fontSize: 'var(--fs-12)', color: 'var(--text-tertiary)' }}>{team}</p>}
              </div>
              {topGrade && <span style={{ marginLeft: 'auto', fontWeight: 'var(--fw-bold)', fontSize: 'var(--fs-17)', color: GRADE_COLOR[topGrade] ?? 'var(--text-tertiary)' }}>{topGrade}</span>}
            </div>
            {/* 统计 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--s-2)', marginBottom: 'var(--s-4)' }}>
              {[
                { label: '总关卡', val: levels.length },
                { label: '进行中', val: active,  color: 'var(--c-orange-500)' },
                { label: '已上线', val: online,  color: 'var(--c-green-500)' },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ textAlign: 'center', background: 'var(--c-neutral-50)', borderRadius: 'var(--r-6)', padding: 'var(--s-3) 0' }}>
                  <div style={{ fontSize: 'var(--fs-17)', fontWeight: 'var(--fw-bold)', color: color ?? 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{val}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-quaternary)' }}>{label}</div>
                </div>
              ))}
            </div>
            {/* 最近关卡 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
              {levels.slice(0, 3).map((l) => {
                const sc = STAGE_COLOR[l.stage] ?? 'var(--text-tertiary)'
                return (
                  <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-3)', fontSize: 'var(--fs-12)' }}>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{l.officialName ?? l.name}</span>
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 'var(--r-4)', background: `color-mix(in srgb, ${sc} 12%, transparent)`, color: sc, flexShrink: 0 }}>{l.stage}</span>
                  </div>
                )
              })}
              {levels.length > 3 && <p style={{ margin: 0, fontSize: 11, color: 'var(--text-quaternary)' }}>…还有 {levels.length - 3} 个关卡</p>}
            </div>
          </Card>
        )
      })}
    </div>
  )
}

/* ══════════ 主视图 ══════════ */
export default function CreatorCenter() {
  const [tab, setTab] = useState<SubTab>('contracts')
  return (
    <div style={{ padding: 'var(--s-8) var(--s-9)', display: 'flex', flexDirection: 'column', gap: 'var(--s-7)', maxWidth: 1200, margin: '0 auto' }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 'var(--fs-22)', fontWeight: 'var(--fw-semi)', color: 'var(--text-primary)' }}>创作者运营</h1>
        <p style={{ margin: '4px 0 0', fontSize: 'var(--fs-13)', color: 'var(--text-tertiary)' }}>商单管理与创作者档案聚合</p>
      </div>
      <div className="view-tabs">
        {SUB_TABS.map(({ id, label, icon }) => (
          <button key={id} className={`view-tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
            <span className="view-tab-icon">{icon}</span>{label}
          </button>
        ))}
      </div>
      {tab === 'contracts' && <ContractsTab />}
      {tab === 'profiles'  && <ProfilesTab />}
    </div>
  )
}
