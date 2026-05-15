// 推荐分析师 — 迁移自 banner-report-analysis.js + strategy.js
import { useCallback, useEffect, useState } from 'react'
import { Markdown } from '../components/Markdown'

interface StrategyCard { id: string; category: string; urgency: string; summary: string; detail?: { target?: string; action?: string; expected?: string; rationale?: string } }
interface BannerReport { id: number; title?: string; generated_at?: string; raw_report?: string; schedule_summary?: string; sa_count?: number }

const URGENCY_COLOR: Record<string, string> = {
  '立即': 'var(--c-red-500)', '本周内': 'var(--c-orange-500)',
  '下周启动': 'var(--c-blue-500)', '本版本内': 'var(--text-tertiary)',
}
const CAT_COLOR: Record<string, string> = {
  '推荐策略': 'var(--c-blue-500)', '异常发现': 'var(--c-red-500)',
  '创作者策略': 'var(--c-green-500)', '重要信息': 'var(--c-orange-500)',
}
const SUB_TABS = [
  { id: 'strategy', label: '推荐策略' },
  { id: 'report',   label: '版本分析' },
] as const
type SubTab = (typeof SUB_TABS)[number]['id']

const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{ background: 'var(--surface-elevated)', borderRadius: 'var(--r-12)', border: '0.5px solid var(--border-default)', boxShadow: 'var(--shadow-1)', ...style }}>
    {children}
  </div>
)

