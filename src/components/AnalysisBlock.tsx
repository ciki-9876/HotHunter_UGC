// 迁移自 monitor.js renderBlock()
// 严格只使用 index.css 设计令牌，不引入外部样式

import type { FC } from 'react'

export interface Block {
  type: string
  title?: string
  style?: string
  content?: string
  level?: string
  items?: any[]
  columns?: string[]
  rows?: string[][]
  sources?: { name: string; status: string; statusText?: string; note?: string }[]
}

/* ── 标题 ── */
const BlockTitle: FC<{ t?: string }> = ({ t }) =>
  t ? <p style={{ fontSize: 'var(--fs-12)', fontWeight: 'var(--fw-semi)', color: 'var(--text-secondary)', marginBottom: 'var(--s-3)', marginTop: 0 }}>{t}</p> : null

/* ── metric_cards ── */
const MetricCards: FC<{ block: Block }> = ({ block }) => (
  <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' }}>
    <BlockTitle t={block.title} />
    <div style={{ display: 'flex', gap: 'var(--s-4)', flexWrap: 'wrap' }}>
      {(block.items ?? []).map((m, i) => {
        const trendColor = m.trend === 'up' ? 'var(--c-green-500)' : m.trend === 'down' ? 'var(--c-red-500)' : 'var(--text-tertiary)'
        const trendIcon  = m.trend === 'up' ? '↑' : m.trend === 'down' ? '↓' : '→'
        return (
          <div key={i} className="metric-card" style={{ flex: '1 1 120px', minWidth: 100 }}>
            <p className="metric-label">{m.label}</p>
            <strong className="metric-value">{m.value}</strong>
            {m.delta && <span className="trend" style={{ color: trendColor, fontSize: 'var(--fs-11)' }}>{trendIcon} {m.delta}</span>}
          </div>
        )
      })}
    </div>
  </section>
)

/* ── list ── */
const ListBlock: FC<{ block: Block }> = ({ block }) => {
  const isSuggestion = block.style === 'suggestion'
  const icons = isSuggestion ? ['🚀', '💡', '✅', '🎯', '📌'] : ['📊', '📈', '🔍', '⚠️', '💬']
  const accentColor = isSuggestion ? 'var(--c-blue-500)' : 'var(--text-primary)'
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' }}>
      <BlockTitle t={block.title} />
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
        {(block.items ?? []).map((item, i) => (
          <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--s-3)', fontSize: 'var(--fs-13)', lineHeight: 'var(--lh-snug)', color: 'var(--text-primary)' }}>
            <span style={{ flexShrink: 0, fontSize: 'var(--fs-12)', marginTop: 1 }}>{icons[i % icons.length]}</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/* ── table ── */
const TableBlock: FC<{ block: Block }> = ({ block }) => (
  <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' }}>
    <BlockTitle t={block.title} />
    <div style={{ overflowX: 'auto', borderRadius: 'var(--r-8)', border: '0.5px solid var(--border-default)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-12)' }}>
        <thead>
          <tr style={{ background: 'var(--c-neutral-100)' }}>
            {(block.columns ?? []).map((c, i) => (
              <th key={i} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 'var(--fw-semi)', color: 'var(--text-secondary)', whiteSpace: 'nowrap', borderBottom: '0.5px solid var(--border-default)' }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(block.rows ?? []).map((row, ri) => (
            <tr key={ri} style={{ borderBottom: '0.5px solid var(--border-subtle)' }}>
              {row.map((cell, ci) => (
                <td key={ci} style={{ padding: '7px 12px', color: 'var(--text-primary)' }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
)

/* ── alert ── */
const AlertBlock: FC<{ block: Block }> = ({ block }) => {
  const lvl = block.level ?? 'info'
  const bg    = lvl === 'danger' ? 'var(--status-error-bg)' : lvl === 'warn' ? 'var(--status-warn-bg)' : 'var(--c-blue-100)'
  const color = lvl === 'danger' ? 'var(--status-error-fg)' : lvl === 'warn' ? 'var(--status-warn-fg)' : 'var(--c-blue-500)'
  const icon  = lvl === 'danger' ? '🚨' : lvl === 'warn' ? '⚠️' : 'ℹ️'
  return (
    <section style={{ background: bg, borderRadius: 'var(--r-8)', padding: '10px 14px', fontSize: 'var(--fs-13)', color, lineHeight: 'var(--lh-snug)', display: 'flex', gap: 'var(--s-3)', alignItems: 'flex-start' }}>
      <span style={{ flexShrink: 0 }}>{icon}</span>
      <div>
        {block.title && <strong style={{ display: 'block', marginBottom: 2 }}>{block.title}</strong>}
        <span>{block.content}</span>
      </div>
    </section>
  )
}

/* ── text ── */
const TextBlock: FC<{ block: Block }> = ({ block }) => (
  <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' }}>
    <BlockTitle t={block.title} />
    <p style={{ margin: 0, fontSize: 'var(--fs-13)', color: 'var(--text-secondary)', lineHeight: 'var(--lh-base)' }}>{block.content}</p>
  </section>
)

/* ── source_attribution ── */
const SourceBlock: FC<{ block: Block }> = ({ block }) => {
  const dotColor = (s: string) => s === 'ok' ? 'var(--c-green-500)' : s === 'warn' ? 'var(--c-orange-500)' : 'var(--c-red-500)'
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' }}>
      <BlockTitle t={block.title} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
        {(block.sources ?? []).map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-4)', padding: '6px 10px', borderRadius: 'var(--r-6)', background: 'var(--c-neutral-50)', border: '0.5px solid var(--border-subtle)' }}>
            <span style={{ width: 6, height: 6, borderRadius: 'var(--r-full)', background: dotColor(s.status), flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 'var(--fs-13)', fontWeight: 'var(--fw-medium)', color: 'var(--text-primary)' }}>{s.name}</span>
            <span style={{ fontSize: 'var(--fs-12)', color: 'var(--text-tertiary)' }}>{s.statusText ?? s.status}</span>
            {s.note && <span style={{ fontSize: 'var(--fs-11)', color: 'var(--text-quaternary)', marginLeft: 'var(--s-2)' }}>{s.note}</span>}
          </div>
        ))}
      </div>
    </section>
  )
}

/* ── 主组件 ── */
export const AnalysisBlock: FC<{ block: Block }> = ({ block }) => {
  switch (block.type) {
    case 'metric_cards':       return <MetricCards block={block} />
    case 'list':               return <ListBlock block={block} />
    case 'table':              return <TableBlock block={block} />
    case 'alert':              return <AlertBlock block={block} />
    case 'text':               return <TextBlock block={block} />
    case 'source_attribution': return <SourceBlock block={block} />
    case 'knowledge_actions':  return null
    default:                   return null
  }
}

/* ── 报告完整渲染 ── */
export const ReportBlocks: FC<{ blocks: Block[]; className?: string }> = ({ blocks, className }) => (
  <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-6)' }}>
    {blocks.map((b, i) => <AnalysisBlock key={i} block={b} />)}
  </div>
)
