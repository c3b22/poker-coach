import { describe, expect, it } from 'vitest'
import { parseCards } from '../cards'
import type { Action, HandState } from './engine'
import { comboKey } from './strength'
import { inferRange, replayStates, reviewHand } from './review'
import type { DecisionReview } from './review'
import { call, check, fold, raise, runHand } from './testing'

const firstHeroDecision = (hand: HandState, heroSeat: number): DecisionReview =>
  reviewHand(hand, heroSeat).decisions.find((d) => d.seat === heroSeat)!

// ---- scripts that force the bots' early actions so each scenario is exact ----

/** UTG (seat 3) is the hero and acts first. No script needed. */
const firstIn = (hole: string, action: Action) =>
  firstHeroDecision(runHand({ heroSeat: 3, hole, heroPlan: [action] }), 3)

/** Hero is BB (seat 2) facing a BTN (seat 0) min-open to 2.5bb. */
const bbVsBtn = (hole: string, action: Action) =>
  firstHeroDecision(
    runHand({
      heroSeat: 2,
      hole,
      heroPlan: [action],
      script: (s) => {
        if (s.street !== 'preflop' || s.actions.length >= 7) return null
        if (s.toAct === 0) return raise(5)
        return fold // seats 3, 4, 5 and the SB fold
      },
    }),
    2,
  )

describe('replay', () => {
  it('replays a finished hand to the same result', () => {
    const hand = runHand({ heroSeat: 3, hole: 'As Ad', heroPlan: [raise(5)] })
    const { final } = replayStates(hand)
    expect(final.result).toEqual(hand.result)
    expect(final.players.map((p) => p.stack)).toEqual(hand.players.map((p) => p.stack))
    expect(final.actions).toEqual(hand.actions)
  })
})

describe('range inference from the bot policy', () => {
  it('weights hands that would open far above hands that would not', () => {
    // Hero is BB. UTG (seat 3) is forced to open, everyone else folds.
    const hand = runHand({
      heroSeat: 2,
      hole: 'Kc Qd',
      heroPlan: [fold],
      script: (s) => (s.toAct === 3 ? raise(5) : fold),
    })
    const { befores } = replayStates(hand)
    const heroIndex = hand.actions.findIndex((a) => a.seat === 2 && a.type !== 'blind')
    const weights = inferRange(befores, hand.actions, 3, heroIndex, parseCards('Kc Qd') as [number, number])
    const w = (cards: string) => {
      const [a, b] = parseCards(cards)
      return weights.get(comboKey(a, b)) ?? 0
    }
    expect(w('As Ad')).toBeGreaterThan(20 * w('7h 2d'))
    expect(w('7h 2d')).toBeGreaterThan(0)
    expect(weights.has(comboKey(...(parseCards('Kc Qd') as [number, number])))).toBe(false) // hero's own cards are dead
  })
})

describe('preflop: first in', () => {
  it('praises the textbook open and the textbook fold', () => {
    expect(firstIn('As Ad', raise(5)).verdict).toBe('good')
    expect(firstIn('7h 2d', fold).verdict).toBe('good')
  })

  it('flags folding a premium hand as a clear mistake', () => {
    const d = firstIn('As Ad', fold)
    expect(d.verdict).toBe('mistake')
    expect(d.category).toBe('preflop-open-missed')
    expect(d.recommended).toBe('Raise')
  })

  it('flags opening trash as a clear mistake', () => {
    const d = firstIn('7h 2d', raise(5))
    expect(d.verdict).toBe('mistake')
    expect(d.category).toBe('preflop-open-too-loose')
  })

  it('treats hands just outside the range as borderline', () => {
    expect(firstIn('8h 7h', raise(5)).verdict).toBe('marginal') // opens from HJ, not UTG
  })

  it('treats a limp as a deviation', () => {
    const d = firstIn('As Ad', call)
    expect(d.verdict).not.toBe('good')
    expect(d.category).toBe('preflop-limp')
  })

  it('does not judge the raise size', () => {
    expect(firstIn('As Ad', raise(9)).verdict).toBe('good')
  })
})

describe('preflop: facing an open', () => {
  it('follows the table for the BB versus a BTN open', () => {
    expect(bbVsBtn('Ah Ad', raise(20)).verdict).toBe('good')
    expect(bbVsBtn('7h 6h', call).verdict).toBe('good')
    expect(bbVsBtn('7d 2c', fold).verdict).toBe('good')
  })

  it('grades deviations by how far they stray', () => {
    expect(bbVsBtn('Ah Ad', fold).verdict).toBe('mistake') // raise expected, folded
    expect(bbVsBtn('Ah Ad', call).verdict).toBe('marginal') // raise expected, called
    expect(bbVsBtn('7d 2c', call).verdict).toBe('mistake') // trash called
    expect(bbVsBtn('7h 6h', fold).verdict).toBe('marginal') // speculative hand folded
  })

  it('names the mistake category and recommendation', () => {
    const d = bbVsBtn('Ah Ad', fold)
    expect(d.category).toBe('preflop-defend-fold')
    expect(d.recommended).toBe('Raise (3-bet)')
  })

  it('does not judge spots without a range table', () => {
    // HJ (seat 4) facing a UTG open: no table.
    const hand = runHand({
      heroSeat: 4,
      hole: 'Ah Kh',
      heroPlan: [call],
      script: (s) => (s.actions.length === 2 ? raise(5) : null), // UTG opens, first to act
    })
    const d = firstHeroDecision(hand, 4)
    expect(d.verdict).toBe('ungraded')
    expect(d.explanation).toContain('ตาราง')
  })
})

