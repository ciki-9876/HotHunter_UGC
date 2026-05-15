// 反馈小助手 — 迁移自 events.js sentiment-analyst + 编辑器反馈/UGC玩法反馈模块
import { useState } from 'react'

const SUB_TABS = [
  { id: 'editor', label: '编辑器反馈' },
  { id: 'ugc',    label: 'UGC 玩法反馈' },
] as const
type SubTab = (typeof SUB_TABS)[number]['id']

const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{ background: 'var(--surface-elevated)', borderRadius: 'var(--r-12)', border: '0.5px solid var(--border-default)', boxShadow: 'var(--shadow-1)', ...style }}>
    {children}
  </div>
)

/* ── 静态数据（与原中台保持一致）── */
const EDITOR_MODULES_SAT = [
  { name: '节点图',   score: 8.2, ok: true },
  { name: '技能',     score: 7.9, ok: true },
  { name: '角色',     score: 7.5, ok: true },
  { name: '组件',     score: 8.3, ok: true },
  { name: '怪物',     score: 7.2, ok: true },
  { name: '相机',     score: 6.5, ok: false },
  { name: '性能分析', score: 6.1, ok: false },
  { name: '调试',     score: 8.0, ok: true },
]

interface FeedItem { platform: string; mood: 'pos' | 'neg' | 'neu'; title: string; meta: string }
const EDITOR_FEED: FeedItem[] = [
  { platform: '微博', mood: 'neg', title: '千星奇域相机模块真的太难用了，LockCamera 老是失效，已经反馈三次了求修复', meta: '❤️ 876 转发 · 1h前' },
  { platform: 'TapTap', mood: 'pos', title: '千星奇域 AI 答疑响应速度真的快，复杂技能逻辑 2 分钟给出带节点图的解答', meta: '👍 1,247 点赞 · 6h前' },
  { platform: 'NGA', mood: 'neg', title: '新版性能分析工具的帧率数据根本不准，官方啥时候修，已经三个版本了', meta: '💬 342 回复 · 12h前' },
  { platform: 'B站', mood: 'pos', title: '节点图终于支持分组折叠了！好用了一百倍，开发效率直接翻倍', meta: '👍 2,891 点赞 · 1天前' },
  { platform: 'TapTap', mood: 'neg', title: '千星奇域的相机视角跟踪在多人模式下老是抖动，做了很久的关卡被这个卡住了', meta: '💬 128 回复 · 2天前' },
]
const UGC_FEED: FeedItem[] = [
  { platform: 'B站', mood: 'pos', title: '千星奇域解谜地图《雾中小屋》太好玩了，剧情和解谜设计完全不输商业游戏', meta: '👍 8,432 点赞 · 2h前' },
  { platform: '微博', mood: 'pos', title: '发现一个千星奇域的竞技跑酷地图，和朋友玩了一个下午，笑死我了', meta: '💬 1,204 评论 · 5h前' },
  { platform: 'TapTap', mood: 'neg', title: '千星奇域的推荐机制太随机了，总是推些质量很差的地图，优质地图很难发现', meta: '💬 567 回复 · 8h前' },
  { platform: 'NGA', mood: 'neu', title: '希望千星奇域多引入一些合作闯关类地图，目前这类型偏少', meta: '💬 234 回复 · 1天前' },
  { platform: 'B站', mood: 'pos', title: '千星奇域 AI 答疑响应速度真的快，复杂技能逻辑 2 分钟给出带节点图的解答', meta: '👍 1,247 点赞 · 4h前' },
]

const MOOD_COLOR = { pos: 'var(--c-green-500)', neg: 'var(--c-red-500)', neu: 'var(--text-tertiary)' }
const MOOD_LABEL = { pos: '正面', neg: '负面', neu: '中性' }
const PLAT_BG: Record<string, string> = {
  '微博': 'oklch(62% 0.20 25)', 'TapTap': 'var(--c-blue-500)',
  'NGA': 'var(--c-orange-500)', 'B站': 'oklch(62% 0.18 310)',
}

function FeedCard({ item }: { item: FeedItem }) {
  const mc = MOOD_COLOR[item.mood]
  return (
    <div style={{ padding: 'var(--s-4) var(--s-5)', borderRadius: 'var(--r-8)', background: 'var(--c-neutral-50)', border: '0.5px solid var(--border-subtle)', display: 'flex', gap: 'var(--s-4)' }}>
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 'var(--s-2)', paddingTop: 2 }}>
        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 'var(--r-full)', background: PLAT_BG[item.platform] ?? 'var(--text-tertiary)', color: '#fff', fontWeight: 'var(--fw-medium)' }}>{item.platform}</span>
        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 'var(--r-full)', background: `color-mix(in srgb, ${mc} 12%, transparent)`, color: mc, border: `0.5px solid color-mix(in srgb, ${mc} 25%, transparent)` }}>{MOOD_LABEL[item.mood]}</span>
      </div>
      <div>
        <p style={{ margin: '0 0 var(--s-2)', fontSize: 'var(--fs-13)', color: 'var(--text-primary)', lineHeight: 'var(--lh-snug)' }}>{item.title}</p>
        <p style={{ margin: 0, fontSize: 11, color: 'var(--text-quaternary)' }}>{item.meta}</p>
      </div>
    </div>
  )
}

