// 迁移自 analysis.js _startBgAnalysisPoll / _doBgPoll
import { useCallback, useEffect, useRef, useState } from 'react'

export type PollStatus = 'idle' | 'polling' | 'done' | 'failed' | 'timeout'

interface UsePollOptions {
  /** job_id 查询接口 */
  jobsUrl?: string
  interval?: number
  maxCount?: number
}

export function useAnalysisPoll(opts: UsePollOptions = {}) {
  const {
    jobsUrl   = '/api/monitor/jobs',
    interval  = 15000,
    maxCount  = 60,
  } = opts

  const [status, setStatus]   = useState<PollStatus>('idle')
  const [message, setMessage] = useState('')
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countRef  = useRef(0)
  const jobIdRef  = useRef<string | null>(null)

  const stop = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    countRef.current = 0
  }, [])

  const poll = useCallback(() => {
    countRef.current++
    const jobId = jobIdRef.current

    const check = async () => {
      try {
        const res  = await fetch(jobsUrl)
        const jobs: any[] = await res.json()

        if (jobId) {
          const job = jobs.find((j) => j.job_id === jobId)
          if (job?.status === 'success') { stop(); setStatus('done'); return }
          if (job?.status === 'failed')  { stop(); setStatus('failed'); setMessage(job.message || ''); return }
        } else {
          const recent = jobs.find((j) => j.status === 'success')
          if (recent) { stop(); setStatus('done'); return }
        }
      } catch { /* 网络闪断忽略 */ }

      if (countRef.current >= maxCount) { stop(); setStatus('timeout'); return }
      timerRef.current = setTimeout(poll, interval)
    }
    check()
  }, [jobsUrl, interval, maxCount, stop])

  const start = useCallback((jobId?: string) => {
    stop()
    countRef.current = 0
    jobIdRef.current = jobId ?? null
    setStatus('polling')
    setMessage('')
    timerRef.current = setTimeout(poll, interval)
  }, [poll, stop, interval])

  useEffect(() => () => stop(), [stop])

  return { status, message, start, stop }
}
