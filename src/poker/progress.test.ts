import { describe, expect, it } from 'vitest'
import type { Question } from './drill'
import { mulberry32 } from './equity'
import { emptyProgress, loadProgress, nextQuestion, recordAnswer, saveProgress } from './progress'

const q = (id: string, topic: Question['topic'] = 'rfi'): Question => ({
  id,
  topic,
  prompt: 'p',
  choices: ['A', 'B'],
  correct: 0,
  explanation: 'e',
})

describe('recordAnswer', () => {
  it('counts per topic and does not mutate the input', () => {
    const p0 = emptyProgress()
    const p1 = recordAnswer(p0, q('a'), 0)
    expect(p1.stats.rfi).toEqual({ correct: 1, total: 1 })
    expect(p0.stats.rfi).toEqual({ correct: 0, total: 0 })
    const p2 = recordAnswer(p1, q('b'), 1)
    expect(p2.stats.rfi).toEqual({ correct: 1, total: 2 })
  })

  it('a wrong answer enters the review pool, a right one does not', () => {
    const wrong = recordAnswer(emptyProgress(), q('a'), 1)
    expect(wrong.missed.map((m) => m.question.id)).toEqual(['a'])
    expect(recordAnswer(emptyProgress(), q('a'), 0).missed).toEqual([])
  })

  it('missing the same question again raises its weight, not a duplicate entry', () => {
    let p = recordAnswer(emptyProgress(), q('a'), 1)
    const w1 = p.missed[0].weight
    p = recordAnswer(p, q('a'), 1)
    expect(p.missed).toHaveLength(1)
    expect(p.missed[0].weight).toBeGreaterThan(w1)
  })

  it('answering a review question correctly decays it until it leaves the pool', () => {
    let p = recordAnswer(emptyProgress(), q('a'), 1)
    let steps = 0
    while (p.missed.length && steps < 10) {
      p = recordAnswer(p, q('a'), 0)
      steps++
    }
    expect(p.missed).toEqual([])
    expect(steps).toBeGreaterThan(1)
  })
})

describe('nextQuestion', () => {
  it('serves a fresh question when the pool is empty', () => {
    const next = nextQuestion(emptyProgress(), 'all', mulberry32(1))
    expect(['rfi', 'facing-open', 'pot-odds']).toContain(next.topic)
  })

  it('respects the topic filter', () => {
    for (let s = 1; s < 50; s++) {
      expect(nextQuestion(emptyProgress(), 'pot-odds', mulberry32(s)).topic).toBe('pot-odds')
    }
  })

  it('replays missed questions a meaningful share of the time', () => {
    const p = recordAnswer(emptyProgress(), q('missed'), 1)
    let replays = 0
    for (let s = 1; s <= 400; s++) {
      if (nextQuestion(p, 'all', mulberry32(s)).id === 'missed') replays++
    }
    expect(replays).toBeGreaterThan(60)
    expect(replays).toBeLessThan(250)
  })

  it('only replays missed questions that match the topic filter', () => {
    const p = recordAnswer(emptyProgress(), q('missed', 'rfi'), 1)
    for (let s = 1; s <= 100; s++) {
      expect(nextQuestion(p, 'pot-odds', mulberry32(s)).topic).toBe('pot-odds')
    }
  })
})

describe('persistence', () => {
  const memory = (initial?: string) => {
    const data = new Map<string, string>()
    if (initial !== undefined) data.set('poker-coach:progress', initial)
    return {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    }
  }

  it('round-trips', () => {
    const store = memory()
    const p = recordAnswer(emptyProgress(), q('a'), 1)
    saveProgress(store, p)
    expect(loadProgress(store)).toEqual(p)
  })

  it('falls back to empty on corrupt or missing data', () => {
    expect(loadProgress(memory())).toEqual(emptyProgress())
    expect(loadProgress(memory('{not json'))).toEqual(emptyProgress())
    expect(loadProgress(memory('{"stats":42}'))).toEqual(emptyProgress())
  })

  it('does not throw when storage is unavailable', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }
    expect(loadProgress(broken)).toEqual(emptyProgress())
    expect(() => saveProgress(broken, emptyProgress())).not.toThrow()
  })
})
