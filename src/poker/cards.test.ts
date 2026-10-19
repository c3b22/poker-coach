import { describe, expect, it } from 'vitest'
import { cardToString, parseCard, parseCards } from './cards'

describe('cards', () => {
  it('parses and prints round-trip', () => {
    for (const s of ['2c', 'Td', 'As', 'Kh', '9s']) {
      expect(cardToString(parseCard(s))).toBe(s)
    }
  })

  it('encodes ranks 2..A as 0..12', () => {
    expect(parseCard('2c') >> 2).toBe(0)
    expect(parseCard('As') >> 2).toBe(12)
  })

  it('parses a space-separated list', () => {
    expect(parseCards('As Kd')).toHaveLength(2)
  })

  it('rejects invalid cards', () => {
    expect(() => parseCard('Xx')).toThrow()
  })
})
