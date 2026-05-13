# Agent 蓝图 · 项目现状

> 一个面向融资 Demo 的可视化 AI 工作流编排工具，对标 UE5 蓝图编辑器。
> 用户在画布上拖拽节点、连线，组合多个 Agent 完成"内容生产 + 数据回灌 + 闭环自纠"。

更新时间：2026-05-13
分支：`claude/suspicious-kowalevski-990eb1`
PR：[#1](https://github.com/ciki-9876/HotHunter_UGC/pull/1)

---

## 1. 已实现能力总览

### 1.1 工作流编排画布
- 深色科技感画布；节点白色卡片；运行中蓝色发光呼吸，完成绿色发光，失败红色
- 边线三层 SVG（底色 + 发光 + 流光虚线）；上游 running 时下游边出现流光
- **MiniMap** 缩略图（右下），按节点类型上色，可拖可缩放
- **自动整理布局**（dagre LR 拓扑）一键水平网格化
- 节点：**拖拽 / 创建 / 删除 / 连线 / 取消连线** 全支持
  - **拖线落空白 = 创建节点**：从任意 Handle 拖出，松开在空白处自动新建 `genericAgent` 并按方向连边
  - **左侧浮窗 Palette**：分 4 段（添加节点 / 画布 / 我的工作流 / 导入）
  - 选中节点/边按 `Delete` 或 `Backspace` 删除
- **BFS 拓扑执行**：从 `TopicInput` 出发；多入度节点的输入按 `\n\n---\n\n` 拼接

### 1.2 节点类型（7 种）
| 类型 | 用途 |
|---|---|
| `topicInput` | 主题输入 + ▶ / ■ 控制 |
| `outlineAgent / writerAgent / editorAgent` | 三个种子 Agent，预置 prompt |
| `genericAgent` | Palette 新增的可自定义 Agent |
| **`criticNode`** | **评审节点 — 打分 + 反馈，分数未达阈值自动回触上游迭代（局部闭环）** |
| `outputNode` | 终点展示成稿 + 复制按钮 |
| `dispatchNode` | 输出回传 — 按格式写入数据看板 / 项目中心 |

### 1.3 Agent 节点新布局（自上而下）
1. **节点名称**（含小字 model 行）
2. **补充提示词输入框**（选填，持久化进 `nodeConfigs[id].extraPrompt`，运行时拼到 userPrompt）
3. **运行时输出**（可收起，状态在 store.collapsedNodes，跨视图切换不丢）
4. **状态 + ⚙ 点击配置** 直接打开侧栏「配置」tab

### 1.4 CriticNode 闭环执行
- 节点内置三个旋钮：**rubric 评分标准** / **阈值**（默认 75）/ **最大迭代数**（默认 3）
- 执行算法（[store.ts](src/store.ts) → judgeOnce + 主循环）：
  1. 取上游 Agent 的当前输出
  2. 调用 LLM 评审（强制返回 `{"score": 0-100, "feedback": "..."}` JSON，含解析容错）
  3. 若 `score >= threshold` → 通过，输出 = 上游文本
  4. 否则：把 feedback 拼到上游的 userPrompt（"上一版评审反馈，请基于此改进…"），**重跑上游**
  5. 重复直到通过或到达最大轮数
- Mock 模式预设三轮：58 → 73 → 89，自动展示闭环过程
- 节点卡片实时显示当前轮 / 分数 / 反馈；侧栏「结果」tab 看完整最新输出

### 1.5 模型适配层（`/agent/`）
- **协议**：OpenAI 兼容 (`/chat/completions`) + Anthropic 原生 (`/v1/messages`)，全部 SSE 流式
- **9 个 Provider 预设**：OpenAI · Claude · DeepSeek · Moonshot · 智谱 · 通义 · OpenRouter · Ollama · 自定义
- **Vite Dev Proxy** (`vite.config.ts`)：`POST /proxy` + `X-Target-URL` header，绕浏览器 CORS
- **回退**：API Key 为空时所有 Agent 走 mock；CriticNode 也用 mock 序列

### 1.6 Markdown 流式渲染
- 侧栏「结果」tab 全部用 `react-markdown` + `remark-gfm` 渲染（标题、列表、引用、代码块、表格、链接）
- 项目中心文件预览的章节体也走 markdown
- 渲染对部分 markdown（流式中途）容错，平滑刷新

### 1.7 工作流快照（保存/加载/导入/导出）
- Palette 底部「我的工作流」段：
  - 💾 **保存当前快照**（自定义名称，最多保留 32 条）
  - 列表显示已存快照（含时间、节点数 / 边数 tooltip），点击载入
  - 每行右侧 ↗ 导出为 `*.flow.json`，× 删除
  - 📥 **导入 JSON**（文件选择器）
- 持久化：`localStorage['agent-blueprint:workflows']`
- 快照包含：`nodes / edges / nodeConfigs / topic` —— 完整可复现的工作流定义

### 1.8 配置体系
- **全局**（右上 ⚙）：predicted / 协议 / baseURL / 模型 / key
- **节点级**（双击或单击 ⚙ 点击配置）：
  - 节点名称 / System Prompt / User Prompt 模板（`{topic}` `{input}` 占位符）
  - Temperature / Max Tokens
  - 可选模型覆盖
- 持久化：`localStorage`，刷新不丢

### 1.9 三个顶级视图 Tab
| Tab | 数据 | 用途 |
|---|---|---|
| **工作流** | 画布 + 节点状态 | 编排与执行 |
| **数据看板** | `dashboardCards`（3 条种子 + DispatchNode 回传） | UGC 关卡 / 外部热点 / 工作流回传 三源监控；指标卡 + 热点卡片网格 |
| **项目中心** | `projectFiles`（1 条种子 + DispatchNode 回传） | `.gia` 文件归档，支持复制 markdown / 下载 |

Tab 旁有 live badge 展示卡片数 / 文件数。

### 1.10 输出回传节点（DispatchNode）
- 节点内下拉切目标：**数据看板 · HotTopicCard** / **项目中心 · .gia 策划文档**
- 格式转换（[agent/dispatch.ts](src/agent/dispatch.ts)）：抽 markdown 标题、首段摘要、关键词标签；启发式热度分；按 `##` 切章节生成 .gia

---

## 2. 目录结构

```
src/
├── App.tsx                       顶栏 · 视图切换 · 模态框 · Toast
├── main.tsx
├── index.css                     全部样式
├── store.ts                      Zustand store：graph + 配置 + 执行器 + 快照 + critic 闭环
├── components/
│   └── Markdown.tsx              react-markdown 流式渲染包装
├── agent/
│   ├── client.ts                 runAgent() 流式生成器（OpenAI / Anthropic）
│   ├── critic.ts                 CriticNode prompts + JSON 解析 + mock 序列
│   ├── defaults.ts               种子 Agent 默认 prompt + GENERIC_AGENT_CONFIG
│   ├── dispatch.ts               DispatchNode 格式转换器
│   ├── layout.ts                 dagre 自动布局
│   ├── presets.ts                9 个 Provider 预设
│   ├── snapshots.ts              工作流快照 LS 持久化
│   └── types.ts                  ProviderConfig · NodeConfig
└── views/
    ├── Workflow.tsx              画布 · 节点 · 边 · Palette · MiniMap · SidePanel · 快照
    ├── Dashboard.tsx             数据看板视图
    └── ProjectCenter.tsx         项目中心视图
vite.config.ts                    含 dev API 代理
```

---

## 3. 数据契约速查

### 3.1 NodeConfig
```ts
interface NodeConfig {
  label: string
  systemPrompt: string
  userPromptTemplate: string     // {topic} {input}
  extraPrompt?: string           // 节点卡片上直接编辑的补充指令
  temperature: number
  maxTokens: number
  override?: Partial<ProviderConfig>
}
```

### 3.2 CriticNodeData
```ts
interface CriticNodeData {
  rubric: string
  threshold: number              // 0-100，默认 75
  maxIterations: number          // 1-8，默认 3
}
```

### 3.3 WorkflowSnapshot
```ts
interface WorkflowSnapshot {
  id: string
  name: string
  savedAt: number
  topic: string
  nodes: Node[]                  // React Flow nodes
  edges: Edge[]
  nodeConfigs: Record<string, NodeConfig>
  version: 1
}
```

### 3.4 HotTopicCard / GiaFile —— 见 agent/dispatch.ts

---

## 4. 演示流程

1. `npm install && npm run dev` → http://localhost:5173
2. **演示模式（默认）**：直接点 ▶ 看 mock 数据按打字机节奏在 5 个节点间流动；侧栏点节点看 markdown 渲染
3. **真实模式**：⚙ → 选 provider → 填 API Key → 保存 → ▶
4. **闭环演示**：从「正文写作 Agent」拖出连线到空白处 → 自动建一个 GenericAgent → 拖一个评审节点放在中间 → 重排成 `Writer → Critic → Editor` → ▶ → 看 Critic 触发回环，分数从 58 → 73 → 89 自动通过
5. **回传演示**：Palette 加 `+ 输出回传 · 看板` → 连到 Editor → ▶ → 切到「数据看板」看新增工作流卡片
6. **快照演示**：搭好一个有意思的工作流 → 「我的工作流 → 💾 保存当前快照 → 命名」→ 刷新页面 → 点列表里的快照即恢复
7. **整理画布**：节点乱后点 Palette「🎨 自动整理布局」一键 dagre 排版

---

## 5. 已知约束

- Dev 代理仅在 vite dev 下生效；上线需后端代理
- API Key 明文存浏览器 localStorage，仅适合 demo
- CriticNode 仅支持**单一直接上游**回环；不支持多上游或跨多级回环
- 节点位置不持久化（拖动后不存），快照保存才落盘
- 数据看板的 UGC/外部种子数据是写死的

---

## 6. 后续可选迭代

- **节点变体扩展**：URLFetch / CSVUpload / Branch / Merge / Approval
- **真接 UGC 数据源**：替换 dashboard 种子，接真实 API 或 SQLite
- **运行日志 & 成本可观测**：token 数 / 耗时 / 成本聚合
- **实时协作**：yjs + y-websocket，双人光标 + 同步状态
- **AB 测试**：同主题左右两条链路并排对比输出
- **后端代理**：Cloudflare Worker 替代 dev proxy，脱离开发环境
- **节点级日志面板**：每个 Agent 调用 raw token 流可展开