/* ── 编辑器反馈 ── */
function EditorFeedback() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-6)' }}>
      {/* 满意度 */}
      <Card style={{ padding: 'var(--s-6)' }}>
        <p style={{ margin: '0 0 var(--s-5)', fontSize: 'var(--fs-14)', fontWeight: 'var(--fw-semi)', color: 'var(--text-primary)' }}>编辑器满意度快照 · 月之六版本</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--s-3)' }}>
          {EDITOR_MODULES_SAT.map(({ name, score, ok }) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-3)', padding: 'var(--s-3) var(--s-4)', borderRadius: 'var(--r-6)', background: 'var(--c-neutral-50)', border: `0.5px solid ${ok ? 'var(--border-subtle)' : 'var(--c-orange-500)'}` }}>
              <span style={{ flex: 1, fontSize: 'var(--fs-12)', color: 'var(--text-secondary)' }}>{name}</span>
              <div style={{ flex: 2, height: 4, background: 'var(--c-neutral-200)', borderRadius: 2, overflow: 'hidden', marginInline: 'var(--s-2)' }}>
                <div style={{ height: '100%', width: `${score * 10}%`, background: ok ? 'var(--c-green-500)' : 'var(--c-orange-500)', borderRadius: 2 }} />
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', fontWeight: 'var(--fw-semi)', color: ok ? 'var(--text-primary)' : 'var(--c-orange-500)', flexShrink: 0 }}>{score}</span>
            </div>
          ))}
        </div>
        <p style={{ margin: 'var(--s-4) 0 0', fontSize: 'var(--fs-12)', color: 'var(--text-tertiary)', lineHeight: 'var(--lh-snug)' }}>
          📌 一句话总结：月之六版本创作者编辑器整体活跃度同比提升 18%，但<strong style={{ color: 'var(--c-orange-500)' }}>相机模块投诉率显著上升</strong>，节点图易用性改善明显，<strong style={{ color: 'var(--c-orange-500)' }}>性能分析工具仍是最大卡点</strong>，建议列为下版本优先优化项。
        </p>
      </Card>
      {/* Feed 流 */}
      <div>
        <p style={{ margin: '0 0 var(--s-4)', fontSize: 'var(--fs-13)', fontWeight: 'var(--fw-semi)', color: 'var(--text-secondary)' }}>实时反馈 Feed</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' }}>
          {EDITOR_FEED.map((item, i) => <FeedCard key={i} item={item} />)}
        </div>
      </div>
    </div>
  )
}

/* ── UGC 玩法反馈 ── */
function UgcFeedback() {
  /* 情绪分布 */
  const total = UGC_FEED.length
  const posCount = UGC_FEED.filter((f) => f.mood === 'pos').length
  const negCount = UGC_FEED.filter((f) => f.mood === 'neg').length
  const neuCount = total - posCount - negCount

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-6)' }}>
      {/* 情绪分布 */}
      <Card style={{ padding: 'var(--s-5)' }}>
        <p style={{ margin: '0 0 var(--s-4)', fontSize: 'var(--fs-13)', fontWeight: 'var(--fw-semi)', color: 'var(--text-primary)' }}>玩法反馈情绪分布</p>
        <div style={{ display: 'flex', gap: 'var(--s-5)', alignItems: 'center', flexWrap: 'wrap' }}>
          {[
            { label: '正面', count: posCount, color: 'var(--c-green-500)' },
            { label: '中性', count: neuCount, color: 'var(--text-tertiary)' },
            { label: '负面', count: negCount, color: 'var(--c-red-500)' },
          ].map(({ label, count, color }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-3)' }}>
              <div style={{ width: 8, height: 8, borderRadius: 'var(--r-full)', background: color }} />
              <span style={{ fontSize: 'var(--fs-13)', color, fontWeight: 'var(--fw-semi)' }}>{label}</span>
              <span style={{ fontSize: 'var(--fs-13)', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{count}</span>
            </div>
          ))}
          {/* 进度条 */}
          <div style={{ flex: 1, minWidth: 200, height: 8, borderRadius: 4, background: 'var(--c-neutral-200)', overflow: 'hidden', display: 'flex' }}>
            <div style={{ height: '100%', width: `${posCount / total * 100}%`, background: 'var(--c-green-500)' }} />
            <div style={{ height: '100%', width: `${neuCount / total * 100}%`, background: 'var(--c-neutral-300)' }} />
            <div style={{ height: '100%', width: `${negCount / total * 100}%`, background: 'var(--c-red-500)' }} />
          </div>
        </div>
      </Card>
      {/* Feed 流 */}
      <div>
        <p style={{ margin: '0 0 var(--s-4)', fontSize: 'var(--fs-13)', fontWeight: 'var(--fw-semi)', color: 'var(--text-secondary)' }}>玩法反馈实时 Feed</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' }}>
          {UGC_FEED.map((item, i) => <FeedCard key={i} item={item} />)}
        </div>
      </div>
    </div>
  )
}

export default function SentimentAnalyst() {
  const [tab, setTab] = useState<SubTab>('editor')
  return (
    <div style={{ padding: 'var(--s-8) var(--s-9)', display: 'flex', flexDirection: 'column', gap: 'var(--s-7)', maxWidth: 1080, margin: '0 auto' }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 'var(--fs-22)', fontWeight: 'var(--fw-semi)', color: 'var(--text-primary)' }}>反馈小助手</h1>
        <p style={{ margin: '4px 0 0', fontSize: 'var(--fs-13)', color: 'var(--text-tertiary)' }}>编辑器反馈 · UGC 玩法舆情监控</p>
      </div>
      <div className="view-tabs">
        {SUB_TABS.map(({ id, label }) => (
          <button key={id} className={`view-tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      {tab === 'editor' && <EditorFeedback />}
      {tab === 'ugc'    && <UgcFeedback />}
    </div>
  )
}
