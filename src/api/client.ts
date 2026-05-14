// 统一 fetch 封装，代理到 Flask 后端 8066
const BASE = ''  // Vite proxy 转发，开发时透明

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${path}`)
  const json = await res.json()
  if (json.ok === false) throw new Error(json.error || 'API error')
  return json
}

export const apiGet  = <T>(path: string) => apiFetch<T>(path)
export const apiPost = <T>(path: string, body?: unknown) =>
  apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) })
export const apiPut  = <T>(path: string, body?: unknown) =>
  apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(body ?? {}) })
export const apiDel  = <T>(path: string) =>
  apiFetch<T>(path, { method: 'DELETE' })
