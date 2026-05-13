export type ProviderKind = 'openai-compatible' | 'anthropic'

export interface ProviderConfig {
  /** Stable id of the active preset, or 'custom' */
  presetId: string
  provider: ProviderKind
  /** Full base URL without trailing slash, e.g. https://api.openai.com/v1 */
  baseURL: string
  apiKey: string
  model: string
}

export interface NodeConfig {
  /** UI label only */
  label: string
  systemPrompt: string
  /** May reference {input} (upstream output) and {topic} (root topic) */
  userPromptTemplate: string
  temperature: number
  maxTokens: number
  /** Optional per-node override. If null/undefined, uses global ProviderConfig. */
  override?: Partial<ProviderConfig>
}

export interface AgentRunOptions {
  systemPrompt: string
  userPrompt: string
  temperature: number
  maxTokens: number
  signal?: AbortSignal
}
