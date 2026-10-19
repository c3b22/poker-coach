import { describe, expect, it } from 'vitest'
import {
  HISTORY_LIMIT,
  clearPlayData,
  emptyPlayData,
  loadPlayData,
  makeHandRecord,
  recordHand,
  savePlayData,
} from './playHistory'
import { reviewHand } from './review'
import { call, check, fold, raise, runHand } from './testing'
import type { Action, HandState } from './engine'

const record = (hole: string, plan: Action[], heroSeat = 3, at = 1, script?: (s: HandState) => Action | null) => {
  const hand = runHand({ heroSeat, hole, heroPlan: plan, script })
  const review = reviewHand(hand, heroSeat)
  return { hand, review, rec: makeHandRecord(hand, review, heroSeat, at) }
}

const memory = (initial?: string) => {
  const data = new Map<string, string>()
  if (initial !== undefined) data.set('poker-coach:play', initial)
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    raw: () => data.get('poker-coach:play'),
  }
}

describe('makeHandRecord', () => {
  it('keeps what is needed to show the hand again', () => {
    const { hand, rec } = record('As Ad', [raise(5)])
    expect(rec.seed).toBe(hand.seed)
    expect(rec.net).toBe(hand.players[3].stack - 200)
    expect(rec.hole).toHaveLength(2)
    expect(rec.actions).toEqual(hand.actions)
    expect(rec.review.decisions.length).toBeGreaterThan(0)
  })
})

describe('recordHand', () => {
  it('puts the newest hand first and updates the totals from the review', () => {
    const a = record('As Ad', [fold], 3, 1) // folded aces: a clear mistake
    const b = record('As Ad', [raise(5)], 3, 2)
    let data = recordHand(emptyPlayData(), a.rec)
    data = recordHand(data, b.rec)
    expect(data.hands.map((h) => h.at)).toEqual([2, 1])
    expect(data.stats.hands).toBe(2)
    expect(data.stats.mistakes).toBe(a.review.summary.mistakes + b.review.summary.mistakes)
    expect(data.stats.graded).toBe(a.review.summary.graded + b.review.summary.graded)
    expect(data.stats.netChips).toBe(a.rec.net + b.rec.net)
  })

  it('counts mistake categories and per-kind accuracy', () => {
    const data = recordHand(emptyPlayData(), record('As Ad', [fold]).rec)
    expect(data.stats.byCategory['preflop-open-missed']).toBe(1)
    expect(data.stats.byKind['preflop-open']).toEqual({ total: 1, marginal: 0, mistake: 1 })
  })

  it('does not count good decisions as mistakes', () => {
    const data = recordHand(emptyPlayData(), record('As Ad', [raise(5)]).rec)
    expect(data.stats.byCategory['preflop-open-missed']).toBeUndefined()
    expect(data.stats.byKind['preflop-open'].mistake).toBe(0)
    expect(data.stats.byKind['preflop-open'].total).toBe(1)
  })

  it('keeps only the latest hands but keeps counting all of them', () => {
    const rec = record('7h 2d', [fold]).rec
    let data = emptyPlayData()
    for (let i = 0; i < HISTORY_LIMIT + 10; i++) data = recordHand(data, { ...rec, at: i })
    expect(data.hands).toHaveLength(HISTORY_LIMIT)
    expect(data.hands[0].at).toBe(HISTORY_LIMIT + 9)
    expect(data.stats.hands).toBe(HISTORY_LIMIT + 10)
  })

  it('does not mutate its input', () => {
    const data = emptyPlayData()
    const before = JSON.stringify(data)
    recordHand(data, record('As Ad', [fold]).rec)
    expect(JSON.stringify(data)).toBe(before)
  })

  it('sums estimated EV lost', () => {
    // BB holds a set, calls an open, then folds to a flop bet: a big EV loss.
    const lost = record('Jh Jd', [call, check, fold], 2, 1, (s) => {
      if (s.street === 'preflop') return s.toAct === 3 ? raise(5) : s.toAct === 2 ? null : fold
      return s.street === 'flop' && s.toAct === 3 && s.currentBet === 0 ? raise(6) : null
    })
    expect(lost.review.summary.evLostBB).toBeGreaterThan(3)
    const data = recordHand(emptyPlayData(), lost.rec)
    expect(data.stats.evLostBB).toBeCloseTo(lost.review.summary.evLostBB, 6)
  })
})

describe('persistence', () => {
  it('round-trips', () => {
    const store = memory()
    const data = recordHand(emptyPlayData(), record('As Ad', [fold]).rec)
    savePlayData(store, data)
    expect(loadPlayData(store)).toEqual(data)
  })

  it('falls back to empty on missing, corrupt or wrong-version data', () => {
    expect(loadPlayData(memory())).toEqual(emptyPlayData())
    expect(loadPlayData(memory('{nope'))).toEqual(emptyPlayData())
    expect(loadPlayData(memory('{"version":99,"hands":[],"stats":{}}'))).toEqual(emptyPlayData())
    expect(loadPlayData(memory('{"version":1,"hands":"x"}'))).toEqual(emptyPlayData())
  })

  it('survives unavailable storage', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }
    expect(loadPlayData(broken)).toEqual(emptyPlayData())
    expect(() => savePlayData(broken, emptyPlayData())).not.toThrow()
  })

  it('clear empties the store', () => {
    const store = memory()
    savePlayData(store, recordHand(emptyPlayData(), record('As Ad', [fold]).rec))
    clearPlayData(store)
    expect(loadPlayData(store)).toEqual(emptyPlayData())
  })
})
