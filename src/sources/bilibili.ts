/* ============================================================
 *  Bilibili data source.
 *
 *  Provides two data feeds:
 *  1. Hot search keywords  (trending search terms + heat scores)
 *  2. Ranking videos       (trending videos filtered by UGC
 *     keywords to surface game-UGC-related content)
 *
 *  All external calls go through the Vite dev proxy at /proxy
 *  to bypass browser CORS restrictions.
 * ============================================================ */

import type { TrendSignal } from './types'
import { UGC_KEYWORDS } from './types'

// ---- API endpoints ----
const BILIBILI_HOT_SEARCH =
  'https://api.bilibili.com/x/web-interface/wbi/search/square?limit=50'

// Ranking goes through a dedicated Vite proxy endpoint that handles WBI signing
const PROXY_RANKING = '/api/bilibili-ranking'

// ---- Helpers ----

async function biliFetch<T>(url: string): Promise<T> {
  const resp = await fetch('/proxy', {
    method: 'GET',
    headers: {
      'X-Target-URL': url,
      Accept: 'application/json',
    },
  })
  if (!resp.ok) {
    throw new Error(`Bilibili proxy fetch failed: ${resp.status} ${resp.statusText}`)
  }
  const json: { code: number; message: string; data: T } = await resp.json()
  if (json.code !== 0) {
    throw new Error(`Bilibili API error ${json.code}: ${json.message}`)
  }
  return json.data
}

function matchesUGC(text: string): string[] {
  const lower = text.toLowerCase()
  return UGC_KEYWORDS.filter((kw) => lower.includes(kw.toLowerCase()))
}

function signalId(platform: string, extId: string | number): string {
  return `${platform}:${extId}`
}

// ---- Hot search ----

interface BiliHotItem {
  keyword: string
  show_name: string
  icon: string
  heat_score: number
  uri: string
}

interface BiliHotSearchData {
  trending: { list: BiliHotItem[] }
}

/** Fetch Bilibili hot search keywords. */
export async function fetchBiliHotSearch(): Promise<TrendSignal[]> {
  const data = await biliFetch<BiliHotSearchData>(BILIBILI_HOT_SEARCH)
  const now = Date.now()
  return (data.trending?.list ?? []).map((item, i) => ({
    id: signalId('bilibili', `hot-${i}`),
    platform: 'bilibili' as const,
    title: item.show_name || item.keyword,
    url: item.uri || `https://search.bilibili.com/all?keyword=${encodeURIComponent(item.keyword)}`,
    metrics: { heatScore: item.heat_score },
    capturedAt: now,
    raw: { ...item },
  }))
}

// ---- Ranking ----

interface BiliVideoItem {
  aid: number
  bvid: string
  title: string
  desc: string
  tname: string
  tnamev2?: string
  pic: string
  owner: { mid: number; name: string; face: string }
  stat: {
    view: number
    like: number
    reply: number
    share: number
    favorite: number
    coin: number
    danmaku: number
  }
  short_link_v2: string
  pubdate: number
}

interface BiliRankingData {
  list: BiliVideoItem[]
}

/** Fetch Bilibili trending videos via dedicated WBI-signed proxy endpoint. */
export async function fetchBiliRanking(): Promise<TrendSignal[]> {
  try {
    const resp = await fetch(PROXY_RANKING)
    if (!resp.ok) {
      throw new Error(`Ranking proxy failed: ${resp.status}`)
    }
    const json: { code: number; message: string; data: BiliRankingData } = await resp.json()
    if (json.code !== 0) {
      throw new Error(`Bilibili API error ${json.code}: ${json.message}`)
    }
    const data = json.data
    const now = Date.now()
    const signals: TrendSignal[] = []

    for (const item of data.list ?? []) {
      const text = [item.title, item.desc, item.tname, item.tnamev2 ?? ''].join(' ')
      const matched = matchesUGC(text)

      signals.push({
        id: signalId('bilibili', item.aid),
        platform: 'bilibili' as const,
        title: item.title,
        url: item.short_link_v2 || `https://www.bilibili.com/video/${item.bvid}`,
        description: item.desc || undefined,
        metrics: {
          viewCount: item.stat.view,
          likeCount: item.stat.like,
          commentCount: item.stat.reply,
          shareCount: item.stat.share,
          favoriteCount: item.stat.favorite,
        },
        capturedAt: now,
        raw: {
          bvid: item.bvid,
          tname: item.tname,
          tnamev2: item.tnamev2,
          owner: item.owner,
          pubdate: item.pubdate,
          pic: item.pic,
          matchedKeywords: matched.length > 0 ? matched : undefined,
        },
      })
    }

    return signals
  } catch (err) {
    console.warn('[bilibili] ranking fetch failed (WBI signing may be unavailable):', err)
    return []
  }
}

// ---- Unified fetch ----

/** Fetch all available Bilibili signals, optionally filtering for UGC only. */
export async function fetchBilibili(options?: {
  ugcOnly?: boolean
  limit?: number
}): Promise<TrendSignal[]> {
  const { ugcOnly = false, limit = 30 } = options ?? {}

  try {
    const [hotSearch, ranking] = await Promise.all([
      fetchBiliHotSearch(),
      fetchBiliRanking(),
    ])

    let all = [...hotSearch, ...ranking]

    if (ugcOnly) {
      all = all.filter((s) => {
        const text = [s.title, s.description ?? ''].join(' ')
        return UGC_KEYWORDS.some((kw) =>
          text.toLowerCase().includes(kw.toLowerCase()),
        )
      })
    }

    // Sort by heat/views descending, then limit
    all.sort((a, b) => {
      const scoreA =
        a.metrics.heatScore ?? a.metrics.viewCount ?? 0
      const scoreB =
        b.metrics.heatScore ?? b.metrics.viewCount ?? 0
      return scoreB - scoreA
    })

    return all.slice(0, limit)
  } catch (err) {
    console.warn('[bilibili] fetch failed, returning empty:', err)
    return []
  }
}
