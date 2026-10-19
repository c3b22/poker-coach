// A card is an integer 0..51: rank = card >> 2 (0 = deuce .. 12 = ace), suit = card & 3.
export type Card = number

const RANKS = '23456789TJQKA'
const SUITS = 'cdhs'

export const rankOf = (c: Card) => c >> 2
export const suitOf = (c: Card) => c & 3

export function parseCard(s: string): Card {
  const r = RANKS.indexOf(s[0])
  const u = SUITS.indexOf(s[1])
  if (s.length !== 2 || r < 0 || u < 0) throw new Error(`Invalid card: ${s}`)
  return r * 4 + u
}

export const parseCards = (s: string): Card[] => s.trim().split(/\s+/).map(parseCard)

export const cardToString = (c: Card) => RANKS[rankOf(c)] + SUITS[suitOf(c)]

export const fullDeck = (): Card[] => Array.from({ length: 52 }, (_, i) => i)
