import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../equity'
import { actionProbabilities, chooseAction, sameAction } from './bot'
import type { WeightedAction } from './bot'
import { START_STACK, applyAction, legalActions, newHand, potOf } from './engine'
import type { Action, HandState } from './engine'
import { check, fold, raise, setup } from './testing'

const play = (s: HandState, ...actions: Action[]) => actions.reduce(applyAction, s)

const probOf = (ps: WeightedAction[], pred: (a: Action) => boolean) =>
  ps.filter((x) => pred(x.action)).reduce((n, x) => n + x.p, 0)
const isRaise = (a: Action) => a.type === 'raise'

describe('action probabilities are well formed', () => {
  it('sum to one and only contain legal, distinct actions', () => {
    const states = [
      setup(3, 'As Ad'),
      setup(3, '7h 2d'),
      play(setup(2, 'Kh Qh'), fold, fold, fold, raise(5), fold), // BB vs BTN
      play(setup(3, 'Qh Qd'), raise(5), raise(15), fold, fold, fold, fold),
    ]
    for (const s of states) {
      const ps = actionProbabilities(s)
      expect(ps.reduce((n, x) => n + x.p, 0)).toBeCloseTo(1, 9)
      for (const x of ps) {
        expect(x.p).toBeGreaterThan(0)
        expect(() => applyAction(s, x.action)).not.toThrow()
      }
      for (let i = 0; i < ps.length; i++) {
        for (let j = i + 1; j < ps.length; j++) expect(sameAction(ps[i].action, ps[j].action)).toBe(false)
      }
    }
  })
})

describe('preflop: first in', () => {
  it('UTG opens premium hands to 2.5bb and folds trash', () => {
    const aa = actionProbabilities(setup(3, 'As Ad'))
    expect(probOf(aa, isRaise)).toBeGreaterThan(0.9)
    expect(aa.find((x) => isRaise(x.action))!.action).toEqual(raise(5))
    expect(probOf(actionProbabilities(setup(3, '7h 2d')), (a) => a.type === 'fold')).toBeGreaterThan(0.9)
  })

  it('BTN opens a wider range than UTG', () => {
    const s = (hole: string) => play(setup(0, hole), fold, fold, fold)
    expect(probOf(actionProbabilities(s('Ks 9s')), isRaise)).toBeGreaterThan(0.9)
    expect(probOf(actionProbabilities(setup(3, 'Ks 9s')), isRaise)).toBeLessThan(0.1)
  })
})

describe('preflop: facing an open', () => {
  const bbVsBtn = (hole: string) => play(setup(2, hole), fold, fold, fold, raise(5), fold)

  it('follows the range table for the BB versus a BTN open', () => {
    const aa = actionProbabilities(bbVsBtn('Ah Ad'))
    expect(probOf(aa, isRaise)).toBeGreaterThan(0.9)
    expect(aa.find((x) => isRaise(x.action))!.action).toEqual(raise(20)) // 4x from out of position
    expect(probOf(actionProbabilities(bbVsBtn('7h 6h')), (a) => a.type === 'call')).toBeGreaterThan(0.9)
    expect(probOf(actionProbabilities(bbVsBtn('7d 2c')), (a) => a.type === 'fold')).toBeGreaterThan(0.9)
  })

  it('3-bets 3x when in position', () => {
    // BTN (seat 0) facing a CO (seat 5) open.
    const s = play(setup(0, 'Ah Ad'), fold, fold, raise(5))
    expect(actionProbabilities(s).find((x) => isRaise(x.action))!.action).toEqual(raise(15))
  })

  it('uses a hand-strength fallback when no table covers the spot', () => {
    // HJ (seat 4) facing a UTG (seat 3) open has no table.
    const strong = play(setup(4, 'Ah Kh'), raise(5))
    const weak = play(setup(4, '7h 2d'), raise(5))
    expect(probOf(actionProbabilities(strong), (a) => a.type !== 'fold')).toBeGreaterThan(0.9)
    expect(probOf(actionProbabilities(weak), (a) => a.type === 'fold')).toBeGreaterThan(0.9)
  })
})