// ---- postflop: UTG opens, BB (hero) calls, hero checks, UTG bets 6 into 11 ----
const facingBet = (hole: string, response: Action) => {
  const hand = runHand({
    heroSeat: 2,
    hole,
    heroPlan: [call, check, response],
    script: (s) => {
      if (s.street === 'preflop' && s.toAct === 3) return raise(5)
      if (s.street === 'preflop') return fold
      if (s.street === 'flop' && s.toAct === 3 && s.currentBet === 0) return raise(6) // 0.5 pot bet from the bot's menu
      return null
    },
  })
  const review = reviewHand(hand, 2)
  return review.decisions.find((d) => d.street === 'flop' && d.taken.type !== 'check')!
}

describe('postflop: facing a bet heads-up', () => {
  it('folding air to a bet is fine, calling with it loses EV', () => {
    expect(facingBet('4h 3d', fold).verdict).toBe('good')
    const call_ = facingBet('4h 3d', call)
    expect(['marginal', 'mistake']).toContain(call_.verdict)
    expect(call_.recommended).toBe('Fold')
    expect(call_.evLossBB).toBeGreaterThan(0)
    expect(call_.category).toBe('postflop-call-too-much')
  })

  it('folding a set is a clear mistake with a large EV loss', () => {
    const d = facingBet('Jh Jd', fold)
    expect(d.verdict).toBe('mistake')
    expect(d.category).toBe('postflop-fold-too-much')
    expect(d.evLossBB).toBeGreaterThan(3)
    expect(facingBet('Jh Jd', call).verdict).toBe('good')
  })

  it('explains the numbers behind the call/fold verdict', () => {
    const d = facingBet('Jh Jd', fold)
    expect(d.explanation).toMatch(/equity/i)
    expect(d.explanation).toMatch(/%/)
  })

  it('does not judge a raise', () => {
    const d = facingBet('Jh Jd', raise(18))
    expect(d.verdict).toBe('ungraded')
  })
})

describe('postflop: situations that are not judged', () => {
  it('does not judge bets and checks when nobody has bet', () => {
    const hand = runHand({
      heroSeat: 2,
      hole: 'Jh Jd',
      heroPlan: [call, check],
      script: (s) => (s.street === 'preflop' ? (s.toAct === 3 ? raise(5) : fold) : s.toAct === 3 ? check : null),
    })
    const flopCheck = reviewHand(hand, 2).decisions.find((d) => d.street === 'flop')!
    expect(flopCheck.verdict).toBe('ungraded')
  })

  it('does not judge multiway pots', () => {
    const hand = runHand({
      heroSeat: 2,
      hole: 'Jh Jd',
      heroPlan: [call, check, fold],
      script: (s) => {
        if (s.street === 'preflop') return s.toAct === 3 ? raise(5) : s.toAct === 4 ? call : fold
        if (s.toAct === 3) return raise(6)
        if (s.toAct === 4) return call
        return null
      },
    })
    const d = reviewHand(hand, 2).decisions.find((x) => x.street === 'flop' && x.taken.type === 'fold')!
    expect(d.verdict).toBe('ungraded')
    expect(d.explanation).toMatch(/หลายคน|multiway/)
  })
})

describe('summary', () => {
  it('counts decisions by verdict and only for the hero', () => {
    const hand = runHand({ heroSeat: 3, hole: '7h 2d', heroPlan: [raise(5)] })
    const review = reviewHand(hand, 3)
    expect(review.decisions.every((d) => d.seat === 3)).toBe(true)
    const { graded, good, marginal, mistakes, ungraded } = review.summary
    expect(graded).toBe(good + marginal + mistakes)
    expect(graded + ungraded).toBe(review.decisions.length)
    expect(mistakes).toBeGreaterThanOrEqual(1)
  })

  it('totals the estimated EV lost', () => {
    const hand = runHand({
      heroSeat: 2,
      hole: 'Jh Jd',
      heroPlan: [call, check, fold],
      script: (s) => {
        if (s.street === 'preflop' && s.toAct === 3) return raise(5)
        if (s.street === 'preflop') return fold
        if (s.street === 'flop' && s.toAct === 3) return raise(6)
        return null
      },
    })
    const review = reviewHand(hand, 2)
    const sum = review.decisions.reduce((n, d) => n + (d.evLossBB ?? 0), 0)
    expect(review.summary.evLostBB).toBeCloseTo(sum, 6)
    expect(review.summary.evLostBB).toBeGreaterThan(0)
  })
})
