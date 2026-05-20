import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createHash } from 'node:crypto'

// ---- Bilibili WBI signing ----

// Bilibili WBI signing constants (used by /api/bilibili-ranking)
const MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35,
  27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13,
  37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4,
  22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52,
]

/**
 * Dev-only proxy: forwards requests to whatever URL the client passes
 * in the `X-Target-URL` header. This bypasses CORS for arbitrary provider
 * APIs during development.
 *
 * Supports:
 *  - GET/POST proxying with automatic Referer + User-Agent injection
 *  - Bilibili WBI signature auto-signing for protected endpoints
 *  - Streaming (SSE) passthrough
 */
function apiProxyPlugin() {
  return {
    name: 'agent-api-proxy',
    configureServer(server: any) {
      // ---- Dedicated Bilibili ranking endpoint (with WBI signing) ----
      server.middlewares.use(
        '/api/bilibili-ranking',
        async (_req: IncomingMessage, res: ServerResponse) => {
          try {
            // 1. Fetch WBI keys
            const navResp = await fetch('https://api.bilibili.com/x/web-interface/nav', {
              headers: {
                'User-Agent': 'Mozilla/5.0',
                Referer: 'https://www.bilibili.com',
              },
            })
            const nav: any = await navResp.json()
            const extractKey = (url: string) =>
              (url.split('/').pop() ?? '').replace(/\.[^.]+$/, '')
            const imgKey = extractKey(nav?.data?.wbi_img?.img_url ?? '')
            const subKey = extractKey(nav?.data?.wbi_img?.sub_url ?? '')

            // 2. Generate mixin_key
            const rawKey = imgKey + subKey
            let mixinKey = ''
            for (const idx of MIXIN_KEY_ENC_TAB) {
              if (idx < rawKey.length) mixinKey += rawKey[idx]
            }
            mixinKey = mixinKey.slice(0, 32)

            // 3. Build signed URL for ranking
            const params: Record<string, string> = { rid: '0', type: 'all', wts: String(Math.floor(Date.now() / 1000)) }
            const sortedKeys = Object.keys(params).sort()
            const encode = (v: string) =>
              encodeURIComponent(v)
                .replace(/!/g, '%21')
                .replace(/'/g, '%27')
                .replace(/\(/g, '%28')
                .replace(/\)/g, '%29')
                .replace(/\*/g, '%2A')
            const query = sortedKeys.map((k) => `${k}=${encode(params[k])}`).join('&')
            const wRid = createHash('md5').update(query + mixinKey).digest('hex')

            const signedUrl = `https://api.bilibili.com/x/web-interface/ranking/v2?${query}&w_rid=${wRid}`

            // 4. Fetch ranking data
            const rankResp = await fetch(signedUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0',
                Referer: 'https://www.bilibili.com',
              },
            })
            const data = await rankResp.text()

            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.setHeader('Access-Control-Allow-Origin', '*')
            res.end(data)
          } catch (err: any) {
            res.statusCode = 502
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'ranking fetch failed', detail: String(err?.message ?? err) }))
          }
        },
      )

      // ---- Generic proxy for all other API calls ----
      server.middlewares.use(
        '/proxy',
        async (req: IncomingMessage, res: ServerResponse) => {
          let target = req.headers['x-target-url']
          if (!target || typeof target !== 'string') {
            res.statusCode = 400
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ error: 'missing X-Target-URL header' }))
            return
          }

          // collect request body
          const chunks: Buffer[] = []
          for await (const chunk of req) chunks.push(chunk as Buffer)
          const body = chunks.length ? Buffer.concat(chunks) : undefined

          // forward request, dropping hop-by-hop / proxy-specific headers
          const headers: Record<string, string> = {}
          for (const [k, v] of Object.entries(req.headers)) {
            if (!v) continue
            const lower = k.toLowerCase()
            if (
              lower === 'host' ||
              lower === 'connection' ||
              lower === 'content-length' ||
              lower === 'x-target-url' ||
              lower === 'origin'
            )
              continue
            headers[k] = Array.isArray(v) ? v.join(',') : String(v)
          }

          // Set default headers for known platform APIs
          const targetHost = new URL(target).host
          if (!headers['referer'] && !headers['Referer']) {
            if (targetHost.includes('bilibili.com')) {
              headers['Referer'] = 'https://www.bilibili.com'
            } else if (targetHost.includes('douyin.com')) {
              headers['Referer'] = 'https://www.douyin.com'
            }
          }
          if (!headers['user-agent'] && !headers['User-Agent']) {
            headers['User-Agent'] =
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
          }

          try {
            const upstream = await fetch(target, {
              method: req.method,
              headers,
              body,
            })

            res.statusCode = upstream.status
            upstream.headers.forEach((value, key) => {
              // Some headers are managed by node automatically
              if (
                key.toLowerCase() === 'content-encoding' ||
                key.toLowerCase() === 'transfer-encoding' ||
                key.toLowerCase() === 'content-length'
              )
                return
              res.setHeader(key, value)
            })

            if (!upstream.body) {
              res.end()
              return
            }
            // stream the upstream body to the client
            const reader = upstream.body.getReader()
            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              res.write(Buffer.from(value))
            }
            res.end()
          } catch (err: any) {
            res.statusCode = 502
            res.setHeader('content-type', 'application/json')
            res.end(
              JSON.stringify({
                error: 'upstream fetch failed',
                detail: String(err?.message ?? err),
              }),
            )
          }
        },
      )
    },
  }
}

export default defineConfig({
  plugins: [react(), apiProxyPlugin()],
  server: {
    port: 5173,
    host: true,
  },
})
