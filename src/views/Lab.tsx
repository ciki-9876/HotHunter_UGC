// 实验室视图 — 迁移自 lab.js + gameplay-designer.js
// 严格只使用 index.css 设计令牌

import { useEffect, useRef, useState } from 'react'

/* ══════════ 类型 ══════════ */
interface GameRecord { game_id: string; prompt: string; model?: string; created_at: string }
interface CtrReport {
  report_id: string; status: string; main_slot?: string; level_tag?: string
  score?: number; grade?: string; summary?: string; error?: string
  created_at?: string; image_data_url?: string; km_doc_url?: string
  activity_slots?: string[]; result?: CtrResult
}
interface CtrResult {
  score?: number; grade?: string; summary?: string
  ctr_predictions?: { slot: string; ctr: string; note?: string }[]
  strengths?: string[]; risks?: string[]; suggestions?: string[]; benchmark?: string
}
interface GdReport {
  id: number; level_name?: string; status: string; content?: string
  created_at?: string; km_url?: string
}

const GRADE_COLOR: Record<string, string> = {
  S: 'var(--c-orange-500)', A: 'var(--c-green-500)',
  B: 'var(--c-blue-500)',  C: 'var(--text-tertiary)', D: 'var(--c-red-500)',
}

const LAB_TABS = [
  { id: 'game-gen', label: 'AI 游戏生成', icon: '🎮' },
  { id: 'ctr',      label: 'CTR 预测',    icon: '📈' },
  { id: 'gd',       label: '玩法设计师',  icon: '✏️' },
] as const
type LabTab = (typeof LAB_TABS)[number]['id']

/* ══════════ 公共 ══════════ */
const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{ background: 'var(--surface-elevated)', borderRadius: 'var(--r-12)', border: '0.5px solid var(--border-default)', boxShadow: 'var(--shadow-1)', ...style }}>
    {children}
  </div>
)
const SectionTitle = ({ t }: { t: string }) => (
  <p style={{ margin: '0 0 var(--s-3)', fontSize: 'var(--fs-12)', fontWeight: 'var(--fw-semi)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)' }}>{t}</p>
)

