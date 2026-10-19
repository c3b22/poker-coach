import { type Card, fullDeck, rankOf, suitOf } from '../cards'
import { evaluate, straightHigh } from '../evaluator'
import { RANK_CHARS } from '../range'
import type { HandClass } from '../range'

const CHEN_POINTS: Record<string, number> = {
  A: 10, K: 8, Q: 7, J: 6, T: 5, '9': 4.5, '8': 4, '7': 3.5, '6': 3, '5': 2.5, '4': 2, '3': 1.5, '2': 1,
}

/** Chen formula: a quick preflop hand rating (AA = 20, 72o = -1). */
export function chenScore(cls: HandClass): number {
  const [a, b, kind] = cls
  if (a === b) return a === '5' ? 6 : Math.ceil(Math.max(CHEN_POINTS[a] * 2, 5))
  const hi = RANK_CHARS.indexOf(a)
  const lo = RANK_CHARS.indexOf(b)
  let score = CHEN_POINTS[a]
  if (kind === 's') score += 2
  const gap = lo - hi - 1
  score -= [0, 1, 2, 4][gap] ?? 5
  if (gap <= 1 && hi >= RANK_CHARS.indexOf('J')) score += 1 // connected, and both cards below a queen
  return Math.ceil(score)
}

export const comboKey = (a: Card, b: Card) => (a < b ? a * 52 + b : b * 52 + a)

const FLUSH_DRAW_BONUS = 0.25
const OPEN_ENDED_BONUS = 0.2
const GUTSHOT_BONUS = 0.08

/** How much a drawing hand is worth beyond its made hand, as a share of the gap to the top. */
function drawBonus(board: Card[], a: Card, b: Card): number {
  const suits = [0, 0, 0, 0]
  let mask = 0
  let boardMask = 0
  for (const c of board) {
    suits[suitOf(c)]++
    mask |= 1 << rankOf(c)
    boardMask |= 1 << rankOf(c)
  }
  for (const c of [a, b]) {
    suits[suitOf(c)]++
    mask |= 1 << rankOf(c)
  }
  const flush = suits.some((n, s) => n === 4 && (suitOf(a) === s || suitOf(b) === s)) ? FLUSH_DRAW_BONUS : 0

  let straight = 0
  if (straightHigh(mask) < 0) {
    let outs = 0
    for (let r = 0; r < 13; r++) {
      if (mask & (1 << r)) continue
      // A rank that completes a straight for the board alone does not help this hand in particular.
      if (straightHigh(mask | (1 << r)) >= 0 && straightHigh(boardMask | (1 << r)) < 0) outs++
    }
    straight = outs >= 2 ? OPEN_ENDED_BONUS : outs === 1 ? GUTSHOT_BONUS : 0
  }
  return 1 - (1 - flush) * (1 - straight)
}

const cache = new Map<string, Map<number, number>>()

/**
 * Strength of every possible hole-card combination on this board, in [0, 1]:
 * the share of other combinations it beats (ties count half), plus a bonus for draws.
 * The same table is used by the bots to decide and by the review to estimate ranges.
 */
function strengthTable(board: Card[]): Map<number, number> {
  const key = board.join(',')
  const hit = cache.get(key)
  if (hit) return hit

  const dead = new Set(board)
  const live = fullDeck().filter((c) => !dead.has(c))
  const combos: { key: number; a: Card; b: Card; score: number }[] = []
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      combos.push({ key: comboKey(live[i], live[j]), a: live[i], b: live[j], score: evaluate([...board, live[i], live[j]]) })
    }
  }
  const sorted = combos.map((c) => c.score).sort((x, y) => x - y)
  const lowerBound = (v: number) => {
    let lo = 0
    let hi = sorted.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (sorted[mid] < v) lo = mid + 1
      else hi = mid
    }
    return lo
  }

  const river = board.length === 5
  const table = new Map<number, number>()
  for (const c of combos) {
    const below = lowerBound(c.score)
    const equal = lowerBound(c.score + 1) - below
    const made = (below + equal / 2) / sorted.length
    const bonus = river ? 0 : drawBonus(board, c.a, c.b)
    table.set(c.key, made + (1 - made) * bonus)
  }

  if (cache.size >= 64) cache.clear()
  cache.set(key, table)
  return table
}

export function strengthOf(board: Card[], hole: [Card, Card]): number {
  return strengthTable(board).get(comboKey(hole[0], hole[1])) ?? 0
}
