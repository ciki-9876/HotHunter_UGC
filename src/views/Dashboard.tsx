import { useMemo, useState, type CSSProperties } from 'react'
import { useBlueprint } from '../store'
import type { HotTopicCard, HotTopicType } from '../agent/dispatch'

const FILTERS: Array<'全部' | HotTopicType | '我的关注' | '生产中'> = [
  '全部',
  '热梗',
  '联动',
  '版本节点',
  '游戏',
  '短剧/动漫',
  '我的关注',
  '生产中',
]

function relTime(ts: number): string {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时前`
  const d = Math.floor(h / 24)
  return `${d} 天前`
}

function stageLabel(card: HotTopicCard): string {
  switch (card.stage) {
    case 'rising':
      return '上升期'
    case 'peak':
      return '峰值期'
    case 'fading':
      return '衰退期'
    default:
      return '稳定期'
  }
}

function urgencyLabel(card: HotTopicCard): string {
  if (card.urgency === 'high') return '窗口紧张'
  if (card.urgency === 'medium') return '需要排期'
  return '可观察'
}

function sourceLabel(card: HotTopicCard): string {
  if (card.source === 'workflow') return '工作流回传'
  if (card.source === 'manual') return '人工补录'
  return '外部热点'
}

function fitStars(score: number): string {
  const full = Math.max(1, Math.min(5, Math.round(score / 20)))
  return '★★★★★'.slice(0, full) + '☆☆☆☆☆'.slice(0, 5 - full)
}

function formatDateOffset(days: number): string {
  const date = new Date(Date.now() + days * 86400000)
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function HotListItem({
  card,
  active,
  onSelect,
}: {
  card: HotTopicCard
  active: boolean
  onSelect: () => void
}) {
  return (
    <button
      className={`radar-list-item ${active ? 'active' : ''} ${card.status === 'ignored' ? 'muted' : ''}`}
      onClick={onSelect}
    >
      <div className="radar-list-top">
        <span className={`urgency-dot ${card.urgency ?? 'medium'}`} />
        <span className="radar-list-title">{card.title}</span>
        <span className="radar-score">{card.hotScore}</span>
      </div>
      <div className="radar-list-meta">
        <span>{card.topicType ?? '热梗'}</span>
        <span>{card.platforms?.length ?? 1} 源</span>
        <span>剩余 {card.windowDays ?? 7} 天</span>
      </div>
      <div className="radar-list-foot">
        <span className={`stage-pill ${card.stage ?? 'stable'}`}>
          {stageLabel(card)}
        </span>
        {card.status === 'watching' && <span className="mini-pill watch">关注</span>}
        {card.status === 'in-production' && <span className="mini-pill prod">生产中</span>}
      </div>
    </button>
  )
}

function EmptyDetails() {
  return (
    <div className="radar-detail empty">
      <div className="empty-state">
        暂无热点。可以点击刷新热点，或用人工补录把运营巡查到的信号先放进来。
      </div>
    </div>
  )
}

function EvaluationReport({ card }: { card: HotTopicCard }) {
  const report = card.evaluation
  if (!report) {
    return (
      <div className="evaluation-placeholder">
        <span>热点评估 Agent 尚未运行</span>
        <p>发起深评后会生成调性匹配、时效窗口、玩法方向、创作者匹配与立项建议。</p>
      </div>
    )
  }

  return (
    <div className="evaluation-card">
      <div className="evaluation-head">
        <div>
          <span className="panel-kicker">热点深度分析报告</span>
          <h3>{card.title}</h3>
        </div>
        <span className={`decision-chip ${report.recommendation === '建议立项' ? 'go' : report.recommendation === '谨慎立项' ? 'watch' : 'stop'}`}>
          {report.recommendation} · {report.priority}
        </span>
      </div>

      <div className="report-grid">
        <div className="report-block">
          <span className="report-label">热度趋势</span>
          <b>{report.trendSummary}</b>
          <p>跨平台热度：{card.platforms?.join(' / ') ?? '未知'}，发现于 {relTime(card.createdAt)}。</p>
        </div>
        <div className="report-block">
          <span className="report-label">游戏调性</span>
          <b>{fitStars(report.toneMatch * 20)} {report.toneMatch.toFixed(1)}/5</b>
          <p>{report.targetAudience} · {report.emotionalDirection.join(' / ')}</p>
        </div>
        <div className="report-block">
          <span className="report-label">时效窗口</span>
          <b>{report.windowSummary}</b>
          <p>预计峰值：{report.peakInDays > 0 ? `${report.peakInDays} 天后` : '当前或已过峰值'}</p>
        </div>
        <div className="report-block">
          <span className="report-label">制作可行性</span>
          <b>{report.feasibility}</b>
          <p>预估制作周期：{report.productionCycleDays} 天。</p>
        </div>
      </div>

      <div className="playway-list">
        {report.gameplayDirections.map((item, idx) => (
          <div className="playway-row" key={item.title}>
            <span className="playway-rank">{idx + 1}</span>
            <div>
              <b>{item.title}</b>
              <p>{item.reason}</p>
            </div>
            <span className="playway-meta">
              留存{item.retention} · 难度{item.difficulty}
            </span>
          </div>
        ))}
      </div>

      <div className="risk-strip">
        {report.risks.map((risk) => (
          <span key={risk}>{risk}</span>
        ))}
      </div>
    </div>
  )
}

function Timeline({ cards }: { cards: HotTopicCard[] }) {
  const visible = cards
    .filter((card) => card.status !== 'ignored')
    .slice()
    .sort((a, b) => (a.windowDays ?? 7) - (b.windowDays ?? 7))
    .slice(0, 5)

  const bannerSlots = [
    { name: '当前占用：版本专题', start: 0, width: 19, tone: 'busy' },
    { name: '空档 2 天', start: 38, width: 12, tone: 'open' },
    { name: '预占：周末推荐', start: 66, width: 22, tone: 'busy' },
  ]

  return (
    <section className="timeline-panel">
      <div className="timeline-head">
        <div>
          <span className="panel-kicker">热点时效日历</span>
          <h3>热点窗口 × Banner 排期</h3>
        </div>
        <span className="section-hint">未来 30 天 · MVP 视图</span>
      </div>
      <div className="timeline-scale">
        {[0, 2, 4, 6, 8, 10, 12].map((day) => (
          <span key={day}>{day === 0 ? '今天' : `+${day}d`}</span>
        ))}
      </div>
      <div className="timeline-rows">
        {visible.map((card, idx) => {
          const width = Math.max(12, Math.min(78, ((card.windowDays ?? 7) / 14) * 72))
          const delayed = card.stage === 'rising' ? 2 + idx * 2 : idx * 2
          const conflict = (card.windowDays ?? 7) < (card.evaluation?.productionCycleDays ?? 8)
          return (
            <div className={`timeline-row ${conflict ? 'conflict' : ''}`} key={card.id}>
              <span className="timeline-label">{card.title}</span>
              <div className="timeline-track">
                <div
                  className={`timeline-bar ${card.urgency ?? 'medium'}`}
                  style={{ left: `${delayed}%`, width: `${width}%` }}
                >
                  {conflict ? '错配风险' : `窗口 ${card.windowDays ?? 7} 天`}
                </div>
              </div>
            </div>
          )
        })}
        <div className="timeline-row banner">
          <span className="timeline-label">Banner</span>
          <div className="timeline-track">
            {bannerSlots.map((slot) => (
              <div
                className={`banner-slot ${slot.tone}`}
                key={slot.name}
                style={{ left: `${slot.start}%`, width: `${slot.width}%` }}
              >
                {slot.name}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function DetailPanel({ card }: { card: HotTopicCard }) {
  const markHotTopic = useBlueprint((s) => s.markHotTopic)
  const evaluateHotTopic = useBlueprint((s) => s.evaluateHotTopic)
  const sendHotTopicToProduction = useBlueprint((s) => s.sendHotTopicToProduction)

  return (
    <div className="radar-detail">
      <div className="detail-main-card">
        <div className="detail-title-row">
          <div>
            <span className="panel-kicker">热点详情</span>
            <h2>{card.title}</h2>
          </div>
          <div
            className="score-orbit"
            style={{ '--score': card.hotScore } as CSSProperties}
          >
            <span>{card.hotScore}</span>
            <small>综合热度</small>
          </div>
        </div>

        <div className="detail-meta-grid">
          <div>
            <span>平台来源</span>
            <b>{card.platforms?.join(' / ') ?? sourceLabel(card)}</b>
          </div>
          <div>
            <span>发现时间</span>
            <b>{relTime(card.createdAt)}</b>
          </div>
          <div>
            <span>类型</span>
            <b>{card.topicType ?? '热梗'}</b>
          </div>
          <div>
            <span>预估窗口</span>
            <b className={`window-text ${card.urgency ?? 'medium'}`}>
              剩余 {card.windowDays ?? 7} 天 · {urgencyLabel(card)}
            </b>
          </div>
        </div>

        <div className="signal-section">
          <div className="section-mini-title">信号摘要</div>
          <p>{card.summary}</p>
          <div className="signal-list">
            {(card.signals ?? []).map((signal) => (
              <a
                className="signal-row"
                key={`${signal.platform}-${signal.title}`}
                href={signal.url}
                target="_blank"
                rel="noreferrer"
              >
                <span className={`signal-heat ${signal.heat}`}>{signal.heat}</span>
                <span className="signal-platform">{signal.platform}</span>
                <span className="signal-title">{signal.title}</span>
              </a>
            ))}
          </div>
        </div>

        <div className="ai-preview">
          <div>
            <span className="section-mini-title">AI 初步评估</span>
            <p>
              游戏调性匹配度：<b>{fitStars(card.fitScore ?? card.hotScore)}</b>
            </p>
            <p>
              千星可实现性：<b>{(card.fitScore ?? 0) >= 82 ? '高' : (card.fitScore ?? 0) >= 68 ? '中' : '低'}</b>
            </p>
            <p>
              建议动作：
              <b>{(card.hotScore >= 85 || card.urgency === 'high') ? ' 发起深评并进入排期判断' : ' 继续观察或低成本验证'}</b>
            </p>
          </div>
        </div>

        <div className="detail-actions">
          <button className="ghost-btn" onClick={() => markHotTopic(card.id, 'watching')}>
            标记关注
          </button>
          <button className="primary-btn" onClick={() => evaluateHotTopic(card.id)}>
            发起深评
          </button>
          <button className="primary-btn warm" onClick={() => sendHotTopicToProduction(card.id)}>
            进入生产
          </button>
          <button className="ghost-btn danger" onClick={() => markHotTopic(card.id, 'ignored')}>
            忽略
          </button>
        </div>
      </div>

      <EvaluationReport card={card} />
    </div>
  )
}

function ManualAddBox() {
  const addManualHotTopic = useBlueprint((s) => s.addManualHotTopic)
  const [title, setTitle] = useState('')
  const [type, setType] = useState<HotTopicType>('热梗')

  return (
    <div className="manual-add-box">
      <input
        value={title}
        placeholder="人工补录热点，例如：某角色新梗开始扩散"
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            addManualHotTopic(title, type)
            setTitle('')
          }
        }}
      />
      <select value={type} onChange={(e) => setType(e.target.value as HotTopicType)}>
        {FILTERS.filter((f): f is HotTopicType => !['全部', '我的关注', '生产中'].includes(f)).map((f) => (
          <option key={f} value={f}>{f}</option>
        ))}
      </select>
      <button
        className="ghost-btn"
        onClick={() => {
          addManualHotTopic(title, type)
          setTitle('')
        }}
      >
        补录
      </button>
    </div>
  )
}

export default function DashboardView() {
  const cards = useBlueprint((s) => s.dashboardCards)
  const trendLoading = useBlueprint((s) => s.trendLoading)
  const trendError = useBlueprint((s) => s.trendError)
  const trendLastUpdated = useBlueprint((s) => s.trendLastUpdated)
  const refreshHotTopics = useBlueprint((s) => s.refreshHotTopics)

  const [activeFilter, setActiveFilter] = useState<(typeof FILTERS)[number]>('全部')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const visibleCards = useMemo(() => {
    return cards
      .filter((card) => {
        if (activeFilter === '全部') return card.status !== 'ignored'
        if (activeFilter === '我的关注') return card.status === 'watching'
        if (activeFilter === '生产中') return card.status === 'in-production'
        return card.topicType === activeFilter && card.status !== 'ignored'
      })
      .sort((a, b) => {
        const urgencyA = a.urgency === 'high' ? 2 : a.urgency === 'medium' ? 1 : 0
        const urgencyB = b.urgency === 'high' ? 2 : b.urgency === 'medium' ? 1 : 0
        return urgencyB - urgencyA || b.hotScore - a.hotScore
      })
  }, [cards, activeFilter])

  const selected = visibleCards.find((card) => card.id === selectedId) ?? visibleCards[0]

  const stats = useMemo(() => {
    const active = cards.filter((c) => c.status !== 'ignored')
    const watching = cards.filter((c) => c.status === 'watching').length
    const urgent = active.filter((c) => c.urgency === 'high').length
    const production = cards.filter((c) => c.status === 'in-production').length
    const avgMinutes = active.length ? 10 : 0
    return { active: active.length, watching, urgent, production, avgMinutes }
  }, [cards])

  return (
    <div className="view-container radar-view">
      <div className="view-header radar-header">
        <div>
          <span className="page-kicker">Hot Hunter · 千星奇域 UGC 生态运营</span>
          <h2>热点监控</h2>
          <p className="view-subtitle">
            把多平台信号、热点窗口、AI 深评和生产入口放在同一张运营桌面上。
          </p>
        </div>
        <div className="radar-header-actions">
          {trendLastUpdated && (
            <span className="section-hint">更新于 {relTime(trendLastUpdated)}</span>
          )}
          <button className="primary-btn" onClick={refreshHotTopics} disabled={trendLoading}>
            {trendLoading ? '抓取中…' : '刷新热点'}
          </button>
        </div>
      </div>

      {trendError && <div className="toast-banner radar-banner">{trendError}</div>}

      <div className="metrics-row radar-metrics">
        <div className="metric-card">
          <span className="metric-label">活跃热点</span>
          <span className="metric-value">{stats.active}</span>
          <span className="metric-foot">Feed 中可处理信号</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">我的关注</span>
          <span className="metric-value accent">{stats.watching}</span>
          <span className="metric-foot">持续追踪中</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">窗口紧张</span>
          <span className="metric-value warn">{stats.urgent}</span>
          <span className="metric-foot">剩余 5 天内或高热</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">进入生产</span>
          <span className="metric-value done">{stats.production}</span>
          <span className="metric-foot">已生成 Brief</span>
        </div>
      </div>

      <div className="radar-workbench">
        <aside className="radar-feed">
          <div className="feed-head">
            <div>
              <span className="panel-kicker">热点 Feed</span>
              <b>{visibleCards.length} 条</b>
            </div>
          </div>
          <div className="filter-row">
            {FILTERS.map((filter) => (
              <button
                key={filter}
                className={activeFilter === filter ? 'active' : ''}
                onClick={() => setActiveFilter(filter)}
              >
                {filter}
              </button>
            ))}
          </div>
          <ManualAddBox />
          <div className="radar-list">
            {visibleCards.map((card) => (
              <HotListItem
                key={card.id}
                card={card}
                active={selected?.id === card.id}
                onSelect={() => setSelectedId(card.id)}
              />
            ))}
          </div>
        </aside>

        {selected ? <DetailPanel card={selected} /> : <EmptyDetails />}
      </div>

      <Timeline cards={cards} />
      <div className="radar-footnote">
        P0 已落地：多源 Feed、人工标注、热点评估报告、时效日历、进入生产写入方案库。小红书 / 微博 / 米游社接口先保留为采集源配置与人工补录兜底。
        <span> 今日目标：发现到进入生产 ≤ {stats.avgMinutes || 10} 分钟。</span>
      </div>
    </div>
  )
}
