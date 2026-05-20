/* ============================================================
 *  Unified types for the Trend Radar data pipeline.
 *
 *  Every external platform's hot list / search result is
 *  normalised into a TrendSignal. Multiple signals that refer
 *  to the same real-world topic are clustered into a HotTopic
 *  by the aggregator.
 * ============================================================ */

// ---- Raw signal from a single platform ----
export interface TrendSignal {
  /** stable id: `${platform}:${externalId}` */
  id: string
  platform: Platform
  title: string
  url: string
  description?: string
  /** Normalised engagement metrics (raw platform values stored separately) */
  metrics: SignalMetrics
  /** Unix ms */
  capturedAt: number
  /** Platform-specific metadata */
  raw: Record<string, unknown>
}

export type Platform = 'bilibili' | 'douyin' | 'weibo' | 'zhihu' | 'newsnow'

export interface SignalMetrics {
  viewCount?: number
  likeCount?: number
  commentCount?: number
  shareCount?: number
  favoriteCount?: number
  /** Platform-native heat score (e.g. Bilibili heat_score) */
  heatScore?: number
}

// ---- Clustered hot topic (the dashboard card) ----
export interface HotTopic {
  id: string
  title: string
  /** One-sentence AI summary of why this is trending */
  summary: string
  /** 0–100 composite score */
  hotScore: number
  /** Score change direction: +rising, -falling, 0 stable */
  trend: number
  tags: string[]
  /** Signals that belong to this topic */
  signals: TrendSignal[]
  /** Unix ms */
  createdAt: number
  /** Whether this topic is suitable for UGC level creation */
  ugcFit: UGCSuitability
}

export interface UGCSuitability {
  score: number // 0–100
  reasons: string[]
}

// ---- UGC-specific filtering ----
export const UGC_KEYWORDS = [
  '千星奇域', 'UGC', '关卡', '复刻', '创作', '编辑器',
  '跑酷', '解谜', 'BOSS战', '挑战', '建筑', '场景',
  '玩家自制', '创意工坊', '自制关卡', '沙盒',
]

// ---- Source config ----
export interface SourceConfig {
  /** Enable this source */
  enabled: boolean
  /** Max signals to fetch per poll */
  limit: number
  /** Extra keyword filters (AND logic with UGC_KEYWORDS) */
  keywords: string[]
}

export type SourceConfigMap = Record<Platform, SourceConfig>

export const DEFAULT_SOURCE_CONFIG: SourceConfigMap = {
  bilibili: { enabled: true, limit: 30, keywords: [] },
  douyin: { enabled: true, limit: 20, keywords: [] },
  weibo: { enabled: false, limit: 20, keywords: [] },
  zhihu: { enabled: false, limit: 20, keywords: [] },
  newsnow: { enabled: false, limit: 30, keywords: [] },
}
