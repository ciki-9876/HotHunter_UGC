// 大盘数据视图 — 迁移自 dashboard.js + monitor.js + analysis.js
// 严格只使用 index.css 设计令牌

import { useEffect, useRef, useState } from 'react'
import { ReportBlocks, type Block } from '../components/AnalysisBlock'
import { useAnalysisPoll } from '../hooks/useAnalysisPoll'

/* ══════════ 类型 ══════════ */
interface FocusCard { id: string; priority: 'P0'|'P1'|'P2'; title: string; content: string; action?: string; action_link?: string }
interface OkrItem   { key: string; progress_pct: number; current?: string; sub_current?: string; status?: string }
interface OkrData   { period_pct: number; items: OkrItem[] }
interface DetailSection { source: string; title: string; content: string }
interface DashboardCache {
  version_name?: string; update_date?: string
  summary_headline?: string; summary_detail?: string
  okr_progress?: OkrData
  focus_cards?: FocusCard[]
  detailed_report?: { generated_at?: string; sections?: DetailSection[] }
}
interface MonitorReport {
  report_id: string; type: '日报'|'周报'|'版本汇报'
  periodLabel: string; sourceDocId: string; generatedAt: string
  summary?: string; blocks?: Block[]; findings?: string[]; strategySuggestions?: string[]
}

/* ══════════ OKR 工具 ══════════ */
function calcPeriodPct() {
  const start = new Date('2026-02-01'), end = new Date('2026-12-31'), now = new Date()
  return Math.min(100, Math.round(Math.max(0, now.getTime() - start.getTime()) / (end.getTime() - start.getTime()) * 1000) / 10)
}
function okrStatus(completionPct: number, periodPct: number) {
  const diff = completionPct - periodPct
  if (diff < -20) return 'warn'
  if (diff >= 10)  return 'good'
  return 'normal'
}
const OKR_STATUS_COLOR: Record<string, string> = {
  warn:   'var(--status-warn-fg)',
  good:   'var(--status-done-fg)',
  normal: 'var(--text-tertiary)',
}
const OKR_STATUS_LABEL: Record<string, string> = {
  warn: '⚠ 进度偏慢', good: '✦ 进展超前', normal: '进度正常',
}

/* ══════════ 子组件 ══════════ */

