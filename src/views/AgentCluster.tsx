// Agent 集群视图 — 迁移自 dashboard-chat.js
// 多 Agent 管理 + 带会话历史的对话界面
// 严格只使用 index.css 设计令牌

import { useCallback, useEffect, useRef, useState } from 'react'
import { Markdown } from '../components/Markdown'

/* ══════════ 类型 ══════════ */
interface Agent { id: string; name: string; agent_id: string; description?: string; sort_order?: number }
interface Message { role: 'user' | 'assistant' | 'summary'; text: string; ts: string }
interface Session { id: string; name: string; agentId: string; agentName: string; createdAt: string; updatedAt: string; messages: Message[] }

/* ══════════ 持久化层（localStorage） ══════════ */
const STORAGE_KEY = 'ugc_float_chat_sessions_v2'
const MAX_TURNS   = 8
const MAX_CHARS   = 6000

function sessLoad(): Session[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}
function sessSave(sessions: Session[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions)) } catch {}
}
function sessNew(agentId: string, agentName: string): Session {
  const id = 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)
  return { id, name: '新会话', agentId, agentName, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messages: [] }
}

/* ══════════ API 调用 ══════════ */
async function chatWithAgent(agentId: string, message: string, reasoningEffort = 'medium'): Promise<string> {
  // 先试异步提交 + 轮询
  try {
    const res = await fetch('/api/dashboard/chat/submit', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_id: agentId, message, reasoning_effort: reasoningEffort })
    })
    const data = await res.json()
    if (data.ok && data.session_id) {
      const sid = data.session_id
      for (let i = 0; i < 200; i++) {
        await new Promise((r) => setTimeout(r, 5000))
        const poll = await fetch(`/api/dashboard/chat/status/${sid}`)
        const pd   = await poll.json()
        if (pd.status === 'done')   return pd.answer ?? ''
        if (pd.status === 'error')  throw new Error(pd.error || '分析失败')
      }
      throw new Error('等待超时')
    }
  } catch (e: any) {
    // fallback 到同步接口
  }
  const r = await fetch('/api/dashboard/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agent_id: agentId, message, reasoning_effort: reasoningEffort })
  })
  const d = await r.json()
  if (d.ok) return d.answer ?? ''
  throw new Error(d.error || '调用失败')
}

/* ══════════ 构建带历史上下文的消息 ══════════ */
function buildMsgWithHistory(userText: string, sessId: string): string {
  const sessions = sessLoad()
  const s = sessions.find((s) => s.id === sessId)
  const prev = (s?.messages ?? []).slice(0, -1).slice(-(MAX_TURNS * 2))
  if (!prev.length) return userText
  let totalChars = prev.reduce((n, m) => n + m.text.length, 0)
  let hist = [...prev]
  while (totalChars > MAX_CHARS && hist.length > 0) { totalChars -= hist[0].text.length; hist.shift() }
  if (!hist.length) return userText
  const lines = hist.map((m) =>
    (m.role === 'user' ? '[用户]' : m.role === 'summary' ? '[摘要]' : '[AI]') + ' ' + m.text
  ).join('\n')
  return `[对话历史（最近${hist.length}条）]\n${lines}\n\n[当前问题]\n${userText}`
}

/* ══════════ 上下文用量 ══════════ */
function ctxUsage(sessId: string): number {
  const sessions = sessLoad()
  const s = sessions.find((s) => s.id === sessId)
  if (!s || s.messages.length <= 1) return 0
  const prev = s.messages.slice(0, -1)
  const chars = prev.reduce((n, m) => n + m.text.length, 0)
  return chars / MAX_CHARS
}

