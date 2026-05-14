import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownProps {
  source: string
  className?: string
}

/**
 * Thin react-markdown wrapper used to render agent output.
 * Streaming-friendly: partial / mid-token markdown is handled gracefully by
 * react-markdown — we just re-render with the latest accumulated string.
 */
function MarkdownInner({ source, className }: MarkdownProps) {
  return (
    <div className={`md-body ${className ?? ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node, ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer" />
          ),
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  )
}

export const Markdown = memo(MarkdownInner)
