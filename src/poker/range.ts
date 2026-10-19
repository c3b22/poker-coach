// Ranges are sets of hand classes such as "AA", "AKs", "T9o". Written in the usual
// shorthand: "22+, A2s+, KTs+, 98s-65s, ATo+, 66-88".

export type HandClass = string

/** Ranks from strongest to weakest; the index is also the row/column in the 13x13 grid. */
export const RANK_CHARS = 'AKQJT98765432'

const idx = (ch: string) => {
  const i = RANK_CHARS.indexOf(ch)
  if (i < 0) throw new Error(`Invalid rank: ${ch}`)
  return i
}

const make = (hi: number, lo: number, suffix: '' | 's' | 'o'): HandClass =>
  RANK_CHARS[hi] + RANK_CHARS[lo] + suffix

export function parseRange(text: string): Set<HandClass> {
  const out = new Set<HandClass>()
  for (const raw of text.split(',')) {
    const tok = raw.trim()
    if (!tok) continue
    for (const h of expandToken(tok)) out.add(h)
  }
  return out
}

function expandToken(tok: string): HandClass[] {
  const bad = () => new Error(`Invalid range token: ${tok}`)
  const [head, tail] = tok.split('-')
  if (tail !== undefined) return expandDash(head, tail, bad)

  const plus = tok.endsWith('+')
  const body = plus ? tok.slice(0, -1) : tok
  if (body.length < 2 || body.length > 3) throw bad()
  const hi = idx(body[0])
  const lo = idx(body[1])
  const kind = body[2]

  if (hi === lo) {
    if (kind !== undefined) throw bad()
    const from = plus ? 0 : hi // "JJ+" runs from JJ up to AA
    const to = hi
    return range(from, to).map((r) => make(r, r, ''))
  }
  if (hi > lo) throw bad() // write the stronger card first: "AK", not "KA"
  if (kind !== 's' && kind !== 'o') throw bad()
  const lows = plus ? range(hi + 1, lo) : [lo] // "QTs+" runs T..J, the kicker stops under the high card
  return lows.map((l) => make(hi, l, kind))
}

function expandDash(a: string, b: string, bad: () => Error): HandClass[] {
  if (a.length < 2 || b.length < 2) throw bad()
  const [hiA, loA, hiB, loB] = [idx(a[0]), idx(a[1]), idx(b[0]), idx(b[1])]
  if (hiA === loA) {
    if (hiB !== loB) throw bad()
    return range(Math.min(hiA, hiB), Math.max(hiA, hiB)).map((r) => make(r, r, ''))
  }
  const kind = a[2]
  if ((kind !== 's' && kind !== 'o') || b[2] !== kind) throw bad()
  if (hiA === hiB) {
    return range(Math.min(loA, loB), Math.max(loA, loB)).map((l) => make(hiA, l, kind))
  }
  if (loA - hiA !== loB - hiB) throw bad() // connectors/gappers must share the same gap
  const shifts = range(Math.min(hiA, hiB), Math.max(hiA, hiB))
  const gap = loA - hiA
  return shifts.map((h) => make(h, h + gap, kind))
}

/** Inclusive integer range, ordered low to high regardless of argument order. */
function range(a: number, b: number): number[] {
  const lo = Math.min(a, b)
  const hi = Math.max(a, b)
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
}

export function comboCount(range: Set<HandClass>): number {
  let n = 0
  for (const h of range) n += h.length === 2 ? 6 : h[2] === 's' ? 4 : 12
  return n
}

/** Hand class shown at grid cell (row, col): pairs on the diagonal, suited above it, offsuit below. */
export function handClassAt(row: number, col: number): HandClass {
  if (row === col) return make(row, col, '')
  return row < col ? make(row, col, 's') : make(col, row, 'o')
}

export function handClassGrid(): HandClass[][] {
  return Array.from({ length: 13 }, (_, r) => Array.from({ length: 13 }, (_, c) => handClassAt(r, c)))
}
