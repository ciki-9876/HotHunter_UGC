/**
 * Format conversions for the DispatchNode.
 *
 * The DispatchNode takes the upstream agent's free-form output and produces
 * a strongly-shaped record matching the target tab's data contract.
 */

export type DispatchTarget = 'dashboard' | 'project'

export interface DispatchFormatSpec {
  target: DispatchTarget
  /** Human-readable name shown in the node UI */
  label: string
  /** Short description shown beneath the selector */
  description: string
}

export const DISPATCH_FORMATS: DispatchFormatSpec[] = [
  {
    target: 'dashboard',
    label: '数据看板 · HotTopicCard',
    description: '提取标题/摘要/标签/热度分，作为一张热点卡片插入看板',
  },
  {
    target: 'project',
    label: '项目中心 · .gia 策划文档',
    description: '按章节切分，封装成 .gia 策划文档加入项目中心',
  },
]

export function dispatchSpecFor(target: DispatchTarget): DispatchFormatSpec {
  return DISPATCH_FORMATS.find((f) => f.target === target) ?? DISPATCH_FORMATS[0]
}

/* ============================================================
 *  Dashboard format — HotTopicCard
 * ============================================================ */

export type HotTopicType =
  | '热梗'
  | '联动'
  | '版本节点'
  | '游戏'
  | '短剧/动漫'
  | '本篇延伸'
  | '新闻时政'

export type HotTopicStatus = 'new' | 'watching' | 'ignored' | 'in-production'

export type HotTopicStage = 'rising' | 'peak' | 'fading' | 'stable'

export type HotTopicUrgency = 'low' | 'medium' | 'high'

export interface HotSignalPreview {
  platform: string
  title: string
  url?: string
  heat: '高' | '中' | '低'
}

export interface HotEvaluationReport {
  generatedAt: number
  trendSummary: string
  toneMatch: number
  feasibility: '高' | '中' | '低'
  targetAudience: string
  emotionalDirection: string[]
  windowSummary: string
  peakInDays: number
  gameplayDirections: {
    title: string
    retention: '强' | '中' | '弱'
    difficulty: '低' | '中' | '高'
    reason: string
  }[]
  creatorSuggestion: string
  productionCycleDays: number
  recommendation: '建议立项' | '谨慎立项' | '不建议'
  priority: '高' | '中' | '低'
  risks: string[]
}

export interface HotTopicCard {
  id: string
  source: 'workflow' | 'external' | 'manual'
  title: string
  hotScore: number // 0-100
  trend: number // -50 ~ +50 (% delta)
  summary: string
  tags: string[]
  createdAt: number
  topicType?: HotTopicType
  platforms?: string[]
  signals?: HotSignalPreview[]
  windowDays?: number
  stage?: HotTopicStage
  fitScore?: number
  urgency?: HotTopicUrgency
  status?: HotTopicStatus
  evaluation?: HotEvaluationReport
}

const TAG_CANDIDATES = [
  '内容',
  '方法论',
  '行动',
  '策略',
  '认知',
  '决策',
  '增长',
  '创作',
  '复盘',
  'AI',
  '工作流',
  '生产力',
  '工具',
]

function pickTags(text: string, topic: string): string[] {
  const tags = new Set<string>()
  if (topic) tags.add(topic.split(/[\s,，。·]/)[0].slice(0, 6))
  for (const tag of TAG_CANDIDATES) {
    if (text.includes(tag)) tags.add(tag)
    if (tags.size >= 4) break
  }
  return Array.from(tags).slice(0, 4)
}

function extractTitle(text: string, fallback: string): string {
  const lines = text.split('\n')
  for (const line of lines) {
    const m = line.match(/^#{1,3}\s+(.+?)\s*$/)
    if (m) return m[1].slice(0, 36)
  }
  // first non-empty line trimmed
  for (const line of lines) {
    const t = line.trim()
    if (t) return t.slice(0, 36)
  }
  return fallback.slice(0, 36)
}

function extractSummary(text: string): string {
  const plain = text
    .replace(/^#.*$/gm, '')
    .replace(/[*_`>~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return plain.slice(0, 80)
}

export function toHotTopicCard(
  upstreamText: string,
  topic: string,
): HotTopicCard {
  const length = upstreamText.length
  // Lightweight heuristic score so each generated card looks distinct
  const lenScore = Math.min(60, Math.floor(length / 30))
  const noise = Math.floor(Math.random() * 25)
  const hotScore = Math.min(99, 40 + lenScore + noise)
  const trend = Math.floor(Math.random() * 60) - 18

  return {
    id: `card-${Date.now()}`,
    source: 'workflow',
    title: extractTitle(upstreamText, topic || '未命名'),
    hotScore,
    trend,
    summary: extractSummary(upstreamText) || '（暂无摘要）',
    tags: pickTags(upstreamText, topic),
    createdAt: Date.now(),
    topicType: '本篇延伸',
    platforms: ['工作流'],
    signals: [
      {
        platform: '工作流',
        title: extractTitle(upstreamText, topic || '未命名'),
        heat: hotScore >= 85 ? '高' : hotScore >= 70 ? '中' : '低',
      },
    ],
    windowDays: hotScore >= 85 ? 5 : 9,
    stage: trend > 8 ? 'rising' : trend < -8 ? 'fading' : 'stable',
    fitScore: Math.min(98, Math.max(55, hotScore - 6)),
    urgency: hotScore >= 85 ? 'high' : hotScore >= 70 ? 'medium' : 'low',
    status: 'new',
  }
}

/* ============================================================
 *  Project format — GiaFile
 * ============================================================ */

export interface GiaFileSection {
  heading: string
  body: string
}

export interface GiaFile {
  id: string
  filename: string
  extension: '.gia' | '.md'
  topic: string
  summary: string
  sections: GiaFileSection[]
  wordCount: number
  generatedAt: number
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9一-龥]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 24) || 'untitled'
  )
}

function splitSections(text: string): GiaFileSection[] {
  // Split by markdown headings (## or # at line start). Anything before the first
  // heading becomes a preamble section.
  const lines = text.split('\n')
  const sections: GiaFileSection[] = []
  let cur: GiaFileSection = { heading: '前言', body: '' }
  for (const line of lines) {
    const m = line.match(/^#{1,3}\s+(.+?)\s*$/)
    if (m) {
      if (cur.body.trim()) sections.push({ ...cur, body: cur.body.trim() })
      cur = { heading: m[1], body: '' }
    } else {
      cur.body += line + '\n'
    }
  }
  if (cur.body.trim()) sections.push({ ...cur, body: cur.body.trim() })
  return sections.length > 0
    ? sections
    : [{ heading: '内容', body: text.trim() }]
}

export function toGiaFile(upstreamText: string, topic: string): GiaFile {
  const now = new Date()
  const stamp = now.toISOString().slice(0, 10).replace(/-/g, '')
  const sections = splitSections(upstreamText)
  const summary = extractSummary(upstreamText) || '（暂无摘要）'
  return {
    id: `gia-${Date.now()}`,
    filename: `${slugify(topic || 'topic')}_${stamp}.gia`,
    extension: '.gia',
    topic: topic || '未命名主题',
    summary,
    sections,
    wordCount: upstreamText.replace(/\s+/g, '').length,
    generatedAt: Date.now(),
  }
}
