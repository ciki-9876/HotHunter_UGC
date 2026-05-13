// ─────────────────────────────────────────────────────────────────────────────
// Platform-level types (PRD §2 Data Model)
// ─────────────────────────────────────────────────────────────────────────────

export type DataType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'any'

export interface PortDefinition {
  id: string
  name: string
  dataType: DataType
  required: boolean
  description?: string
}

// ── Node status / run status ──────────────────────────────────────────────────
export type NodeStatus = 'idle' | 'running' | 'done' | 'error' | 'waiting'
export type RunStatus  = 'pending' | 'running' | 'waiting_approval' | 'success' | 'failed' | 'cancelled'

// ── Provider / model config ───────────────────────────────────────────────────
export type ProviderKind = 'openai-compatible' | 'anthropic'

export interface ProviderConfig {
  presetId: string
  provider: ProviderKind
  baseURL: string
  apiKey: string
  model: string
}

// ── Per-node configuration stored in configStore ─────────────────────────────
export interface NodeConfig {
  label: string
  systemPrompt: string
  userPromptTemplate: string   // supports {topic} {input}
  extraPrompt?: string
  temperature: number
  maxTokens: number
  override?: Partial<ProviderConfig>
  /** For http_request / miliastra nodes */
  apiConfig?: HttpApiConfig
}

export interface HttpApiConfig {
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  headers: string          // JSON string
  bodyTemplate: string     // supports {{varName}}
  authType: 'none' | 'bearer' | 'basic' | 'api_key'
  authToken: string
  timeoutMs: number
}

// ── Agent run options (passed to client.ts) ───────────────────────────────────
export interface AgentRunOptions {
  systemPrompt: string
  userPrompt: string
  temperature: number
  maxTokens: number
  signal?: AbortSignal
}

// ── Node runtime data (for critic / dispatch / condition / etc.) ──────────────
export interface CriticNodeData {
  rubric: string
  threshold: number
  maxIterations: number
}

export interface ConditionNodeData {
  conditions: Array<{ id: string; label: string; expression: string }>
  defaultBranch: string
}

export interface LoopNodeData {
  iterateOver: string
  itemVarName: string
  maxIterations: number
  concurrency: number
}

export interface HumanApprovalNodeData {
  approvers: string[]
  message: string
  timeoutHours: number
  timeoutAction: 'skip' | 'approve' | 'reject' | 'terminate'
  approvalOptions: string[]
}

export type DispatchTarget = 'dashboard' | 'project'
export interface DispatchNodeData { target: DispatchTarget }

// ── WorkflowRun (backend persistence model) ───────────────────────────────────
export interface NodeRun {
  nodeId: string
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped'
  startedAt: number
  finishedAt?: number
  input: Record<string, unknown>
  output: Record<string, unknown>
  error?: string
  retryCount: number
}

export interface WorkflowRun {
  id: string
  workflowId: string
  status: RunStatus
  trigger: { type: string; payload: Record<string, unknown> }
  startedAt: number
  finishedAt?: number
  nodeRuns: NodeRun[]
  error?: { nodeId: string; message: string }
}

// ── Snapshot (local save / export) ───────────────────────────────────────────
export interface WorkflowSnapshot {
  id: string
  name: string
  savedAt: number
  topic: string
  nodes: import('reactflow').Node[]
  edges: import('reactflow').Edge[]
  nodeConfigs: Record<string, NodeConfig>
  version: 1
}

// ── Node Definition (registration interface) ──────────────────────────────────
export interface NodeDefinition {
  /** Unique string key, e.g. "llm", "http_request", "hotspot_fetch" */
  type: string
  /** Sidebar palette category */
  category: 'platform' | 'miliastra' | 'custom'
  title: string
  description: string
  icon: string
  accentColor: string
  defaultConfig: Partial<NodeConfig>
  defaultData?: Record<string, unknown>
  inputPorts:  PortDefinition[]
  outputPorts: PortDefinition[]
}
