# Agent 蓝图 · 项目现状

> 一个面向融资 Demo 的可视化 AI 工作流编排工具，对标 UE5 蓝图编辑器。
> 用户在画布上拖拽节点、连线、组合多个 Agent，完成"内容生产 + 数据回灌"全链路。

更新时间：2026-05-13
分支：`claude/suspicious-kowalevski-990eb1`
PR：[#1](https://github.com/ciki-9876/HotHunter_UGC/pull/1)

---

## 1. 已实现能力总览

### 1.1 工作流编排画布（`/views/Workflow.tsx`）
- 深色科技感画布，节点白色卡片，运行中蓝色发光呼吸、完成绿色发光
- 节点间贝塞尔连线，三层 SVG（底色 + 发光 + 流光虚线）
- 节点：**拖拽 / 创建 / 删除 / 连线 / 取消连线** 全部支持
  - 拖拽：React Flow 默认；位置即时同步进 Zustand
  - 创建：左上角 **添加节点** 浮窗（Palette），按钮 `+ Agent` / `+ Dispatch · 看板` / `+ Dispatch · 项目`
  - 删除：选中节点/边后按 `Delete` 或 `Backspace`
  - 连线：拖动节点右侧 Handle 到下游节点左侧 Handle；同一对节点防重边
- **拓扑式 BFS 执行**：从 `TopicInput` 出发，等所有上游完成再执行下游；多入度节点的输入按 `\n\n---\n\n` 拼接

### 1.2 节点类型
| 类型 | 文件 | 功能 |
|---|---|---|
| `topicInput` | Workflow.tsx | 主题输入 + ▶ 开始运行 / ■ 停止 |
| `outlineAgent` / `writerAgent` / `editorAgent` | Workflow.tsx (AgentNode) | 三个种子 Agent，预置 prompt/temperature |
| `genericAgent` | Workflow.tsx (AgentNode) | Palette 新增的可自定义 Agent |
| `outputNode` | Workflow.tsx | 终点，展示成稿 + 复制按钮 |
| `dispatchNode` | Workflow.tsx | **输出回传**节点 — 把上游内容做格式转换后写入指定 Tab 页 |

### 1.3 模型适配层（`/agent/`）
- **协议**：OpenAI 兼容 (`/chat/completions`) + Anthropic 原生 (`/v1/messages`)，两者均支持 **SSE 流式响应**
- **预设 9 个 Provider**：OpenAI · Claude · DeepSeek · Moonshot · 智谱 · 通义 · OpenRouter · Ollama · 自定义
- **Vite Dev Proxy** (`vite.config.ts`)：`POST /proxy` + `X-Target-URL` header，转发任意 URL，绕浏览器 CORS
- **回退**：API Key 为空时所有 Agent 自动走 mock（按打字机节奏分块吐字），demo 永远能跑

### 1.4 配置体系
- **全局**：右上角 ⚙ → 模态框，选预设/协议/baseURL/模型/key
- **节点级**：双击 Agent 节点 → 侧栏「配置」tab → System Prompt / User Prompt 模板（`{topic}` `{input}` 占位符）/ Temperature / Max Tokens / 可选模型覆盖
- **持久化**：全部存 `localStorage`，刷新不丢

### 1.5 三个顶级视图 Tab（`/views/`）
| Tab | 数据来源 | 用途 |
|---|---|---|
| **工作流** | 画布 + 节点状态 | 编排与执行 |
| **数据看板** | `dashboardCards`（含 3 条种子 + DispatchNode 回传） | UGC 关卡 / 外部热点 / 工作流回传 三源监控；4 个指标卡 + 热点卡片网格 |
| **项目中心** | `projectFiles`（含 1 条种子 + DispatchNode 回传） | 策划文档 + `.gia` 文件归档；左侧列表 + 右侧详情，支持下载/复制 markdown |

顶部状态徽章 `数据看板 · 3` 实时显示卡片数。

### 1.6 输出回传节点（DispatchNode）
- 节点内下拉选择目标：**数据看板 · HotTopicCard** / **项目中心 · .gia 策划文档**
- 执行时自动调用对应格式转换器（`agent/dispatch.ts`）：
  - `toHotTopicCard(text, topic)` → `{ title, hotScore, trend, summary, tags[] }`，提取首个 markdown 标题作为 title、首段去 markdown 作为 summary、命中关键词作为 tags
  - `toGiaFile(text, topic)` → `{ filename, sections[], wordCount }`，按 `##` 切章节，文件名 `<slug(topic)>_<YYYYMMDD>.gia`
- 转换结果直接 `set()` 到 store 对应数组前端，Tab 页立即刷新

### 1.7 侧栏 & 交互
- 单击节点：右侧滑入面板，显示**实时**流式输出（运行时字符数随 token 增长）
- 双击节点：直接打开「配置」tab
- 错误：节点变红、面板顶部展示错误详情
- Toast：复制成功 / 配置保存 / 执行完成 等轻提示

---

## 2. 目录结构

```
src/
├── App.tsx                  顶栏 + 视图切换 + 模态框 + Toast
├── main.tsx
├── index.css                所有样式（深色主题 / 节点 / 模态 / 看板 / 项目）
├── store.ts                 Zustand store：graph state + 配置 + 执行器
├── agent/
│   ├── client.ts            runAgent() 流式生成器（OpenAI/Anthropic）
│   ├── dispatch.ts          DispatchNode 的格式转换器
│   ├── defaults.ts          种子 Agent 默认 prompt + GENERIC_AGENT_CONFIG
│   ├── presets.ts           9 个 Provider 预设
│   └── types.ts             ProviderConfig / NodeConfig
└── views/
    ├── Workflow.tsx         画布 + 节点 + 边 + Palette + SidePanel
    ├── Dashboard.tsx        数据看板视图
    └── ProjectCenter.tsx    项目中心视图
vite.config.ts               含 dev API 代理（绕 CORS）
```

---

## 3. 数据契约速查

### 3.1 HotTopicCard（数据看板）
```ts
interface HotTopicCard {
  id: string
  source: 'workflow' | 'external'
  title: string          // <= 36 字符
  hotScore: number       // 0-100
  trend: number          // -50 ~ +50 (%)
  summary: string        // <= 80 字符
  tags: string[]         // 2-4 个
  createdAt: number
}
```

### 3.2 GiaFile（项目中心）
```ts
interface GiaFile {
  id: string
  filename: string             // <slug>_<YYYYMMDD>.gia
  extension: '.gia' | '.md'
  topic: string
  summary: string
  sections: { heading: string; body: string }[]
  wordCount: number
  generatedAt: number
}
```

---

## 4. 演示流程

1. `npm install && npm run dev` → http://localhost:5173
2. **演示模式（默认）**：直接点 ▶ 看 mock 数据按打字机节奏在 5 个节点间流动
3. **真实模式**：
   - 点右上角 ⚙ → 选 provider（建议 DeepSeek / OpenRouter，CN 网络较稳）→ 填 API Key → 保存
   - 顶部胶囊从「演示模式 (mock)」变为模型 id
   - 点 ▶ → 节点边渲染流式 token
4. **扩展演示**：
   - 左上角 `+ 输出回传 · 看板` 添加节点 → 拖线连到「润色编辑 Agent」→ 再运行一次
   - 切到「数据看板」tab，看到新增的热点卡片在最前面
   - 同理添加 `+ 输出回传 · 项目` → 拖线 → 跑 → 切到「项目中心」看到新 .gia 文件
5. **配置演示**：双击任意 Agent → 改 System Prompt → 再跑，输出风格立刻变

---

## 5. 已知约束

- **Dev 代理仅在 vite dev 下生效**：上线需替换为后端代理或 Edge Function
- **API Key 明文存浏览器 localStorage**：仅适合 demo，不要塞生产 key
- **图状态不持久化**：节点/边只活在内存，刷新页面回到种子图；用户的 prompt 配置和主题会持久化
- **种子数据是 mock**：看板的 UGC/外部卡片是写死的，目前只演示"回传"路径，不接真实数据源
- **mock 模式**下不论用户改了什么 prompt，输出都是固定文本（按 topic 套模板）

---

## 6. 下一步可选项

- [ ] 节点/边状态持久化（保存/加载多个工作流）
- [ ] 真接 UGC 数据源（替换 dashboard seed）
- [ ] 节点级日志面板（展开看 raw token 流）
- [ ] 多输入合并策略可选（concat / 仅取最新 / JSON merge）
- [ ] 工作流导出为 JSON / 分享链接
- [ ] 后端代理（消除"仅 dev 可用"约束）
