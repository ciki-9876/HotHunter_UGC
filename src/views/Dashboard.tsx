import { useMemo } from 'react'
import { useBlueprint } from '../store'

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

function trendIcon(t: number): string {
  if (t > 5) return '↑'
  if (t < -5) return '↓'
  return '→'
}

export default function DashboardView() {
  const cards = useBlueprint((s) => s.dashboardCards)
  const removeCard = useBlueprint((s) => s.removeDashboardCard)

  const stats = useMemo(() => {
    const ugc = cards.filter((c) => c.tags.includes('UGC')).length
    const external = cards.filter((c) => c.source === 'external').length
    const fromWorkflow = cards.filter((c) => c.source === 'workflow').length
    const avgHot = cards.length
      ? Math.round(
          cards.reduce((s, c) => s + c.hotScore, 0) / cards.length,
        )
      : 0
    return { ugc, external, fromWorkflow, avgHot }
  }, [cards])

  return (
    <div className="view-container">
      <div className="view-header">
        <div>
          <h2>数据看板</h2>
          <p className="view-subtitle">
            UGC 关卡热度 · 外部热点 · 工作流回传卡片，统一监控
          </p>
        </div>
      </div>

      <div className="metrics-row">
        <div className="metric-card">
          <span className="metric-label">UGC 关卡相关</span>
          <span className="metric-value">{stats.ugc}</span>
          <span className="metric-foot">条卡片</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">外部热点</span>
          <span className="metric-value">{stats.external}</span>
          <span className="metric-foot">条来自外部抓取</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">工作流回传</span>
          <span className="metric-value accent">
            {stats.fromWorkflow}
          </span>
          <span className="metric-foot">DispatchNode 写入</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">平均热度分</span>
          <span className="metric-value">{stats.avgHot}</span>
          <span className="metric-foot">/100</span>
        </div>
      </div>

      <div className="section-title">
        <span>热点卡片</span>
        <span className="section-hint">{cards.length} 条 · 最新在前</span>
      </div>

      <div className="hot-grid">
        {cards.length === 0 && (
          <div className="empty-state">
            还没有卡片。回到「工作流」页运行一遍，并连接一个「输出回传 · 看板」节点。
          </div>
        )}
        {cards.map((c) => (
          <div className="hot-card" key={c.id}>
            <div className="hot-card-head">
              <span
                className={`source-pill ${
                  c.source === 'workflow' ? 'is-workflow' : ''
                }`}
              >
                {c.source === 'workflow' ? '工作流回传' : '外部热点'}
              </span>
              <span className="hot-card-time">{relTime(c.createdAt)}</span>
              <button
                className="ghost-btn small"
                onClick={() => removeCard(c.id)}
              >
                移除
              </button>
            </div>
            <div className="hot-card-title">{c.title}</div>
            <div className="hot-card-summary">{c.summary}</div>
            <div className="hot-card-tags">
              {c.tags.map((t) => (
                <span className="tag" key={t}>
                  #{t}
                </span>
              ))}
            </div>
            <div className="hot-card-foot">
              <div className="hot-score">
                <span className="label">热度</span>
                <span className="value">{c.hotScore}</span>
                <div
                  className="hot-bar"
                  style={{ width: `${c.hotScore}%` }}
                />
              </div>
              <div
                className={`trend ${
                  c.trend > 5 ? 'up' : c.trend < -5 ? 'down' : ''
                }`}
              >
                {trendIcon(c.trend)} {Math.abs(c.trend)}%
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
