import { useState } from 'react'
import { Markdown } from '../components/Markdown'
import { useBlueprint } from '../store'
import type { GiaFile } from '../agent/dispatch'

function formatTime(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`
}

function FilePreview({ file }: { file: GiaFile }) {
  const showToast = useBlueprint((s) => s.showToast)
  const copy = () => {
    const text = `# ${file.topic}\n\n${file.sections
      .map((s) => `## ${s.heading}\n\n${s.body}`)
      .join('\n\n')}`
    navigator.clipboard.writeText(text).then(
      () => showToast('已复制 .gia 内容', 1600),
      () => showToast('复制失败', 1600),
    )
  }
  const download = () => {
    const text = JSON.stringify(
      {
        filename: file.filename,
        topic: file.topic,
        generatedAt: file.generatedAt,
        sections: file.sections,
      },
      null,
      2,
    )
    const blob = new Blob([text], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = file.filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="file-preview">
      <div className="file-preview-head">
        <div>
          <div className="file-preview-name">{file.filename}</div>
          <div className="file-preview-meta">
            主题：<b>{file.topic}</b> · {file.wordCount} 字 ·{' '}
            {formatTime(file.generatedAt)}
          </div>
        </div>
        <div className="file-preview-actions">
          <button className="ghost-btn" onClick={copy}>
            复制 markdown
          </button>
          <button className="primary-btn" onClick={download}>
            下载
          </button>
        </div>
      </div>
      <div className="file-preview-summary">{file.summary}</div>
      <div className="file-preview-sections">
        {file.sections.map((s, idx) => (
          <div className="section-block" key={idx}>
            <div className="section-heading">{s.heading}</div>
            <div className="section-body">
              <Markdown source={s.body} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ProjectCenterView() {
  const files = useBlueprint((s) => s.projectFiles)
  const removeFile = useBlueprint((s) => s.removeProjectFile)
  const [activeId, setActiveId] = useState<string | null>(
    files[0]?.id ?? null,
  )

  const active = files.find((f) => f.id === activeId) ?? files[0]

  return (
    <div className="view-container">
      <div className="view-header">
        <div>
          <h2>项目中心</h2>
          <p className="view-subtitle">
            工作流回传生成的策划文档与 .gia 文件，按时间归档
          </p>
        </div>
        <div className="view-stats">
          <span>
            <b>{files.length}</b> 个文件
          </span>
        </div>
      </div>

      <div className="project-layout">
        <aside className="file-list">
          {files.length === 0 && (
            <div className="empty-state">
              还没有文件。回到「工作流」运行一遍并接一个「输出回传 · 项目」节点。
            </div>
          )}
          {files.map((f) => (
            <div key={f.id} className="file-row-shell">
              <button
                className={`file-row ${active?.id === f.id ? 'active' : ''}`}
                onClick={() => setActiveId(f.id)}
              >
                <div className="file-row-name">{f.filename}</div>
                <div className="file-row-meta">
                  <span className="file-ext">{f.extension}</span>
                  <span>{f.topic}</span>
                  <span className="muted">{formatTime(f.generatedAt)}</span>
                </div>
              </button>
              <button
                className="file-row-remove"
                onClick={() => {
                  removeFile(f.id)
                  if (active?.id === f.id) setActiveId(null)
                }}
              >
                ×
              </button>
            </div>
          ))}
        </aside>

        <main className="file-detail">
          {active ? (
            <FilePreview file={active} />
          ) : (
            <div className="empty-state">选择左侧文件查看详情</div>
          )}
        </main>
      </div>
    </div>
  )
}
