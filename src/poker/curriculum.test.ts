import { describe, expect, it } from 'vitest'
import { POSTFLOP_QUESTIONS } from '../data/postflop-questions'
import { LESSONS } from '../data/lessons'
import { parseCard, parseCards } from './cards'
import { generateQuestion, TOPICS } from './drill'
import { categoryOf, evaluate } from './evaluator'
import { mulberry32 } from './equity'
import { emptyProgress, loadProgress } from './progress'

const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1)

describe('topics', () => {
  it('follow the curriculum order', () => {
    expect(TOPICS).toEqual(['basics', 'rfi', 'facing-open', 'pot-odds', 'postflop'])
  })
})

describe('basics: hand name', () => {
  const nameQs = SEEDS.map((s) => generateQuestion('basics', mulberry32(s))).filter((q) => q.meta!.kind === 'hand-name')

  it('is generated for a fair share of seeds', () => {
    expect(nameQs.length).toBeGreaterThan(40)
  })

  it('correct choice names the real best-hand category', () => {
    for (const q of nameQs) {
      const cards = parseCards(q.meta!.cards as string)
      expect(cards).toHaveLength(7)
      const label = q.choices[q.correct]
      expect(label).toBe(CATEGORY_LABELS[categoryOf(evaluate(cards))])
      expect(new Set(q.choices).size).toBe(q.choices.length)
    }
  })

  it('shows hole cards and a five-card board', () => {
    for (const q of nameQs) {
      expect(q.cards).toHaveLength(2)
      expect(q.board).toHaveLength(5)
    }
  })
})

describe('basics: showdown', () => {
  const showdowns = SEEDS.map((s) => generateQuestion('basics', mulberry32(s))).filter((q) => q.meta!.kind === 'showdown')

  it('is generated for a fair share of seeds', () => {
    expect(showdowns.length).toBeGreaterThan(40)
  })

  it('declares the right winner', () => {
    for (const q of showdowns) {
      const board = parseCards(q.meta!.board as string)
      const hero = evaluate([...parseCards(q.meta!.hero as string), ...board])
      const villain = evaluate([...parseCards(q.meta!.villain as string), ...board])
      const expected = hero > villain ? 'คุณชนะ' : hero < villain ? 'คู่ต่อสู้ชนะ' : 'เสมอ (split pot)'
      expect(q.choices[q.correct]).toBe(expected)
    }
  })
})

describe('postflop handwritten bank', () => {
  it('has a useful number of questions', () => {
    expect(POSTFLOP_QUESTIONS.length).toBeGreaterThanOrEqual(12)
  })

  it('has unique ids and valid answers', () => {
    const ids = new Set(POSTFLOP_QUESTIONS.map((q) => q.id))
    expect(ids.size).toBe(POSTFLOP_QUESTIONS.length)
    for (const q of POSTFLOP_QUESTIONS) {
      expect(q.topic).toBe('postflop')
      expect(q.correct).toBeGreaterThanOrEqual(0)
      expect(q.correct).toBeLessThan(q.choices.length)
      expect(q.explanation.length).toBeGreaterThan(20)
    }
  })

  it('uses valid, non-duplicated cards', () => {
    for (const q of POSTFLOP_QUESTIONS) {
      const all = [...(q.cards ?? []), ...(q.board ?? [])]
      all.forEach(parseCard)
      expect(new Set(all).size, q.id).toBe(all.length)
    }
  })

  it('generateQuestion serves them', () => {
    const served = new Set(SEEDS.map((s) => generateQuestion('postflop', mulberry32(s)).id))
    expect(served.size).toBe(POSTFLOP_QUESTIONS.length)
  })
})

describe('lessons', () => {
  it('cover topics 1-4 with content', () => {
    expect(LESSONS).toHaveLength(4)
    for (const l of LESSONS) {
      expect(l.sections.length).toBeGreaterThan(1)
      expect(l.practice.length).toBeGreaterThan(0)
      for (const t of l.practice) expect(TOPICS).toContain(t)
    }
    const practiced = new Set(LESSONS.flatMap((l) => l.practice))
    for (const t of TOPICS) expect(practiced.has(t)).toBe(true)
  })
})

describe('progress migration', () => {
  it('keeps old saved progress that lacks newer topics', () => {
    const old = {
      stats: {
        rfi: { correct: 3, total: 4 },
        'facing-open': { correct: 1, total: 2 },
        'pot-odds': { correct: 0, total: 1 },
      },
      missed: [],
    }
    const store = { getItem: () => JSON.stringify(old), setItem: () => {} }
    const p = loadProgress(store)
    expect(p.stats.rfi).toEqual({ correct: 3, total: 4 })
    expect(p.stats.basics).toEqual({ correct: 0, total: 0 })
    expect(p).not.toEqual(emptyProgress())
  })
})

const CATEGORY_LABELS = [
  'High card',
  'One pair',
  'Two pair',
  'Three of a kind',
  'Straight',
  'Flush',
  'Full house',
  'Four of a kind',
  'Straight flush',
]
