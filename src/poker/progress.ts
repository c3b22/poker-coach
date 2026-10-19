import { generateQuestion, TOPICS } from './drill'
import type { Question, Topic } from './drill'

export interface TopicStats {
  correct: number
  total: number
}

export interface MissedEntry {
  question: Question
  weight: number
}

export interface Progress {
  stats: Record<Topic, TopicStats>
  missed: MissedEntry[]
}

export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const STORAGE_KEY = 'poker-coach:progress'
/** Chance that the next question is a replay of a missed one, when any are pending. */
const REPLAY_CHANCE = 0.35
const MISS_WEIGHT = 1
const START_WEIGHT = 2
const DECAY = 0.5
const DROP_BELOW = 0.75

export const emptyProgress = (): Progress => ({
  stats: Object.fromEntries(TOPICS.map((t) => [t, { correct: 0, total: 0 }])) as Record<Topic, TopicStats>,
  missed: [],
})

export function recordAnswer(progress: Progress, question: Question, choice: number): Progress {
  const isCorrect = choice === question.correct
  const old = progress.stats[question.topic]
  const stats = {
    ...progress.stats,
    [question.topic]: { correct: old.correct + (isCorrect ? 1 : 0), total: old.total + 1 },
  }

  const existing = progress.missed.find((m) => m.question.id === question.id)
  let missed = progress.missed
  if (!isCorrect) {
    missed = existing
      ? missed.map((m) => (m === existing ? { ...m, weight: m.weight + MISS_WEIGHT } : m))
      : [...missed, { question, weight: START_WEIGHT }]
  } else if (existing) {
    const weight = existing.weight * DECAY
    missed = weight < DROP_BELOW ? missed.filter((m) => m !== existing) : missed.map((m) => (m === existing ? { ...m, weight } : m))
  }
  return { stats, missed }
}

export function nextQuestion(progress: Progress, topic: Topic | 'all', rng: () => number): Question {
  const pool = progress.missed.filter((m) => topic === 'all' || m.question.topic === topic)
  if (pool.length && rng() < REPLAY_CHANCE) {
    let r = rng() * pool.reduce((sum, m) => sum + m.weight, 0)
    for (const m of pool) {
      r -= m.weight
      if (r <= 0) return m.question
    }
    return pool[pool.length - 1].question
  }
  const t = topic === 'all' ? TOPICS[Math.floor(rng() * TOPICS.length)] : topic
  return generateQuestion(t, rng)
}

export function loadProgress(store: KeyValueStore): Progress {
  try {
    const raw = store.getItem(STORAGE_KEY)
    if (!raw) return emptyProgress()
    const parsed: unknown = JSON.parse(raw)
    return isProgress(parsed) ? withAllTopics(parsed) : emptyProgress()
  } catch {
    return emptyProgress()
  }
}

export function saveProgress(store: KeyValueStore, progress: Progress): void {
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(progress))
  } catch {
    // Storage can be blocked or full; progress then lasts only for this session.
  }
}

/** Progress saved before a topic existed has no stats for it; start those at zero. */
function withAllTopics(p: Progress): Progress {
  return { ...p, stats: { ...emptyProgress().stats, ...p.stats } }
}

function isProgress(x: unknown): x is Progress {
  if (typeof x !== 'object' || x === null) return false
  const { stats, missed } = x as { stats?: unknown; missed?: unknown }
  if (typeof stats !== 'object' || stats === null || !Array.isArray(missed)) return false
  const s = stats as Record<string, Partial<TopicStats> | undefined>
  const validStat = (t: Topic) => typeof s[t]?.correct === 'number' && typeof s[t]?.total === 'number'
  return (
    TOPICS.every((t) => s[t] === undefined || validStat(t)) &&
    Object.keys(s).length > 0 &&
    missed.every((m) => typeof m?.weight === 'number' && typeof m?.question?.id === 'string')
  )
}
