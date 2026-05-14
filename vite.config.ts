import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'

/**
 * Dev-only proxy: forwards `POST /proxy` to whatever URL the client passed
 * in the `X-Target-URL` header. This bypasses CORS for arbitrary provider
 * APIs (OpenAI / Anthropic / DeepSeek / etc.) during development.
 *
 * The proxy strips `X-Target-URL` and forwards everything else verbatim,
 * including streaming (SSE) responses.
 */
function apiProxyPlugin() {
  return {
    name: 'agent-api-proxy',
    configureServer(server: any) {
      server.middlewares.use(
        '/proxy',
        async (req: IncomingMessage, res: ServerResponse) => {
          const target = req.headers['x-target-url']
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
              lower === 'origin' ||
              lower === 'referer'
            )
              continue
            headers[k] = Array.isArray(v) ? v.join(',') : String(v)
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
    proxy: {
      '/api': 'http://localhost:8066',
      '/workflows': 'http://localhost:8066',
      '/runs': 'http://localhost:8066',
      '/webhooks': 'http://localhost:8066',
    },
  },
  preview: {
    port: 5174,
    host: true,
    allowedHosts: true,   // allow all tunnel hosts
  },
})