describe('preflop: facing a 3-bet', () => {
  const utgVs3bet = (hole: string) => play(setup(3, hole), raise(5), raise(15), fold, fold, fold, fold)

  it('4-bets aces, calls queens, folds junk', () => {
    expect(probOf(actionProbabilities(utgVs3bet('As Ad')), isRaise)).toBeGreaterThan(0.9)
    expect(probOf(actionProbabilities(utgVs3bet('Qh Qd')), (a) => a.type === 'call')).toBeGreaterThan(0.9)
    expect(probOf(actionProbabilities(utgVs3bet('7h 2d')), (a) => a.type === 'fold')).toBeGreaterThan(0.9)
  })
})

describe('postflop', () => {
  // UTG opens, BB calls: BB acts first on the flop. Board J-7-2.
  const bbFirst = (hole: string) => play(setup(2, hole), raise(5), fold, fold, fold, fold, { type: 'call' })

  it('bets a set far more often than it bets air', () => {
    const set = probOf(actionProbabilities(bbFirst('Jh Jd')), isRaise)
    const air = probOf(actionProbabilities(bbFirst('4h 3d')), isRaise)
    expect(set).toBeGreaterThan(0.5)
    expect(air).toBeLessThan(0.2)
    expect(set).toBeGreaterThan(air * 3)
  })

  it('folds air to a pot-sized bet but continues with a set', () => {
    const facing = (hole: string) => play(bbFirst(hole), check, raise(11))
    expect(probOf(actionProbabilities(facing('4h 3d')), (a) => a.type === 'fold')).toBeGreaterThan(0.9)
    expect(probOf(actionProbabilities(facing('Jh Jd')), (a) => a.type !== 'fold')).toBeGreaterThan(0.95)
  })

  it('never folds when it can check', () => {
    const ps = actionProbabilities(bbFirst('4h 3d'))
    expect(probOf(ps, (a) => a.type === 'fold')).toBe(0)
  })
})

describe('chooseAction', () => {
  it('samples according to the probabilities and is deterministic per rng', () => {
    const s = setup(3, 'As Ad')
    expect(chooseAction(s, mulberry32(3))).toEqual(chooseAction(s, mulberry32(3)))
    let raises = 0
    for (let i = 0; i < 400; i++) if (chooseAction(s, mulberry32(i + 100)).type === 'raise') raises++
    expect(raises).toBeGreaterThan(340)
  })
})

describe('six bots playing each other', () => {
  const playHand = (seed: number) => {
    const rng = mulberry32(seed * 104729)
    let s = newHand({ button: seed % 6, seed })
    for (let steps = 0; s.result === null; steps++) {
      if (steps > 300) throw new Error(`hand ${seed} did not terminate`)
      s = applyAction(s, chooseAction(s, rng))
    }
    return s
  }

  it('finishes legal hands with conserved chips and a plausible style', () => {
    let vpipSeats = 0
    let showdowns = 0
    const hands = 600
    for (let seed = 1; seed <= hands; seed++) {
      const s = playHand(seed)
      expect(s.players.reduce((n, p) => n + p.stack, 0)).toBe(6 * START_STACK)
      expect(s.result!.payouts.reduce((a, b) => a + b, 0)).toBe(potOf(s))
      if (s.result!.showdown) showdowns++
      const voluntary = new Set(
        s.actions.filter((a) => a.street === 'preflop' && (a.type === 'call' || a.type === 'raise')).map((a) => a.seat),
      )
      vpipSeats += voluntary.size
    }
    const vpip = vpipSeats / (hands * 6)
    expect(vpip).toBeGreaterThan(0.1)
    expect(vpip).toBeLessThan(0.4)
    expect(showdowns / hands).toBeGreaterThan(0.05)
  })

  it('every sampled action is legal', () => {
    const rng = mulberry32(99)
    for (let seed = 1; seed <= 100; seed++) {
      let s = newHand({ button: seed % 6, seed })
      while (s.result === null) {
        const la = legalActions(s)!
        const a = chooseAction(s, rng)
        if (a.type === 'check') expect(la.canCheck).toBe(true)
        if (a.type === 'call') expect(la.canCall).toBe(true)
        if (a.type === 'raise') expect(la.canRaise).toBe(true)
        s = applyAction(s, a)
      }
    }
  })
})
