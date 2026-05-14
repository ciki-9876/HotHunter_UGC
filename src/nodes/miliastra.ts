/**
 * Miliastra (千星奇域) application-layer node definitions.
 * Registered separately so the platform layer stays business-agnostic.
 */
import type { NodeDefinition } from '../types'
import { registerNodes } from './registry'

const MILIASTRA_NODES: NodeDefinition[] = [
  // ── 热点采集 ────────────────────────────────────────────────────────────────
  {
    type: 'hotspot_fetch',
    category: 'miliastra',
    title: '热点采集',
    description: '拉取 B站/微博/抖音/小红书/NGA 热榜，自动去重打标',
    icon: '🔥',
    accentColor: '#FF375F',
    defaultConfig: {
      label: '热点采集',
      apiConfig: {
        url: '',
        method: 'POST',
        headers: '{"Content-Type":"application/json"}',
        bodyTemplate: '{"platforms":["weibo","bilibili"],"topN":20,"dedup":true}',
        authType: 'none',
        authToken: '',
        timeoutMs: 30000,
      },
    },
    inputPorts: [],
    outputPorts: [
      { id: 'out_0', name: 'hotspots', dataType: 'array',  required: false,
        description: 'Array of {id,title,platform,heat,trend,category,tags,detectedAt}' },
    ],
  },
  // ── 热度评分 ────────────────────────────────────────────────────────────────
  {
    type: 'hotspot_score',
    category: 'miliastra',
    title: '热度评分',
    description: '综合热度/趋势/平台覆盖/IP价值，输出 0-100 评分',
    icon: '📊',
    accentColor: '#FF9F0A',
    defaultConfig: {
      label: '热度评分',
      systemPrompt: `你是千星奇域热点分析专家。
对输入热点进行多维评分，输出严格JSON格式：
{"score":0-100,"scoreDetail":{"absoluteHeat":0-100,"trendSlope":0-100,"platformCoverage":0-100,"ipValue":0-100},"recommendation":"follow|watch|skip"}
评分标准：follow>=70; watch=40-69; skip<40`,
      userPromptTemplate: `热点数据：{input}
请评分并以JSON输出。`,
      temperature: 0.2,
      maxTokens: 512,
    },
    inputPorts: [
      { id: 'in_0', name: 'hotspot', dataType: 'object', required: true,
        description: '单个热点对象' },
    ],
    outputPorts: [
      { id: 'out_0', name: 'score',          dataType: 'number', required: false },
      { id: 'out_1', name: 'scoreDetail',    dataType: 'object', required: false },
      { id: 'out_2', name: 'recommendation', dataType: 'string', required: false },
    ],
  },
  // ── 热点类型分类 ─────────────────────────────────────────────────────────────
  {
    type: 'hotspot_classify',
    category: 'miliastra',
    title: '热点分类',
    description: '将热点分为 IP联动/社会事件/游戏梗/音乐/影视/体育/节日 7类',
    icon: '🏷',
    accentColor: '#BF5AF2',
    defaultConfig: {
      label: '热点分类',
      systemPrompt: `你是热点分类专家，将输入热点归类。
可选分类：IP联动、社会事件、游戏梗、音乐、影视、体育、节日
输出严格JSON：{"category":"分类名","confidence":0-1,"subCategories":["子标签"]}`,
      userPromptTemplate: '热点：{input}\n请分类，以JSON输出。',
      temperature: 0.1,
      maxTokens: 256,
    },
    inputPorts: [
      { id: 'in_0', name: 'hotspot', dataType: 'object', required: true },
    ],
    outputPorts: [
      { id: 'out_0', name: 'category',      dataType: 'string', required: false },
      { id: 'out_1', name: 'confidence',    dataType: 'number', required: false },
      { id: 'out_2', name: 'subCategories', dataType: 'array',  required: false },
    ],
  },
  // ── 玩法匹配 ────────────────────────────────────────────────────────────────
  {
    type: 'gameplay_match',
    category: 'miliastra',
    title: '玩法匹配',
    description: '基于热点类型从玩法原子库检索最匹配的 Top3 玩法方向',
    icon: '🎮',
    accentColor: '#34C759',
    defaultConfig: {
      label: '玩法匹配',
      systemPrompt: `你是千星奇域玩法策略专家。
根据热点类型和分类，从以下玩法原子库中推荐最适合的3个玩法：
跑酷、收集、解谜、射击、竞速、节奏、沙盒、对抗、生存、角色扮演

对每个推荐给出：
{"gameplayOptions":[{"name":"玩法名","matchScore":0-100,"rationale":"推荐理由（50字内）","difficulty":1-5,"estimatedD7Retention":"低/中/高"}]}`,
      userPromptTemplate: `热点信息：{input}
类型：{{category}}

请推荐3个最适合的玩法，以JSON输出。`,
      temperature: 0.4,
      maxTokens: 1024,
    },
    inputPorts: [
      { id: 'in_0', name: 'hotspot',  dataType: 'object', required: true },
      { id: 'in_1', name: 'category', dataType: 'string', required: false },
    ],
    outputPorts: [
      { id: 'out_0', name: 'gameplayOptions', dataType: 'array', required: false },
    ],
  },
  // ── 爽点提取 ────────────────────────────────────────────────────────────────
  {
    type: 'hook_extract',
    category: 'miliastra',
    title: '爽点提取',
    description: '分析外部爆款玩法，提取「核心 3 秒爽点」',
    icon: '⚡',
    accentColor: '#FF9F0A',
    defaultConfig: {
      label: '爽点提取',
      systemPrompt: `你是游戏体验分析专家，专注于识别让玩家在3秒内产生强烈正反馈的核心设计。

分析输入的游戏/玩法描述，输出：
{"coreHook":"核心爽点一句话描述","hookType":"achievement|collection|competition|exploration|rhythm|puzzle|other","hookDetail":"详细分析（100字内）","essentialElements":["必须保留的元素"],"removableElements":["可以删除的次要元素"]}`,
      userPromptTemplate: '玩法描述：{input}\n\n请提取核心爽点，以JSON输出。',
      temperature: 0.5,
      maxTokens: 800,
    },
    inputPorts: [
      { id: 'in_0', name: 'gameplayDescription', dataType: 'string', required: true },
    ],
    outputPorts: [
      { id: 'out_0', name: 'coreHook',           dataType: 'string', required: false },
      { id: 'out_1', name: 'hookType',            dataType: 'string', required: false },
      { id: 'out_2', name: 'essentialElements',   dataType: 'array',  required: false },
      { id: 'out_3', name: 'removableElements',   dataType: 'array',  required: false },
    ],
  },
  // ── GIA 可行性评估 ────────────────────────────────────────────────────────────
  {
    type: 'gia_evaluate',
    category: 'miliastra',
    title: 'GIA 可行性评估',
    description: '评估玩法在千星 GIA 编辑器中的实现难度，输出 0-10 可行性评分',
    icon: '🔬',
    accentColor: '#0071E3',
    defaultConfig: {
      label: 'GIA 可行性评估',
      systemPrompt: `你是千星奇域 GIA 编辑器技术专家。
评估给定玩法在 GIA 节点图编辑器中的实现可行性。

GIA 能力说明：
- 支持：触发器、变量、计时器、碰撞检测、UI组件、音效、粒子、动画状态机
- 支持：复杂分支逻辑、循环、事件系统、多人同步（基础）
- 限制：无法实现物理引擎级别的精确模拟、无法实现高精度3D变换
- 限制：单关卡节点图上限约500个节点

评分标准：8-10=高度可行；6-7=基本可行需改造；4-5=部分可行需降级；1-3=当前不可行

输出格式：
{"feasibilityScore":0-10,"feasibilityLevel":"high|medium|low|infeasible","obstacles":[{"element":"元素","issue":"问题","severity":"blocking|major|minor"}],"suggestion":"改造建议","estimatedEffort":"low|medium|high"}`,
      userPromptTemplate: `玩法描述：{input}
核心爽点：{{coreHook}}
必须保留元素：{{essentialElements}}

请评估 GIA 可行性，以JSON输出。`,
      temperature: 0.2,
      maxTokens: 1024,
    },
    inputPorts: [
      { id: 'in_0', name: 'gameplayDescription', dataType: 'string', required: true },
      { id: 'in_1', name: 'coreHook',            dataType: 'string', required: false },
      { id: 'in_2', name: 'essentialElements',   dataType: 'array',  required: false },
    ],
    outputPorts: [
      { id: 'out_0', name: 'feasibilityScore', dataType: 'number', required: false },
      { id: 'out_1', name: 'feasibilityLevel', dataType: 'string', required: false },
      { id: 'out_2', name: 'obstacles',         dataType: 'array',  required: false },
      { id: 'out_3', name: 'suggestion',        dataType: 'string', required: false },
    ],
  },
  // ── 创作者匹配 ───────────────────────────────────────────────────────────────
  {
    type: 'creator_match',
    category: 'miliastra',
    title: '创作者匹配',
    description: '基于玩法类型和难度，推荐最合适的签约创作者',
    icon: '👤',
    accentColor: '#BF5AF2',
    defaultConfig: {
      label: '创作者匹配',
      systemPrompt: `你是千星奇域创作者运营专家。
根据玩法类型、难度系数和可行性评分，给出创作者选择策略建议。

输出格式：
{"strategy":"选人策略描述","requirements":["创作者要求"],"riskFactors":["潜在风险"],"timelineEstimate":"预计制作周期"}`,
      userPromptTemplate: `玩法方向：{input}
难度：{{difficulty}}
GIA可行性：{{feasibilityScore}}/10

请给出创作者匹配策略，以JSON输出。`,
      temperature: 0.5,
      maxTokens: 512,
    },
    inputPorts: [
      { id: 'in_0', name: 'gameplayOption',   dataType: 'object', required: true },
      { id: 'in_1', name: 'feasibilityScore', dataType: 'number', required: false },
    ],
    outputPorts: [
      { id: 'out_0', name: 'strategy',          dataType: 'string', required: false },
      { id: 'out_1', name: 'requirements',      dataType: 'array',  required: false },
      { id: 'out_2', name: 'timelineEstimate',  dataType: 'string', required: false },
    ],
  },
  // ── 上线时机 ────────────────────────────────────────────────────────────────
  {
    type: 'launch_timing',
    category: 'miliastra',
    title: '上线时机',
    description: '结合热点生命周期，计算最优上线时间窗口',
    icon: '⏱',
    accentColor: '#FF9F0A',
    defaultConfig: {
      label: '上线时机',
      systemPrompt: `你是内容发布时机分析专家。
根据热点趋势和内容就绪日，分析最优发布窗口。

热点生命周期规律：
- 社会事件/游戏梗：2-5天峰值期
- IP联动：5-14天峰值期  
- 音乐/影视：3-7天峰值期
- 节日：固定日期前3天到节日当天

输出格式：
{"hotspotPeakEstimate":"预测峰值时间描述","urgency":"critical|high|medium|low","optimalWindow":"最优发布时间描述","timingAdvice":"具体建议"}`,
      userPromptTemplate: `热点信息：{input}
热点类型：{{category}}
趋势：{{trend}}

请分析发布时机，以JSON输出。`,
      temperature: 0.3,
      maxTokens: 512,
    },
    inputPorts: [
      { id: 'in_0', name: 'hotspot',  dataType: 'object', required: true },
      { id: 'in_1', name: 'category', dataType: 'string', required: false },
    ],
    outputPorts: [
      { id: 'out_0', name: 'urgency',        dataType: 'string', required: false },
      { id: 'out_1', name: 'optimalWindow',  dataType: 'string', required: false },
      { id: 'out_2', name: 'timingAdvice',   dataType: 'string', required: false },
    ],
  },
  // ── 经验卡片生成 ─────────────────────────────────────────────────────────────
  {
    type: 'experience_card_gen',
    category: 'miliastra',
    title: '经验卡片生成',
    description: '关卡生命周期结束后，自动生成结构化复盘经验卡片',
    icon: '📝',
    accentColor: '#34C759',
    defaultConfig: {
      label: '经验卡片生成',
      systemPrompt: `你是内容复盘专家，负责总结热点内容生产的经验教训。
根据输入的全流程数据，生成结构化经验卡片。

输出格式：
{"lessons":"经验总结（200字内）","keyTakeaways":["关键结论1","关键结论2"],"tags":["标签"],"rating":"success|partial|miss","improvementSuggestions":["改进建议"]}`,
      userPromptTemplate: `本次热点内容生产数据：{input}

请生成经验卡片，以JSON输出。`,
      temperature: 0.5,
      maxTokens: 1024,
    },
    inputPorts: [
      { id: 'in_0', name: 'fullRecord', dataType: 'object', required: true,
        description: '包含热点信息、决策记录、时间线、数据表现的完整记录' },
    ],
    outputPorts: [
      { id: 'out_0', name: 'experienceCard', dataType: 'object', required: false },
    ],
  },
]

export function registerMiliastraNodes() {
  registerNodes(MILIASTRA_NODES)
}
