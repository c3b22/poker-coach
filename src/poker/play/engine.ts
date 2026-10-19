import { type Card, fullDeck } from '../cards'
import { mulberry32 } from '../equity'
import { evaluate } from '../evaluator'
import type { Position } from '../preflop'
import { shuffled } from '../random'

// Chips are integers: 1 chip = 0.5 big blind, so SB = 1, BB = 2 and a stack is 100bb = 200 chips.
export const SEATS = 6
export const SMALL_BLIND = 1
export const BIG_BLIND = 2
export const START_STACK = 200

export type Street = 'preflop' | 'flop' | 'turn' | 'river'
export type Action = { type: 'fold' } | { type: 'check' } | { type: 'call' } | { type: 'raise'; to: number }

export interface PlayerState {
  seat: number
  hole: [Card, Card]
  stack: number
  /** Chips put in on the current street. */
  committed: number
  /** Chips put in over the whole hand. */
  total: number
  folded: boolean
  allIn: boolean
  /** Still owes a decision this street (set again whenever someone raises). */
  needsAction: boolean
}

export interface ActionRecord {
  seat: number
  street: Street
  type: 'blind' | 'fold' | 'check' | 'call' | 'raise'
  /** Chips moved into the pot by this action. */
  amount: number
  /** The player's street total after the action ("raise to" size). */
  to: number
  allIn: boolean
  potAfter: number
}

export interface HandResult {
  winners: number[]
  /** Chips won per seat, including the player's own chips coming back. */
  payouts: number[]
  showdown: boolean
}

export interface HandState {
  seed: number
  button: number
  /** All five community cards, fixed at the deal so a hand can be replayed. */
  runout: Card[]
  board: Card[]
  street: Street
  players: PlayerState[]
  /** Highest street total anyone has put in. */
  currentBet: number
  /** Size of the last full raise; the next raise must be at least this much bigger. */
  lastRaiseSize: number
  toAct: number | null
  actions: ActionRecord[]
  result: HandResult | null
}

export interface LegalActions {
  seat: number
  toCall: number
  canCheck: boolean
  canCall: boolean
  /** Chips a call would cost (less than toCall only if it puts the player all-in). */
  callAmount: number
  canRaise: boolean
  minRaiseTo: number
  maxRaiseTo: number
}

export interface Deal {
  holes: [Card, Card][]
  board: Card[]
}

const BOARD_SIZE: Record<Street, number> = { preflop: 0, flop: 3, turn: 4, river: 5 }
const NEXT_STREET: Record<Street, Street | null> = { preflop: 'flop', flop: 'turn', turn: 'river', river: null }
const POSITIONS: Position[] = ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO']

export const positionOf = (seat: number, button: number): Position => POSITIONS[(seat - button + SEATS) % SEATS]

export const potOf = (s: HandState) => s.players.reduce((n, p) => n + p.total, 0)

export function newHand(opts: { button: number; seed: number; deal?: Deal }): HandState {
  const { button, seed } = opts
  let holes: [Card, Card][]
  let runout: Card[]
  if (opts.deal) {
    holes = opts.deal.holes
    runout = opts.deal.board
  } else {
    const deck = shuffled(fullDeck(), mulberry32(seed))
    holes = Array.from({ length: SEATS }, (_, i) => [deck[2 * i], deck[2 * i + 1]] as [Card, Card])
    runout = deck.slice(2 * SEATS, 2 * SEATS + 5)
  }

  const s: HandState = {
    seed,
    button,
    runout,
    board: [],
    street: 'preflop',
    players: holes.map((hole, seat) => ({
      seat,
      hole,
      stack: START_STACK,
      committed: 0,
      total: 0,
      folded: false,
      allIn: false,
      needsAction: true,
    })),
    currentBet: BIG_BLIND,
    lastRaiseSize: BIG_BLIND,
    toAct: null,
    actions: [],
    result: null,
  }
  postBlind(s, (button + 1) % SEATS, SMALL_BLIND)
  postBlind(s, (button + 2) % SEATS, BIG_BLIND)
  s.toAct = (button + 3) % SEATS
  return s
}

export function legalActions(s: HandState): LegalActions | null {
  if (s.toAct === null) return null
  const p = s.players[s.toAct]
  const toCall = s.currentBet - p.committed
  const maxRaiseTo = p.committed + p.stack
  return {
    seat: p.seat,
    toCall,
    canCheck: toCall === 0,
    canCall: toCall > 0,
    callAmount: Math.min(toCall, p.stack),
    canRaise: maxRaiseTo > s.currentBet,
    // A player who cannot cover the full min-raise may still shove for less.
    minRaiseTo: Math.min(s.currentBet + s.lastRaiseSize, maxRaiseTo),
    maxRaiseTo,
  }
}

