import { useEffect, useRef, useState } from 'react'

/* ============================================================
 *  Source-of-truth data (mirrors tokens defined in index.css)
 * ============================================================ */

interface ColorEntry {
  name: string
  token: string
  value: string
}

const NEUTRAL_RAMP: ColorEntry[] = [
  { name: '0', token: '--c-neutral-0', value: 'oklch(100% 0 0)' },
  { name: '25', token: '--c-neutral-25', value: 'oklch(99% 0.003 250)' },
  { name: '50', token: '--c-neutral-50', value: 'oklch(98% 0.004 250)' },
  { name: '100', token: '--c-neutral-100', value: 'oklch(97% 0.005 250)' },
  { name: '150', token: '--c-neutral-150', value: 'oklch(95% 0.006 250)' },
  { name: '200', token: '--c-neutral-200', value: 'oklch(92% 0.006 250)' },
  { name: '300', token: '--c-neutral-300', value: 'oklch(88% 0.007 250)' },
  { name: '400', token: '--c-neutral-400', value: 'oklch(75% 0.008 250)' },
  { name: '500', token: '--c-neutral-500', value: 'oklch(60% 0.01 250)' },
  { name: '600', token: '--c-neutral-600', value: 'oklch(45% 0.012 250)' },
  { name: '700', token: '--c-neutral-700', value: 'oklch(32% 0.013 250)' },
  { name: '800', token: '--c-neutral-800', value: 'oklch(22% 0.012 250)' },
  { name: '900', token: '--c-neutral-900', value: 'oklch(15% 0.01 250)' },
  { name: '950', token: '--c-neutral-950', value: 'oklch(8% 0.008 250)' },
]

const ACCENT_RAMP: ColorEntry[] = [
  { name: 'blue-500', token: '--c-blue-500', value: 'oklch(62% 0.18 250)' },
  { name: 'blue-100', token: '--c-blue-100', value: 'oklch(94% 0.04 250)' },
  { name: 'green-500', token: '--c-green-500', value: 'oklch(62% 0.18 150)' },
  { name: 'green-100', token: '--c-green-100', value: 'oklch(94% 0.04 150)' },
  { name: 'orange-500', token: '--c-orange-500', value: 'oklch(72% 0.18 60)' },
  { name: 'orange-100', token: '--c-orange-100', value: 'oklch(95% 0.04 60)' },
  { name: 'red-500', token: '--c-red-500', value: 'oklch(62% 0.20 25)' },
  { name: 'red-100', token: '--c-red-100', value: 'oklch(95% 0.04 25)' },
  { name: 'purple-500', token: '--c-purple-500', value: 'oklch(62% 0.18 290)' },
  { name: 'purple-100', token: '--c-purple-100', value: 'oklch(94% 0.04 290)' },
]

const TYPE_SCALE = [
  { token: '--fs-44', size: 44, weight: 600, sample: 'AaBb 蓝图编辑' },
  { token: '--fs-34', size: 34, weight: 600, sample: 'AaBb 蓝图编辑' },
  { token: '--fs-28', size: 28, weight: 600, sample: 'AaBb 蓝图编辑' },
  { token: '--fs-22', size: 22, weight: 600, sample: 'AaBb 蓝图编辑器' },
  { token: '--fs-19', size: 19, weight: 600, sample: 'AaBb 蓝图编辑器' },
  { token: '--fs-17', size: 17, weight: 500, sample: 'AaBb 蓝图编辑器' },
  { token: '--fs-15', size: 15, weight: 500, sample: 'AaBb 蓝图编辑器 body large' },
  { token: '--fs-14', size: 14, weight: 400, sample: 'AaBb 蓝图编辑器 body' },
  { token: '--fs-13', size: 13, weight: 400, sample: 'AaBb 蓝图编辑器 default body' },
  { token: '--fs-12', size: 12, weight: 500, sample: 'AaBb 蓝图编辑器 caption' },
  { token: '--fs-11', size: 11, weight: 500, sample: 'AaBb LABEL · 11PX' },
]

