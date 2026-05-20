/* ============================================================
 *  Multi-source signal aggregator.
 *
 *  Responsibilities:
 *  1. Collect signals from all enabled sources
 *  2. De-duplicate near-identical signals across platforms
 *  3. Cluster related signals into HotTopics via keyword overlap
 *  4. Score each HotTopic with a multi-dimensional composite
 *  5. Annotate UGC suitability for game level creation
 * ============================================================ */

import type { HotTopic, Platform, SourceConfigMap, TrendSignal, UGCSuitability } from './types'
import { DEFAULT_SOURCE_CONFIG, UGC_KEYWORDS } from './types'
import { fetchBilibili } from './bilibili'
import { fetchDouyin } from './douyin'

// ---- Source dispatcher ----

type SourceFetcher = (opts: {
  ugcOnly: boolean
  limit: number
}) => Promise<TrendSignal[]>

const FETCHERS: Partial<Record<Platform, SourceFetcher>> = {
  bilibili: fetchBilibili,
  douyin: fetchDouyin,
}

export interface AggregationOptions {
  config?: Partial<SourceConfigMap>
  ugcOnly?: boolean
}

/** Fetch signals from all enabled sources in parallel. */
async function collectSignals(
  opts: AggregationOptions = {},
): Promise<TrendSignal[]> {
  const config = { ...DEFAULT_SOURCE_CONFIG, ...(opts.config ?? {}) }
  const ugcOnly = opts.ugcOnly ?? false
  const tasks: Promise<TrendSignal[]>[] = []

  for (const [platform, sourceCfg] of Object.entries(config) as [
    Platform,
    (typeof config)[Platform],
  ][]) {
    if (!sourceCfg.enabled) continue
    const fetcher = FETCHERS[platform]
    if (!fetcher) continue
    tasks.push(
      fetcher({ ugcOnly, limit: sourceCfg.limit }).catch((err) => {
        console.warn(`[aggregator] source ${platform} failed:`, err)
        return [] as TrendSignal[]
      }),
    )
  }

  const results = await Promise.all(tasks)
  return results.flat()
}

// ---- De-duplication ----

/**
 * Jaccard-based title similarity for near-duplicate detection.
 * Two signals with >80% token overlap are considered duplicates;
 * the one with higher metrics is kept.
 */
function deduplicate(signals: TrendSignal[]): TrendSignal[] {
  const tokenize = (text: string): Set<string> => {
    // Simple 2-gram tokenization for Chinese + space-delimited tokens
    const cleaned = text.toLowerCase().replace(/[^一-鿿\w\s]/g, '')
    const tokens = new Set<string>()
    // Word-level tokens (space-separated, mostly for English)
    for (const w of cleaned.split(/\s+/).filter(Boolean)) {
      tokens.add(w)
    }
    // Character bigrams (for Chinese)
    for (let i = 0; i < cleaned.length - 1; i++) {
      tokens.add(cleaned.slice(i, i + 2))
    }
    return tokens
  }

  const kept: TrendSignal[] = []
  const seen = new Set<string>()

  // Sort by metric score descending so the "best" version is kept first
  const sorted = [...signals].sort((a, b) => {
    const score = (s: TrendSignal) =>
      (s.metrics.heatScore ?? 0) +
      (s.metrics.viewCount ?? 0) * 0.01 +
      (s.metrics.likeCount ?? 0) * 0.1
    return score(b) - score(a)
  })

  for (const signal of sorted) {
    const tokens = tokenize(signal.title)
    let isDup = false
    for (const prev of kept) {
      const prevTokens = tokenize(prev.title)
      const intersection = new Set([...tokens].filter((t) => prevTokens.has(t)))
      const union = new Set([...tokens, ...prevTokens])
      const jaccard = intersection.size / union.size
      if (jaccard > 0.8) {
        isDup = true
        break
      }
    }
    if (!isDup) {
      kept.push(signal)
      seen.add(signal.id)
    }
  }

  return kept
}

// ---- Clustering ----

interface SignalCluster {
  /** Representative title */
  title: string
  signals: TrendSignal[]
  keywords: Set<string>
}

/**
 * Cluster signals by shared keyword overlap.
 * Each UGC_KEYWORD that appears in a signal's title acts as a
 * grouping key. Signals that share at least one keyword are
 * merged into the same cluster.
 */
function clusterByKeywords(signals: TrendSignal[]): SignalCluster[] {
  const clusters: SignalCluster[] = []

  for (const signal of signals) {
    const text = [signal.title, signal.description ?? ''].join(' ').toLowerCase()
    const matched = UGC_KEYWORDS.filter((kw) => text.includes(kw.toLowerCase()))

    // Find an existing cluster that shares at least one keyword
    let assigned = false
    for (const cluster of clusters) {
      const overlap = matched.some((kw) => cluster.keywords.has(kw))
      if (overlap && matched.length > 0) {
        cluster.signals.push(signal)
        for (const kw of matched) cluster.keywords.add(kw)
        assigned = true
        break
      }
    }

    if (!assigned) {
      clusters.push({
        title: signal.title,
        signals: [signal],
        keywords: new Set(matched),
      })
    }
  }

  return clusters
}

// ---- Scoring ----

/**
 * Multi-dimensional composite score (0–100) for a HotTopic.
 *
 * Weights:
 *   - spread:     35%  (how many platforms carry this topic)
 *   - engagement: 35%  (total views/likes/comments normalised)
 *   - velocity:   20%  (recency of signals)
 *   - ugcFit:     10%  (how game-level-able this topic is)
 */