/**
 * Applies the action of the player to act and returns the new state; the input is never mutated.
 *
 * Every player starts the hand with the same stack, so everyone still in a hand has put in the
 * same total and an all-in is always for the same amount. That is why a single pot is enough
 * (no side pots) and why a short all-in raise can never be re-raised: it is already the cap.
 */
export function applyAction(state: HandState, action: Action): HandState {
  const la = legalActions(state)
  if (!la) throw new Error('The hand is over')
  const s = structuredClone(state)
  const p = s.players[la.seat]

  if (action.type === 'fold') {
    p.folded = true
    record(s, p, 'fold', 0)
  } else if (action.type === 'check') {
    if (!la.canCheck) throw new Error('Cannot check facing a bet')
    record(s, p, 'check', 0)
  } else if (action.type === 'call') {
    if (!la.canCall) throw new Error('Nothing to call')
    commit(p, la.callAmount)
    record(s, p, 'call', la.callAmount)
  } else {
    const { to } = action
    if (!la.canRaise) throw new Error('Cannot raise')
    if (!Number.isInteger(to) || to < la.minRaiseTo || to > la.maxRaiseTo) {
      throw new Error(`Raise to ${to} is outside ${la.minRaiseTo}..${la.maxRaiseTo}`)
    }
    const amount = to - p.committed
    const size = to - s.currentBet
    commit(p, amount)
    if (size >= s.lastRaiseSize) s.lastRaiseSize = size
    s.currentBet = to
    for (const q of s.players) if (q !== p && !q.folded && !q.allIn) q.needsAction = true
    record(s, p, 'raise', amount)
  }
  p.needsAction = false

  advance(s, p.seat)
  return s
}

function commit(p: PlayerState, amount: number) {
  p.stack -= amount
  p.committed += amount
  p.total += amount
  if (p.stack === 0) p.allIn = true
}

function postBlind(s: HandState, seat: number, amount: number) {
  const p = s.players[seat]
  commit(p, amount)
  record(s, p, 'blind', amount)
}

function record(s: HandState, p: PlayerState, type: ActionRecord['type'], amount: number) {
  s.actions.push({
    seat: p.seat,
    street: s.street,
    type,
    amount,
    to: p.committed,
    allIn: p.allIn,
    potAfter: potOf(s),
  })
}

function nextToAct(s: HandState, from: number): number | null {
  for (let i = 1; i <= SEATS; i++) {
    const p = s.players[(from + i) % SEATS]
    if (!p.folded && !p.allIn && p.needsAction) return p.seat
  }
  return null
}

function advance(s: HandState, justActed: number) {
  let from = justActed
  for (;;) {
    if (s.players.filter((p) => !p.folded).length === 1) return finish(s, false)
    const next = nextToAct(s, from)
    if (next !== null) {
      s.toAct = next
      return
    }
    if (s.street === 'river') return finish(s, true)
    startStreet(s)
    from = s.button
  }
}

function startStreet(s: HandState) {
  const street = NEXT_STREET[s.street]!
  s.street = street
  s.board = s.runout.slice(0, BOARD_SIZE[street])
  s.currentBet = 0
  s.lastRaiseSize = BIG_BLIND
  const canAct = s.players.filter((p) => !p.folded && !p.allIn)
  // With fewer than two players holding chips there is nobody to bet against: just run the board out.
  for (const p of s.players) {
    p.committed = 0
    p.needsAction = canAct.length >= 2 && canAct.includes(p)
  }
}

function finish(s: HandState, showdown: boolean) {
  const alive = s.players.filter((p) => !p.folded)
  let winners: number[]
  if (showdown) {
    s.board = s.runout
    const scores = alive.map((p) => evaluate([...p.hole, ...s.runout]))
    const best = Math.max(...scores)
    winners = alive.filter((_, i) => scores[i] === best).map((p) => p.seat)
  } else {
    winners = [alive[0].seat]
  }

  const pot = potOf(s)
  const share = Math.floor(pot / winners.length)
  const payouts = new Array<number>(SEATS).fill(0)
  for (const w of winners) payouts[w] = share
  // Odd chips go one at a time to the winners nearest the left of the button.
  const clockwise = [...winners].sort((a, b) => ((a - s.button - 1 + SEATS) % SEATS) - ((b - s.button - 1 + SEATS) % SEATS))
  for (let i = 0; i < pot - share * winners.length; i++) payouts[clockwise[i]]++
  for (const p of s.players) p.stack += payouts[p.seat]

  s.result = { winners, payouts, showdown }
  s.toAct = null
}
