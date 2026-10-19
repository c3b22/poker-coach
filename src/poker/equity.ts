import { type Card, fullDeck } from './cards'
import { evaluate } from './evaluator'

export interface Equity {
  win: number
  tie: number
  lose: number
  /** win + tie split fairly (tie counted as 1/n of a win). */
  equity: number
}

export interface EquityOptions {
  /** Monte Carlo samples when exact enumeration is too large. */
  iterations?: number
  rng?: () => number
  /** Enumerate exactly when the number of boards is at most this. */
  exactLimit?: number
}

/** Small seedable PRNG so results are reproducible in tests. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  let r = 1
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i
  return Math.round(r)
}

/** Equity of each hand against the others, given the known board (0 to 5 cards). */
export function equity(hands: Card[][], board: Card[], opts: EquityOptions = {}): Equity[] {
  const { iterations = 20000, rng = Math.random, exactLimit = 200000 } = opts
  const used = new Set<Card>()
  for (const c of [...hands.flat(), ...board]) {
    if (used.has(c)) throw new Error('Duplicate card')
    used.add(c)
  }
  if (hands.length < 2) throw new Error('Need at least two hands')

  const deck = fullDeck().filter((c) => !used.has(c))
  const need = 5 - board.length
  const wins = new Array<number>(hands.length).fill(0)
  const ties = new Array<number>(hands.length).fill(0)
  const shares = new Array<number>(hands.length).fill(0)
  let total = 0

  const scoreBoard = (runout: Card[]) => {
    const full = [...board, ...runout]
    let best = -1
    let bestCount = 0
    const scores = hands.map((h) => evaluate([...h, ...full]))
    for (const s of scores) {
      if (s > best) {
        best = s
        bestCount = 1
      } else if (s === best) bestCount++
    }
    scores.forEach((s, i) => {
      if (s !== best) return
      if (bestCount === 1) wins[i]++
      else ties[i]++
      shares[i] += 1 / bestCount
    })
    total++
  }

  if (need === 0) {
    scoreBoard([])
  } else if (choose(deck.length, need) <= exactLimit) {
    const runout: Card[] = []
    const rec = (start: number) => {
      if (runout.length === need) return scoreBoard(runout)
      for (let i = start; i < deck.length; i++) {
        runout.push(deck[i])
        rec(i + 1)
        runout.pop()
      }
    }
    rec(0)
  } else {
    for (let n = 0; n < iterations; n++) {
      // Partial Fisher-Yates: draw `need` distinct cards.
      const pool = deck.slice()
      const runout: Card[] = []
      for (let k = 0; k < need; k++) {
        const j = k + Math.floor(rng() * (pool.length - k))
        ;[pool[k], pool[j]] = [pool[j], pool[k]]
        runout.push(pool[k])
      }
      scoreBoard(runout)
    }
  }

  return hands.map((_, i) => ({
    win: wins[i] / total,
    tie: ties[i] / total,
    lose: 1 - (wins[i] + ties[i]) / total,
    equity: shares[i] / total,
  }))
}
