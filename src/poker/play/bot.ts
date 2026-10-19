import type { Card } from '../cards'
import { facingOpenSpots, preflopAction, rfiRange, RFI_POSITIONS } from '../preflop'
import type { FacingOpenSpot, Position } from '../preflop'
import { handClassOfHole } from '../range'
import type { HandClass } from '../range'
import type { Rng } from '../random'
import { legalActions, positionOf, potOf } from './engine'
import type { Action, HandState, LegalActions } from './engine'
import { chenScore, strengthOf } from './strength'

/**
 * The bots are rule-based and deliberately a little random. A policy is a function from the
 * visible situation and a pair of hole cards to a probability for each legal action, so the
 * review can later ask "which hands would have played this way?" with the very same code.
 */
export interface WeightedAction {
  action: Action
  p: number
}

export function sameAction(a: Action, b: Action): boolean {
  return a.type === b.type && (a.type !== 'raise' || (b.type === 'raise' && a.to === b.to))
}

export function chooseAction(state: HandState, rng: Rng): Action {
  const options = actionProbabilities(state)
  let r = rng()
  for (const o of options) {
    r -= o.p
    if (r < 0) return o.action
  }
  return options[options.length - 1].action
}

/** Probabilities of each action for the player to act, optionally pretending they hold other cards. */
export function actionProbabilities(state: HandState, hole?: [Card, Card]): WeightedAction[] {
  const la = legalActions(state)
  if (!la) throw new Error('The hand is over')
  const cards = hole ?? state.players[la.seat].hole
  return state.street === 'preflop' ? preflop(state, la, cards) : postflop(state, la, cards)
}

// ---------------------------------------------------------------------------
// Intents: what the bot wants, turned into a legal action only at the end.

type Intent = 'fold' | 'passive' | { raiseTo: number }
type Weighted = [Intent, number]

const raiseTo = (to: number): Intent => ({ raiseTo: to })

function resolve(la: LegalActions, intent: Intent): Action {
  if (intent === 'fold') return la.canCheck ? { type: 'check' } : { type: 'fold' }
  if (intent === 'passive' || !la.canRaise) return la.canCheck ? { type: 'check' } : { type: 'call' }
  let to = Math.max(Math.round(intent.raiseTo), la.minRaiseTo)
  to = Math.min(to, la.maxRaiseTo)
  if (to >= 0.7 * la.maxRaiseTo) to = la.maxRaiseTo // not worth keeping a sliver behind
  return { type: 'raise', to }
}

function distribution(la: LegalActions, weights: Weighted[]): WeightedAction[] {
  const merged: WeightedAction[] = []
  for (const [intent, w] of weights) {
    if (w <= 1e-9) continue
    const action = resolve(la, intent)
    const same = merged.find((m) => sameAction(m.action, action))
    if (same) same.p += w
    else merged.push({ action, p: w })
  }
  const total = merged.reduce((n, m) => n + m.p, 0)
  return merged.map((m) => ({ action: m.action, p: m.p / total }))
}

// ---------------------------------------------------------------------------
// Preflop

const EPS = 0.04
const OPEN_SIZE = 5 // 2.5bb
const SB_OPEN_SIZE = 6 // 3bb
/** Postflop order: the later in this list, the more "in position". */
const POSTFLOP_ORDER: Position[] = ['SB', 'BB', 'UTG', 'HJ', 'CO', 'BTN']
/** Chen score needed to call an open from each position when no table covers the spot. */
const CALL_VS: Record<Position, number> = { UTG: 9, HJ: 8.5, CO: 8, BTN: 7, SB: 6.5, BB: 6 }
const RAISE_VS: Record<Position, number> = { UTG: 12, HJ: 12, CO: 11, BTN: 10, SB: 10, BB: 10 }

const rfiCache = new Map<Position, Set<HandClass>>()
/** The textbook first-in range for a position, parsed once. */
export const rfiOf = (pos: (typeof RFI_POSITIONS)[number]) => {
  let r = rfiCache.get(pos)
  if (!r) rfiCache.set(pos, (r = rfiRange(pos)))
  return r
}
let spots: FacingOpenSpot[] | null = null
/** The range table for `hero` facing an open from `villain`, if we have one. */
export function facingSpot(hero: Position, villain: Position): FacingOpenSpot | undefined {
  spots ??= facingOpenSpots()
  return spots.find((s) => s.hero === hero && s.villain === villain)
}

/** Raises so far this preflop, and how many players have called (limped or cold-called). */
export function preflopContext(state: HandState) {
  const preActions = state.actions.filter((a) => a.street === 'preflop')
  return {
    raises: preActions.filter((a) => a.type === 'raise'),
    calls: preActions.filter((a) => a.type === 'call').length,
  }
}