const SPACE_SCALE: [string, number][] = [
  ['--s-1', 2],
  ['--s-2', 4],
  ['--s-3', 6],
  ['--s-4', 8],
  ['--s-5', 12],
  ['--s-6', 16],
  ['--s-7', 20],
  ['--s-8', 24],
  ['--s-9', 32],
  ['--s-10', 40],
  ['--s-11', 48],
  ['--s-12', 64],
]

const RADIUS_SCALE: [string, number][] = [
  ['--r-2', 2],
  ['--r-4', 4],
  ['--r-6', 6],
  ['--r-8', 8],
  ['--r-10', 10],
  ['--r-12', 12],
  ['--r-16', 16],
  ['--r-20', 20],
]

const SHADOW_LIST = ['--shadow-1', '--shadow-2', '--shadow-3', '--shadow-4']

interface SemanticRow {
  token: string
  desc: string
}
interface SemanticGroup {
  title: string
  rows: SemanticRow[]
}

const SEMANTIC_GROUPS: SemanticGroup[] = [
  {
    title: 'Surfaces',
    rows: [
      { token: '--surface-base', desc: '页面底色' },
      { token: '--surface-elevated', desc: '卡片 / 节点' },
      { token: '--surface-recessed', desc: '次级浅色面' },
      { token: '--surface-glass', desc: '半透磨砂' },
    ],
  },
  {
    title: 'Text',
    rows: [
      { token: '--text-primary', desc: '主文本' },
      { token: '--text-secondary', desc: '次文本' },
      { token: '--text-tertiary', desc: '弱文本 · 时间戳' },
      { token: '--text-quaternary', desc: '占位符' },
    ],
  },
  {
    title: 'Borders',
    rows: [
      { token: '--border-subtle', desc: '0.5 hairline' },
      { token: '--border-default', desc: '默认描边' },
      { token: '--border-strong', desc: '加重描边' },
      { token: '--accent-tint', desc: '强调描边底色' },
    ],
  },
  {
    title: 'Status',
    rows: [
      { token: '--status-running-fg', desc: 'running' },
      { token: '--status-done-fg', desc: 'done' },
      { token: '--status-warn-fg', desc: 'warn' },
      { token: '--status-error-fg', desc: 'error' },
    ],
  },
]

/* ============================================================
 *  Anatomy previews use the project's REAL production class names
 *  so this page is a live truth check, not a separate mock system.
 * ============================================================ */

interface AnatomyRow {
  k: string
  v: string
  swatch?: string // var name for the chip background
}

interface AnatomySpec {
  id: string
  title: string
  desc: string
  preview: React.ReactNode
  tokens: AnatomyRow[]
}

function PreviewButton() {
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      <button className="primary-btn">▶ 开始运行</button>
      <button className="ghost-btn">关闭</button>
      <button className="primary-btn small">保存</button>
      <button className="ghost-btn small">取消</button>
    </div>
  )
}

function PreviewField() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        width: 280,
      }}
    >
      <div className="form-row">
        <label>主题</label>
        <input type="text" placeholder="主题输入…" />
      </div>
      <div className="form-row">
        <label>补充提示词</label>
        <textarea
          rows={3}
          defaultValue="补充提示词：风格偏小红书，第二人称"
        />
      </div>
      <div className="form-row">
        <label>目标 Tab</label>
        <select defaultValue="dashboard">
          <option value="dashboard">数据看板 · HotTopicCard</option>
          <option value="project">项目中心 · .gia 策划文档</option>
        </select>
      </div>
    </div>
  )
}

