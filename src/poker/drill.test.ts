import { describe, expect, it } from 'vitest'
import { drawEquity, generateQuestion, dealHand, requiredEquity } from './drill'
import { mulberry32 } from './equity'
import { facingOpenSpots, preflopAction, rfiRange } from './preflop'
import type { Position } from './preflop'

const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1)

describe('dealHand', () => {
  const cardsOf = (cls: string, seed: number) => dealHand(cls, mulberry32(seed))

  it('pairs get two different suits', () => {
    for (const s of SEEDS) {
      const [a, b] = cardsOf('QQ', s)
      expect(a[0]).toBe('Q')
      expect(b[0]).toBe('Q')
      expect(a[1]).not.toBe(b[1])
    }
  })

  it('suited hands share a suit, offsuit hands do not', () => {
    for (const s of SEEDS) {
      const [a, b] = cardsOf('AKs', s)
      expect(a[1]).toBe(b[1])
      const [c, d] = cardsOf('T9o', s)
      expect(c[1]).not.toBe(d[1])
      expect(c[0] + d[0]).toBe('T9')
    }
  })
})

describe('equity maths', () => {
  it('required equity is bet / (pot + 2 * bet)', () => {
    expect(requiredEquity(100, 50)).toBeCloseTo(0.25, 9) // half-pot bet needs 25%
    expect(requiredEquity(100, 100)).toBeCloseTo(1 / 3, 9)
  })

  it('turn draw: outs / 46', () => {
    expect(drawEquity(9, 'turn')).toBeCloseTo(9 / 46, 9)
  })

  it('flop draw: two cards to come', () => {
    expect(drawEquity(9, 'flop')).toBeCloseTo(1 - (38 / 47) * (37 / 46), 9)
  })
})

describe('generateQuestion: rfi', () => {
  it('correct answer matches the range data', () => {
    for (const s of SEEDS) {
      const q = generateQuestion('rfi', mulberry32(s))
      expect(q.topic).toBe('rfi')
      expect(q.choices).toHaveLength(2)
      const pos = q.meta!.position as Exclude<Position, 'BB'>
      const hand = q.meta!.hand as string
      const inRange = rfiRange(pos).has(hand)
      expect(q.choices[q.correct]).toBe(inRange ? 'Raise' : 'Fold')
      expect(q.cards).toHaveLength(2)
    }
  })

  it('serves both open and fold answers', () => {
    const answers = new Set(SEEDS.map((s) => generateQuestion('rfi', mulberry32(s)).correct))
    expect(answers.size).toBe(2)
  })
})

describe('generateQuestion: facing-open', () => {
  it('correct answer matches the spot data', () => {
    const spots = facingOpenSpots()
    for (const s of SEEDS) {
      const q = generateQuestion('facing-open', mulberry32(s))
      const spot = spots.find((x) => x.hero === q.meta!.hero && x.villain === q.meta!.villain)!
      const action = preflopAction(q.meta!.hand as string, spot)
      expect(q.choices[q.correct].toLowerCase()).toContain(action)
    }
  })

  it('covers all three answers', () => {
    const answers = new Set(SEEDS.map((s) => generateQuestion('facing-open', mulberry32(s)).correct))
    expect(answers.size).toBe(3)
  })
})

describe('generateQuestion: pot-odds', () => {
  it('is never borderline and the answer follows EV', () => {
    for (const s of SEEDS) {
      const q = generateQuestion('pot-odds', mulberry32(s))
      const { pot, bet, equity } = q.meta as { pot: number; bet: number; equity: number }
      const need = requiredEquity(pot, bet)
      expect(Math.abs(equity - need)).toBeGreaterThanOrEqual(0.03)
      expect(q.choices).toEqual(['Call', 'Fold'])
      expect(q.choices[q.correct]).toBe(equity > need ? 'Call' : 'Fold')
    }
  })

  it('evLoss is zero for the correct answer and positive for the wrong one', () => {
    for (const s of SEEDS) {
      const q = generateQuestion('pot-odds', mulberry32(s))
      expect(q.evLoss![q.correct]).toBe(0)
      expect(q.evLoss![1 - q.correct]).toBeGreaterThan(0)
    }
  })

  it('serves both call and fold answers', () => {
    const answers = new Set(SEEDS.map((s) => generateQuestion('pot-odds', mulberry32(s)).correct))
    expect(answers.size).toBe(2)
  })
})

describe('generateQuestion: determinism', () => {
  it('same seed gives the same question', () => {
    for (const t of ['rfi', 'facing-open', 'pot-odds'] as const) {
      expect(generateQuestion(t, mulberry32(5))).toEqual(generateQuestion(t, mulberry32(5)))
    }
  })
})