function computeHotScore(cluster: SignalCluster): number {
  const platforms = new Set(cluster.signals.map((s) => s.platform))
  const spreadScore = Math.min(1, platforms.size / 3) * 100 // max at 3+ platforms

  const totalViews = cluster.signals.reduce(
    (sum, s) => sum + (s.metrics.viewCount ?? 0),
    0,
  )
  const totalLikes = cluster.signals.reduce(
    (sum, s) => sum + (s.metrics.likeCount ?? 0),
    0,
  )
  // Log-scale engagement: 1M views → ~80, 10M → ~95
  const engagementScore = Math.min(100, Math.log10(Math.max(1, totalViews + totalLikes * 10)) * 20)

  const now = Date.now()
  const agesHours = cluster.signals.map(
    (s) => (now - s.capturedAt) / (3600 * 1000),
  )
  const avgAge = agesHours.reduce((a, b) => a + b, 0) / agesHours.length
  // Fresher = higher score. <1h → 100, <24h → 80, <72h → 50
  const velocityScore = Math.max(0, 100 - avgAge * 4)

  const ugcFit = computeUGCFit(cluster)

  return Math.round(
    spreadScore * 0.35 +
      engagementScore * 0.35 +
      velocityScore * 0.2 +
      ugcFit.score * 0.1,
  )
}

function computeUGCFit(cluster: SignalCluster): UGCSuitability {
  const reasons: string[] = []
  let score = 10 // base

  // Keyword richness: more UGC keywords = higher fit
  const ugcKeywordCount = cluster.keywords.size
  if (ugcKeywordCount >= 5) {
    score += 30
    reasons.push(`高度匹配 UGC 关键词 (${ugcKeywordCount} 个)`)
  } else if (ugcKeywordCount >= 2) {
    score += 15
    reasons.push(`部分匹配 UGC 关键词 (${ugcKeywordCount} 个)`)
  }

  // Multi-platform: topic appears on multiple platforms → broader interest
  const platforms = new Set(cluster.signals.map((s) => s.platform))
  if (platforms.size >= 2) {
    score += 15
    reasons.push(`跨平台传播 (${platforms.size} 个平台)`)
  }

  // Engagement volume
  const totalEngagement = cluster.signals.reduce(
    (sum, s) =>
      sum +
      (s.metrics.viewCount ?? 0) +
      (s.metrics.likeCount ?? 0) * 2 +
      (s.metrics.commentCount ?? 0) * 3,
    0,
  )
  if (totalEngagement > 100_000) {
    score += 20
    reasons.push('高互动量 (10w+)')
  } else if (totalEngagement > 10_000) {
    score += 10
    reasons.push('中等互动量 (1w+)')
  }

  // Signal count
  if (cluster.signals.length >= 3) {
    score += 10
    reasons.push(`多来源信号 (${cluster.signals.length} 条)`)
  }

  return { score: Math.min(100, score), reasons }
}

function computeTrend(cluster: SignalCluster): number {
  const agesHours = cluster.signals.map(
    (s) => (Date.now() - s.capturedAt) / (3600 * 1000),
  )
  const avgAge = agesHours.reduce((a, b) => a + b, 0) / agesHours.length
  if (avgAge < 2) return 15 // very fresh, likely rising
  if (avgAge < 6) return 8
  if (avgAge < 24) return 2
  return -5 // older, likely fading
}

// ---- Main Aggregation Pipeline ----

let topicCounter = 0

function makeTopicId(): string {
  topicCounter += 1
  return `topic-${Date.now().toString(36)}-${topicCounter}`
}

function pickBestTitle(cluster: SignalCluster): string {
  // Pick the signal with the highest engagement as the representative
  const sorted = [...cluster.signals].sort((a, b) => {
    const score = (s: TrendSignal) =>
      (s.metrics.heatScore ?? 0) +
      (s.metrics.viewCount ?? 0) * 0.01 +
      (s.metrics.likeCount ?? 0) * 0.1
    return score(b) - score(a)
  })
  return sorted[0]?.title ?? '未知热点'
}

function pickTags(cluster: SignalCluster): string[] {
  const tags = new Set<string>()
  for (const kw of cluster.keywords) {
    tags.add(kw)
  }
  // Add platform names
  for (const s of cluster.signals) {
    tags.add(s.platform)
  }
  return [...tags].slice(0, 6)
}

/**
 * Main entry point: fetch signals from all sources, aggregate into
 * scored hot topics ready for the dashboard.
 */
export async function aggregateHotTopics(
  opts: AggregationOptions = {},
): Promise<HotTopic[]> {
  const signals = await collectSignals(opts)
  if (signals.length === 0) return []

  const unique = deduplicate(signals)
  const clusters = clusterByKeywords(unique)

  return clusters
    .filter((c) => c.signals.length > 0)
    .map((cluster) => {
      const ugcFit = computeUGCFit(cluster)
      return {
        id: makeTopicId(),
        title: pickBestTitle(cluster),
        summary: `${cluster.signals.length} 条信号 · ${cluster.keywords.size} 个关键词`,
        hotScore: computeHotScore(cluster),
        trend: computeTrend(cluster),
        tags: pickTags(cluster),
        signals: cluster.signals,
        createdAt: Date.now(),
        ugcFit,
      }
    })
    .sort((a, b) => b.hotScore - a.hotScore)
}