function PreviewSeg() {
  const [v, setV] = useState('a')
  const opts = [
    { k: 'a', label: '工作流' },
    { k: 'b', label: '数据看板' },
    { k: 'c', label: '项目中心' },
  ]
  return (
    <div className="view-tabs">
      {opts.map((t) => (
        <button
          key={t.k}
          className={`view-tab ${v === t.k ? 'active' : ''}`}
          onClick={() => setV(t.k)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

function PreviewPill() {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <span className="status-pill">就绪 · 等待运行</span>
      <span className="status-pill running">执行中 · 请稍候</span>
      <span className="status-pill done">已完成 · 点击节点查看</span>
      <span className="status-pill error">失败 · 查看错误</span>
    </div>
  )
}

function PreviewNode() {
  return (
    <div
      className="node-card node-agent is-done preview-node"
      style={{ position: 'static', cursor: 'default' }}
    >
      <div className="node-header">
        <span className="node-icon">✎</span>
        <div className="node-name-block">
          <div className="node-title">正文写作 Agent</div>
          <div className="node-model-line">gpt-4o-mini · OpenAI</div>
        </div>
        <span className="node-status-dot" />
      </div>
      <textarea
        className="extra-prompt-input"
        rows={2}
        defaultValue="风格偏小红书，第二人称"
        readOnly
      />
      <div className="node-output">
        <div className="output-toggle">
          <span className="caret">▾</span>运行时输出
        </div>
        <div className="node-output-body">
          清晨的灵山，雾还没散，你站在梵宫前听到第一声木鱼。这里不是景区
          —— 它是一座被设计过的"沉浸关卡"……
        </div>
      </div>
      <div className="node-footer">
        <span style={{ color: 'var(--status-done-fg)' }}>已完成</span>
        <button className="config-link">⚙ 点击配置</button>
      </div>
    </div>
  )
}

function PreviewEdge() {
  return (
    <svg width="280" height="120" viewBox="0 0 280 120">
      <g className="flow-edge is-active">
        <path
          d="M 20 30 C 90 30 90 90 220 90"
          className="flow-edge-glow"
        />
        <path
          d="M 20 30 C 90 30 90 90 220 90"
          className="flow-edge-base"
        />
        <path
          d="M 20 30 C 90 30 90 90 220 90"
          className="flow-edge-dash"
        />
      </g>
      <circle cx="20" cy="30" r="4" fill="var(--accent-base)" />
      <circle cx="220" cy="90" r="4" fill="var(--accent-base)" />
    </svg>
  )
}

function PreviewPalette() {
  return (
    <div style={{ transform: 'scale(0.92)', transformOrigin: 'top left' }}>
      <div
        className="palette"
        style={{
          position: 'static',
          margin: 0,
          width: 220,
          boxShadow: 'var(--shadow-2)',
          maxHeight: 'none',
        }}
      >
        <div className="palette-head">
          <span className="palette-head-title">画布工具</span>
        </div>
        <div className="palette-body">
          <div className="palette-section">
            <button className="palette-section-head">
              <span className="caret">▾</span>
              <span className="palette-section-title">添加节点</span>
            </button>
            <div className="palette-section-body">
              <button className="palette-btn">
                <span className="palette-icon">✦</span>新 Agent
              </button>
              <button className="palette-btn">
                <span className="palette-icon critic">⚖</span>评审 Critic
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const COMPONENT_ANATOMY: AnatomySpec[] = [
  {
    id: 'button',
    title: 'Button · Primary / Ghost',
    desc:
      '主操作按钮。tokens 全部读 component-scoped 变量，换肤只动 --btn-* / --accent-* 即可。',
    preview: <PreviewButton />,
    tokens: [
      { k: '--btn-height', v: '32px' },
      { k: '--btn-padding-x', v: '14px' },
      { k: '--btn-radius', v: '--r-8' },
      { k: '--btn-fs', v: '--fs-13' },
      { k: '--btn-weight', v: '--fw-medium' },
      { k: 'primary background', v: '--accent-base', swatch: '--accent-base' },
      { k: 'primary foreground', v: '--accent-fg', swatch: '--accent-fg' },
      { k: 'ghost background', v: '--surface-elevated', swatch: '--surface-elevated' },
      { k: 'ghost border', v: '--border-default' },
      { k: 'shadow', v: '--shadow-1' },
    ],
  },
  {
    id: 'field',
    title: 'Field · Input + Textarea + Select',
    desc:
      '统一表单字段。focus 状态用 --accent-base 描边 + 4px focus ring，全套字段共享。',
    preview: <PreviewField />,
    tokens: [
      { k: '--field-height', v: '32px' },
      { k: '--field-bg', v: '--surface-elevated', swatch: '--surface-elevated' },
      { k: '--field-border', v: '--border-default' },
      { k: '--field-border-focus', v: '--accent-base', swatch: '--accent-base' },
      { k: '--field-radius', v: '--r-8' },
      { k: '--field-fs', v: '--fs-13' },
      { k: '--field-placeholder-fg', v: '--text-quaternary' },
      { k: '--field-focus-ring', v: '4px accent @ 0.20α' },
    ],
  },
  {
    id: 'seg',
    title: 'SegmentedTabs',
    desc:
      'Apple 经典灰底胶囊分段。激活态用 elevated 表面 + shadow-1 浮起，给视觉一个轻微高低。',
    preview: <PreviewSeg />,
    tokens: [
      { k: '--seg-bg', v: '--c-neutral-100', swatch: '--c-neutral-100' },
      { k: '--seg-padding', v: '3px' },
      { k: '--seg-radius', v: '--r-10' },
      { k: '--seg-item-radius', v: '8px' },
      { k: '--seg-item-padding', v: '6px / 12px' },
      { k: '--seg-item-bg-active', v: '--surface-elevated', swatch: '--surface-elevated' },
      { k: '--seg-item-fg', v: '--text-secondary' },
      { k: '--seg-item-fg-active', v: '--text-primary' },
      { k: '--seg-item-shadow-active', v: '--shadow-1' },
    ],
  },
  {
    id: 'pill',
    title: 'StatusPill',
    desc:
      '状态徽标。idle / running / done / error 四态共享 dot + label + bg 三个 token 切换。',
    preview: <PreviewPill />,
    tokens: [
      { k: 'padding', v: '5px / 10px' },
      { k: 'font-size', v: '--fs-12' },
      { k: 'border-radius', v: '--r-full' },
      { k: 'dot-size', v: '6px' },
      { k: '--status-running-bg', v: '--c-blue-100', swatch: '--c-blue-100' },
      { k: '--status-running-fg', v: '--c-blue-500', swatch: '--c-blue-500' },
      { k: '--status-done-bg', v: '--c-green-100', swatch: '--c-green-100' },
      { k: '--status-done-fg', v: '--c-green-500', swatch: '--c-green-500' },
      { k: '--status-error-fg', v: '--c-red-500', swatch: '--c-red-500' },
    ],
  },
  {
    id: 'node',
    title: 'NodeCard · Agent',
    desc:
      '画布主元素。状态变化只换 shadow + dot 颜色；输出有底部渐变淡出，不剪断文字。',
    preview: <PreviewNode />,
    tokens: [
      { k: '--node-width', v: '280px' },
      { k: '--node-bg', v: '--surface-elevated', swatch: '--surface-elevated' },
      { k: '--node-radius', v: '14px' },
      { k: '--node-padding', v: '14px' },
      { k: '--node-border', v: '--border-default' },
      { k: 'selected border', v: '--accent-base', swatch: '--accent-base' },
      { k: '--node-shadow', v: '--shadow-2' },
      { k: 'running halo', v: 'ring(blue 0.16) + shadow-3' },
      { k: 'done halo', v: 'ring(green 0.14) + shadow-2' },
      { k: 'icon size', v: '26px / --r-8' },
      { k: 'output bg', v: '--c-neutral-50', swatch: '--c-neutral-50' },
      { k: 'handle size', v: '9px' },
    ],
  },
  {
    id: 'edge',
    title: 'Edge · 连接线',
    desc:
      '三层 SVG：base 主线 / glow 发光 / dash 流光。active 态打开 glow + dash 流动。',
    preview: <PreviewEdge />,
    tokens: [
      { k: '--edge-color', v: '--c-neutral-300' },
      { k: '--edge-color-active', v: '--accent-base', swatch: '--accent-base' },
      { k: '--edge-color-done', v: '--c-green-500', swatch: '--c-green-500' },
      { k: 'base width', v: '1.5px' },
      { k: 'active width', v: '2px' },
      { k: 'glow', v: 'accent @ 0.25α + blur 2px' },
    ],
  },
  {
    id: 'palette',
    title: 'Palette · 工具面板',
    desc:
      '左侧悬浮玻璃卡。glass 表面 + 0.5 hairline，section header 走 caps + tracking-wide。',
    preview: <PreviewPalette />,
    tokens: [
      { k: '--palette-width', v: '240px' },
      { k: '--palette-bg', v: '--surface-glass' },
      { k: '--palette-blur', v: 'saturate 180% + blur 24px' },
      { k: '--palette-radius', v: '16px' },
      { k: 'padding', v: '12px' },
      { k: '--palette-shadow', v: '--shadow-3' },
      { k: 'button height', v: '34px' },
      { k: 'button radius', v: '8px' },
    ],
  },
]

/* ============================================================
 *  View component
 * ============================================================ */

const SECTIONS = [
  { id: 'primitives', label: '原子层' },
  { id: 'semantic', label: '语义层' },
  { id: 'components', label: '组件层' },
]

export default function TokensView() {
  const [active, setActive] = useState('primitives')
  const rootRef = useRef<HTMLDivElement>(null)

  const scrollTo = (id: string) => {
    setActive(id)
    const el = document.getElementById('tok-' + id)
    if (el && rootRef.current) {
      rootRef.current.scrollTo({
        top: el.offsetTop - 24,
        behavior: 'smooth',
      })
    }
  }

  // Update active section based on scroll position
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const ids = SECTIONS.map((s) => 'tok-' + s.id)
    const handler = () => {
      let current = ids[0]
      for (const id of ids) {
        const el = document.getElementById(id)
        if (!el) continue
        if (el.offsetTop - root.scrollTop <= 120) current = id
      }
      setActive(current.replace(/^tok-/, ''))
    }
    root.addEventListener('scroll', handler, { passive: true })
    return () => root.removeEventListener('scroll', handler)
  }, [])

  return (
    <div className="tokens-view" ref={rootRef}>
      <div className="page-inner">
        <div className="page-hero">
          <div className="page-eyebrow">Design Tokens · 蓝图设计系统</div>
          <h1 className="page-title">三层令牌 · 自下而上</h1>
          <div className="page-subtitle">
            原子层（primitive）→ 语义层（semantic）→
            组件层（component）。组件只读组件级 token，换肤永远只改最上层，不污染底层。
            下面按层级铺开整套蓝图的令牌定义。
          </div>
        </div>

        <div className="tokens-nav">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              className={`tokens-nav-item ${active === s.id ? 'active' : ''}`}
              onClick={() => scrollTo(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* ── PRIMITIVES ── */}
        <section className="tokens-section" id="tok-primitives">
          <div className="tokens-section-head">
            <h2 className="tokens-section-title">01 · 原子层 Primitives</h2>
            <div className="tokens-section-desc">
              所有可见值的源头。颜色用 oklch 表达；中性色单色相 250
              低饱和；强调色统一 chroma 0.18，仅 hue 变化。
            </div>
          </div>

          <h3 className="tokens-sub-title">中性色阶</h3>
          <div className="swatch-grid">
            {NEUTRAL_RAMP.map((c) => (
              <div className="swatch" key={c.token}>
                <div className="swatch-chip" style={{ background: c.value }} />
                <div className="swatch-info">
                  <div className="swatch-name">neutral / {c.name}</div>
                  <div className="swatch-value">{c.token}</div>
                </div>
              </div>
            ))}
          </div>

          <h3 className="tokens-sub-title" style={{ marginTop: 24 }}>
            强调色（chroma 0.18 · hue varied）
          </h3>
          <div className="swatch-grid">
            {ACCENT_RAMP.map((c) => (
              <div className="swatch" key={c.token}>
                <div className="swatch-chip" style={{ background: c.value }} />
                <div className="swatch-info">
                  <div className="swatch-name">{c.name}</div>
                  <div className="swatch-value">{c.token}</div>
                </div>
              </div>
            ))}
          </div>

          <h3 className="tokens-sub-title" style={{ marginTop: 24 }}>
            字阶（SF Pro Display / Text）
          </h3>
          <div className="type-scale">
            {TYPE_SCALE.map((t) => (
              <div className="type-row" key={t.token}>
                <span className="type-row-token">{t.token}</span>
                <span
                  className="type-row-sample"
                  style={{
                    fontSize: t.size,
                    fontWeight: t.weight,
                    fontFamily: 'var(--font-display)',
                    letterSpacing: 'var(--tracking-snug)',
                  }}
                >
                  {t.sample}
                </span>
                <span className="type-row-meta">
                  {t.size}px · w{t.weight}
                </span>
              </div>
            ))}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 20,
              marginTop: 24,
            }}
          >
            <div>
              <h3 className="tokens-sub-title">间距（4px base）</h3>
              <div className="space-card">
                {SPACE_SCALE.map(([k, v]) => (
                  <div className="space-row" key={k}>
                    <span className="space-row-token">{k}</span>
                    <span className="space-row-value">{v}px</span>
                    <div className="space-row-bar" style={{ width: v }} />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="tokens-sub-title">圆角</h3>
              <div className="radius-grid">
                {RADIUS_SCALE.map(([k, v]) => (
                  <div className="radius-cell" key={k}>
                    <div
                      className="radius-sample"
                      style={{ borderRadius: v }}
                    />
                    <div className="radius-token">{k}</div>
                    <div className="radius-value">{v}px</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <h3 className="tokens-sub-title" style={{ marginTop: 24 }}>
            阴影
          </h3>
          <div className="shadow-grid">
            {SHADOW_LIST.map((s) => (
              <div
                key={s}
                className="shadow-cell"
                style={{ boxShadow: `var(${s})` }}
              >
                <span className="shadow-cell-token">{s}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── SEMANTIC ── */}
        <section className="tokens-section" id="tok-semantic">
          <div className="tokens-section-head">
            <h2 className="tokens-section-title">02 · 语义层 Semantic</h2>
            <div className="tokens-section-desc">
              把原子色名换成意义名。"surface-elevated"
              表达"卡片表面"，与具体色值解耦。组件代码引用语义 token，深浅主题切换只需把语义层重指即可。
            </div>
          </div>

          <div className="semantic-grid">
            {SEMANTIC_GROUPS.map((g) => (
              <div className="semantic-card" key={g.title}>
                <div className="semantic-card-title">{g.title}</div>
                {g.rows.map((r) => (
                  <div className="semantic-row" key={r.token}>
                    <div
                      className="semantic-swatch"
                      style={{ background: `var(${r.token})` }}
                    />
                    <div className="semantic-name">{r.desc}</div>
                    <div className="semantic-token">{r.token}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>

        {/* ── COMPONENT ── */}
        <section className="tokens-section" id="tok-components">
          <div className="tokens-section-head">
            <h2 className="tokens-section-title">03 · 组件层 Component</h2>
            <div className="tokens-section-desc">
              每个组件都有自己的 token
              名空间。改组件外观时只动它的命名空间，绝不越权改语义层。下面每个预览都用项目里 <b>真实生产组件</b> 渲染，确保设计稿与代码同步。
            </div>
          </div>

          {COMPONENT_ANATOMY.map((c) => (
            <div
              className="anatomy-card"
              key={c.id}
              style={{ marginBottom: 18 }}
            >
              <div className="anatomy-preview">{c.preview}</div>
              <div className="anatomy-tokens">
                <div className="anatomy-title">{c.title}</div>
                <div className="anatomy-desc">{c.desc}</div>
                <div className="anatomy-list">
                  {c.tokens.map((t) => (
                    <div className="anatomy-row" key={t.k}>
                      <span className="anatomy-row-key">{t.k}</span>
                      <span className="anatomy-row-value">
                        {t.swatch && (
                          <span
                            className="anatomy-row-chip"
                            style={{ background: `var(${t.swatch})` }}
                          />
                        )}
                        {t.v}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}
