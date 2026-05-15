// 网站管理 — 迁移自 auth.js 用户管理 + 角色权限管理
import { useEffect, useState } from 'react'

/* ── 类型 ── */
interface UserRecord { username: string; displayName?: string; role: string }
interface RoleDef { label: string; color: string; desc?: string; modules: string[]; builtin?: boolean }

/* ── 全量模块定义 ── */
const ALL_MODULES = [
  { id: 'dashboard',         label: '大盘数据',      group: '核心' },
  { id: 'level-center',      label: '关卡中心',      group: '核心' },
  { id: 'creator',           label: '创作者运营',    group: '核心' },
  { id: 'gameplay-designer', label: '玩法设计师',    group: 'Agent' },
  { id: 'recommend-analyst', label: '推荐分析师',    group: 'Agent' },
  { id: 'craft-engineer',    label: '创作工程师',    group: 'Agent' },
  { id: 'sentiment-analyst', label: '反馈小助手',    group: 'Agent' },
  { id: 'version-worker',    label: '版更工具人',    group: 'Agent' },
  { id: 'knowledge',         label: '知识库',        group: '知识' },
  { id: 'lab',               label: '实验室',        group: '知识' },
  { id: 'agent-cluster',     label: 'Agent 集群',    group: 'Agent' },
  { id: 'settings',          label: '系统管理',      group: '管理' },
]
const ALL_MODULE_IDS = ALL_MODULES.map((m) => m.id)

/* ── 内置角色 ── */
const DEFAULT_ROLES: Record<string, RoleDef> = {
  admin: {
    label: '管理员', color: 'var(--c-orange-500)', desc: '全功能访问，含网站管理',
    modules: ALL_MODULE_IDS, builtin: true,
  },
  recommend: {
    label: '推荐策略组', color: 'var(--c-blue-500)', desc: '大盘数据、推荐分析师、知识库',
    modules: ['dashboard','recommend-analyst','knowledge'], builtin: true,
  },
  ecology: {
    label: '生态玩法组', color: 'var(--c-green-500)', desc: '大盘数据、玩法设计师、关卡中心、知识库',
    modules: ['dashboard','gameplay-designer','level-center','knowledge'], builtin: true,
  },
  guest: {
    label: '游客', color: 'var(--text-quaternary)', desc: '只读大盘数据',
    modules: ['dashboard'], builtin: true,
  },
}

const ROLES_KEY = 'ucm_roles_v2'
const USERS_KEY = 'ucm_users_v2'

function loadRoles(): Record<string, RoleDef> {
  try { return { ...DEFAULT_ROLES, ...JSON.parse(localStorage.getItem(ROLES_KEY) || '{}') } } catch { return { ...DEFAULT_ROLES } }
}
function saveRoles(r: Record<string, RoleDef>) {
  // 只保存非内置的自定义角色
  const custom: Record<string, RoleDef> = {}
  Object.entries(r).forEach(([k, v]) => { if (!DEFAULT_ROLES[k]) custom[k] = v })
  localStorage.setItem(ROLES_KEY, JSON.stringify(custom))
}
function loadUsers(): UserRecord[] {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || '[]') } catch { return [] }
}
function saveUsers(u: UserRecord[]) { localStorage.setItem(USERS_KEY, JSON.stringify(u)) }

const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{ background: 'var(--surface-elevated)', borderRadius: 'var(--r-12)', border: '0.5px solid var(--border-default)', boxShadow: 'var(--shadow-1)', ...style }}>
    {children}
  </div>
)