/* ═══ 推荐策略 ═══ */
function StrategySection() {
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [cards, setCards]     = useState<StrategyCard[]>([])
  const [raw, setRaw]         = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [urgencyFilter, setUrgencyFilter] = useState('all')

  const run = async () => {
    setRunning(true); setElapsed(0); setCards([]); setRaw('')
    const timer = setInterval(() => setElapsed((n) => n + 1), 1000)
    try {
      const cfgR = await fetch('/api/settings/ai/scenes?scene_key=gameplay_strategy')
      const cfgD = await cfgR.json()
      const agentId = cfgD.merged?.echo_agent_id
      if (!agentId) throw new Error('未配置 Echo Agent，请在「系统管理 → 场景 Agent → 推荐分析师」中绑定')

      const prompt = `你是千星奇域推荐策略分析专家。请基于当前关卡池数据，输出今日运营建议。

输出格式（严格JSON，每条建议包含 id/category/urgency/summary/detail）：
{"type":"strategy_cards","title":"今日运营建议","items":[
  {"id":"s1","category":"推荐策略","urgency":"立即","summary":"策略概述","detail":{"target":"对象","action":"动作","expected":"预期","rationale":"依据"}},
  {"id":"s2","category":"异常发现","urgency":"本周内","summary":"...",  "detail":{...}}
]}

category 枚举：推荐策略/异常发现/创作者策略/重要信息
urgency 枚举：立即/本周内/下周启动/本版本内/下版本初
每类至少输出2条，总计至少5条。`

      const sub = await fetch('/api/dashboard/chat/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: agentId, message: prompt })
      })
      const sd = await sub.json()
      if (!sd.ok) throw new Error(sd.error || '提交失败')

      let answer = ''
      for (let i = 0; i < 100; i++) {
        await new Promise((r) => setTimeout(r, 6000))
        const pd = await (await fetch(`/api/dashboard/chat/status/${sd.session_id}`)).json()
        if (pd.status === 'completed') { answer = pd.answer ?? ''; break }
        if (pd.status === 'failed') throw new Error(pd.error)
      }
      setRaw(answer)
      // 尝试解析 JSON
      const m = answer.match(/\{[\s\S]*"items"\s*:\s*\[[\s\S]*\][\s\S]*\}/)
      if (m) {
        try { const p = JSON.parse(m[0]); setCards(p.items ?? []) } catch {}
      }
    } catch (e: any) { setRaw('❌ ' + (e.message ?? '失败')) }
    finally { clearInterval(timer); setRunning(false) }
  }

  const urgencies = ['all', '立即', '本周内', '下周启动', '本版本内']
  const filtered = urgencyFilter === 'all' ? cards : cards.filter((c) => c.urgency === urgencyFilter)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-5)' }}>
      <div style={{ display: 'flex', gap: 'var(--s-4)', flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="primary-btn" onClick={run} disabled={running}>
          {running ? <><span className="spinner" style={{ marginRight: 6 }} />分析中… {elapsed}s</> : '▶ 运行策略分析'}
        </button>
        <div className="view-tabs" style={{ flex: 0 }}>
          {urgencies.map((u) => (
            <button key={u} className={`view-tab ${urgencyFilter === u ? 'active' : ''}`} style={{ padding: '5px 10px', fontSize: 'var(--fs-12)' }} onClick={() => setUrgencyFilter(u)}>
              {u === 'all' ? '全部' : u}
            </button>
          ))}
        </div>
      </div>

      {filtered.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' }}>
          {filtered.map((c) => {
            const uc = URGENCY_COLOR[c.urgency] ?? 'var(--text-tertiary)'
            const cc = CAT_COLOR[c.category] ?? 'var(--text-tertiary)'
            return (
              <Card key={c.id} style={{ overflow: 'hidden' }}>
                <div style={{ display: 'flex', gap: 'var(--s-4)', padding: 'var(--s-4) var(--s-5)', cursor: 'pointer', alignItems: 'flex-start' }} onClick={() => setExpanded(expanded === c.id ? null : c.id)}>
                  <div style={{ width: 4, background: uc, borderRadius: 2, alignSelf: 'stretch', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 'var(--s-2)', flexWrap: 'wrap', marginBottom: 'var(--s-2)' }}>
                      <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 'var(--r-4)', background: `color-mix(in srgb, ${cc} 12%, transparent)`, color: cc, border: `0.5px solid color-mix(in srgb, ${cc} 25%, transparent)` }}>{c.category}</span>
                      <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 'var(--r-4)', background: `color-mix(in srgb, ${uc} 12%, transparent)`, color: uc, border: `0.5px solid color-mix(in srgb, ${uc} 25%, transparent)` }}>{c.urgency}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 'var(--fs-13)', color: 'var(--text-primary)', lineHeight: 'var(--lh-snug)' }}>{c.summary}</p>
                  </div>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: 12, flexShrink: 0 }}>{expanded === c.id ? '▲' : '▼'}</span>
                </div>
                {expanded === c.id && c.detail && (
                  <div style={{ padding: 'var(--s-3) var(--s-5) var(--s-5) calc(var(--s-5) + 8px)', borderTop: '0.5px solid var(--border-subtle)' }}>
                    {[['对象', c.detail.target], ['操作', c.detail.action], ['预期', c.detail.expected], ['依据', c.detail.rationale]].map(([label, val]) =>
                      val ? <p key={label} style={{ margin: '0 0 var(--s-2)', fontSize: 'var(--fs-12)', color: 'var(--text-secondary)' }}><strong style={{ color: 'var(--text-tertiary)', fontWeight: 'var(--fw-medium)' }}>{label}：</strong>{val}</p> : null
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      ) : raw ? (
        <Card style={{ padding: 'var(--s-6)' }}><Markdown source={raw} /></Card>
      ) : (
        <div style={{ padding: 'var(--s-12)', textAlign: 'center', color: 'var(--text-quaternary)', fontSize: 'var(--fs-13)' }}>点击「运行策略分析」生成今日运营建议</div>
      )}
    </div>
  )
}

