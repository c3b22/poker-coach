import { type Card, rankOf, suitOf } from './cards'

export const Category = {
  HighCard: 0,
  Pair: 1,
  TwoPair: 2,
  ThreeOfAKind: 3,
  Straight: 4,
  Flush: 5,
  FullHouse: 6,
  FourOfAKind: 7,
  StraightFlush: 8,
} as const
export type Category = (typeof Category)[keyof typeof Category]

// Score = category * 13^5 + five tiebreak ranks in base 13. Higher is better; equal means tie.
const BASE = 13 ** 5

export const categoryOf = (score: number) => Math.floor(score / BASE) as Category

const pack = (category: Category, ranks: number[]) =>
  ranks.reduce((acc, r) => acc * 13 + r, 0) + category * BASE

// Highest rank of a straight in the given rank bitmask (bit 12 = ace), or -1. Wheel counts as 3 (five-high).
function straightHigh(mask: number): number {
  for (let high = 12; high >= 4; high--) {
    const run = 0b11111 << (high - 4)
    if ((mask & run) === run) return high
  }
  const wheel = (1 << 12) | 0b1111
  return (mask & wheel) === wheel ? 3 : -1
}

/** Best-hand score for 5 to 7 cards. */
export function evaluate(cards: Card[]): number {
  if (cards.length < 5 || cards.length > 7) throw new Error('evaluate needs 5 to 7 cards')

  const rankCount = new Array<number>(13).fill(0)
  const suitMask = [0, 0, 0, 0]
  const suitCount = [0, 0, 0, 0]
  let mask = 0
  for (const c of cards) {
    const r = rankOf(c)
    const s = suitOf(c)
    rankCount[r]++
    suitCount[s]++
    suitMask[s] |= 1 << r
    mask |= 1 << r
  }

  const flushSuit = suitCount.findIndex((n) => n >= 5)
  if (flushSuit >= 0) {
    const sf = straightHigh(suitMask[flushSuit])
    if (sf >= 0) return pack(Category.StraightFlush, [sf, 0, 0, 0, 0])
  }

  // Ranks grouped by multiplicity, each group sorted high to low.
  const quads: number[] = []
  const trips: number[] = []
  const pairs: number[] = []
  const singles: number[] = []
  for (let r = 12; r >= 0; r--) {
    const n = rankCount[r]
    if (n === 4) quads.push(r)
    else if (n === 3) trips.push(r)
    else if (n === 2) pairs.push(r)
    else if (n === 1) singles.push(r)
  }
  const kickers = (n: number, ...pool: number[][]) =>
    pool.flat().sort((a, b) => b - a).slice(0, n)

  if (quads.length) {
    const [k] = kickers(1, trips, pairs, singles, quads.slice(1))
    return pack(Category.FourOfAKind, [quads[0], k, 0, 0, 0])
  }
  if (trips.length && (trips.length > 1 || pairs.length)) {
    const [p] = kickers(1, trips.slice(1), pairs)
    return pack(Category.FullHouse, [trips[0], p, 0, 0, 0])
  }
  if (flushSuit >= 0) {
    const top: number[] = []
    for (let r = 12; r >= 0 && top.length < 5; r--) if (suitMask[flushSuit] & (1 << r)) top.push(r)
    return pack(Category.Flush, top)
  }
  const st = straightHigh(mask)
  if (st >= 0) return pack(Category.Straight, [st, 0, 0, 0, 0])
  if (trips.length) {
    return pack(Category.ThreeOfAKind, [trips[0], ...kickers(2, pairs, singles), 0, 0].slice(0, 5))
  }
  if (pairs.length >= 2) {
    const k = kickers(1, pairs.slice(2), singles)
    return pack(Category.TwoPair, [pairs[0], pairs[1], k[0], 0, 0])
  }
  if (pairs.length === 1) {
    return pack(Category.Pair, [pairs[0], ...kickers(3, singles), 0, 0].slice(0, 5))
  }
  return pack(Category.HighCard, singles.slice(0, 5))
}
