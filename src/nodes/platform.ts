/**
 * Platform-layer node definitions — V3.1 收束版
 *
 * 三类核心节点：
 *   agent        — Agent 节点（LLM / Echo Agent，业务差异化通过 Prompt 配置）
 *   code_tool    — 代码工具节点（Python/JS，爬虫/数据处理/格式转换）
 *   module_output — 模块输出节点（将结果分发到指定业务模块页面）
 *
 * 四类辅助节点：
 *   condition    — 条件分支
 *   loop         — 循环
 *   human_approval — 人工审批
 *   notify       — 发送通知
 *
 * 触发器节点（画布起点）：
 *   topicInput   — 手动触发 / 主题输入
 *
 * 兼容保留（旧快照读取用，不在 Palette 中显示）：
 *   outputNode / dispatchNode / genericAgent / criticNode
 *   outlineAgent / writerAgent / editorAgent
 *   llm / http_request / sub_workflow
 */
import type { NodeDefinition } from '../types'
import { registerNodes } from './registry'

const PLATFORM_NODES: NodeDefinition[] = [

  // ══════════════════════════════════════════════════════════════
  //  触发器节点
  // ══════════════════════════════════════════════════════════════
  {
    type: 'topicInput',
    category: 'platform',
    title: '触发器',
    description: '工作流起点，提供初始输入（手动触发 / 主题文本）',
    icon: '▶',
    accentColor: 'oklch(62% 0.18 250)',   // --c-blue-500
    defaultConfig: { label: '触发器' },
    inputPorts: [],
    outputPorts: [{ id: 'out_0', name: 'input', dataType: 'string', required: false }],
  },

  // ══════════════════════════════════════════════════════════════
  //  核心节点 1：Agent 节点
  // ══════════════════════════════════════════════════════════════
  {
    type: 'agent',
    category: 'platform',
    title: 'Agent 节点',
    description: '调用 LLM / Echo Agent 执行分析、推理、生成。业务场景差异化通过配置不同 System Prompt 实现。',
    icon: '⚡',
    accentColor: 'oklch(62% 0.18 250)',   // --c-blue-500
    defaultConfig: {
      label: 'Agent',
      systemPrompt: '你是一个有帮助的 AI 助手。',
      userPromptTemplate: '请处理以下内容：\n\n{input}',
      temperature: 0.7,
      maxTokens: 2048,
    },
    inputPorts:  [{ id: 'in_0', name: 'input', dataType: 'any', required: false }],
    outputPorts: [{ id: 'out_0', name: 'output', dataType: 'string', required: false }],
  },

  // ══════════════════════════════════════════════════════════════
  //  核心节点 2：代码工具节点
  // ══════════════════════════════════════════════════════════════
  {
    type: 'code_tool',
    category: 'platform',
    title: '代码工具',
    description: '运行用户自定义代码（Python / JS），适合爬虫、数据处理、格式转换等工具性操作。',
    icon: '{ }',
    accentColor: 'oklch(62% 0.18 150)',   // --c-green-500
    defaultConfig: { label: '代码工具' },
    defaultData: {
      language: 'python',
      code: [
        '# Python 示例：B站热搜爬虫',
        '# def main(inputs: dict) -> dict:',
        '#     import requests',
        '#     r = requests.get("https://api.bilibili.com/x/web-interface/ranking/v2")',
        '#     return {"result": r.json()}',
      ].join('\n'),
      timeout: 30,
    },
    inputPorts:  [{ id: 'in_0', name: 'input', dataType: 'any', required: false }],
    outputPorts: [{ id: 'out_0', name: 'output', dataType: 'any', required: false }],
  },

  // ══════════════════════════════════════════════════════════════
  //  核心节点 3：模块输出节点
  // ══════════════════════════════════════════════════════════════
  {
    type: 'module_output',
    category: 'platform',
    title: '模块输出',
    description: '将工作流运行结果分发到指定业务模块页面（大盘数据 / 关卡中心 / 知识库 / 热点看板等）。',
    icon: '↗',
    accentColor: 'oklch(72% 0.18 60)',    // --c-orange-500
    defaultConfig: { label: '模块输出' },
    defaultData: { target: 'dau' },
    inputPorts:  [{ id: 'in_0', name: 'input', dataType: 'any', required: true }],
    outputPorts: [],
  },

  // ══════════════════════════════════════════════════════════════
  //  辅助节点
  // ══════════════════════════════════════════════════════════════
  {
    type: 'condition',
    category: 'platform',
    title: '条件分支',
    description: '根据表达式将流程分流到不同分支',
    icon: '⑂',
    accentColor: 'oklch(72% 0.18 60)',
    defaultConfig: { label: '条件分支' },
    defaultData: {
      conditions: [
        { id: 'c1', label: '条件 A', expression: 'input.score >= 60' },
        { id: 'c2', label: '条件 B', expression: 'input.score < 60' },
      ],
      defaultBranch: '条件 B',
    },
    inputPorts:  [{ id: 'in_0', name: 'input', dataType: 'any', required: true }],
    outputPorts: [
      { id: 'out_0', name: '条件 A', dataType: 'any', required: false },
      { id: 'out_1', name: '条件 B', dataType: 'any', required: false },
    ],
  },
  {
    type: 'loop',
    category: 'platform',
    title: '循环',
    description: '对数组逐项处理，支持串行或并发执行',
    icon: '↻',
    accentColor: 'oklch(62% 0.18 290)',   // --c-purple-500
    defaultConfig: { label: '循环' },
    defaultData: { iterateOver: 'items', itemVarName: 'item', maxIterations: 100, concurrency: 1 },
    inputPorts:  [{ id: 'in_0', name: 'items', dataType: 'array', required: true }],
    outputPorts: [{ id: 'out_0', name: 'results', dataType: 'array', required: false }],
  },
  {
    type: 'human_approval',
    category: 'platform',
    title: '人工审批',
    description: '暂停工作流，等待指定人确认后继续；支持超时自动处理',
    icon: '⏸',
    accentColor: 'oklch(62% 0.20 25)',    // --c-red-500
    defaultConfig: { label: '人工审批' },
    defaultData: { approvers: [], message: '请审批：\n\n{{input}}', timeoutHours: 24, timeoutAction: 'skip', approvalOptions: ['通过', '拒绝'] },
    inputPorts:  [{ id: 'in_0', name: 'input', dataType: 'any', required: false }],
    outputPorts: [
      { id: 'out_0', name: 'decision', dataType: 'string', required: false },
      { id: 'out_1', name: 'comment',  dataType: 'string', required: false },
    ],
  },
  {
    type: 'notify',
    category: 'platform',
    title: '发送通知',
    description: '通过 Wave 或邮件发送消息，支持变量插值',
    icon: '📨',
    accentColor: 'oklch(62% 0.18 250)',
    defaultConfig: {
      label: '发送通知',
      apiConfig: { url: '', method: 'POST', headers: '{"Content-Type":"application/json"}', bodyTemplate: '{"text":"{{input}}"}', authType: 'none', authToken: '', timeoutMs: 5000 },
    },
    inputPorts:  [{ id: 'in_0', name: 'input', dataType: 'any', required: false }],
    outputPorts: [],
  },

  // ══════════════════════════════════════════════════════════════
  //  兼容保留（不在 Palette 展示，旧快照可继续读取）
  // ══════════════════════════════════════════════════════════════
  { type: 'outputNode',    category: 'platform', title: '输出展示',  description: '兼容保留', icon: '📄', accentColor: '#30D158', defaultConfig: { label: '输出展示' }, inputPorts: [{ id: 'in_0', name: 'input', dataType: 'any', required: true }], outputPorts: [] },
  { type: 'dispatchNode',  category: 'platform', title: '输出回传',  description: '兼容保留', icon: '↩',  accentColor: '#0071E3', defaultConfig: { label: '输出回传' }, defaultData: { target: 'dashboard' }, inputPorts: [{ id: 'in_0', name: 'input', dataType: 'string', required: true }], outputPorts: [] },
  { type: 'criticNode',    category: 'platform', title: '评审',      description: '兼容保留', icon: '⚖',  accentColor: '#FF375F', defaultConfig: { label: '评审' }, defaultData: { rubric: '', threshold: 75, maxIterations: 3 }, inputPorts: [{ id: 'in_0', name: 'input', dataType: 'string', required: true }], outputPorts: [{ id: 'out_0', name: 'output', dataType: 'string', required: false }] },
  { type: 'genericAgent',  category: 'platform', title: '通用 Agent','description': '兼容保留', icon: '⚡', accentColor: '#636366', defaultConfig: { label: '通用 Agent', systemPrompt: '', userPromptTemplate: '{input}', temperature: 0.7, maxTokens: 2000 }, inputPorts: [{ id: 'in_0', name: 'input', dataType: 'any', required: false }], outputPorts: [{ id: 'out_0', name: 'output', dataType: 'string', required: false }] },
  { type: 'outlineAgent',  category: 'platform', title: '大纲 Agent','description': '兼容保留', icon: '📋', accentColor: '#4B8EF1', defaultConfig: { label: '大纲 Agent', systemPrompt: '', userPromptTemplate: '{topic}', temperature: 0.7, maxTokens: 1500 }, inputPorts: [{ id: 'in_0', name: 'topic', dataType: 'string', required: true }], outputPorts: [{ id: 'out_0', name: 'outline', dataType: 'string', required: false }] },
  { type: 'writerAgent',   category: 'platform', title: '写作 Agent','description': '兼容保留', icon: '✍️', accentColor: '#34C759', defaultConfig: { label: '写作 Agent', systemPrompt: '', userPromptTemplate: '{input}', temperature: 0.8, maxTokens: 3000 }, inputPorts: [{ id: 'in_0', name: 'outline', dataType: 'string', required: true }], outputPorts: [{ id: 'out_0', name: 'article', dataType: 'string', required: false }] },
  { type: 'editorAgent',   category: 'platform', title: '编辑 Agent','description': '兼容保留', icon: '✨', accentColor: '#FF9F0A', defaultConfig: { label: '编辑 Agent', systemPrompt: '', userPromptTemplate: '{input}', temperature: 0.6, maxTokens: 3000 }, inputPorts: [{ id: 'in_0', name: 'draft', dataType: 'string', required: true }], outputPorts: [{ id: 'out_0', name: 'edited', dataType: 'string', required: false }] },
  { type: 'llm',           category: 'platform', title: 'LLM',       description: '兼容保留', icon: '🧠', accentColor: '#4B8EF1', defaultConfig: { label: 'LLM', systemPrompt: '', userPromptTemplate: '{input}', temperature: 0.7, maxTokens: 2048 }, inputPorts: [{ id: 'in_0', name: 'input', dataType: 'any', required: false }], outputPorts: [{ id: 'out_0', name: 'result', dataType: 'string', required: false }] },
  { type: 'http_request',  category: 'platform', title: 'HTTP',      description: '兼容保留', icon: '🌐', accentColor: '#34C759', defaultConfig: { label: 'HTTP', apiConfig: { url: '', method: 'POST', headers: '{}', bodyTemplate: '{}', authType: 'none', authToken: '', timeoutMs: 5000 } }, inputPorts: [{ id: 'in_0', name: 'input', dataType: 'any', required: false }], outputPorts: [{ id: 'out_0', name: 'response', dataType: 'object', required: false }] },
  { type: 'sub_workflow',  category: 'platform', title: '子工作流',  description: '兼容保留', icon: '⊞', accentColor: '#636366', defaultConfig: { label: '子工作流' }, defaultData: { snapshotId: '' }, inputPorts: [{ id: 'in_0', name: 'input', dataType: 'any', required: false }], outputPorts: [{ id: 'out_0', name: 'output', dataType: 'any', required: false }] },
]

export function registerPlatformNodes() {
  registerNodes(PLATFORM_NODES)
}
