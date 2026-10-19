import { describe, expect, it } from 'vitest'
import { parseCards } from '../cards'
import { mulberry32 } from '../equity'
import {
  BIG_BLIND,
  START_STACK,
  applyAction,
  legalActions,
  newHand,
  positionOf,
  potOf,
} from './engine'
import type { Action, HandState } from './engine'

const play = (s: HandState, ...actions: Action[]) => actions.reduce(applyAction, s)
const fold: Action = { type: 'fold' }
const check: Action = { type: 'check' }
const call: Action = { type: 'call' }
const raise = (to: number): Action => ({ type: 'raise', to })
const stackTotal = (s: HandState) => s.players.reduce((n, p) => n + p.stack, 0)

// Button on seat 0: SB = 1, BB = 2, UTG = 3, HJ = 4, CO = 5.
const fresh = (seed = 1) => newHand({ button: 0, seed })

const dealt = (holes: string[], board: string): { holes: [number, number][]; board: number[] } => ({
  holes: holes.map((h) => parseCards(h) as [number, number]),
  board: parseCards(board),
})

describe('newHand', () => {
  it('deals 12 hole cards and 5 board cards, all distinct', () => {
    const s = fresh()
    const all = [...s.players.flatMap((p) => p.hole), ...s.runout]
    expect(all).toHaveLength(17)
    expect(new Set(all).size).toBe(17)
  })

  it('is deterministic for a seed and differs across seeds', () => {
    expect(fresh(7).players.map((p) => p.hole)).toEqual(fresh(7).players.map((p) => p.hole))
    expect(fresh(7).players.map((p) => p.hole)).not.toEqual(fresh(8).players.map((p) => p.hole))
  })

  it('posts blinds and puts UTG first to act', () => {
    const s = fresh()
    expect(s.players[1].committed).toBe(1)
    expect(s.players[2].committed).toBe(BIG_BLIND)
    expect(s.players[1].stack).toBe(START_STACK - 1)
    expect(s.players[2].stack).toBe(START_STACK - BIG_BLIND)
    expect(potOf(s)).toBe(3)
    expect(s.toAct).toBe(3)
    expect(s.street).toBe('preflop')
    expect(s.board).toEqual([])
  })

  it('names positions relative to the button', () => {
    const names = [0, 1, 2, 3, 4, 5].map((seat) => positionOf(seat, 0))
    expect(names).toEqual(['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'])
    expect(positionOf(0, 3)).toBe('UTG') // button on seat 3: SB 4, BB 5, UTG 0
  })
})

describe('legalActions', () => {
  it('UTG can fold, call or raise, but not check', () => {
    const la = legalActions(fresh())!
    expect(la.canCheck).toBe(false)
    expect(la.callAmount).toBe(2)
    expect(la.minRaiseTo).toBe(4)
    expect(la.maxRaiseTo).toBe(START_STACK)
    expect(la.canRaise).toBe(true)
  })

  it('big blind gets the option to check after limps', () => {
    const s = play(fresh(), call, call, call, call, call)
    expect(s.toAct).toBe(2)
    const la = legalActions(s)!
    expect(la.canCheck).toBe(true)
    expect(la.canRaise).toBe(true)
  })

  it('is null once the hand is over', () => {
    const s = play(fresh(), fold, fold, fold, fold, fold)
    expect(legalActions(s)).toBeNull()
  })
})

describe('betting rules', () => {
  it('min-raise equals the previous raise size', () => {
    const s = play(fresh(), raise(6))
    expect(legalActions(s)!.minRaiseTo).toBe(10)
    expect(() => applyAction(s, raise(9))).toThrow()
    const s2 = applyAction(s, raise(10))
    expect(legalActions(s2)!.minRaiseTo).toBe(14)
  })

  it('rejects a raise above the stack and non-integer raises', () => {
    expect(() => applyAction(fresh(), raise(201))).toThrow()
    expect(() => applyAction(fresh(), raise(5.5))).toThrow()
  })

  it('only an all-in is possible when the min-raise exceeds the stack', () => {
    const s = play(fresh(), raise(150))
    const la = legalActions(s)!
    expect(la.canRaise).toBe(true)
    expect(la.minRaiseTo).toBe(START_STACK)
    expect(la.maxRaiseTo).toBe(START_STACK)
  })

  it('cannot check facing a bet, or call with nothing to call', () => {
    expect(() => applyAction(fresh(), check)).toThrow()
    const flop = play(fresh(), call, call, call, call, call, check)
    expect(flop.street).toBe('flop')
    expect(() => applyAction(flop, call)).toThrow()
  })

  it('postflop min bet is one big blind', () => {
    const flop = play(fresh(), call, call, call, call, call, check)
    expect(legalActions(flop)!.minRaiseTo).toBe(BIG_BLIND)
    expect(() => applyAction(flop, raise(1))).toThrow()
  })

  it('a raise reopens action for players who already acted', () => {
    // UTG limps, HJ raises: UTG must act again.
    let s = play(fresh(), call, raise(8))
    s = play(s, fold, fold, fold, fold)
    expect(s.toAct).toBe(3)
    expect(legalActions(s)!.callAmount).toBe(6)
  })
})