/* ═══ 版本分析 ═══ */
function VersionReportSection() {
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [result, setResult]   = useState('')
  const [history, setHistory] = useState<BannerReport[]>([])
  const [expanded, setExpanded] = useState<number | null>(null)

  const loadHistory = useCallback(() => {
    try {
      const h = JSON.parse(localStorage.getItem('ugc_rr_report_history') || '[]')
      setHistory(h)
    } catch {}
  }, [])
  useEffect(() => { loadHistory() }, [loadHistory])

  const run = async () => {
    setRunning(true); setElapsed(0); setResult('')
    const timer = setInterval(() => setElapsed((n) => n + 1), 1000)
    try {
      const cfgR = await fetch('/api/settings/ai/scenes?scene_key=report_generate')
      const cfgD = await cfgR.json()
      const agentId = cfgD.merged?.echo_agent_id
      if (!agentId) throw new Error('未配置 Echo Agent，请在「系统管理 → 场景 Agent → 报告生成」中绑定')

      const prompt = `请调用 banner-daily-schedule 技能，获取当前排期数据，完成今日头图推荐排期报告。
如遇工具失败，直接基于已有知识库数据输出。

请输出以下内容：
1. 明日上线名单（5张，含状态/档位/核心依据）
2. 候补顺位（第6-10位，含推荐率/游玩人数/时长）
3. 本次调整说明（下放关卡 + 未纳入关卡及原因）
4. 执行规则速查
5. 今日风险提示（含关卡名和具体问题）`

      const sub = await fetch('/api/dashboard/chat/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: agentId, message: prompt })
      })
      const sd = await sub.json()
      if (!sd.ok) throw new Error(sd.error || '提交失败')

      let answer = ''
      for (let i = 0; i < 200; i++) {
        await new Promise((r) => setTimeout(r, 5000))
        const pd = await (await fetch(`/api/dashboard/chat/status/${sd.session_id}`)).json()
        if (pd.status === 'completed') { answer = pd.answer ?? ''; break }
        if (pd.status === 'failed') throw new Error(pd.error)
      }
      setResult(answer)
      // 保存到 localStorage 历史
      const now = new Date().toLocaleString('zh-CN')
      const newRecord = { id: Date.now(), title: `版本报告分析 · ${now}`, generated_at: now, raw_report: answer, schedule_summary: '', sa_count: 0 }
      const h = [...history.slice(0, 29), newRecord]
      localStorage.setItem('ugc_rr_report_history', JSON.stringify(h))
      setHistory(h)
    } catch (e: any) { setResult('❌ ' + (e.message ?? '失败')) }
    finally { clearInterval(timer); setRunning(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-5)' }}>
      <div style={{ display: 'flex', gap: 'var(--s-4)', alignItems: 'center' }}>
        <button className="primary-btn" onClick={run} disabled={running}>
          {running ? <><span className="spinner" style={{ marginRight: 6 }} />分析中… {elapsed}s</> : '▶ 运行版本分析'}
        </button>
        <span style={{ fontSize: 'var(--fs-12)', color: 'var(--text-tertiary)' }}>基于 banner-daily-schedule 数据生成今日头图排班建议</span>
      </div>
      {result && <Card style={{ padding: 'var(--s-6)' }}><Markdown source={result} /></Card>}
      {history.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' }}>
          <p style={{ margin: 0, fontSize: 'var(--fs-12)', color: 'var(--text-tertiary)', fontWeight: 'var(--fw-semi)' }}>历史报告</p>
          {history.map((h) => (
            <Card key={h.id} style={{ overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-4)', padding: 'var(--s-4) var(--s-5)', cursor: 'pointer' }} onClick={() => setExpanded(expanded === h.id ? null : h.id)}>
                <span style={{ flex: 1, fontSize: 'var(--fs-13)', color: 'var(--text-primary)' }}>{h.title}</span>
                <span style={{ fontSize: 10, color: 'var(--text-quaternary)', fontFamily: 'var(--font-mono)' }}>{h.generated_at?.slice(0, 16)}</span>
                <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{expanded === h.id ? '▲' : '▼'}</span>
              </div>
              {expanded === h.id && h.raw_report && (
                <div style={{ padding: 'var(--s-4) var(--s-6) var(--s-5)', borderTop: '0.5px solid var(--border-subtle)' }}>
                  <Markdown source={h.raw_report} />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

/* ═══ 主视图 ═══ */
export default function RecommendAnalyst() {
  const [tab, setTab] = useState<SubTab>('strategy')
  return (
    <div style={{ padding: 'var(--s-8) var(--s-9)', display: 'flex', flexDirection: 'column', gap: 'var(--s-7)', maxWidth: 1080, margin: '0 auto' }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 'var(--fs-22)', fontWeight: 'var(--fw-semi)', color: 'var(--text-primary)' }}>推荐分析师</h1>
        <p style={{ margin: '4px 0 0', fontSize: 'var(--fs-13)', color: 'var(--text-tertiary)' }}>推荐策略建议 · 版本头图排期分析</p>
      </div>
      <div className="view-tabs">
        {SUB_TABS.map(({ id, label }) => (
          <button key={id} className={`view-tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      {tab === 'strategy' && <StrategySection />}
      {tab === 'report'   && <VersionReportSection />}
    </div>
  )
}
