// 版更工具人 — 迁移自 index.html version-worker 区块
import { useEffect, useRef, useState } from 'react'

const SUB_TABS = [
  { id: 'calendar', label: '版更日历' },
  { id: 'tasks',    label: '任务看板' },
] as const
type SubTab = (typeof SUB_TABS)[number]['id']

const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{ background: 'var(--surface-elevated)', borderRadius: 'var(--r-12)', border: '0.5px solid var(--border-default)', boxShadow: 'var(--shadow-1)', ...style }}>
    {children}
  </div>
)

/* ── 版更日历（iframe） ── */
function GachaCalendar() {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [status, setStatus] = useState<'loading'|'ok'|'error'>('loading')

  useEffect(() => {
    // 延迟加载 iframe，避免首次渲染时的跳动
    const t = setTimeout(() => {
      if (iframeRef.current) iframeRef.current.src = '/proxy/gacha-calendar/'
    }, 100)
    return () => clearTimeout(t)
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-4)' }}>
      {status === 'error' && (
        <Card style={{ padding: 'var(--s-5)', textAlign: 'center' }}>
          <p style={{ margin: '0 0 var(--s-3)', fontSize: 'var(--fs-13)', color: 'var(--text-secondary)' }}>⚠️ 版更日历服务暂不可用</p>
          <p style={{ margin: '0 0 var(--s-4)', fontSize: 'var(--fs-12)', color: 'var(--text-tertiary)' }}>请确认版更配置小助手的 <code style={{ fontFamily: 'var(--font-mono)', background: 'var(--c-neutral-100)', padding: '1px 5px', borderRadius: 'var(--r-4)' }}>calendar_app.py</code> 已在 8060 端口启动</p>
          <button className="ghost-btn small" onClick={() => { setStatus('loading'); if (iframeRef.current) { iframeRef.current.src = ''; setTimeout(() => { if (iframeRef.current) iframeRef.current.src = '/proxy/gacha-calendar/' }, 200) } }}>
            重新加载
          </button>
        </Card>
      )}
      <div style={{ position: 'relative', borderRadius: 'var(--r-12)', overflow: 'hidden', border: '0.5px solid var(--border-default)', background: 'var(--surface-elevated)', minHeight: 600 }}>
        {status === 'loading' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--s-4)', color: 'var(--text-quaternary)', background: 'var(--surface-elevated)', zIndex: 1 }}>
            <span className="spinner" style={{ width: 24, height: 24 }} />
            <span style={{ fontSize: 'var(--fs-13)' }}>正在加载版更日历…</span>
          </div>
        )}
        <iframe
          ref={iframeRef}
          title="UGC 版更日历"
          allow="same-origin"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
          onLoad={() => setStatus('ok')}
          onError={() => setStatus('error')}
          style={{ width: '100%', height: 700, border: 'none', display: 'block' }}
        />
      </div>
    </div>
  )
}

/* ── 任务看板 ── */
interface Task { text: string; done?: boolean; urgent?: boolean }
interface DayData { label: string; today?: boolean; tasks: Task[] }
interface Milestone { date: string; label: string; daysLeft: number; warn?: boolean }

const WEEK_DATA: DayData[] = [
  { label: '周一', tasks: [{ text: '关卡池周报整理', done: true }, { text: '策划案评审会议', done: true }] },
  { label: '周二', tasks: [{ text: '创作者签约跟进', done: true }, { text: '推荐位排期确认' }] },
  { label: '周三', tasks: [{ text: '例行数据监控' }] },
  { label: '周四', today: true, tasks: [{ text: '打回关卡跟催', urgent: true }, { text: '数据周报' }] },
  { label: '周五', tasks: [{ text: '版本提测 checklist' }, { text: '内容上线审核' }] },
]
const MILESTONES: Milestone[] = [
  { date: '2026-05-08', label: 'v5.3 内容锁定截止', daysLeft: 14, warn: true },
  { date: '2026-05-20', label: 'v5.3 正式上线', daysLeft: 26 },
  { date: '2026-06-10', label: 'v5.4 策划案截止', daysLeft: 47 },
]

