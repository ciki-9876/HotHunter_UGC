// 关卡中心视图 — 迁移自 level-center.js + recommend-pool.js
// 严格只使用 index.css 设计令牌

import { useCallback, useEffect, useRef, useState } from 'react'
import { apiPost, apiPut } from '../api/client'

/* ══════════ 类型 ══════════ */
type LevelStage = '提案准备期'|'策划案评审'|'生产中'|'发布前审核'|'玩法验收'|'生态审'|'待推荐'|'线上'|'已归档'|'约稿中'
type FeedbackGrade = 'S'|'A'|'B'|'C'|''

interface LevelOrder {
  id: string; name: string; officialName?: string; idCard?: string
  owner?: string; team?: string; version?: string
  deliveryDate?: string; createDate?: string; lastActionDate?: string
  stage: LevelStage; planReviewDone?: boolean
  guid?: string; guidEnv?: string; feedbackGrade?: FeedbackGrade
  feedbackDate?: string; feedbackNote?: string; feedbackRecommendReq?: string
}
interface PoolRow { id: number; level_name: string; guid?: string; category?: string; status?: string }

/* ══════════ 常量 ══════════ */
const STAGE_COLOR: Record<string, string> = {
  '提案准备期': 'var(--text-tertiary)', '策划案评审': 'var(--c-orange-500)',
  '已完成智能评审': 'var(--c-orange-500)', '生产中': 'var(--c-orange-500)',
  '发布前审核': 'var(--c-orange-500)', '玩法验收': 'var(--c-blue-500)',
  '生态审': 'var(--c-blue-500)', '待推荐': 'var(--c-green-500)',
  '线上': 'var(--c-green-500)', '已归档': 'var(--text-quaternary)',
  '约稿中': 'var(--c-orange-500)',
}
const STAGE_NEXT: Record<string, string> = {
  '生产中':'发布前审核', '发布前审核':'玩法验收', '玩法验收':'生态审',
  '生态审':'待推荐', '待推荐':'线上', '约稿中':'策划案评审',
}
const STAGE_TABS: LevelStage[] = ['提案准备期','策划案评审','生产中','发布前审核','玩法验收','生态审','待推荐','线上']

function stageLabel(order: LevelOrder) {
  return order.stage === '策划案评审' && order.planReviewDone ? '已完成智能评审' : order.stage
}

const GRADE_COLOR: Record<string, string> = { S: 'var(--c-orange-500)', A: 'var(--c-green-500)', B: 'var(--c-blue-500)', C: 'var(--text-tertiary)' }
const GRADE_ORDER: Record<string, number> = { S: 0, A: 1, B: 2, C: 3 }

/* ══════════ 排序 hook ══════════ */
type SortKey = { key: string; dir: 'asc'|'desc' }
function useMultiSort(list: LevelOrder[]) {
  const [sortKeys, setSortKeys] = useState<SortKey[]>([])
  const toggle = (key: string) => setSortKeys((prev) => {
    const ex = prev.find((s) => s.key === key)
    if (!ex) return [...prev, { key, dir: 'asc' }]
    if (ex.dir === 'asc') return prev.map((s) => s.key === key ? { key, dir: 'desc' } : s)
    return prev.filter((s) => s.key !== key)
  })
  const sorted = sortKeys.length
    ? [...list].sort((a, b) => {
        for (const { key, dir } of sortKeys) {
          const cmp = String((a as any)[key] ?? '').localeCompare(String((b as any)[key] ?? ''))
          if (cmp !== 0) return dir === 'asc' ? cmp : -cmp
        }
        return 0
      })
    : list
  return { sorted, sortKeys, toggle }
}

/* ══════════ 甘特图 ══════════ */
const CELL_W = 28, ROW_H = 48

