import type { ProviderConfig, ProviderKind } from './types'

export interface ProviderPreset {
  id: string
  name: string
  provider: ProviderKind
  baseURL: string
  /** Suggested default model id for this preset */
  defaultModel: string
  /** Common alternative models, used to populate the model picker datalist */
  models: string[]
  /** Where the user gets an API key */
  apiKeyHint?: string
}

export const PRESETS: ProviderPreset[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    provider: 'openai-compatible',
    baseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1', 'o4-mini'],
    apiKeyHint: 'platform.openai.com → API keys',
  },
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    provider: 'anthropic',
    baseURL: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-5-sonnet-latest',
    models: [
      'claude-3-5-sonnet-latest',
      'claude-3-5-haiku-latest',
      'claude-3-opus-latest',
      'claude-sonnet-4-5',
    ],
    apiKeyHint: 'console.anthropic.com → API keys',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    provider: 'openai-compatible',
    baseURL: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    apiKeyHint: 'platform.deepseek.com → API keys',
  },
  {
    id: 'moonshot',
    name: 'Moonshot · Kimi',
    provider: 'openai-compatible',
    baseURL: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-8k',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    apiKeyHint: 'platform.moonshot.cn → API keys',
  },
  {
    id: 'zhipu',
    name: '智谱 GLM',
    provider: 'openai-compatible',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-plus',
    models: ['glm-4-plus', 'glm-4-air', 'glm-4-flash'],
    apiKeyHint: 'bigmodel.cn → 控制台',
  },
  {
    id: 'qwen',
    name: '通义 Qwen (DashScope)',
    provider: 'openai-compatible',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-plus',
    models: ['qwen-plus', 'qwen-max', 'qwen-turbo'],
    apiKeyHint: 'dashscope.console.aliyun.com',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    provider: 'openai-compatible',
    baseURL: 'https://openrouter.ai/api/v1',
    defaultModel: 'anthropic/claude-3.5-sonnet',
    models: [
      'anthropic/claude-3.5-sonnet',
      'openai/gpt-4o-mini',
      'google/gemini-2.0-flash-001',
      'meta-llama/llama-3.3-70b-instruct',
    ],
    apiKeyHint: 'openrouter.ai/keys',
  },
  {
    id: 'ollama',
    name: 'Ollama (本地)',
    provider: 'openai-compatible',
    baseURL: 'http://localhost:11434/v1',
    defaultModel: 'llama3.2',
    models: ['llama3.2', 'qwen2.5', 'deepseek-r1'],
    apiKeyHint: '本地运行，无需 key（留空或填 ollama）',
  },
  {
    id: 'custom',
    name: '自定义',
    provider: 'openai-compatible',
    baseURL: '',
    defaultModel: '',
    models: [],
    apiKeyHint: '任意 OpenAI 兼容接口',
  },
]

export function presetById(id: string): ProviderPreset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[0]
}

export function defaultProviderConfig(): ProviderConfig {
  const p = PRESETS[0]
  return {
    presetId: p.id,
    provider: p.provider,
    baseURL: p.baseURL,
    apiKey: '',
    model: p.defaultModel,
  }
}