/* ══════════ Manage Agent 弹窗 ══════════ */
function ManageModal({ agents, onClose, onSave }: {
  agents: Agent[]; onClose: () => void
  onSave: (list: Agent[]) => Promise<void>
}) {
  const [list, setList]   = useState<Agent[]>(agents.map((a) => ({ ...a })))
  const [name, setName]   = useState('')
  const [agId, setAgId]   = useState('')
  const [desc, setDesc]   = useState('')
  const [saving, setSaving] = useState(false)

  const add = () => {
    if (!name.trim() || !agId.trim()) return
    setList((l) => [...l, { id: 'dc_' + Date.now(), name: name.trim(), agent_id: agId.trim(), description: desc.trim(), sort_order: l.length }])
    setName(''); setAgId(''); setDesc('')
  }
  const del = (idx: number) => setList((l) => l.filter((_, i) => i !== idx))
  const save = async () => { setSaving(true); try { await onSave(list) } finally { setSaving(false) } }

  return (
    <div className="modal-mask" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-card" style={{ width: 560 }}>
        <div className="modal-header">
          <span className="modal-title">管理 Agent 集群</span>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {/* 当前列表 */}
          {list.length === 0 ? (
            <p style={{ fontSize: 'var(--fs-13)', color: 'var(--text-quaternary)', padding: 'var(--s-4) 0' }}>暂无 Agent，添加一个开始使用</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' }}>
              {list.map((a, i) => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-4)', padding: 'var(--s-3) var(--s-4)', borderRadius: 'var(--r-8)', background: 'var(--c-neutral-50)', border: '0.5px solid var(--border-subtle)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 'var(--fw-medium)', fontSize: 'var(--fs-13)', color: 'var(--text-primary)' }}>{a.name}</p>
                    <p style={{ margin: 0, fontSize: 'var(--fs-11)', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>{a.agent_id}{a.description ? ` · ${a.description}` : ''}</p>
                  </div>
                  <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-red-500)', fontSize: 'var(--fs-13)', padding: '4px 8px' }} onClick={() => del(i)}>✕</button>
                </div>
              ))}
            </div>
          )}

          {/* 添加表单 */}
          <div style={{ marginTop: 'var(--s-5)', paddingTop: 'var(--s-5)', borderTop: '0.5px solid var(--border-subtle)' }}>
            <p style={{ margin: '0 0 var(--s-4)', fontSize: 'var(--fs-12)', fontWeight: 'var(--fw-semi)', color: 'var(--text-secondary)' }}>添加新 Agent</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s-4)' }}>
              <div className="form-row">
                <label>显示名称 *</label>
                <input placeholder="例：千星奇域分析大师" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="form-row">
                <label>Echo Agent ID *</label>
                <input placeholder="agent_xxxxxxxx" value={agId} onChange={(e) => setAgId(e.target.value)} />
              </div>
              <div className="form-row" style={{ gridColumn: '1 / -1' }}>
                <label>描述（选填）</label>
                <input placeholder="功能简介" value={desc} onChange={(e) => setDesc(e.target.value)} />
              </div>
            </div>
            <button className="ghost-btn small" style={{ marginTop: 'var(--s-4)' }} onClick={add} disabled={!name.trim() || !agId.trim()}>
              ＋ 添加到列表
            </button>
          </div>
        </div>
        <div className="modal-footer">
          <button className="ghost-btn" onClick={onClose}>取消</button>
          <div style={{ flex: 1 }} />
          <button className="primary-btn" onClick={save} disabled={saving}>
            {saving && <span className="spinner" style={{ marginRight: 6 }} />}保存
          </button>
        </div>
      </div>
    </div>
  )
}

/* ══════════ 对话消息 ══════════ */
function MsgBubble({ msg, agentName }: { msg: Message; agentName?: string }) {
  const isUser = msg.role === 'user'
  const isSummary = msg.role === 'summary'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', gap: 'var(--s-2)', marginBottom: 'var(--s-5)' }}>
      <span style={{ fontSize: 'var(--fs-11)', color: 'var(--text-quaternary)', paddingInline: 'var(--s-2)' }}>
        {isUser ? '你' : isSummary ? '[摘要]' : (agentName ?? 'Agent')}
      </span>
      <div style={{
        maxWidth: '80%', padding: '10px 14px', borderRadius: isUser ? 'var(--r-12) var(--r-12) var(--r-4) var(--r-12)' : 'var(--r-12) var(--r-12) var(--r-12) var(--r-4)',
        background: isUser ? 'var(--accent-base)' : isSummary ? 'var(--c-neutral-100)' : 'var(--surface-elevated)',
        color: isUser ? 'var(--accent-fg)' : 'var(--text-primary)',
        border: isUser ? 'none' : '0.5px solid var(--border-default)',
        boxShadow: 'var(--shadow-1)', fontSize: 'var(--fs-13)', lineHeight: 'var(--lh-base)',
      }}>
        {isUser || isSummary ? msg.text : <Markdown source={msg.text} />}
      </div>
    </div>
  )
}

