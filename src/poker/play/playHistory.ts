import type { KeyValueStore } from '../progress'
import { START_STACK } from './engine'
import type { ActionRecord, HandState } from './engine'
import { cardToString } from '../cards'
import type { DecisionKind, HandReview, MistakeCategory } from './review'

export const HISTORY_LIMIT = 50
const STORAGE_KEY = 'poker-coach:play'
const VERSION = 1

export interface HandRecord {
  id: string
  /** Unix ms when the hand finished. */
  at: number
  button: number
  seed: number
  /** Hero's result in chips (1 chip = 0.5bb). */
  net: number
  /** Hero's hole cards and the final board, as strings like "As". */
  hole: string[]
  board: string[]
  actions: ActionRecord[]
  review: HandReview
}

export interface KindStats {
  total: number
  marginal: number
  mistake: number
}

export interface PlayStats {
  hands: number
  netChips: number
  graded: number
  good: number
  marginal: number
  mistakes: number
  evLostBB: number
  byCategory: Partial<Record<MistakeCategory, number>>
  byKind: Record<DecisionKind, KindStats>
}

export interface PlayData {
  version: typeof VERSION
  /** Newest first, at most HISTORY_LIMIT. */
  hands: HandRecord[]
  /** Totals over every hand ever recorded, not just the ones still in the list. */
  stats: PlayStats
}

const emptyKind = (): KindStats => ({ total: 0, marginal: 0, mistake: 0 })

export const emptyPlayData = (): PlayData => ({
  version: VERSION,
  hands: [],
  stats: {
    hands: 0,
    netChips: 0,
    graded: 0,
    good: 0,
    marginal: 0,
    mistakes: 0,
    evLostBB: 0,
    byCategory: {},
    byKind: { 'preflop-open': emptyKind(), 'preflop-defend': emptyKind(), 'postflop-callfold': emptyKind() },
  },
})

export function makeHandRecord(hand: HandState, review: HandReview, heroSeat: number, at: number): HandRecord {
  return {
    id: `${at}-${hand.seed}`,
    at,
    button: hand.button,
    seed: hand.seed,
    net: hand.players[heroSeat].stack - START_STACK,
    hole: hand.players[heroSeat].hole.map(cardToString),
    board: hand.board.map(cardToString),
    actions: hand.actions,
    review,
  }
}

export function recordHand(data: PlayData, record: HandRecord): PlayData {
  const s = data.stats
  const { summary, decisions } = record.review
  const byCategory = { ...s.byCategory }
  const byKind = {
    'preflop-open': { ...s.byKind['preflop-open'] },
    'preflop-defend': { ...s.byKind['preflop-defend'] },
    'postflop-callfold': { ...s.byKind['postflop-callfold'] },
  }
  for (const d of decisions) {
    if (d.verdict === 'ungraded' || !d.kind) continue
    byKind[d.kind].total++
    if (d.verdict === 'marginal') byKind[d.kind].marginal++
    if (d.verdict === 'mistake') byKind[d.kind].mistake++
    if (d.category) byCategory[d.category] = (byCategory[d.category] ?? 0) + 1
  }
  return {
    version: VERSION,
    hands: [record, ...data.hands].slice(0, HISTORY_LIMIT),
    stats: {
      hands: s.hands + 1,
      netChips: s.netChips + record.net,
      graded: s.graded + summary.graded,
      good: s.good + summary.good,
      marginal: s.marginal + summary.marginal,
      mistakes: s.mistakes + summary.mistakes,
      evLostBB: s.evLostBB + summary.evLostBB,
      byCategory,
      byKind,
    },
  }
}

export function loadPlayData(store: KeyValueStore): PlayData {
  try {
    const raw = store.getItem(STORAGE_KEY)
    if (!raw) return emptyPlayData()
    const parsed: unknown = JSON.parse(raw)
    return isPlayData(parsed) ? parsed : emptyPlayData()
  } catch {
    return emptyPlayData()
  }
}

export function savePlayData(store: KeyValueStore, data: PlayData): void {
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Storage can be blocked or full; the history then lasts only for this session.
  }
}

export const clearPlayData = (store: KeyValueStore) => savePlayData(store, emptyPlayData())

function isPlayData(x: unknown): x is PlayData {
  if (typeof x !== 'object' || x === null) return false
  const { version, hands, stats } = x as { version?: unknown; hands?: unknown; stats?: unknown }
  if (version !== VERSION || !Array.isArray(hands) || typeof stats !== 'object' || stats === null) return false
  const s = stats as Record<string, unknown>
  const numbers = ['hands', 'netChips', 'graded', 'good', 'marginal', 'mistakes', 'evLostBB']
  return (
    numbers.every((k) => typeof s[k] === 'number') &&
    typeof s.byCategory === 'object' &&
    s.byCategory !== null &&
    typeof s.byKind === 'object' &&
    s.byKind !== null &&
    hands.every((h) => typeof h?.id === 'string' && Array.isArray(h?.actions) && Array.isArray(h?.review?.decisions))
  )
}