describe('street flow', () => {
  it('limped pot goes to the flop with SB first to act', () => {
    const s = play(fresh(), call, call, call, call, call, check)
    expect(s.street).toBe('flop')
    expect(s.board).toHaveLength(3)
    expect(s.toAct).toBe(1)
    expect(potOf(s)).toBe(12)
    expect(s.players.every((p) => p.committed === 0)).toBe(true)
  })

  it('deals turn and river and reaches showdown after checks', () => {
    let s = play(fresh(), call, call, call, call, call, check)
    s = play(s, check, check, check, check, check, check) // flop
    expect(s.street).toBe('turn')
    s = play(s, check, check, check, check, check, check)
    expect(s.street).toBe('river')
    expect(s.board).toHaveLength(5)
    s = play(s, check, check, check, check, check, check)
    expect(s.result).not.toBeNull()
    expect(s.result!.showdown).toBe(true)
  })

  it('skips folded players and ends the hand when one remains', () => {
    const s = play(fresh(), raise(6), fold, fold, fold, fold, fold)
    expect(s.result).toMatchObject({ showdown: false, winners: [3] })
    expect(s.result!.payouts[3]).toBe(9) // 6 + SB 1 + BB 2
    expect(s.players[3].stack).toBe(START_STACK + 3)
  })

  it('refuses actions after the hand is over', () => {
    const s = play(fresh(), fold, fold, fold, fold, fold)
    expect(() => applyAction(s, check)).toThrow()
  })

  it('does not mutate the previous state', () => {
    const s = fresh()
    const before = JSON.stringify(s)
    applyAction(s, raise(6))
    expect(JSON.stringify(s)).toBe(before)
  })
})

describe('showdown', () => {
  it('all-in preflop runs out the board and pays the best hand', () => {
    const deal = dealt(['2c 3d', '2d 3c', '4c 5d', 'Kc Kh', '6c 7d', '6d 7c'], 'Ah Kd 7h 4s 9c')
    // seat 3 (Kc Kh) hits trips on the board; BB seat 2 (4c 5d) pairs fours.
    let s = newHand({ button: 0, seed: 1, deal })
    s = play(s, raise(START_STACK), fold, fold, fold, fold, call)
    expect(s.result!.showdown).toBe(true)
    expect(s.board).toHaveLength(5)
    expect(s.result!.winners).toEqual([3])
    expect(s.result!.payouts[3]).toBe(401) // 200 + 200 + SB 1
    expect(stackTotal(s)).toBe(6 * START_STACK)
  })

  it('splits ties and gives the odd chip to the first winner left of the button', () => {
    // Royal flush on the board: everyone remaining ties.
    const deal = dealt(['2c 3d', '2d 3c', '4c 5d', '4d 5c', '6c 7d', '6d 7c'], 'As Ks Qs Js Ts')
    let s = newHand({ button: 0, seed: 1, deal })
    s = play(s, raise(5), fold, fold, fold, fold, call) // UTG 5, SB folds (1), BB calls: pot 11
    s = play(s, check, check, check, check, check, check) // flop, turn, river checks (BB then UTG)
    expect(s.result!.winners.sort()).toEqual([2, 3])
    expect(s.result!.payouts[2]).toBe(6) // BB sits first to the left of the button
    expect(s.result!.payouts[3]).toBe(5)
    expect(stackTotal(s)).toBe(6 * START_STACK)
  })

  it('a folded player cannot win even with the best hand', () => {
    // UTG (seat 3) folds pocket aces; HJ raises with nines and BB calls with fours.
    const deal = dealt(['2c 3d', '2d 3c', '4c 5d', 'As Ad', '9d 9c', '6c 7d'], '2h 7s Jd Qc 4h')
    let s = newHand({ button: 0, seed: 1, deal })
    s = play(s, fold, raise(6), fold, fold, fold, call)
    s = play(s, check, check, check, check, check, check) // flop, turn, river: BB then HJ
    expect(s.result!.winners).toEqual([4])
    expect(s.players[3].stack).toBe(START_STACK)
    expect(stackTotal(s)).toBe(6 * START_STACK)
  })
})

describe('random play simulation', () => {
  const randomHand = (seed: number): HandState => {
    const rng = mulberry32(seed * 7919)
    let s = newHand({ button: seed % 6, seed })
    for (let steps = 0; s.result === null; steps++) {
      if (steps > 300) throw new Error(`hand ${seed} did not terminate`)
      const la = legalActions(s)!
      const roll = rng()
      let action: Action
      if (roll < 0.15) action = fold
      else if (roll < 0.55 && la.canCheck) action = check
      else if (roll < 0.75 && la.canCall) action = call
      else if (la.canRaise) {
        const span = la.maxRaiseTo - la.minRaiseTo
        const to = rng() < 0.15 ? la.maxRaiseTo : la.minRaiseTo + Math.floor(rng() * (span + 1))
        action = raise(to)
      } else action = la.canCheck ? check : call
      s = applyAction(s, action)
    }
    return s
  }

  it('always terminates with conserved chips and valid winners over 3000 hands', () => {
    let showdowns = 0
    let allIns = 0
    let splits = 0
    for (let seed = 1; seed <= 3000; seed++) {
      const s = randomHand(seed)
      const r = s.result!
      if (r.showdown) showdowns++
      if (s.players.some((p) => p.allIn)) allIns++
      if (r.winners.length > 1) splits++
      expect(stackTotal(s), `hand ${seed}`).toBe(6 * START_STACK)
      expect(r.payouts.reduce((a, b) => a + b, 0), `hand ${seed}`).toBe(potOf(s))
      expect(r.winners.length).toBeGreaterThan(0)
      for (const w of r.winners) expect(s.players[w].folded).toBe(false)
      if (r.showdown) expect(s.board).toHaveLength(5)
      expect(s.toAct).toBeNull()
    }
    // The random policy must actually reach the interesting paths, or the checks above prove little.
    expect(showdowns).toBeGreaterThan(300)
    expect(allIns).toBeGreaterThan(300)
    expect(splits).toBeGreaterThan(0)
  })
})