function preflop(state: HandState, la: LegalActions, hole: [Card, Card]): WeightedAction[] {
  const pos = positionOf(la.seat, state.button)
  const cls = handClassOfHole(...hole)
  const { raises, calls: limpers } = preflopContext(state)

  if (raises.length === 0 && limpers === 0) {
    const inRange = pos !== 'BB' && rfiOf(pos).has(cls)
    const size = raiseTo(pos === 'SB' ? SB_OPEN_SIZE : OPEN_SIZE)
    return distribution(la, inRange ? [[size, 0.95], ['fold', 0.05]] : [['fold', 0.98], [size, 0.02]])
  }

  if (raises.length === 0) return limpedPot(la, pos, cls, limpers)

  if (raises.length === 1) return facingOpen(state, la, pos, cls, positionOf(raises[0].seat, state.button))

  return facingThreeBet(la, cls, raises.length)
}

function limpedPot(la: LegalActions, pos: Position, cls: HandClass, limpers: number): WeightedAction[] {
  const isolate = pos === 'BB' ? chenScore(cls) >= 9 : rfiOf(pos).has(cls)
  if (isolate) return distribution(la, [[raiseTo(OPEN_SIZE + 2 * limpers), 0.9], ['passive', 0.1]])
  if (la.canCheck) return distribution(la, [['passive', 1]])
  return chenScore(cls) >= 5 && la.toCall <= 2
    ? distribution(la, [['passive', 0.5], ['fold', 0.5]])
    : distribution(la, [['fold', 0.95], ['passive', 0.05]])
}

function facingOpen(state: HandState, la: LegalActions, pos: Position, cls: HandClass, opener: Position): WeightedAction[] {
  const spot = facingSpot(pos, opener)
  let kind: 'raise' | 'call' | 'fold'
  if (spot) {
    kind = preflopAction(cls, spot)
  } else {
    const c = chenScore(cls)
    const callAt = CALL_VS[opener] - (pos === 'BB' ? 2 : 0)
    kind = c >= RAISE_VS[opener] ? 'raise' : c >= callAt ? 'call' : 'fold'
  }
  const inPosition = POSTFLOP_ORDER.indexOf(pos) > POSTFLOP_ORDER.indexOf(opener)
  const threeBet = raiseTo(state.currentBet * (inPosition ? 3 : 4))
  const mix: Record<typeof kind, Weighted[]> = {
    raise: [[threeBet, 1 - EPS], ['passive', EPS / 2], ['fold', EPS / 2]],
    call: [['passive', 1 - EPS], ['fold', EPS / 2], [threeBet, EPS / 2]],
    fold: [['fold', 1 - EPS], ['passive', EPS * 0.75], [threeBet, EPS * 0.25]],
  }
  return distribution(la, mix[kind])
}

const FOUR_BET_FOR_VALUE = new Set(['AA', 'KK'])
const CALL_THREE_BET = new Set(['QQ', 'JJ', 'TT', 'AKo', 'AQs'])

function facingThreeBet(la: LegalActions, cls: HandClass, raises: number): WeightedAction[] {
  const shove = raiseTo(Number.POSITIVE_INFINITY)
  if (FOUR_BET_FOR_VALUE.has(cls)) return distribution(la, [[raises === 2 ? raiseTo(la.minRaiseTo * 1.15) : shove, 0.96], ['passive', 0.04]])
  if (cls === 'AKs') return distribution(la, [[raises === 2 ? raiseTo(la.minRaiseTo * 1.15) : 'passive', 0.96], ['passive', 0.04]])
  if (cls === 'QQ' || (raises === 2 && CALL_THREE_BET.has(cls))) return distribution(la, [['passive', 0.96], ['fold', 0.04]])
  return distribution(la, [['fold', 0.99], ['passive', 0.01]])
}

// ---------------------------------------------------------------------------
// Postflop: everything hangs off the hand's strength percentile on this board.

function postflop(state: HandState, la: LegalActions, hole: [Card, Card]): WeightedAction[] {
  const s = strengthOf(state.board, hole)
  const pot = potOf(state)
  const opponents = state.players.filter((p) => !p.folded).length - 1
  const crowd = opponents <= 1 ? 1 : opponents === 2 ? 0.7 : 0.5

  if (la.canCheck) {
    const base = s >= 0.62 ? Math.min(0.92, 0.35 + (s - 0.62) * 1.6) : s >= 0.45 ? 0.12 : 0.1
    const bet = base * crowd
    const size = raiseTo(pot * (s >= 0.85 ? 0.75 : 0.5))
    return distribution(la, [[size, bet], ['passive', 1 - bet]])
  }

  // Facing a bet: continue when the hand is strong enough for the price.
  const need = la.callAmount / (pot + la.callAmount)
  const threshold = 0.28 + need + 0.05 * (opponents - 1)
  const keepPlaying = 1 / (1 + Math.exp(-(s - threshold) / 0.04))
  const raiseShare = s >= 0.88 ? Math.min(0.6, (s - 0.88) * 8) : 0
  return distribution(la, [
    [raiseTo(state.currentBet * 2.75), keepPlaying * raiseShare],
    ['passive', keepPlaying * (1 - raiseShare)],
    ['fold', 1 - keepPlaying],
  ])
}