function GanttChart({ orders }: { orders: LevelOrder[] }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const today   = new Date(); today.setHours(0,0,0,0)

  if (!orders.length) return <div style={{ padding: 20, color: 'var(--text-tertiary)', fontSize: 'var(--fs-13)' }}>暂无关卡数据</div>

  let minDate = new Date(today), maxDate = new Date(today)
  orders.forEach((o) => {
    if (o.createDate)   { const d = new Date(o.createDate); d.setHours(0,0,0,0);   if (d < minDate) minDate = d }
    if (o.deliveryDate) { const d = new Date(o.deliveryDate); d.setHours(0,0,0,0); if (d > maxDate) maxDate = d }
  })
  minDate = new Date(minDate.getTime() - 21 * 86400000)
  maxDate = new Date(maxDate.getTime() + 14 * 86400000)
  const totalDays = Math.round((maxDate.getTime() - minDate.getTime()) / 86400000) + 1
  const totalW    = totalDays * CELL_W
  const todayOff  = Math.round((today.getTime() - minDate.getTime()) / 86400000)

  const dateHeaders = Array.from({ length: totalDays }, (_, i) => {
    const d      = new Date(minDate.getTime() + i * 86400000)
    const isToday = i === todayOff
    const weekCN = ['日','一','二','三','四','五','六'][d.getDay()]
    return { d, i, isToday, weekCN }
  })

  return (
    <div ref={wrapRef} style={{ overflowX: 'auto', position: 'relative' }}>
      <div style={{ minWidth: totalW + 160, fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-11)' }}>
        {/* 日期头 */}
        <div style={{ display: 'flex', position: 'sticky', top: 0, zIndex: 2, background: 'var(--surface-elevated)', borderBottom: '0.5px solid var(--border-default)' }}>
          <div style={{ width: 150, flexShrink: 0, padding: '6px 8px', color: 'var(--text-tertiary)', fontSize: 'var(--fs-11)' }}>关卡</div>
          <div style={{ flex: 1, overflowX: 'hidden', position: 'relative', height: 46 }}>
            <div style={{ width: totalW, position: 'relative', height: '100%', display: 'flex' }}>
              {dateHeaders.map(({ d, i, isToday, weekCN }) => (
                <div key={i} style={{ position: 'absolute', left: i * CELL_W, width: CELL_W, height: '100%', borderLeft: isToday ? '1px solid var(--accent-base)' : undefined }}>
                  <div style={{ textAlign: 'center', fontSize: 9, color: isToday ? 'var(--accent-base)' : 'var(--text-quaternary)', fontWeight: isToday ? 700 : 400, lineHeight: 1, paddingTop: 6 }}>
                    {isToday ? '今' : `${d.getMonth()+1}/${d.getDate()}`}
                  </div>
                  <div style={{ textAlign: 'center', fontSize: 9, color: d.getDay() === 0 || d.getDay() === 6 ? 'var(--c-red-500)' : 'var(--text-quaternary)', marginTop: 2 }}>
                    {weekCN}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* 关卡行 */}
        {orders.map((o) => {
          const bs   = new Date(o.lastActionDate ?? o.createDate ?? today); bs.setHours(0,0,0,0)
          const startOff = Math.max(0, Math.round((bs.getTime() - minDate.getTime()) / 86400000))
          const dur      = Math.max(1, Math.round((today.getTime() - bs.getTime()) / 86400000) + 1)
          const isArch   = o.stage === '已归档'
          return (
            <div key={o.id} style={{ display: 'flex', height: ROW_H, borderBottom: '0.5px solid var(--border-subtle)' }}>
              <div style={{ width: 150, flexShrink: 0, padding: '0 8px', display: 'flex', alignItems: 'center', color: isArch ? 'var(--text-quaternary)' : 'var(--text-primary)', fontSize: 'var(--fs-12)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                {o.officialName ?? o.name}
              </div>
              <div style={{ flex: 1, overflowX: 'hidden', position: 'relative' }}>
                <div style={{ width: totalW, height: '100%', position: 'relative' }}>
                  {/* 今日线 */}
                  <div style={{ position: 'absolute', left: todayOff * CELL_W + CELL_W / 2, top: 0, bottom: 0, width: 1, background: 'var(--accent-tint-strong)', pointerEvents: 'none' }} />
                  {/* 色块 */}
                  <div style={{
                    position: 'absolute', top: 10, height: ROW_H - 20,
                    left: startOff * CELL_W, width: Math.max(dur * CELL_W, 60),
                    borderRadius: 'var(--r-4)',
                    background: isArch ? 'var(--c-neutral-200)' : 'var(--accent-tint-strong)',
                    display: 'flex', alignItems: 'center', paddingLeft: 8, overflow: 'hidden',
                    fontSize: 10, color: isArch ? 'var(--text-quaternary)' : 'var(--accent-base)',
                    fontWeight: 'var(--fw-medium)', cursor: 'pointer',
                  }}>
                    {stageLabel(o)} · {dur}天
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ══════════ 待推荐卡片 ══════════ */
function PendingRecommendList({ orders }: { orders: LevelOrder[] }) {
  const [grade, setGrade]   = useState('')
  const [sort, setSort]     = useState('date-desc')
  const [search, setSearch] = useState('')
  const [view, setView]     = useState<'card'|'list'>('card')

  let list = orders.filter((o) => o.stage === '待推荐')
  if (grade) list = list.filter((o) => o.feedbackGrade === grade)
  if (search) list = list.filter((o) =>
    (o.officialName ?? o.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (o.guid ?? '').toLowerCase().includes(search.toLowerCase())
  )
  list = [...list].sort((a, b) => {
    if (sort === 'grade-desc') return (GRADE_ORDER[a.feedbackGrade ?? ''] ?? 9) - (GRADE_ORDER[b.feedbackGrade ?? ''] ?? 9)
    if (sort === 'grade-asc')  return (GRADE_ORDER[b.feedbackGrade ?? ''] ?? 9) - (GRADE_ORDER[a.feedbackGrade ?? ''] ?? 9)
    if (sort === 'date-desc')  return (b.feedbackDate ?? '').localeCompare(a.feedbackDate ?? '')
    return (a.feedbackDate ?? '').localeCompare(b.feedbackDate ?? '')
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-5)' }}>
      {/* 工具栏 */}
      <div style={{ display: 'flex', gap: 'var(--s-4)', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          style={{ background: 'var(--field-bg)', border: '0.5px solid var(--field-border)', borderRadius: 'var(--field-radius)', padding: '6px 10px', fontSize: 'var(--fs-13)', color: 'var(--field-fg)', outline: 'none', width: 200 }}
          placeholder="搜索关卡名/GUID…"
          value={search} onChange={(e) => setSearch(e.target.value)}
        />
        <div className="view-tabs" style={{ flex: 0 }}>
          {['','S','A','B','C'].map((g) => (
            <button key={g} className={`view-tab ${grade === g ? 'active' : ''}`} onClick={() => setGrade(g)} style={{ padding: '5px 10px' }}>
              {g || '全部'}
            </button>
          ))}
        </div>
        <select
          style={{ background: 'var(--field-bg)', border: '0.5px solid var(--field-border)', borderRadius: 'var(--field-radius)', padding: '6px 10px', fontSize: 'var(--fs-13)', color: 'var(--field-fg)', outline: 'none' }}
          value={sort} onChange={(e) => setSort(e.target.value)}
        >
          <option value="date-desc">最新进池</option>
          <option value="date-asc">最早进池</option>
          <option value="grade-desc">评级高→低</option>
          <option value="grade-asc">评级低→高</option>
        </select>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--s-2)' }}>
          {(['card','list'] as const).map((v) => (
            <button key={v} className={`ghost-btn small ${view === v ? '' : ''}`} style={{ opacity: view === v ? 1 : 0.5 }} onClick={() => setView(v)}>
              {v === 'card' ? '⊞' : '☰'}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 'var(--fs-12)', color: 'var(--text-tertiary)' }}>{list.length} 个关卡</span>
      </div>

      {/* 列表 */}
      {!list.length ? (
        <div style={{ padding: 'var(--s-9)', textAlign: 'center', color: 'var(--text-quaternary)', fontSize: 'var(--fs-13)' }}>暂无符合条件的待推荐关卡</div>
      ) : view === 'card' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--s-5)' }}>
          {list.map((item) => {
            const gc = GRADE_COLOR[item.feedbackGrade ?? ''] ?? 'var(--text-tertiary)'
            return (
              <div key={item.id} style={{ background: 'var(--surface-elevated)', borderRadius: 'var(--r-12)', border: '0.5px solid var(--border-default)', padding: 'var(--s-5)', boxShadow: 'var(--shadow-1)', display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  {item.feedbackGrade && <span style={{ fontWeight: 'var(--fw-bold)', fontSize: 'var(--fs-17)', color: gc }}>{item.feedbackGrade}</span>}
                  {item.idCard && <span style={{ fontSize: 'var(--fs-11)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{item.idCard}</span>}
                </div>
                <p style={{ margin: 0, fontSize: 'var(--fs-14)', fontWeight: 'var(--fw-semi)', color: 'var(--text-primary)', lineHeight: 'var(--lh-snug)' }}>{item.officialName ?? item.name}</p>
                <div style={{ display: 'flex', gap: 'var(--s-3)', flexWrap: 'wrap', fontSize: 'var(--fs-11)', color: 'var(--text-tertiary)' }}>
                  <span>{item.version ?? '—'}</span><span>·</span><span>{item.team ?? '—'}</span><span>·</span><span>{item.owner ?? '—'}</span>
                </div>
                {item.guid && <span style={{ fontSize: 'var(--fs-11)', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', background: 'var(--c-neutral-100)', borderRadius: 'var(--r-4)', padding: '2px 6px', alignSelf: 'flex-start' }}>{item.guid}</span>}
                {item.feedbackNote && <p style={{ margin: 0, fontSize: 'var(--fs-12)', color: 'var(--text-secondary)', lineHeight: 'var(--lh-snug)' }}>{item.feedbackNote}</p>}
                {item.feedbackRecommendReq && (
                  <p style={{ margin: 0, fontSize: 'var(--fs-11)', color: 'var(--c-orange-500)', lineHeight: 'var(--lh-snug)' }}>★ 定制推荐：{item.feedbackRecommendReq}</p>
                )}
                <button className="ghost-btn small" style={{ marginTop: 'var(--s-2)', alignSelf: 'stretch' }}>查看关卡详情 →</button>
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ border: '0.5px solid var(--border-default)', borderRadius: 'var(--r-8)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-13)' }}>
            <thead>
              <tr style={{ background: 'var(--c-neutral-100)' }}>
                {['评级','关卡名称','版本','团队','负责人','GUID','进池日'].map((h) => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 'var(--fs-12)', fontWeight: 'var(--fw-semi)', color: 'var(--text-secondary)', whiteSpace: 'nowrap', borderBottom: '0.5px solid var(--border-default)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((item) => (
                <tr key={item.id} style={{ borderBottom: '0.5px solid var(--border-subtle)', cursor: 'pointer' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 'var(--fw-bold)', color: GRADE_COLOR[item.feedbackGrade ?? ''] ?? 'var(--text-tertiary)' }}>{item.feedbackGrade ?? '—'}</td>
                  <td style={{ padding: '8px 12px', color: 'var(--text-primary)', fontWeight: 'var(--fw-medium)' }}>{item.officialName ?? item.name}</td>
                  <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{item.version ?? '—'}</td>
                  <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{item.team ?? '—'}</td>
                  <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{item.owner ?? '—'}</td>
                  <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-11)', color: 'var(--text-tertiary)' }}>{item.guid ?? '—'}</td>
                  <td style={{ padding: '8px 12px', color: 'var(--text-tertiary)' }}>{item.feedbackDate ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ══════════ 推荐池 ══════════ */
const POS_LABEL: Record<string, string> = { banner: 'Banner 推荐位', feedstream: '信息流', feedstream_1: '信息流 1', feedstream_2: '信息流 2' }
function RecommendPool() {
  const [rows, setRows]       = useState<PoolRow[]>([])
  const [search, setSearch]   = useState('')
  const [batch, setBatch]     = useState('')
  const [batches, setBatches] = useState<string[]>([])
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState('')

  const load = async () => {
    const res  = await fetch('/api/recommend-pool/data')
    const data = await res.json()
    if (data.ok) {
      setRows(data.rows ?? [])
      if (data.last_sync) setLastSync(data.last_sync.slice(0, 16))
      const bs = [...new Set<string>((data.rows ?? []).map((r: PoolRow) => String(r.status ?? '')))]
        .filter(Boolean).sort((a, b) => { if (a === '1') return -1; if (b === '1') return 1; return b.localeCompare(a) })
      setBatches(bs)
    }
  }
  const sync = async () => {
    setSyncing(true)
    try {
      const res  = await fetch('/api/recommend-pool/sync', { method: 'POST' })
      const data = await res.json()
      if (data.ok) { setLastSync((data.synced_at ?? '').slice(0, 16)); await load() }
    } finally { setSyncing(false) }
  }
  useEffect(() => { load() }, [])

  let filtered = rows
  if (search) filtered = filtered.filter((r) => ((r.level_name ?? '') + (r.guid ?? '') + (r.category ?? '')).toLowerCase().includes(search.toLowerCase()))
  if (batch)  filtered = filtered.filter((r) => String(r.status ?? '') === batch)

  const batchLabel = (v: string) => {
    if (v === '1') return '当前在推'
    if (/^\d{8}$/.test(v)) return `${v.slice(0,4)}-${v.slice(4,6)}-${v.slice(6,8)}`
    return v
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-5)' }}>
      <div style={{ display: 'flex', gap: 'var(--s-4)', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          style={{ background: 'var(--field-bg)', border: '0.5px solid var(--field-border)', borderRadius: 'var(--field-radius)', padding: '6px 10px', fontSize: 'var(--fs-13)', color: 'var(--field-fg)', outline: 'none', width: 200 }}
          placeholder="搜索关卡名/GUID…" value={search} onChange={(e) => setSearch(e.target.value)}
        />
        <select
          style={{ background: 'var(--field-bg)', border: '0.5px solid var(--field-border)', borderRadius: 'var(--field-radius)', padding: '6px 10px', fontSize: 'var(--fs-13)', color: 'var(--field-fg)', outline: 'none' }}
          value={batch} onChange={(e) => setBatch(e.target.value)}
        >
          <option value="">全部批次</option>
          {batches.map((b) => <option key={b} value={b}>{batchLabel(b)}</option>)}
        </select>
        <span style={{ fontSize: 'var(--fs-12)', color: 'var(--text-tertiary)' }}>共 {filtered.length} 条</span>
        <button className="ghost-btn small" style={{ marginLeft: 'auto' }} onClick={sync} disabled={syncing}>
          {syncing ? <span className="spinner" style={{ marginRight: 4 }} /> : null}
          刷新数据
        </button>
        {lastSync && <span style={{ fontSize: 'var(--fs-11)', color: 'var(--text-quaternary)' }}>上次同步：{lastSync}</span>}
      </div>
      <div style={{ border: '0.5px solid var(--border-default)', borderRadius: 'var(--r-8)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-13)' }}>
          <thead>
            <tr style={{ background: 'var(--c-neutral-100)' }}>
              {['关卡名称','关卡 ID','资源位','推荐批次'].map((h) => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 'var(--fs-12)', fontWeight: 'var(--fw-semi)', color: 'var(--text-secondary)', borderBottom: '0.5px solid var(--border-default)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length ? filtered.map((r) => (
              <tr key={r.id} style={{ borderBottom: '0.5px solid var(--border-subtle)' }}>
                <td style={{ padding: '8px 12px', color: 'var(--text-primary)' }}>{r.level_name ?? '—'}</td>
                <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-11)', color: 'var(--text-tertiary)' }}>{r.guid ?? '—'}</td>
                <td style={{ padding: '8px 12px' }}>
                  <span style={{ fontSize: 'var(--fs-12)', padding: '2px 8px', borderRadius: 'var(--r-4)', background: r.category === 'banner' ? 'var(--c-green-100)' : 'var(--c-blue-100)', color: r.category === 'banner' ? 'var(--c-green-500)' : 'var(--c-blue-500)' }}>
                    {POS_LABEL[r.category ?? ''] ?? r.category ?? '—'}
                  </span>
                </td>
                <td style={{ padding: '8px 12px' }}>
                  {String(r.status ?? '') === '1'
                    ? <span style={{ fontSize: 'var(--fs-12)', padding: '2px 8px', borderRadius: 'var(--r-4)', background: 'var(--c-green-100)', color: 'var(--c-green-500)' }}>当前在推</span>
                    : <span style={{ fontSize: 'var(--fs-12)', color: 'var(--text-tertiary)' }}>{batchLabel(String(r.status ?? ''))}</span>
                  }
                </td>
              </tr>
            )) : (
              <tr><td colSpan={4} style={{ padding: 'var(--s-9)', textAlign: 'center', color: 'var(--text-quaternary)', fontSize: 'var(--fs-13)' }}>
                {rows.length ? '无匹配数据' : '暂无数据，点击「刷新数据」从 KM 拉取'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ══════════ 关卡主列表 ══════════ */
function LevelTable({ orders, onAdvance, onDelete, onArchive, onRestart }: {
  orders: LevelOrder[]
  onAdvance: (id: string, nextStage: string) => void
  onDelete: (id: string) => void
  onArchive: (id: string) => void
  onRestart: (id: string) => void
}) {
  const [filter, setFilter]   = useState('all')
  const [teamQ, setTeamQ]     = useState('')
  const [verQ, setVerQ]       = useState('')
  const { sorted, sortKeys, toggle } = useMultiSort(orders)

  const todoStages: LevelStage[] = ['发布前审核','玩法验收','生态审']
  let filtered = filter === 'all'  ? sorted
    : filter === 'todo'            ? sorted.filter((o) => todoStages.includes(o.stage))
    : sorted.filter((o) => o.stage === filter)

  if (teamQ) filtered = filtered.filter((o) => (o.team ?? '').toLowerCase().includes(teamQ.toLowerCase()))
  if (verQ)  filtered = filtered.filter((o) => (o.version ?? '').toLowerCase().includes(verQ.toLowerCase()))

  const SortTh = ({ label, sortKey }: { label: string; sortKey: string }) => {
    const s   = sortKeys.find((x) => x.key === sortKey)
    const pri = sortKeys.indexOf(s!) + 1
    return (
      <th onClick={() => toggle(sortKey)} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 'var(--fs-12)', fontWeight: 'var(--fw-semi)', color: s ? 'var(--accent-base)' : 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap', borderBottom: '0.5px solid var(--border-default)', userSelect: 'none' }}>
        {label} <span style={{ fontSize: 9, opacity: 0.7 }}>{s ? (s.dir === 'asc' ? '↑' : '↓') : '⇅'}</span>
        {pri > 0 && <sup style={{ fontSize: 9, color: 'var(--accent-base)' }}>{pri}</sup>}
      </th>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-5)' }}>
      {/* 筛选栏 */}
      <div style={{ display: 'flex', gap: 'var(--s-4)', flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="view-tabs" style={{ flex: '0 0 auto' }}>
          {[{id:'all',label:'全部'},{id:'todo',label:'待处理'},...STAGE_TABS.map((s)=>({id:s,label:s}))].slice(0,8).map(({id,label})=>(
            <button key={id} className={`view-tab ${filter===id?'active':''}`} onClick={()=>setFilter(id)} style={{ padding: '5px 10px', fontSize: 'var(--fs-12)' }}>{label}</button>
          ))}
        </div>
        <input style={{ background: 'var(--field-bg)', border: '0.5px solid var(--field-border)', borderRadius: 'var(--field-radius)', padding: '5px 10px', fontSize: 'var(--fs-12)', color: 'var(--field-fg)', outline: 'none', width: 110 }}
          placeholder="团队筛选" value={teamQ} onChange={(e)=>setTeamQ(e.target.value)} />
        <input style={{ background: 'var(--field-bg)', border: '0.5px solid var(--field-border)', borderRadius: 'var(--field-radius)', padding: '5px 10px', fontSize: 'var(--fs-12)', color: 'var(--field-fg)', outline: 'none', width: 110 }}
          placeholder="版本筛选" value={verQ} onChange={(e)=>setVerQ(e.target.value)} />
        <span style={{ fontSize: 'var(--fs-12)', color: 'var(--text-tertiary)', marginLeft: 'auto' }}>{filtered.length} 条</span>
      </div>

      {/* 表格 */}
      <div style={{ overflowX: 'auto', border: '0.5px solid var(--border-default)', borderRadius: 'var(--r-8)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-13)' }}>
          <thead>
            <tr style={{ background: 'var(--c-neutral-100)' }}>
              <SortTh label="关卡名称" sortKey="name" />
              <th style={{ padding: '8px 12px', fontSize: 'var(--fs-12)', fontWeight: 'var(--fw-semi)', color: 'var(--text-secondary)', borderBottom: '0.5px solid var(--border-default)', whiteSpace: 'nowrap' }}>负责人</th>
              <SortTh label="团队" sortKey="team" />
              <SortTh label="版本" sortKey="version" />
              <th style={{ padding: '8px 12px', fontSize: 'var(--fs-12)', fontWeight: 'var(--fw-semi)', color: 'var(--text-secondary)', borderBottom: '0.5px solid var(--border-default)', whiteSpace: 'nowrap' }}>交付日</th>
              <SortTh label="最后操作" sortKey="lastActionDate" />
              <th style={{ padding: '8px 12px', fontSize: 'var(--fs-12)', fontWeight: 'var(--fw-semi)', color: 'var(--text-secondary)', borderBottom: '0.5px solid var(--border-default)', whiteSpace: 'nowrap' }}>阶段</th>
              <th style={{ padding: '8px 12px', fontSize: 'var(--fs-12)', fontWeight: 'var(--fw-semi)', color: 'var(--text-secondary)', borderBottom: '0.5px solid var(--border-default)', whiteSpace: 'nowrap' }}>评级</th>
              <th style={{ padding: '8px 12px', fontSize: 'var(--fs-12)', fontWeight: 'var(--fw-semi)', color: 'var(--text-secondary)', borderBottom: '0.5px solid var(--border-default)' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length ? filtered.map((item) => {
              const isArch = item.stage === '已归档'
              const isOnline = item.stage === '线上'
              const gc = GRADE_COLOR[item.feedbackGrade ?? ''] ?? 'var(--text-tertiary)'
              return (
                <tr key={item.id} style={{ borderBottom: '0.5px solid var(--border-subtle)', opacity: isArch ? 0.5 : 1 }}>
                  <td style={{ padding: '10px 12px', maxWidth: 200 }}>
                    <div style={{ fontWeight: 'var(--fw-medium)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.officialName ?? item.name}</div>
                    {item.officialName && item.officialName !== item.name && <div style={{ fontSize: 'var(--fs-11)', color: 'var(--text-tertiary)' }}>{item.name}</div>}
                    {item.idCard && <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-quaternary)' }}>{item.idCard}</div>}
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{item.owner ?? '—'}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{item.team ?? '—'}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{item.version ?? '—'}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)' }}>{item.deliveryDate ?? '—'}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)' }}>{item.lastActionDate ?? '—'}</td>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: 'var(--fs-12)', padding: '2px 8px', borderRadius: 'var(--r-4)', background: `color-mix(in srgb, ${STAGE_COLOR[stageLabel(item)] ?? 'var(--text-tertiary)'} 12%, transparent)`, color: STAGE_COLOR[stageLabel(item)] ?? 'var(--text-tertiary)', border: `0.5px solid color-mix(in srgb, ${STAGE_COLOR[stageLabel(item)] ?? 'var(--text-tertiary)'} 25%, transparent)` }}>
                      {stageLabel(item)}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {item.feedbackGrade ? <span style={{ fontWeight: 'var(--fw-bold)', fontSize: 'var(--fs-14)', color: gc }}>{item.feedbackGrade}</span> : '—'}
                  </td>
                  <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', gap: 'var(--s-2)', flexWrap: 'wrap' }}>
                      {item.stage === '提案准备期' && <button className="ghost-btn small" onClick={() => onAdvance(item.id, '策划案评审')}>→ 策划案评审</button>}
                      {STAGE_NEXT[item.stage] && item.stage !== '提案准备期' && <button className="ghost-btn small" onClick={() => onAdvance(item.id, STAGE_NEXT[item.stage])}>→ {STAGE_NEXT[item.stage]}</button>}
                      {!isArch && !isOnline && <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--fs-12)', color: 'var(--text-tertiary)', padding: '3px 6px' }} onClick={() => onArchive(item.id)}>归档</button>}
                      {!isArch && <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--fs-12)', color: 'var(--c-red-500)', padding: '3px 6px' }} onClick={() => onDelete(item.id)}>删除</button>}
                      {isArch && <button className="ghost-btn small" onClick={() => onRestart(item.id)}>重新启动</button>}
                    </div>
                  </td>
                </tr>
              )
            }) : (
              <tr><td colSpan={9} style={{ padding: 'var(--s-9)', textAlign: 'center', color: 'var(--text-quaternary)', fontSize: 'var(--fs-13)' }}>暂无关卡数据</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ══════════ 新建关卡弹窗 ══════════ */
function AddLevelModal({ onClose, onSave }: { onClose: () => void; onSave: (data: Partial<LevelOrder>) => Promise<void> }) {
  const [form, setForm] = useState({ name: '', officialName: '', owner: '', team: '', version: '', deliveryDate: '', kmUrl: '' })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const submit = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try { await onSave(form) } finally { setSaving(false) }
  }
  return (
    <div className="modal-mask" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-card">
        <div className="modal-header">
          <span className="modal-title">新建关卡</span>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-row"><label>约稿名称 *</label><input value={form.name} onChange={(e)=>set('name',e.target.value)} placeholder="填写约稿方案名称" /></div>
          <div className="form-row"><label>正式关卡名</label><input value={form.officialName} onChange={(e)=>set('officialName',e.target.value)} placeholder="最终上线名称" /></div>
          <div className="form-row-split">
            <div className="form-row"><label>负责人</label><input value={form.owner} onChange={(e)=>set('owner',e.target.value)} /></div>
            <div className="form-row"><label>团队</label><input value={form.team} onChange={(e)=>set('team',e.target.value)} /></div>
          </div>
          <div className="form-row-split">
            <div className="form-row"><label>版本</label><input value={form.version} onChange={(e)=>set('version',e.target.value)} /></div>
            <div className="form-row"><label>交付日期</label><input type="date" value={form.deliveryDate} onChange={(e)=>set('deliveryDate',e.target.value)} /></div>
          </div>
          <div className="form-row"><label>KM 链接</label><input value={form.kmUrl} onChange={(e)=>set('kmUrl',e.target.value)} placeholder="https://km.mihoyo.com/doc/..." /></div>
        </div>
        <div className="modal-footer">
          <div className="spacer" />
          <button className="ghost-btn" onClick={onClose}>取消</button>
          <button className="primary-btn" onClick={submit} disabled={saving || !form.name.trim()}>
            {saving ? <span className="spinner" style={{ marginRight: 6 }} /> : null}创建
          </button>
        </div>
      </div>
    </div>
  )
}

/* ══════════ 主视图 ══════════ */
const SUB_TABS = [
  { id: 'list',    label: '关卡列表' },
  { id: 'gantt',   label: '生产协同甘特图' },
  { id: 'pending', label: '待推荐关卡' },
  { id: 'pool',    label: '推荐池' },
] as const
type SubTab = (typeof SUB_TABS)[number]['id']

export default function LevelCenter() {
  const [subTab, setSubTab]   = useState<SubTab>('list')
  const [orders, setOrders]   = useState<LevelOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  const load = useCallback(async () => {
    try {
      const res  = await fetch('/api/orders')
      const data = await res.json()
      if (data.ok) setOrders(data.orders ?? [])
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const handleAdvance = async (id: string, nextStage: string) => {
    await apiPut(`/api/orders/${id}`, { stage: nextStage })
    await load()
  }
  const handleDelete = async (id: string) => {
    if (!confirm('确认删除该关卡？')) return
    await fetch(`/api/orders/${id}`, { method: 'DELETE' })
    await load()
  }
  const handleArchive = async (id: string) => {
    await apiPut(`/api/orders/${id}`, { stage: '已归档' })
    await load()
  }
  const handleRestart = async (id: string) => {
    await apiPut(`/api/orders/${id}`, { stage: '提案准备期' })
    await load()
  }
  const handleAdd = async (data: Partial<LevelOrder>) => {
    await apiPost('/api/orders', data)
    setShowAdd(false)
    await load()
  }

  return (
    <div style={{ padding: 'var(--s-8) var(--s-9)', display: 'flex', flexDirection: 'column', gap: 'var(--s-7)', maxWidth: 1280, margin: '0 auto' }}>
      {/* 页头 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--s-4)' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 'var(--fs-22)', fontWeight: 'var(--fw-semi)', color: 'var(--text-primary)' }}>关卡中心</h1>
          <p style={{ margin: '4px 0 0', fontSize: 'var(--fs-13)', color: 'var(--text-tertiary)' }}>关卡全生命周期管理</p>
        </div>
        <button className="primary-btn" onClick={() => setShowAdd(true)}>＋ 新建关卡</button>
      </div>

      {/* 子 Tab */}
      <div className="view-tabs">
        {SUB_TABS.map(({ id, label }) => (
          <button key={id} className={`view-tab ${subTab === id ? 'active' : ''}`} onClick={() => setSubTab(id)}>
            <span className="view-tab-icon">{id === 'list' ? '☰' : id === 'gantt' ? '⊟' : id === 'pending' ? '◎' : '▣'}</span>
            {label}
            {id === 'list' && <span className="view-tab-badge">{orders.filter(o => o.stage !== '已归档').length}</span>}
            {id === 'pending' && <span className="view-tab-badge">{orders.filter(o => o.stage === '待推荐').length}</span>}
          </button>
        ))}
      </div>

      {/* 内容区 */}
      <div style={{ background: 'var(--surface-elevated)', borderRadius: 'var(--r-12)', border: '0.5px solid var(--border-default)', boxShadow: 'var(--shadow-1)', overflow: 'hidden', padding: 'var(--s-6)' }}>
        {loading ? (
          <div style={{ padding: 'var(--s-12)', textAlign: 'center', color: 'var(--text-quaternary)' }}>
            <span className="spinner" />
          </div>
        ) : (
          <>
            {subTab === 'list'    && <LevelTable orders={orders} onAdvance={handleAdvance} onDelete={handleDelete} onArchive={handleArchive} onRestart={handleRestart} />}
            {subTab === 'gantt'   && <GanttChart orders={orders} />}
            {subTab === 'pending' && <PendingRecommendList orders={orders} />}
            {subTab === 'pool'    && <RecommendPool />}
          </>
        )}
      </div>

      {showAdd && <AddLevelModal onClose={() => setShowAdd(false)} onSave={handleAdd} />}
    </div>
  )
}
