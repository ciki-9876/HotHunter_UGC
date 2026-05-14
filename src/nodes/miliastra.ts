/**
 * Miliastra (千星奇域) application-layer nodes — V3.1 收束版
 *
 * 原有的热点评分、热点分类、玩法匹配、爽点提取、GIA评估等节点
 * 已统一合并为平台层 `agent` 节点，通过 System Prompt 配置实现业务差异化。
 *
 * 本文件保留热点业务场景的「预制模板快照」，供工作流模板页直接加载。
 */
import { registerNodes } from './registry'

// 无业务专属节点需注册 — 全部使用平台层三类核心节点
export function registerMiliastraNodes() {
  // noop — 业务节点已收束至 platform.ts
}

// ── 热点业务场景预制模板快照 ────────────────────────────────────────────────
// 供工作流模板页 (WorkflowTemplates) 加载
export const HOTSPOT_TEMPLATE_SNAPSHOT = {
  name: '热点内容生产工作流',
  description: '代码工具节点（爬虫）→ Agent 节点（热点分析）→ 模块输出节点（热点看板）',
  nodes: [
    {
      id: 'n1',
      type: 'topicInput',
      position: { x: 80, y: 200 },
      config: { label: '触发器' },
    },
    {
      id: 'n2',
      type: 'code_tool',
      position: { x: 320, y: 200 },
      config: {
        label: '热点爬虫',
        language: 'python',
        code: [
          '# B站 / 小红书热搜爬虫示例',
          '# 替换为实际接口后直接可用',
          'import requests',
          '',
          'def main(inputs: dict) -> dict:',
          '    # B站热搜',
          '    bi = requests.get("https://api.bilibili.com/x/web-interface/ranking/v2", timeout=10)',
          '    # 小红书热点（需配置 Cookie）',
          '    # xhs = requests.get("https://www.xiaohongshu.com/explore", headers={...})',
          '    return {"hotspots": bi.json().get("data", {}).get("list", [])[:20]}',
        ].join('\n'),
        timeout: 30,
      },
    },
    {
      id: 'n3',
      type: 'agent',
      position: { x: 580, y: 200 },
      config: {
        label: '热点分析 Agent',
        systemPrompt: [
          '你是千星奇域热点内容分析专家。',
          '根据输入的热点数据，完成以下分析：',
          '1. 热度评分（0-100）',
          '2. 内容品类分类（竞技/解谜/跑酷/冒险/休闲/叙事）',
          '3. 核心爽点提取（玩家为什么喜欢）',
          '4. 千星奇域玩法匹配建议',
          '5. GIA 可行性初步评估（高/中/低）',
          '输出严格 JSON 格式。',
        ].join('\n'),
        userPromptTemplate: '热点数据：\n{input}\n\n请完成分析并以JSON输出。',
        temperature: 0.3,
        maxTokens: 2048,
      },
    },
    {
      id: 'n4',
      type: 'module_output',
      position: { x: 840, y: 200 },
      config: {
        label: '推送到热点看板',
        targetModule: 'dau',
      },
      data: { target: 'dau' },
    },
  ],
  edges: [
    { id: 'e1', source: 'n1', sourceHandle: 'out_0', target: 'n2', targetHandle: 'in_0' },
    { id: 'e2', source: 'n2', sourceHandle: 'out_0', target: 'n3', targetHandle: 'in_0' },
    { id: 'e3', source: 'n3', sourceHandle: 'out_0', target: 'n4', targetHandle: 'in_0' },
  ],
}