/* ══════════ 主视图 ══════════ */
export default function AgentCluster() {
  const [agents, setAgents]       = useState<Agent[]>([])
  const [activeAgent, setActiveAgent] = useState<Agent | null>(null)
  const [sessions, setSessions]   = useState<Session[]>([])
  const [currentSessId, setCurrentSessId] = useState<string | null>(null)
  const [messages, setMessages]   = useState<Message[]>([])
  const [input, setInput]         = useState('')
  const [sending, setSending]     = useState(false)
  const [effort, setEffort]       = useState<'low'|'medium'|'high'>('medium')
  const [showManage, setShowManage] = useState(false)
  const [ctxPct, setCtxPct]       = useState(0)
  const msgRef  = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  /* ── 加载 Agent 列表 ── */
  const loadAgents = useCallback(async () => {
    try {
      const res  = await fetch('/api/dashboard/agents')
      const data = await res.json()
      const list: Agent[] = Array.isArray(data) ? data : []
      setAgents(list)
      if (list.length > 0 && !activeAgent) switchAgent(list[0], true)
    } catch { setAgents([]) }
  }, [])
  useEffect(() => { loadAgents() }, [loadAgents])

  /* ── 切换 Agent ── */
  const switchAgent = useCallback((agent: Agent, firstLoad = false) => {
    setActiveAgent(agent)
    const allSess = sessLoad().filter((s) => s.agentId === agent.agent_id)
      .sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1))
    setSessions(allSess)
    if (allSess.length > 0) {
      setCurrentSessId(allSess[0].id)
      setMessages(allSess[0].messages)
    } else {
      const s = sessNew(agent.agent_id, agent.name)
      const all = sessLoad(); all.unshift(s); sessSave(all)
      setSessions([s]); setCurrentSessId(s.id); setMessages([])
    }
  }, [])

  /* ── 切换会话 ── */
  const switchSess = (id: string) => {
    const s = sessLoad().find((s) => s.id === id)
    if (!s) return
    setCurrentSessId(id); setMessages(s.messages)
  }

  /* ── 新建会话 ── */
  const newSess = () => {
    if (!activeAgent) return
    const s = sessNew(activeAgent.agent_id, activeAgent.name)
    const all = sessLoad(); all.unshift(s); sessSave(all)
    setSessions((prev) => [s, ...prev]); setCurrentSessId(s.id); setMessages([])
  }

  /* ── 发送消息 ── */
  const send = async () => {
    if (!input.trim() || sending || !activeAgent || !currentSessId) return
    const text = input.trim()
    setInput('')
    setSending(true)

    // 存用户消息
    const userMsg: Message = { role: 'user', text, ts: new Date().toISOString() }
    const all = sessLoad()
    const si  = all.findIndex((s) => s.id === currentSessId)
    if (si >= 0) {
      all[si].messages.push(userMsg)
      if (all[si].name === '新会话') all[si].name = text.slice(0, 20) + (text.length > 20 ? '…' : '')
      all[si].updatedAt = new Date().toISOString()
      sessSave(all)
    }
    setMessages((prev) => [...prev, userMsg])
    setTimeout(() => msgRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 50)
    setCtxPct(Math.round(ctxUsage(currentSessId) * 100))

    // 构建带历史的消息并调用
    const fullMsg = buildMsgWithHistory(text, currentSessId)
    try {
      const answer = await chatWithAgent(activeAgent.agent_id, fullMsg, effort)
      const aiMsg: Message = { role: 'assistant', text: answer, ts: new Date().toISOString() }
      const all2 = sessLoad()
      const si2  = all2.findIndex((s) => s.id === currentSessId)
      if (si2 >= 0) {
        all2[si2].messages.push(aiMsg); all2[si2].updatedAt = new Date().toISOString(); sessSave(all2)
        setSessions(sessLoad().filter((s) => s.agentId === activeAgent.agent_id).sort((a, b) => b.updatedAt > a.updatedAt ? 1 : -1))
      }
      setMessages((prev) => [...prev, aiMsg])
      setCtxPct(Math.round(ctxUsage(currentSessId) * 100))
    } catch (e: any) {
      const errMsg: Message = { role: 'assistant', text: `❌ ${e.message ?? '调用失败'}`, ts: new Date().toISOString() }
      setMessages((prev) => [...prev, errMsg])
    } finally {
      setSending(false)
      setTimeout(() => { msgRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }); inputRef.current?.focus() }, 50)
    }
  }

  /* ── 保存 Agent 列表 ── */
  const saveAgents = async (list: Agent[]) => {
    await fetch('/api/dashboard/agents', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agents: list })
    })
    setAgents(list)
    setShowManage(false)
    if (list.length > 0 && (!activeAgent || !list.find((a) => a.id === activeAgent.id))) {
      switchAgent(list[0])
    }
  }

  useEffect(() => { setTimeout(() => msgRef.current?.scrollTo({ top: 99999 }), 50) }, [messages.length])

  const ctxColor = ctxPct >= 100 ? 'var(--c-red-500)' : ctxPct >= 85 ? 'var(--c-orange-500)' : 'var(--c-green-500)'

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--surface-base)' }}>
      {/* 顶部：Agent 切换 + 管理按钮 */}
      <div style={{ padding: 'var(--s-4) var(--s-6)', borderBottom: '0.5px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 'var(--s-4)', flexWrap: 'wrap', background: 'var(--topbar-bg)', backdropFilter: 'var(--topbar-blur)', WebkitBackdropFilter: 'var(--topbar-blur)', flexShrink: 0 }}>
        <h2 style={{ margin: 0, fontSize: 'var(--fs-14)', fontWeight: 'var(--fw-semi)', color: 'var(--text-primary)', flexShrink: 0 }}>Agent 集群</h2>
        <div style={{ display: 'flex', gap: 'var(--s-2)', flexWrap: 'wrap', flex: 1 }}>
          {agents.length === 0 ? (
            <span style={{ fontSize: 'var(--fs-12)', color: 'var(--text-quaternary)' }}>暂无 Agent，点击「管理」添加</span>
          ) : agents.map((a) => (
            <button key={a.id} onClick={() => switchAgent(a)}
              style={{ padding: '4px 12px', borderRadius: 'var(--r-full)', fontSize: 'var(--fs-12)', fontWeight: 'var(--fw-medium)', cursor: 'pointer', border: '0.5px solid', transition: 'all 0.15s',
                background: activeAgent?.id === a.id ? 'var(--accent-tint-strong)' : 'var(--c-neutral-100)',
                borderColor: activeAgent?.id === a.id ? 'var(--accent-base)' : 'var(--border-default)',
                color: activeAgent?.id === a.id ? 'var(--accent-base)' : 'var(--text-secondary)',
              }}
              title={a.description}>{a.name}</button>
          ))}
        </div>
        <button className="ghost-btn small" onClick={() => setShowManage(true)} style={{ flexShrink: 0 }}>管理</button>
      </div>

      {/* 主体 */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* 左侧：会话列表 */}
        <div style={{ width: 200, borderRight: '0.5px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}>
          <div style={{ padding: 'var(--s-3) var(--s-4)', borderBottom: '0.5px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 'var(--fs-12)', color: 'var(--text-tertiary)', fontWeight: 'var(--fw-medium)' }}>会话</span>
            <button className="ghost-btn small" style={{ padding: '3px 8px', fontSize: 11 }} onClick={newSess} disabled={!activeAgent}>＋ 新建</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--s-2)' }}>
            {sessions.length === 0 ? (
              <p style={{ fontSize: 'var(--fs-11)', color: 'var(--text-quaternary)', padding: 'var(--s-4)', textAlign: 'center' }}>暂无会话</p>
            ) : sessions.map((s) => (
              <button key={s.id} onClick={() => switchSess(s.id)}
                style={{ width: '100%', display: 'block', textAlign: 'left', background: currentSessId === s.id ? 'var(--accent-tint)' : 'none', border: 'none', borderRadius: 'var(--r-6)', padding: '8px 10px', cursor: 'pointer', marginBottom: 'var(--s-1)', transition: 'background 0.12s' }}>
                <p style={{ margin: 0, fontSize: 'var(--fs-12)', fontWeight: 'var(--fw-medium)', color: currentSessId === s.id ? 'var(--accent-base)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</p>
                <p style={{ margin: 0, fontSize: 10, color: 'var(--text-quaternary)', fontFamily: 'var(--font-mono)' }}>{s.updatedAt.slice(0, 16).replace('T', ' ')}</p>
              </button>
            ))}
          </div>
        </div>

        {/* 右侧：对话区 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Agent 信息栏 */}
          {activeAgent && (
            <div style={{ padding: 'var(--s-3) var(--s-6)', borderBottom: '0.5px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 'var(--s-4)', flexShrink: 0 }}>
              <div style={{ width: 32, height: 32, borderRadius: 'var(--r-full)', background: 'var(--accent-tint-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>⚡</div>
              <div>
                <p style={{ margin: 0, fontWeight: 'var(--fw-semi)', fontSize: 'var(--fs-13)', color: 'var(--text-primary)' }}>{activeAgent.name}</p>
                {activeAgent.description && <p style={{ margin: 0, fontSize: 'var(--fs-11)', color: 'var(--text-tertiary)' }}>{activeAgent.description}</p>}
              </div>
              {ctxPct > 0 && (
                <div title={`上下文用量 ${ctxPct}%`} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--s-2)', fontSize: 'var(--fs-11)', color: ctxColor }}>
                  <div style={{ width: 6, height: 6, borderRadius: 'var(--r-full)', background: ctxColor }} />
                  上下文 {ctxPct}%
                </div>
              )}
            </div>
          )}

          {/* 消息区 */}
          <div ref={msgRef} style={{ flex: 1, overflowY: 'auto', padding: 'var(--s-6) var(--s-7)' }}>
            {messages.length === 0 ? (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--s-4)', color: 'var(--text-quaternary)' }}>
                <span style={{ fontSize: 40 }}>⚡</span>
                <p style={{ margin: 0, fontSize: 'var(--fs-13)' }}>{activeAgent ? `${activeAgent.name} 已就绪，发送消息开始对话` : '请先选择一个 Agent'}</p>
              </div>
            ) : (
              messages.map((msg, i) => <MsgBubble key={i} msg={msg} agentName={activeAgent?.name} />)
            )}
            {sending && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--s-3)', marginBottom: 'var(--s-5)' }}>
                <div style={{ padding: '10px 14px', borderRadius: 'var(--r-12)', background: 'var(--surface-elevated)', border: '0.5px solid var(--border-default)', display: 'flex', gap: 4 }}>
                  {[0, 1, 2].map((i) => (
                    <span key={i} style={{ width: 6, height: 6, borderRadius: 'var(--r-full)', background: 'var(--text-tertiary)', opacity: 0.5, animation: `pulse 1.2s ${i * 0.2}s infinite` }} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 输入区 */}
          <div style={{ padding: 'var(--s-4) var(--s-6)', borderTop: '0.5px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 'var(--s-3)', flexShrink: 0 }}>
            {/* 推理等级 */}
            <div style={{ display: 'flex', gap: 'var(--s-2)' }}>
              {(['low', 'medium', 'high'] as const).map((e) => (
                <button key={e} onClick={() => setEffort(e)}
                  style={{ padding: '3px 10px', borderRadius: 'var(--r-full)', fontSize: 11, cursor: 'pointer', border: '0.5px solid', transition: 'all 0.15s',
                    background: effort === e ? 'var(--accent-tint-strong)' : 'var(--c-neutral-100)',
                    borderColor: effort === e ? 'var(--accent-base)' : 'var(--border-default)',
                    color: effort === e ? 'var(--accent-base)' : 'var(--text-tertiary)',
                  }}>
                  {e === 'low' ? '快速' : e === 'medium' ? '标准' : '深度'}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 'var(--s-3)', alignItems: 'flex-end' }}>
              <textarea ref={inputRef} value={input}
                onChange={(e) => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px' }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                placeholder={activeAgent ? `向 ${activeAgent.name} 发送消息… (Enter 发送，Shift+Enter 换行)` : '请先选择 Agent'}
                disabled={!activeAgent || sending}
                style={{ flex: 1, minHeight: 44, maxHeight: 160, resize: 'none', background: 'var(--field-bg)', border: '0.5px solid var(--field-border)', borderRadius: 'var(--r-8)', padding: '10px 12px', fontSize: 'var(--fs-13)', color: 'var(--field-fg)', fontFamily: 'var(--font-text)', lineHeight: 'var(--lh-base)', outline: 'none', transition: 'border-color 0.15s', overflow: 'hidden' }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--field-border-focus)')}
                onBlur={(e)  => (e.target.style.borderColor = 'var(--field-border)')}
              />
              <button className="primary-btn" onClick={send} disabled={!input.trim() || sending || !activeAgent}
                style={{ height: 44, flexShrink: 0, paddingInline: 'var(--s-6)' }}>
                {sending ? <span className="spinner" /> : '发送'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showManage && <ManageModal agents={agents} onClose={() => setShowManage(false)} onSave={saveAgents} />}
    </div>
  )
}