/* ══════════ AI 游戏生成 ══════════ */
function GameGenTab() {
  const [prompt, setPrompt]   = useState('')
  const [loading, setLoading] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [html, setHtml]       = useState('')
  const [label, setLabel]     = useState('')
  const [history, setHistory] = useState<GameRecord[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startTimer = () => {
    setElapsed(0)
    timerRef.current = setInterval(() => setElapsed((n) => n + 1), 1000)
  }
  const stopTimer = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null } }

  const loadHistory = async () => {
    try {
      const res  = await fetch('/api/lab/games')
      const data = await res.json()
      if (data.ok) setHistory(data.games ?? [])
    } catch { /* 静默 */ }
  }
  useEffect(() => { loadHistory() }, [])

  const generate = async () => {
    if (!prompt.trim()) return
    setLoading(true); setHtml(''); startTimer()
    try {
      const res  = await fetch('/api/lab/generate-game', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt + (prompt.includes('中文') ? '' : '，中文游戏') })
      })
      const data = await res.json()
      stopTimer()
      if (data.ok) {
        setHtml(data.html)
        setLabel(`「${prompt.slice(0, 40)}${prompt.length > 40 ? '…' : ''}」`)
        await loadHistory()
      }
    } catch { stopTimer() } finally { setLoading(false) }
  }

  const loadGame = async (gameId: string) => {
    const res  = await fetch(`/api/lab/games/${gameId}`)
    const data = await res.json()
    if (data.ok) { setHtml(data.html); setLabel('历史：' + gameId.slice(0, 16)) }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 'var(--s-6)', alignItems: 'start' }}>
      {/* 左栏：输入 + 历史 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-5)' }}>
        <Card style={{ padding: 'var(--s-5)' }}>
          <SectionTitle t="玩法描述" />
          <textarea
            style={{ width: '100%', minHeight: 120, background: 'var(--field-bg)', border: '0.5px solid var(--field-border)', borderRadius: 'var(--field-radius)', padding: '8px 10px', fontSize: 'var(--fs-13)', color: 'var(--field-fg)', outline: 'none', resize: 'vertical', fontFamily: 'var(--font-text)', lineHeight: 'var(--lh-base)', boxSizing: 'border-box' }}
            placeholder="描述你想生成的游戏玩法，例如：消消乐 + 解谜 + 宇宙主题…"
            value={prompt} onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') generate() }}
          />
          <button className="primary-btn" style={{ width: '100%', marginTop: 'var(--s-4)' }} onClick={generate} disabled={loading || !prompt.trim()}>
            {loading ? <><span className="spinner" style={{ marginRight: 6 }} />生成中… {elapsed}s</> : '生成游戏 (⌘↵)'}
          </button>
        </Card>

        {/* 历史 */}
        {history.length > 0 && (
          <Card style={{ padding: 'var(--s-5)' }}>
            <SectionTitle t={`历史记录 · ${history.length}`} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-2)', maxHeight: 300, overflowY: 'auto' }}>
              {history.map((g) => (
                <button key={g.game_id} onClick={() => loadGame(g.game_id)}
                  style={{ background: 'none', border: '0.5px solid var(--border-subtle)', borderRadius: 'var(--r-6)', padding: '8px 10px', cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--c-neutral-50)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                >
                  <p style={{ margin: 0, fontSize: 'var(--fs-12)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {g.prompt.slice(0, 50)}{g.prompt.length > 50 ? '…' : ''}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 10, color: 'var(--text-quaternary)', fontFamily: 'var(--font-mono)' }}>
                    {g.created_at.slice(0, 16).replace('T', ' ')} · {g.model ?? ''}
                  </p>
                </button>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* 右栏：游戏预览 */}
      <Card style={{ minHeight: 480, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {html ? (
          <>
            <div style={{ padding: 'var(--s-4) var(--s-5)', borderBottom: '0.5px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 'var(--s-3)' }}>
              <span style={{ fontSize: 'var(--fs-12)', color: 'var(--text-tertiary)' }}>{label}</span>
            </div>
            <iframe srcDoc={html} style={{ flex: 1, border: 'none', width: '100%', minHeight: 440 }} sandbox="allow-scripts" />
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-quaternary)', gap: 'var(--s-4)' }}>
            <span style={{ fontSize: 40 }}>🎮</span>
            <p style={{ margin: 0, fontSize: 'var(--fs-13)' }}>输入玩法描述后点击生成，游戏将在此预览</p>
          </div>
        )}
      </Card>
    </div>
  )
}

/* ══════════ CTR 预测 ══════════ */
function CtrTab() {
  const [view, setView]         = useState<'form'|'loading'|'result'|'history'>('form')
  const [elapsed, setElapsed]   = useState(0)
  const [report, setReport]     = useState<CtrReport | null>(null)
  const [history, setHistory]   = useState<CtrReport[]>([])
  const [imgFile, setImgFile]   = useState<File | null>(null)
  const [imgUrl, setImgUrl]     = useState('')
  const [mainSlot, setMainSlot] = useState('')
  const [levelTag, setLevelTag] = useState('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null)

  const startTimer = () => { setElapsed(0); timerRef.current = setInterval(() => setElapsed((n) => n + 1), 1000) }
  const stopTimer  = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null } }

  const loadHistory = async () => {
    const res  = await fetch('/api/lab/ctr-reports')
    const data = await res.json()
    if (data.ok) setHistory(data.reports ?? [])
  }
  useEffect(() => { loadHistory() }, [])

  const onImage = (file: File) => {
    if (file.size > 500 * 1024) return
    setImgFile(file); setImgUrl(URL.createObjectURL(file))
  }

  const submit = async () => {
    if (!imgFile || !mainSlot || !levelTag) return
    const fd = new FormData()
    fd.append('image', imgFile)
    fd.append('main_slot', mainSlot)
    fd.append('level_tag', levelTag)
    setView('loading'); startTimer()
    try {
      const res  = await fetch('/api/lab/ctr-predict', { method: 'POST', body: fd })
      const data = await res.json()
      if (!data.ok) { stopTimer(); setView('form'); return }
      startPolling(data.report_id)
    } catch { stopTimer(); setView('form') }
  }

  const startPolling = (reportId: string) => {
    if (pollRef.current) clearInterval(pollRef.current)
    let tries = 0
    pollRef.current = setInterval(async () => {
      tries++
      if (tries > 80) { clearInterval(pollRef.current!); stopTimer(); setView('form'); return }
      try {
        const res  = await fetch(`/api/lab/ctr-reports/${reportId}`)
        const data = await res.json()
        if (!data.ok) return
        if (data.report.status === 'completed') {
          clearInterval(pollRef.current!); stopTimer()
          setReport(data.report); setView('result'); loadHistory()
        } else if (data.report.status === 'failed') {
          clearInterval(pollRef.current!); stopTimer(); setView('form')
        }
      } catch { /* 忽略 */ }
    }, 8000)
  }

  const loadHistoryItem = async (id: string) => {
    const res  = await fetch(`/api/lab/ctr-reports/${id}`)
    const data = await res.json()
    if (data.ok && data.report.status === 'completed') { setReport(data.report); setView('result') }
  }

  const MAIN_SLOTS  = ['banner', 'feedstream', 'feedstream_1', 'feedstream_2']
  const LEVEL_TAGS  = ['竞技', '解谜', '跑酷', '冒险', '休闲', '角色扮演', '模拟', '射击']

  return (
    <div style={{ display: 'grid', gridTemplateColumns: view === 'history' ? '1fr' : '300px 1fr', gap: 'var(--s-6)', alignItems: 'start' }}>
      {/* 左栏 */}
      {view !== 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-5)' }}>
          {/* 图片上传 */}
          <Card style={{ padding: 'var(--s-5)' }}>
            <SectionTitle t="上传素材图片" />
            <div
              style={{ border: `1.5px dashed ${imgUrl ? 'var(--c-green-500)' : 'var(--border-default)'}`, borderRadius: 'var(--r-8)', padding: 'var(--s-6)', textAlign: 'center', cursor: 'pointer', position: 'relative', overflow: 'hidden', transition: 'border-color 0.2s' }}
              onClick={() => document.getElementById('ctr-img-input')?.click()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onImage(f) }}
              onDragOver={(e) => e.preventDefault()}
            >
              {imgUrl
                ? <img src={imgUrl} alt="" style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 'var(--r-6)' }} />
                : <div style={{ color: 'var(--text-quaternary)', fontSize: 'var(--fs-13)' }}>
                    <div style={{ fontSize: 28, marginBottom: 'var(--s-3)' }}>🖼️</div>
                    点击或拖拽上传（≤500KB）
                  </div>
              }
              <input id="ctr-img-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) onImage(f) }} />
            </div>
          </Card>

          {/* 参数 */}
          <Card style={{ padding: 'var(--s-5)' }}>
            <SectionTitle t="资源位 & 关卡标签" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-4)' }}>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--fs-12)', color: 'var(--text-secondary)', marginBottom: 'var(--s-2)' }}>主资源位 *</label>
                <select className="field-input" value={mainSlot} onChange={(e) => setMainSlot(e.target.value)}>
                  <option value="">请选择</option>
                  {MAIN_SLOTS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--fs-12)', color: 'var(--text-secondary)', marginBottom: 'var(--s-2)' }}>关卡标签 *</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--s-2)' }}>
                  {LEVEL_TAGS.map((t) => (
                    <button key={t} onClick={() => setLevelTag(t)}
                      style={{ padding: '4px 10px', borderRadius: 'var(--r-full)', fontSize: 'var(--fs-12)', cursor: 'pointer', border: '0.5px solid', transition: 'all 0.15s',
                        background: levelTag === t ? 'var(--accent-tint-strong)' : 'var(--c-neutral-100)',
                        borderColor: levelTag === t ? 'var(--accent-base)' : 'var(--border-default)',
                        color: levelTag === t ? 'var(--accent-base)' : 'var(--text-secondary)',
                      }}>{t}</button>
                  ))}
                </div>
              </div>
            </div>
            <button className="primary-btn" style={{ width: '100%', marginTop: 'var(--s-5)' }}
              onClick={submit} disabled={!imgFile || !mainSlot || !levelTag || view === 'loading'}>
              开始预测
            </button>
          </Card>

          <button className="ghost-btn" style={{ width: '100%' }} onClick={() => { loadHistory(); setView('history') }}>
            历史报告
          </button>
        </div>
      )}

      {/* 右栏 */}
      <div>
        {view === 'form' && (
          <Card style={{ padding: 'var(--s-12)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--s-4)', minHeight: 400 }}>
            <span style={{ fontSize: 40 }}>📈</span>
            <p style={{ margin: 0, fontSize: 'var(--fs-13)', color: 'var(--text-quaternary)' }}>上传素材图片并配置参数后，点击「开始预测」</p>
          </Card>
        )}

        {view === 'loading' && (
          <Card style={{ padding: 'var(--s-12)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--s-5)', minHeight: 400 }}>
            <span className="spinner" style={{ width: 32, height: 32 }} />
            <p style={{ margin: 0, fontSize: 'var(--fs-14)', color: 'var(--text-secondary)' }}>AI 分析中… 已用时 {elapsed} 秒</p>
            <p style={{ margin: 0, fontSize: 'var(--fs-12)', color: 'var(--text-quaternary)' }}>预计 30–90 秒完成</p>
          </Card>
        )}

        {view === 'result' && report?.result && (
          <Card style={{ padding: 'var(--s-6)', display: 'flex', flexDirection: 'column', gap: 'var(--s-6)' }}>
            {/* 顶部：图片 + 分数 */}
            <div style={{ display: 'flex', gap: 'var(--s-6)', flexWrap: 'wrap' }}>
              {report.image_data_url && (
                <img src={report.image_data_url} alt="素材" style={{ width: 200, height: 113, objectFit: 'cover', borderRadius: 'var(--r-8)', flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--s-4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-5)' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 'var(--fs-34)', fontWeight: 'var(--fw-bold)', color: GRADE_COLOR[report.result.grade ?? ''] ?? 'var(--text-primary)', lineHeight: 1 }}>
                      {report.result.score ?? '—'}
                    </div>
                    <div style={{ fontSize: 'var(--fs-11)', color: 'var(--text-tertiary)', marginTop: 2 }}>/ 100</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--fs-19)', fontWeight: 'var(--fw-bold)', color: GRADE_COLOR[report.result.grade ?? ''] ?? 'var(--text-primary)' }}>评级 {report.result.grade}</div>
                    <p style={{ margin: '4px 0 0', fontSize: 'var(--fs-13)', color: 'var(--text-secondary)', lineHeight: 'var(--lh-snug)' }}>{report.result.summary}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--s-2)', flexWrap: 'wrap' }}>
                  {[report.main_slot, report.level_tag, ...(report.activity_slots ?? [])].filter(Boolean).map((t, i) => (
                    <span key={i} style={{ fontSize: 'var(--fs-11)', padding: '2px 8px', borderRadius: 'var(--r-full)', background: 'var(--c-neutral-100)', color: 'var(--text-secondary)', border: '0.5px solid var(--border-default)' }}>{t}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* CTR 预测列表 */}
            {!!report.result.ctr_predictions?.length && (
              <div>
                <SectionTitle t="各资源位 CTR 预测" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
                  {report.result.ctr_predictions.map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-4)', padding: '6px 10px', borderRadius: 'var(--r-6)', background: 'var(--c-neutral-50)', border: '0.5px solid var(--border-subtle)' }}>
                      <span style={{ fontSize: 'var(--fs-12)', color: 'var(--text-secondary)', flex: 1 }}>{s.slot}</span>
                      <span style={{ fontSize: 'var(--fs-14)', fontWeight: 'var(--fw-semi)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{s.ctr}</span>
                      {s.note && <span style={{ fontSize: 'var(--fs-11)', color: 'var(--text-tertiary)' }}>{s.note}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 优势 / 风险 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s-5)' }}>
              {!!report.result.strengths?.length && (
                <div>
                  <SectionTitle t="素材优势" />
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
                    {report.result.strengths.map((s, i) => (
                      <li key={i} style={{ fontSize: 'var(--fs-12)', color: 'var(--c-green-500)', lineHeight: 'var(--lh-snug)' }}>✦ {s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {!!report.result.risks?.length && (
                <div>
                  <SectionTitle t="风险点" />
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
                    {report.result.risks.map((s, i) => (
                      <li key={i} style={{ fontSize: 'var(--fs-12)', color: 'var(--c-orange-500)', lineHeight: 'var(--lh-snug)' }}>⚠ {s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {!!report.result.suggestions?.length && (
              <div>
                <SectionTitle t="优化建议" />
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
                  {report.result.suggestions.map((s, i) => (
                    <li key={i} style={{ fontSize: 'var(--fs-12)', color: 'var(--c-blue-500)', lineHeight: 'var(--lh-snug)' }}>→ {s}</li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ display: 'flex', gap: 'var(--s-3)' }}>
              {report.km_doc_url && <a href={report.km_doc_url} target="_blank" rel="noreferrer"><button className="ghost-btn small">✦ 查看 KM 报告</button></a>}
              <button className="ghost-btn small" onClick={() => setView('form')}>重新预测</button>
              <button className="ghost-btn small" onClick={() => { loadHistory(); setView('history') }}>历史报告</button>
            </div>
          </Card>
        )}

        {view === 'history' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 'var(--fs-15)', fontWeight: 'var(--fw-semi)', color: 'var(--text-primary)' }}>历史报告</h3>
              <button className="ghost-btn small" onClick={() => setView('form')}>← 返回</button>
            </div>
            {!history.length ? (
              <div style={{ padding: 'var(--s-12)', textAlign: 'center', color: 'var(--text-quaternary)', fontSize: 'var(--fs-13)' }}>暂无历史报告</div>
            ) : history.map((r) => (
              <div key={r.report_id} style={{ padding: 'var(--s-4) var(--s-5)', cursor: 'pointer', background: 'var(--surface-elevated)', borderRadius: 'var(--r-12)', border: '0.5px solid var(--border-default)', boxShadow: 'var(--shadow-1)' }} onClick={() => { if (r.status === 'completed') loadHistoryItem(r.report_id) }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-4)' }}>
                  {r.image_data_url && <img src={r.image_data_url} alt="" style={{ width: 60, height: 34, objectFit: 'cover', borderRadius: 'var(--r-4)', flexShrink: 0 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 'var(--s-3)', alignItems: 'center', flexWrap: 'wrap' }}>
                      {r.grade && <span style={{ fontWeight: 'var(--fw-bold)', color: GRADE_COLOR[r.grade] ?? 'var(--text-tertiary)' }}>{r.score}分 {r.grade}</span>}
                      <span style={{ fontSize: 'var(--fs-12)', color: r.status === 'completed' ? 'var(--c-green-500)' : r.status === 'failed' ? 'var(--c-red-500)' : 'var(--c-orange-500)' }}>{r.status === 'completed' ? '已完成' : r.status === 'failed' ? '失败' : '分析中'}</span>
                    </div>
                    <p style={{ margin: '2px 0 0', fontSize: 'var(--fs-12)', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.summary ?? r.error ?? '—'}</p>
                  </div>
                  <span style={{ fontSize: 'var(--fs-11)', color: 'var(--text-quaternary)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{(r.created_at ?? '').slice(0, 16).replace('T', ' ')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ══════════ 玩法设计师 ══════════ */
function GdTab() {
  const [reports, setReports] = useState<GdReport[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm]       = useState({ level_name: '', km_url: '', version: '' })
  const [running, setRunning] = useState<Record<number, boolean>>({})
  const [expanded, setExpanded] = useState<number | null>(null)

  const load = async () => {
    try {
      const res  = await fetch('/api/gd/gameplay-reports')
      const data = await res.json()
      if (data.ok) setReports(data.reports ?? [])
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const run = async () => {
    if (!form.level_name.trim()) return
    setRunning((r) => ({ ...r, [-1]: true }))
    try {
      const res  = await fetch('/api/gd/gameplay-reports', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.ok) {
        await load()
        const id = data.id
        setRunning((r) => ({ ...r, [id]: true }))
        // 轮询
        for (let i = 0; i < 72; i++) {
          await new Promise((r) => setTimeout(r, 5000))
          const poll = await fetch(`/api/gd/status?table=gameplay_reports&id=${id}`)
          const pd   = await poll.json()
          if (pd.ok && pd.status !== 'pending') { await load(); break }
        }
        setRunning((r) => ({ ...r, [id]: false }))
      }
    } finally { setRunning((r) => ({ ...r, [-1]: false })) }
  }

  const STATUS_COLOR: Record<string, string> = {
    done: 'var(--c-green-500)', pending: 'var(--c-orange-500)', error: 'var(--c-red-500)',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-6)' }}>
      {/* 新建 */}
      <Card style={{ padding: 'var(--s-5)' }}>
        <p style={{ margin: '0 0 var(--s-4)', fontSize: 'var(--fs-14)', fontWeight: 'var(--fw-semi)', color: 'var(--text-primary)' }}>新建关卡策略分析</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--s-4)' }}>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--fs-12)', color: 'var(--text-secondary)', marginBottom: 'var(--s-2)' }}>关卡名称 *</label>
            <input className="field-input" value={form.level_name} placeholder="填写关卡名称" onChange={(e) => setForm((f) => ({ ...f, level_name: e.target.value }))} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--fs-12)', color: 'var(--text-secondary)', marginBottom: 'var(--s-2)' }}>版本</label>
            <input className="field-input" value={form.version} placeholder="如 5.4" onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--fs-12)', color: 'var(--text-secondary)', marginBottom: 'var(--s-2)' }}>KM 策划案链接</label>
            <input className="field-input" value={form.km_url} placeholder="https://km.mihoyo.com/doc/…" onChange={(e) => setForm((f) => ({ ...f, km_url: e.target.value }))} />
          </div>
        </div>
        <div style={{ marginTop: 'var(--s-4)', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="primary-btn" onClick={run} disabled={running[-1] || !form.level_name.trim()}>
            {running[-1] ? <><span className="spinner" style={{ marginRight: 6 }} />分析中…</> : '运行策略分析'}
          </button>
        </div>
      </Card>

      {/* 报告列表 */}
      {loading ? (
        <div style={{ padding: 'var(--s-12)', textAlign: 'center' }}><span className="spinner" /></div>
      ) : !reports.length ? (
        <div style={{ padding: 'var(--s-12)', textAlign: 'center', color: 'var(--text-quaternary)', fontSize: 'var(--fs-13)' }}>暂无分析报告</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' }}>
          {reports.map((r) => {
            const sc = STATUS_COLOR[r.status] ?? 'var(--text-tertiary)'
            const isExp = expanded === r.id
            return (
              <Card key={r.id} style={{ overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-4)', padding: 'var(--s-4) var(--s-5)', cursor: 'pointer' }} onClick={() => setExpanded(isExp ? null : r.id)}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-3)' }}>
                      <span style={{ fontWeight: 'var(--fw-medium)', fontSize: 'var(--fs-13)', color: 'var(--text-primary)' }}>{r.level_name ?? `报告 #${r.id}`}</span>
                      <span style={{ fontSize: 'var(--fs-11)', padding: '1px 7px', borderRadius: 'var(--r-4)', background: `color-mix(in srgb, ${sc} 12%, transparent)`, color: sc, border: `0.5px solid color-mix(in srgb, ${sc} 25%, transparent)` }}>
                        {running[r.id] ? '分析中…' : r.status === 'done' ? '已完成' : r.status === 'error' ? '失败' : '生成中'}
                      </span>
                      {running[r.id] && <span className="spinner" style={{ width: 12, height: 12 }} />}
                    </div>
                    <span style={{ fontSize: 'var(--fs-11)', color: 'var(--text-quaternary)', fontFamily: 'var(--font-mono)' }}>{(r.created_at ?? '').slice(0, 16).replace('T', ' ')}</span>
                  </div>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-12)' }}>{isExp ? '▲' : '▼'}</span>
                </div>
                {isExp && r.content && (
                  <div style={{ padding: '0 var(--s-5) var(--s-5)', borderTop: '0.5px solid var(--border-subtle)', paddingTop: 'var(--s-4)' }}>
                    <pre style={{ margin: 0, fontSize: 'var(--fs-12)', color: 'var(--text-secondary)', lineHeight: 'var(--lh-base)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'var(--font-text)' }}>{r.content}</pre>
                    {r.km_url && <a href={r.km_url} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 'var(--s-4)' }}><button className="ghost-btn small">查看 KM 文档</button></a>}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ══════════ 主视图 ══════════ */
export default function Lab() {
  const [tab, setTab] = useState<LabTab>('game-gen')
  return (
    <div style={{ padding: 'var(--s-8) var(--s-9)', display: 'flex', flexDirection: 'column', gap: 'var(--s-7)', maxWidth: 1200, margin: '0 auto' }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 'var(--fs-22)', fontWeight: 'var(--fw-semi)', color: 'var(--text-primary)' }}>实验室</h1>
        <p style={{ margin: '4px 0 0', fontSize: 'var(--fs-13)', color: 'var(--text-tertiary)' }}>AI 辅助内容创作与数据分析工具</p>
      </div>
      <div className="view-tabs">
        {LAB_TABS.map(({ id, label, icon }) => (
          <button key={id} className={`view-tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
            <span className="view-tab-icon">{icon}</span>{label}
          </button>
        ))}
      </div>
      {tab === 'game-gen' && <GameGenTab />}
      {tab === 'ctr'      && <CtrTab />}
      {tab === 'gd'       && <GdTab />}
    </div>
  )
}