/* ═══ 用户管理 ═══ */
function UsersSection({ roles }: { roles: Record<string, RoleDef> }) {
  const [users, setUsers] = useState<UserRecord[]>(loadUsers)
  const [form, setForm]   = useState({ username: '', displayName: '', role: 'guest' })
  const [showAdd, setShowAdd] = useState(false)
  const [editIdx, setEditIdx] = useState<number | null>(null)

  const save = () => {
    if (!form.username.trim()) return
    const updated = editIdx != null
      ? users.map((u, i) => i === editIdx ? { ...u, ...form } : u)
      : [...users, form]
    setUsers(updated); saveUsers(updated)
    setForm({ username: '', displayName: '', role: 'guest' })
    setShowAdd(false); setEditIdx(null)
  }
  const del = (i: number) => {
    const u = [...users]; u.splice(i, 1)
    setUsers(u); saveUsers(u)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ margin: 0, fontSize: 'var(--fs-14)', fontWeight: 'var(--fw-semi)', color: 'var(--text-primary)' }}>用户管理</p>
        <button className="primary-btn small" onClick={() => { setShowAdd(true); setEditIdx(null); setForm({ username: '', displayName: '', role: 'guest' }) }}>＋ 添加用户</button>
      </div>

      {showAdd && (
        <Card style={{ padding: 'var(--s-5)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--s-4)' }}>
            <div className="form-row"><label>用户名 *</label><input value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} placeholder="zhiheng.luo" /></div>
            <div className="form-row"><label>显示名称</label><input value={form.displayName} onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} placeholder="罗志恒" /></div>
            <div className="form-row">
              <label>角色</label>
              <select className="field-input" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                {Object.entries(roles).map(([key, r]) => <option key={key} value={key}>{r.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--s-3)', justifyContent: 'flex-end', marginTop: 'var(--s-4)' }}>
            <button className="ghost-btn" onClick={() => { setShowAdd(false); setEditIdx(null) }}>取消</button>
            <button className="primary-btn" onClick={save} disabled={!form.username.trim()}>
              {editIdx != null ? '保存修改' : '添加'}
            </button>
          </div>
        </Card>
      )}

      {!users.length ? (
        <div style={{ padding: 'var(--s-8)', textAlign: 'center', color: 'var(--text-quaternary)', fontSize: 'var(--fs-13)' }}>暂无用户，添加后可管理权限</div>
      ) : (
        <div style={{ overflow: 'auto', borderRadius: 'var(--r-8)', border: '0.5px solid var(--border-default)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-13)' }}>
            <thead>
              <tr style={{ borderBottom: '0.5px solid var(--border-default)', background: 'var(--c-neutral-50)' }}>
                {['用户名', '显示名称', '角色', '可访问模块数', '操作'].map((h) => (
                  <th key={h} style={{ padding: 'var(--s-3) var(--s-5)', textAlign: 'left', fontSize: 'var(--fs-11)', fontWeight: 'var(--fw-semi)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => {
                const role = roles[u.role]
                return (
                  <tr key={i} style={{ borderBottom: '0.5px solid var(--border-subtle)' }}>
                    <td style={{ padding: 'var(--s-3) var(--s-5)', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{u.username}</td>
                    <td style={{ padding: 'var(--s-3) var(--s-5)', color: 'var(--text-secondary)' }}>{u.displayName || '—'}</td>
                    <td style={{ padding: 'var(--s-3) var(--s-5)' }}>
                      {role ? <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 'var(--r-full)', background: `color-mix(in srgb, ${role.color} 12%, transparent)`, color: role.color, border: `0.5px solid color-mix(in srgb, ${role.color} 25%, transparent)` }}>{role.label}</span> : <span style={{ color: 'var(--text-quaternary)' }}>{u.role}</span>}
                    </td>
                    <td style={{ padding: 'var(--s-3) var(--s-5)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{role?.modules?.length ?? 0}</td>
                    <td style={{ padding: 'var(--s-3) var(--s-5)', display: 'flex', gap: 'var(--s-2)' }}>
                      <button className="ghost-btn small" onClick={() => { setForm({ username: u.username, displayName: u.displayName ?? '', role: u.role }); setEditIdx(i); setShowAdd(true) }}>编辑</button>
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--fs-12)', color: 'var(--c-red-500)', padding: '3px 8px' }} onClick={() => del(i)}>删除</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ═══ 角色管理 ═══ */
function RolesSection() {
  const [roles, setRoles]     = useState<Record<string, RoleDef>>(loadRoles)
  const [showAdd, setShowAdd] = useState(false)
  const [newRole, setNewRole] = useState({ key: '', label: '', color: '#888', desc: '', modules: [] as string[] })

  const save = () => {
    if (!newRole.key.trim() || !newRole.label.trim()) return
    const r = { ...roles, [newRole.key]: { label: newRole.label, color: newRole.color, desc: newRole.desc, modules: newRole.modules } }
    setRoles(r); saveRoles(r)
    setNewRole({ key: '', label: '', color: '#888', desc: '', modules: [] })
    setShowAdd(false)
  }
  const del = (key: string) => {
    if (roles[key]?.builtin) return
    const r = { ...roles }; delete r[key]
    setRoles(r); saveRoles(r)
  }
  const toggleModule = (moduleId: string) => {
    setNewRole((r) => ({ ...r, modules: r.modules.includes(moduleId) ? r.modules.filter((m) => m !== moduleId) : [...r.modules, moduleId] }))
  }

  const groupedModules = ALL_MODULES.reduce<Record<string, typeof ALL_MODULES>>((acc, m) => {
    if (!acc[m.group]) acc[m.group] = []
    acc[m.group].push(m)
    return acc
  }, {})

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ margin: 0, fontSize: 'var(--fs-14)', fontWeight: 'var(--fw-semi)', color: 'var(--text-primary)' }}>角色管理</p>
        <button className="ghost-btn small" onClick={() => setShowAdd((s) => !s)}>＋ 新建角色</button>
      </div>

      {showAdd && (
        <Card style={{ padding: 'var(--s-5)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--s-4)', marginBottom: 'var(--s-4)' }}>
            <div className="form-row"><label>角色 Key *</label><input value={newRole.key} onChange={(e) => setNewRole((r) => ({ ...r, key: e.target.value }))} placeholder="recommend_v2" /></div>
            <div className="form-row"><label>角色名称 *</label><input value={newRole.label} onChange={(e) => setNewRole((r) => ({ ...r, label: e.target.value }))} placeholder="推荐策略 V2" /></div>
            <div className="form-row"><label>颜色</label><input type="color" value={newRole.color} onChange={(e) => setNewRole((r) => ({ ...r, color: e.target.value }))} style={{ height: 'var(--field-height)', padding: '2px', cursor: 'pointer', width: '100%', borderRadius: 'var(--field-radius)', border: '0.5px solid var(--field-border)' }} /></div>
            <div className="form-row" style={{ gridColumn: '1/-1' }}><label>描述</label><input value={newRole.desc} onChange={(e) => setNewRole((r) => ({ ...r, desc: e.target.value }))} placeholder="角色说明" /></div>
          </div>
          <p style={{ margin: '0 0 var(--s-3)', fontSize: 'var(--fs-12)', color: 'var(--text-secondary)', fontWeight: 'var(--fw-medium)' }}>可访问模块</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-4)', marginBottom: 'var(--s-5)' }}>
            {Object.entries(groupedModules).map(([group, mods]) => (
              <div key={group}>
                <p style={{ margin: '0 0 var(--s-2)', fontSize: 11, color: 'var(--text-quaternary)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)' }}>{group}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--s-2)' }}>
                  {mods.map((m) => {
                    const sel = newRole.modules.includes(m.id)
                    return (
                      <button key={m.id} onClick={() => toggleModule(m.id)}
                        style={{ padding: '4px 10px', borderRadius: 'var(--r-full)', fontSize: 'var(--fs-12)', cursor: 'pointer', border: '0.5px solid', transition: 'all 0.12s',
                          background: sel ? 'var(--accent-tint-strong)' : 'var(--c-neutral-100)',
                          borderColor: sel ? 'var(--accent-base)' : 'var(--border-default)',
                          color: sel ? 'var(--accent-base)' : 'var(--text-secondary)',
                        }}>
                        {m.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 'var(--s-3)', justifyContent: 'flex-end' }}>
            <button className="ghost-btn" onClick={() => setShowAdd(false)}>取消</button>
            <button className="primary-btn" onClick={save} disabled={!newRole.key.trim() || !newRole.label.trim()}>保存角色</button>
          </div>
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 'var(--s-4)' }}>
        {Object.entries(roles).map(([key, r]) => (
          <Card key={key} style={{ padding: 'var(--s-5)', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--s-3)' }}>
              <div>
                <span style={{ display: 'inline-block', fontSize: 'var(--fs-13)', fontWeight: 'var(--fw-semi)', padding: '2px 10px', borderRadius: 'var(--r-full)', background: `color-mix(in srgb, ${r.color} 12%, transparent)`, color: r.color, border: `0.5px solid color-mix(in srgb, ${r.color} 25%, transparent)`, marginBottom: 'var(--s-2)' }}>
                  {r.label}
                </span>
                {r.builtin && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--text-quaternary)', background: 'var(--c-neutral-100)', padding: '1px 6px', borderRadius: 'var(--r-full)' }}>内置</span>}
                {r.desc && <p style={{ margin: '2px 0 0', fontSize: 'var(--fs-12)', color: 'var(--text-tertiary)' }}>{r.desc}</p>}
              </div>
              {!r.builtin && <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-red-500)', fontSize: 12, padding: '2px 6px', flexShrink: 0 }} onClick={() => del(key)}>删除</button>}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--s-2)' }}>
              {(r.modules ?? []).slice(0, 6).map((mid) => {
                const mod = ALL_MODULES.find((m) => m.id === mid)
                return mod ? <span key={mid} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 'var(--r-full)', background: 'var(--c-neutral-100)', color: 'var(--text-tertiary)', border: '0.5px solid var(--border-subtle)' }}>{mod.label}</span> : null
              })}
              {(r.modules?.length ?? 0) > 6 && <span style={{ fontSize: 10, color: 'var(--text-quaternary)' }}>+{r.modules.length - 6}</span>}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

/* ═══ 主视图 ═══ */
export default function SiteAdmin() {
  const [roles] = useState<Record<string, RoleDef>>(loadRoles)
  return (
    <div style={{ padding: 'var(--s-8) var(--s-9)', display: 'flex', flexDirection: 'column', gap: 'var(--s-8)', maxWidth: 1080, margin: '0 auto' }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 'var(--fs-22)', fontWeight: 'var(--fw-semi)', color: 'var(--text-primary)' }}>网站管理</h1>
        <p style={{ margin: '4px 0 0', fontSize: 'var(--fs-13)', color: 'var(--text-tertiary)' }}>用户管理 · 角色权限配置</p>
      </div>
      <UsersSection roles={roles} />
      <div style={{ borderTop: '0.5px solid var(--border-subtle)', paddingTop: 'var(--s-6)' }}>
        <RolesSection />
      </div>
    </div>
  )
}
