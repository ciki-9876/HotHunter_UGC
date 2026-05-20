/* ============================================================
 *  Douyin (TikTok China) data source.
 *
 *  Fetches the trending search list and optionally filters for
 *  gaming / UGC-related content.
 * ============================================================ */

import type { TrendSignal } from './types'
import { UGC_KEYWORDS } from './types'

const DOUYIN_HOT_SEARCH =
  'https://www.douyin.com/aweme/v1/web/hot/search/list/'

interface DouyinHotItem {
  word: string
  hot_value: number
  video_count: number
  event_time: number
  sentence_tag: number
  word_cover?: { url_list: string[] }
  group_id?: string
}

interface DouyinHotData {
  active_time: string
  trending_list: DouyinHotItem[]
}

async function dyFetch<T>(url: string): Promise<T> {
  const resp = await fetch('/proxy', {
    method: 'GET',
    headers: {
      'X-Target-URL': url,
      Accept: 'application/json',
    },
  })
  if (!resp.ok) {
    throw new Error(`Douyin proxy fetch failed: ${resp.status}`)
  }
  return resp.json() as Promise<T>
}

export async function fetchDouyinHotSearch(): Promise<TrendSignal[]> {
  try {
    const data = await dyFetch<DouyinHotData>(DOUYIN_HOT_SEARCH)
    const now = Date.now()
    return (data.trending_list ?? []).map((item, i) => ({
      id: `douyin:hot-${item.group_id ?? i}`,
      platform: 'douyin' as const,
      title: item.word,
      url: `https://www.douyin.com/search/${encodeURIComponent(item.word)}`,
      metrics: {
        heatScore: item.hot_value,
        viewCount: item.video_count,
      },
      capturedAt: now,
      raw: { ...item },
    }))
  } catch (err) {
    console.warn('[douyin] fetch failed, returning empty:', err)
    return []
  }
}

/** Fetch Douyin trending, optionally filtered for UGC relevance. */
export async function fetchDouyin(options?: {
  ugcOnly?: boolean
  limit?: number
}): Promise<TrendSignal[]> {
  const { ugcOnly = false, limit = 20 } = options ?? {}
  let signals = await fetchDouyinHotSearch()

  if (ugcOnly) {
    signals = signals.filter((s) =>
      UGC_KEYWORDS.some((kw) =>
        s.title.toLowerCase().includes(kw.toLowerCase()),
      ),
    )
  }

  return signals.slice(0, limit)
}
