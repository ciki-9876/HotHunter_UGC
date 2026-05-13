import type { NodeConfig } from './types'

export const NODE_IDS = {
  input: 'n-input',
  outline: 'n-outline',
  writer: 'n-writer',
  editor: 'n-editor',
  output: 'n-output',
} as const

export type AgentNodeId = string

/** The three seed agents that ship with the canvas */
export const SEED_AGENT_IDS = [
  NODE_IDS.outline,
  NODE_IDS.writer,
  NODE_IDS.editor,
] as const

/** Compatibility re-export — UI code reads this for the status pill */
export const AGENT_ORDER: readonly string[] = SEED_AGENT_IDS

export const DEFAULT_NODE_CONFIGS: Record<string, NodeConfig> = {
  [NODE_IDS.outline]: {
    label: '大纲生成 Agent',
    systemPrompt:
      '你是一位资深的中文内容策划。请根据用户给定的主题，输出一份清晰的文章大纲：3 个章节，每个章节给出标题与一行简短摘要，使用 Markdown。不要写正文，只写大纲。',
    userPromptTemplate: '主题：{topic}\n\n请基于这个主题给出三章节大纲。',
    temperature: 0.7,
    maxTokens: 800,
  },
  [NODE_IDS.writer]: {
    label: '正文写作 Agent',
    systemPrompt:
      '你是一位优秀的中文作者。请根据上一步给出的大纲，写一篇约 600 字的完整文章，语言自然、节奏舒适，使用 Markdown 排版。',
    userPromptTemplate:
      '主题：{topic}\n\n大纲如下：\n{input}\n\n请基于大纲写出完整文章。',
    temperature: 0.8,
    maxTokens: 1600,
  },
  [NODE_IDS.editor]: {
    label: '润色编辑 Agent',
    systemPrompt:
      '你是一位严谨的中文编辑。请对收到的文章进行润色：让语言更精炼、节奏更舒适、用词更精准，保留原意与结构。直接给出润色后的成稿，不要解释你的修改。',
    userPromptTemplate: '请润色以下文章：\n\n{input}',
    temperature: 0.5,
    maxTokens: 1800,
  },
}

export const GENERIC_AGENT_CONFIG: NodeConfig = {
  label: '新 Agent',
  systemPrompt: '你是一个 AI 助手。请基于用户给到的输入完成对应任务。',
  userPromptTemplate: '输入：\n{input}',
  temperature: 0.7,
  maxTokens: 1200,
}

/* ---------------- Mock fallbacks (used when no API key configured) ---------------- */

export function mockOutline(topic: string): string {
  return [
    `# 《${topic}》· 文章大纲`,
    '',
    `## 第 1 章 · 引入：为什么《${topic}》值得被关注`,
    '   - 当下的背景与现状速描',
    '   - 我们要解决的核心问题',
    '',
    `## 第 2 章 · 拆解：${topic} 的三个关键支点`,
    '   - 支点一：核心概念与定义',
    '   - 支点二：实际应用中的难点',
    '   - 支点三：可复用的方法论',
    '',
    `## 第 3 章 · 行动：把《${topic}》落到日常`,
    '   - 给读者的三步行动清单',
    '   - 进一步阅读与延伸',
  ].join('\n')
}

export function mockArticle(topic: string): string {
  return [
    `# ${topic}`,
    '',
    `当我们谈论《${topic}》时，大多数人脑海里浮现的还是它最表层的样子。但真正驱动它的，是一组看似平常、却被反复忽视的底层规律。`,
    '',
    `## 一、为什么《${topic}》正在被重新定义`,
    `过去几年，行业对${topic}的理解经历了三次跃迁：从工具化、到方法论化、再到今天的系统化。每一次跃迁背后，都是用户需求颗粒度变细的结果。`,
    '',
    `## 二、三个常被忽略的关键支点`,
    `**支点一 · 概念**：${topic}的本质并不复杂，它是一组可被拆解、可被复用的最小单元。`,
    `**支点二 · 难点**：真正的难点不在执行，而在"判断哪件事不该做"。`,
    `**支点三 · 方法**：用最小可验证流程替代一次性大方案，跑得快才能改得快。`,
    '',
    `## 三、把《${topic}》落到日常`,
    `1. 列出你目前正在投入${topic}的 3 件事；`,
    `2. 用 10 分钟把它们按"必要 / 重要 / 顺手"重新排序；`,
    `3. 只保留前两类，剩下的直接归档。`,
    '',
    `结尾：${topic}从来不是知识问题，而是选择问题。`,
  ].join('\n')
}

export function mockEdited(topic: string): string {
  return [
    `# ${topic}：少做一点，反而更快`,
    '',
    `我们对《${topic}》的误解，往往不是因为不懂，而是因为做得太多。`,
    '',
    `## 一、重新理解${topic}`,
    `过去几年，行业对它的认知经历了三次跃迁——工具化、方法论化、系统化。每一次跃迁的背后，都是同一件事：用户的需求颗粒度，正在变得越来越细。`,
    '',
    `## 二、三个被忽略的支点`,
    `**概念**：${topic}并不复杂，它是一组可拆解、可复用的最小单元。`,
    `**难点**：真正的难，不在执行，而在判断"哪件事不该做"。`,
    `**方法**：用最小可验证流程，替代一次性大方案；跑得快，才改得快。`,
    '',
    `## 三、可以今天就开始的三步`,
    `1. 写下当前正在为${topic}投入的 3 件事；`,
    `2. 花 10 分钟按"必要 / 重要 / 顺手"重新排序；`,
    `3. 只保留前两类，其它归档，不再回看。`,
    '',
    `${topic}从来不是知识问题，而是选择问题。`,
  ].join('\n')
}
