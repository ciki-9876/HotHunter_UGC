import type { AgentRunOptions, ProviderConfig } from './types'

const PROXY_PATH = '/proxy'

/** Async iterable of incremental text chunks. */
export type TokenStream = AsyncGenerator<string, void, void>

/**
 * Build the URL we POST to. In dev we route through Vite's `/proxy`
 * middleware to bypass CORS for arbitrary provider URLs. The middleware
 * reads the real target from the `X-Target-URL` header.
 */
function proxiedHeaders(target: string, base: Record<string, string>) {
  return { ...base, 'X-Target-URL': target }
}

export async function* runAgent(
  cfg: ProviderConfig,
  opts: AgentRunOptions,
): TokenStream {
  if (cfg.provider === 'anthropic') {
    yield* anthropicStream(cfg, opts)
  } else {
    yield* openaiStream(cfg, opts)
  }
}

/* ---------------- OpenAI-compatible streaming ---------------- */

async function* openaiStream(
  cfg: ProviderConfig,
  opts: AgentRunOptions,
): TokenStream {
  const target = `${cfg.baseURL.replace(/\/$/, '')}/chat/completions`
  const headers = proxiedHeaders(target, {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
    ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
  })
  const body = JSON.stringify({
    model: cfg.model,
    stream: true,
    temperature: opts.temperature,
    max_tokens: opts.maxTokens,
    messages: [
      { role: 'system', content: opts.systemPrompt },
      { role: 'user', content: opts.userPrompt },
    ],
  })

  const resp = await fetch(PROXY_PATH, {
    method: 'POST',
    headers,
    body,
    signal: opts.signal,
  })

  if (!resp.ok || !resp.body) {
    const text = await resp.text().catch(() => '')
    throw new Error(
      `OpenAI-compatible API error ${resp.status}: ${text.slice(0, 400)}`,
    )
  }

  for await (const event of parseSSE(resp.body)) {
    if (event.data === '[DONE]') return
    try {
      const json = JSON.parse(event.data)
      const delta: string | undefined = json?.choices?.[0]?.delta?.content
      if (delta) yield delta
    } catch {
      /* skip non-JSON keep-alive lines */
    }
  }
}

/* ---------------- Anthropic native streaming ---------------- */

async function* anthropicStream(
  cfg: ProviderConfig,
  opts: AgentRunOptions,
): TokenStream {
  const target = `${cfg.baseURL.replace(/\/$/, '')}/messages`
  const headers = proxiedHeaders(target, {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
    ...(cfg.apiKey ? { 'x-api-key': cfg.apiKey } : {}),
  })
  const body = JSON.stringify({
    model: cfg.model,
    stream: true,
    max_tokens: opts.maxTokens,
    temperature: opts.temperature,
    system: opts.systemPrompt,
    messages: [{ role: 'user', content: opts.userPrompt }],
  })

  const resp = await fetch(PROXY_PATH, {
    method: 'POST',
    headers,
    body,
    signal: opts.signal,
  })

  if (!resp.ok || !resp.body) {
    const text = await resp.text().catch(() => '')
    throw new Error(
      `Anthropic API error ${resp.status}: ${text.slice(0, 400)}`,
    )
  }

  for await (const event of parseSSE(resp.body)) {
    if (event.event === 'message_stop') return
    if (event.event !== 'content_block_delta') continue
    try {
      const json = JSON.parse(event.data)
      const delta: string | undefined = json?.delta?.text
      if (delta) yield delta
    } catch {
      /* skip */
    }
  }
}

/* ---------------- SSE parser ---------------- */

interface SSEEvent {
  event: string
  data: string
}

async function* parseSSE(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<SSEEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let currentEvent = 'message'
  let dataLines: string[] = []

  const flush = (): SSEEvent | null => {
    if (dataLines.length === 0 && currentEvent === 'message') return null
    const ev: SSEEvent = { event: currentEvent, data: dataLines.join('\n') }
    currentEvent = 'message'
    dataLines = []
    return ev
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let nlIdx: number
    while ((nlIdx = buffer.indexOf('\n')) >= 0) {
      const rawLine = buffer.slice(0, nlIdx).replace(/\r$/, '')
      buffer = buffer.slice(nlIdx + 1)
      if (rawLine === '') {
        const ev = flush()
        if (ev) yield ev
      } else if (rawLine.startsWith(':')) {
        // comment / keep-alive
      } else if (rawLine.startsWith('event:')) {
        currentEvent = rawLine.slice(6).trim()
      } else if (rawLine.startsWith('data:')) {
        dataLines.push(rawLine.slice(5).trimStart())
      }
    }
  }

  const tail = flush()
  if (tail) yield tail
}