/* ── OKR ── */
function OkrSection({ data, periodPct }: { data: OkrData; periodPct: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-4)' }}>
      {data.items.map((item) => {
        const pct = Math.min(100, Math.max(0, item.progress_pct ?? 0))
        const st  = item.status ?? okrStatus(pct, periodPct)
        return (
          <div key={item.key} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--fs-12)', color: 'var(--text-secondary)', fontWeight: 'var(--fw-medium)' }}>{item.key}</span>
              <span style={{ fontSize: 'var(--fs-11)', color: OKR_STATUS_COLOR[st] }}>{OKR_STATUS_LABEL[st]}</span>
            </div>
            <div style={{ height: 6, borderRadius: 'var(--r-full)', background: 'var(--c-neutral-200)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 'var(--r-full)', transition: 'width 0.4s ease',
                width: `${pct}%`,
                background: st === 'warn' ? 'var(--c-orange-500)' : st === 'good' ? 'var(--c-green-500)' : 'var(--accent-base)',
              }} />
            </div>
            {item.current && (
              <span style={{ fontSize: 'var(--fs-11)', color: 'var(--text-tertiary)' }}>当前：{item.current}{item.sub_current ? ` / ${item.sub_current}` : ''}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ── 关注点卡片 ── */
const PRI_COLOR: Record<string, string> = {
  P0: 'var(--c-red-500)', P1: 'var(--c-orange-500)', P2: 'var(--c-purple-500)',
}
function FocusCards({ cards }: { cards: FocusCard[] }) {
  const sorted = [...cards]
    .filter((c) => ['P0','P1','P2'].includes(c.priority))
    .sort((a, b) => a.priority.localeCompare(b.priority))
  if (!sorted.length) return (
    <div style={{ padding: 'var(--s-9)', textAlign: 'center', color: 'var(--text-quaternary)', fontSize: 'var(--fs-13)' }}>
      暂无关注点，点击「刷新大盘」生成
    </div>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' }}>
      {sorted.map((card) => {
        const clr = PRI_COLOR[card.priority] ?? 'var(--text-tertiary)'
        return (
          <div key={card.id} style={{
            display: 'flex', alignItems: 'stretch', gap: 0,
            borderRadius: 'var(--r-8)', border: '0.5px solid var(--border-default)',
            background: 'var(--surface-elevated)', overflow: 'hidden', boxShadow: 'var(--shadow-1)',
          }}>
            {/* 左色块 */}
            <div style={{ width: 56, background: `color-mix(in srgb, ${clr} 10%, transparent)`, borderRight: `2px solid ${clr}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontWeight: 'var(--fw-bold)', fontSize: 'var(--fs-14)', color: clr }}>{card.priority}</span>
            </div>
            {/* 中内容 */}
            <div style={{ flex: 1, padding: '12px 14px', minWidth: 0 }}>
              <p style={{ margin: '0 0 4px', fontSize: 'var(--fs-13)', fontWeight: 'var(--fw-semi)', color: clr }}>{card.title}</p>
              <p style={{ margin: 0, fontSize: 'var(--fs-12)', color: 'var(--text-secondary)', lineHeight: 'var(--lh-snug)' }}>{card.content}</p>
            </div>
            {/* 右按钮 */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '0 14px', flexShrink: 0 }}>
              <button className="ghost-btn small">{card.action ?? '查看详情'}</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ── 报告 Tab ── */
const REPORT_TABS: Array<'日报'|'周报'|'版本汇报'> = ['日报', '周报', '版本汇报']
function ReportSection({ reports }: { reports: MonitorReport[] }) {
  const available = REPORT_TABS.filter((t) => reports.some((r) => r.type === t))
  const [tab, setTab] = useState<string>(available[0] ?? '日报')
  const [page, setPage] = useState(0)

  useEffect(() => { setPage(0) }, [tab])

  if (!available.length) return (
    <div style={{ padding: 'var(--s-9)', textAlign: 'center', color: 'var(--text-quaternary)', fontSize: 'var(--fs-13)' }}>
      暂无分析报告，点击「运行 AI 分析」生成
    </div>
  )

  const filtered = reports.filter((r) => r.type === tab)
  const current  = filtered[page]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-5)' }}>
      {/* Tab 栏 */}
      <div className="view-tabs">
        {available.map((t) => (
          <button key={t} className={`view-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t}
            <span className="view-tab-badge">{reports.filter((r) => r.type === t).length}</span>
          </button>
        ))}
      </div>

      {current ? (
        <div style={{ background: 'var(--surface-elevated)', borderRadius: 'var(--r-12)', border: '0.5px solid var(--border-default)', padding: 'var(--s-6)', boxShadow: 'var(--shadow-1)' }}>
          {/* 报告头 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--s-5)', flexWrap: 'wrap', gap: 'var(--s-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-3)' }}>
              <span className="status-pill done" style={{ fontSize: 'var(--fs-11)', padding: '3px 8px' }}>{current.type}</span>
              <strong style={{ fontSize: 'var(--fs-15)', color: 'var(--text-primary)' }}>{current.periodLabel}</strong>
            </div>
            <div style={{ display: 'flex', gap: 'var(--s-3)', fontSize: 'var(--fs-11)', color: 'var(--text-tertiary)' }}>
              <span>🗂 {current.sourceDocId}</span>
              <span>🕐 {(current.generatedAt ?? '').slice(0, 16)}</span>
            </div>
          </div>
          {/* 内容 */}
          {current.blocks?.length ? (
            <ReportBlocks blocks={current.blocks} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-4)' }}>
              {current.summary && <p style={{ margin: 0, fontSize: 'var(--fs-13)', color: 'var(--text-secondary)', lineHeight: 'var(--lh-base)' }}>{current.summary}</p>}
              {current.findings?.map((f, i) => <p key={i} style={{ margin: 0, fontSize: 'var(--fs-13)', color: 'var(--text-primary)' }}>📊 {f}</p>)}
              {current.strategySuggestions?.map((s, i) => <p key={i} style={{ margin: 0, fontSize: 'var(--fs-13)', color: 'var(--c-blue-500)' }}>🚀 {s}</p>)}
            </div>
          )}
          {/* 翻页 */}
          {filtered.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 'var(--s-4)', marginTop: 'var(--s-6)', paddingTop: 'var(--s-5)', borderTop: '0.5px solid var(--border-subtle)' }}>
              <button className="ghost-btn small" disabled={page <= 0} onClick={() => setPage((p) => p - 1)}>上一篇</button>
              <span style={{ fontSize: 'var(--fs-12)', color: 'var(--text-tertiary)' }}>第 {page + 1} / {filtered.length} 篇</span>
              <button className="ghost-btn small" disabled={page >= filtered.length - 1} onClick={() => setPage((p) => p + 1)}>下一篇</button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ padding: 'var(--s-9)', textAlign: 'center', color: 'var(--text-quaternary)', fontSize: 'var(--fs-13)' }}>该类型暂无报告</div>
      )}
    </div>
  )
}

/* ══════════ 主视图 ══════════ */
export default function DauView() {
  const [cache, setCache]         = useState<DashboardCache>({})
  const [reports, setReports]     = useState<MonitorReport[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState('')
  const periodPct = calcPeriodPct()
  const { status: pollStatus, start: startPoll } = useAnalysisPoll()

  /* ── 加载缓存 ── */
  const loadCache = async () => {
    try {
      const res  = await fetch('/api/dashboard/cache')
      const data = await res.json()
      if (data.ok && data.cache) setCache(data.cache)
    } catch { /* 无缓存静默 */ }
  }

  /* ── 加载报告 ── */
  const loadReports = async () => {
    try {
      const res  = await fetch('/api/monitor/state')
      const data = await res.json()
      if (data.ok && data.reports) setReports(data.reports)
    } catch { /* 静默 */ }
  }

  /* ── 刷新大盘 ── */
  const handleRefresh = async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      const res  = await fetch('/api/dashboard/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' } })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error)
      startPoll(data.refresh_session_id)
    } catch (e: any) {
      setRefreshing(false)
    }
  }

  /* ── 运行分析 ── */
  const handleAnalyze = async () => {
    try {
      const res  = await fetch('/api/monitor/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ report_type: '日报' }) })
      const data = await res.json()
      if (data.job_id) startPoll(data.job_id)
    } catch { /* 静默 */ }
  }

  /* ── 轮询完成后刷新 ── */
  useEffect(() => {
    if (pollStatus === 'done') {
      setRefreshing(false)
      setLastRefresh(new Date().toLocaleTimeString('zh-CN'))
      Promise.all([loadCache(), loadReports()])
    }
    if (pollStatus === 'failed' || pollStatus === 'timeout') setRefreshing(false)
  }, [pollStatus])

  useEffect(() => { loadCache(); loadReports() }, [])

  /* ── 卡片容器 ── */
  const Card = ({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) => (
    <div style={{ background: 'var(--surface-elevated)', borderRadius: 'var(--r-12)', border: '0.5px solid var(--border-default)', boxShadow: 'var(--shadow-1)', overflow: 'hidden' }}>
      <div style={{ padding: 'var(--s-5) var(--s-6)', borderBottom: '0.5px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0, fontSize: 'var(--fs-14)', fontWeight: 'var(--fw-semi)', color: 'var(--text-primary)' }}>{title}</h3>
        {action}
      </div>
      <div style={{ padding: 'var(--s-6)' }}>{children}</div>
    </div>
  )

  return (
    <div style={{ padding: 'var(--s-8) var(--s-9)', display: 'flex', flexDirection: 'column', gap: 'var(--s-7)', maxWidth: 1080, margin: '0 auto' }}>

      {/* 页头 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--s-4)' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 'var(--fs-22)', fontWeight: 'var(--fw-semi)', color: 'var(--text-primary)' }}>千星奇域大盘</h1>
          <p style={{ margin: '4px 0 0', fontSize: 'var(--fs-13)', color: 'var(--text-tertiary)' }}>
            {cache.version_name ? `版本：${cache.version_name}` : ''}
            {cache.update_date ? ` · 信息更新：${cache.update_date}` : ''}
            {lastRefresh ? ` · 最后刷新：${lastRefresh}` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--s-3)' }}>
          <button className="ghost-btn" onClick={handleAnalyze} disabled={pollStatus === 'polling'}>
            {pollStatus === 'polling' ? <span className="spinner" style={{ marginRight: 6 }} /> : null}
            运行 AI 分析
          </button>
          <button className="primary-btn" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? <span className="spinner" style={{ marginRight: 6 }} /> : null}
            刷新大盘
          </button>
        </div>
      </div>

      {/* 摘要 */}
      {(cache.summary_headline || cache.summary_detail) && (
        <div style={{ background: 'var(--accent-tint)', border: '0.5px solid var(--accent-tint-strong)', borderRadius: 'var(--r-10)', padding: 'var(--s-5) var(--s-6)' }}>
          {cache.summary_headline && <strong style={{ fontSize: 'var(--fs-15)', color: 'var(--text-primary)', display: 'block', marginBottom: 4 }}>{cache.summary_headline}</strong>}
          {cache.summary_detail && <p style={{ margin: 0, fontSize: 'var(--fs-13)', color: 'var(--text-secondary)', lineHeight: 'var(--lh-base)' }}>{cache.summary_detail}</p>}
        </div>
      )}

      {/* OKR 进度 */}
      {cache.okr_progress && (
        <Card title={`OKR 进度 · 当前周期 ${periodPct}%`}>
          <OkrSection data={cache.okr_progress} periodPct={periodPct} />
        </Card>
      )}

      {/* 关注点 */}
      <Card
        title="当前关注点"
        action={
          <span style={{ fontSize: 'var(--fs-11)', color: 'var(--text-tertiary)' }}>
            {cache.focus_cards?.length ? `${cache.focus_cards.length} 项` : ''}
          </span>
        }
      >
        <FocusCards cards={cache.focus_cards ?? []} />
      </Card>

      {/* 分析报告 */}
      <Card
        title="分析报告"
        action={
          pollStatus === 'polling' ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-12)', color: 'var(--c-blue-500)' }}>
              <span className="spinner" />后台分析中
            </span>
          ) : null
        }
      >
        <ReportSection reports={reports} />
      </Card>

    </div>
  )
}
