/**
 * Critic node — scores an upstream agent's output and, on failure, triggers
 * a re-run of that single direct upstream with feedback spliced into the
 * prompt. The loop is local (critic ↔ direct upstream), not a general graph
 * cycle, which keeps execution semantics simple.
 */

export interface CriticNodeData {
  rubric: string
  threshold: number
  maxIterations: number
}

export const DEFAULT_CRITIC_DATA: CriticNodeData = {
  rubric:
    '内容是否结构清晰、论点明确？是否避免空话套话？是否有具体例子或可执行建议？',
  threshold: 75,
  maxIterations: 3,
}

export interface CriticJudgement {
  score: number
  feedback: string
}

const SCORE_REGEX = /(?:"score"|score)\s*[:：]\s*(\d{1,3})/i
const FEEDBACK_REGEX = /(?:"feedback"|feedback)\s*[:：]\s*"([\s\S]*?)"/i

export function parseCriticJudgement(raw: string): CriticJudgement {
  // Try strict JSON first
  try {
    const trimmed = raw.trim()
    // Take the first {...} block if there is surrounding prose
    const m = trimmed.match(/\{[\s\S]*\}/)
    if (m) {
      const obj = JSON.parse(m[0])
      const score = clampScore(obj.score)
      const feedback = String(obj.feedback ?? '').trim()
      if (Number.isFinite(score)) return { score, feedback }
    }
  } catch {
    /* fall through */
  }
  // Regex fallback
  const score = Number((raw.match(SCORE_REGEX) ?? [])[1] ?? '0')
  const feedback = (raw.match(FEEDBACK_REGEX) ?? [])[1] ?? ''
  return { score: clampScore(score), feedback: feedback.trim() }
}

function clampScore(n: unknown): number {
  const v = Number(n)
  if (!Number.isFinite(v)) return 0
  return Math.max(0, Math.min(100, Math.round(v)))
}

/** Build the LLM prompts used by the critic. */
export function criticPrompts(rubric: string, candidateText: string) {
  return {
    systemPrompt:
      '你是一位严格而公正的中文内容评审。根据用户给定的评分标准（rubric），对待评内容打分（0-100 整数）并给出简洁的改进反馈（中文，<= 120 字）。\n\n必须只输出一个 JSON 对象，结构为：\n{"score": <number>, "feedback": "<string>"}\n不要包含任何其他解释、前后缀或 markdown 包装。',
    userPrompt:
      `评分标准（rubric）：\n${rubric}\n\n待评内容：\n${candidateText}\n\n请输出 JSON。`,
  }
}

/** Mock judgements used when no API key is set, so the loop is still visible. */
export const MOCK_CRITIC_SEQUENCE: CriticJudgement[] = [
  {
    score: 58,
    feedback: '正文略冗长，第一节铺垫过多；建议精简前两段，并在第二节加一个真实案例。',
  },
  {
    score: 73,
    feedback: '结构改善明显，但结尾稍弱；建议补一个可立即执行的行动清单。',
  },
  {
    score: 89,
    feedback: '结构清晰、论点扎实、含具体建议，通过。',
  },
]