function TaskBoard() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-6)' }}>
      {/* 本周日历 */}
      <Card style={{ padding: 'var(--s-5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--s-5)' }}>
          <p style={{ margin: 0, fontSize: 'var(--fs-11)', fontWeight: 'var(--fw-semi)', color: 'var(--text-tertiary)', letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase' }}>本周任务日历</p>
          <span style={{ fontSize: 'var(--fs-12)', color: 'var(--text-tertiary)' }}>v5.3 · 上线倒计时 <strong style={{ color: 'var(--text-primary)' }}>26</strong> 天</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 'var(--s-3)' }}>
          {WEEK_DATA.map(({ label, today, tasks }) => (
            <div key={label} style={{ background: today ? 'var(--accent-tint)' : 'var(--c-neutral-50)', borderRadius: 'var(--r-8)', padding: 'var(--s-4)', border: today ? '1px solid var(--accent-base)' : '0.5px solid var(--border-subtle)' }}>
              <p style={{ margin: '0 0 var(--s-3)', fontSize: 'var(--fs-12)', fontWeight: 'var(--fw-semi)', color: today ? 'var(--accent-base)' : 'var(--text-secondary)' }}>
                {label} {today && <span style={{ fontSize: 10, background: 'var(--accent-base)', color: '#fff', borderRadius: 'var(--r-full)', padding: '0 5px', marginLeft: 4 }}>今天</span>}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
                {tasks.map((t, i) => (
                  <div key={i} style={{ fontSize: 'var(--fs-12)', color: t.done ? 'var(--text-quaternary)' : t.urgent ? 'var(--c-orange-500)' : 'var(--text-primary)', textDecoration: t.done ? 'line-through' : 'none' }}>
                    {t.done ? '✓ ' : t.urgent ? '⚠ ' : '• '}{t.text}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
      {/* 版本里程碑 */}
      <Card style={{ padding: 'var(--s-5)' }}>
        <p style={{ margin: '0 0 var(--s-4)', fontSize: 'var(--fs-11)', fontWeight: 'var(--fw-semi)', color: 'var(--text-tertiary)', letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase' }}>版本里程碑</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' }}>
          {MILESTONES.map(({ date, label, daysLeft, warn }) => (
            <div key={date} style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-4)', padding: 'var(--s-3) var(--s-4)', borderRadius: 'var(--r-6)', background: warn ? 'color-mix(in srgb, var(--c-orange-500) 6%, transparent)' : 'var(--c-neutral-50)', border: `0.5px solid ${warn ? 'var(--c-orange-500)' : 'var(--border-subtle)'}` }}>
              <span style={{ fontSize: 'var(--fs-12)', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', flexShrink: 0 }}>{date}</span>
              <span style={{ flex: 1, fontSize: 'var(--fs-13)', color: 'var(--text-primary)' }}>{label}</span>
              <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 'var(--r-full)', background: warn ? 'color-mix(in srgb, var(--c-orange-500) 14%, transparent)' : 'var(--c-neutral-100)', color: warn ? 'var(--c-orange-500)' : 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                {daysLeft} 天
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

export default function VersionWorker() {
  const [tab, setTab] = useState<SubTab>('calendar')
  return (
    <div style={{ padding: 'var(--s-8) var(--s-9)', display: 'flex', flexDirection: 'column', gap: 'var(--s-7)', maxWidth: 1200, margin: '0 auto' }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 'var(--fs-22)', fontWeight: 'var(--fw-semi)', color: 'var(--text-primary)' }}>版更工具人</h1>
        <p style={{ margin: '4px 0 0', fontSize: 'var(--fs-13)', color: 'var(--text-tertiary)' }}>版更日历 · 任务看板</p>
      </div>
      <div className="view-tabs">
        {SUB_TABS.map(({ id, label }) => (
          <button key={id} className={`view-tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      {tab === 'calendar' && <GachaCalendar />}
      {tab === 'tasks'    && <TaskBoard />}
    </div>
  )
}
