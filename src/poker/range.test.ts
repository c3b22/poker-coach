import { describe, expect, it } from 'vitest'
import { comboCount, handClassAt, handClassGrid, parseRange } from './range'

describe('parseRange', () => {
  it('single pair, suited and offsuit', () => {
    const r = parseRange('AA,AKs,AKo')
    expect([...r].sort()).toEqual(['AA', 'AKo', 'AKs'])
  })

  it('pair plus expands upward', () => {
    expect([...parseRange('JJ+')].sort()).toEqual(['AA', 'JJ', 'KK', 'QQ'])
  })

  it('suited plus raises the kicker up to one below the high card', () => {
    expect([...parseRange('A9s+')].sort()).toEqual(['A9s', 'AJs', 'AKs', 'AQs', 'ATs'])
    expect([...parseRange('QTs+')].sort()).toEqual(['QJs', 'QTs'])
  })

  it('offsuit plus', () => {
    expect([...parseRange('KJo+')].sort()).toEqual(['KJo', 'KQo'])
  })

  it('dash ranges for pairs and connectors', () => {
    expect([...parseRange('66-88')].sort()).toEqual(['66', '77', '88'])
    expect([...parseRange('T9s-65s')].sort()).toEqual(['65s', '76s', '87s', '98s', 'T9s'])
  })

  it('ignores whitespace and empty parts', () => {
    expect(parseRange(' AA , KK ,').size).toBe(2)
  })

  it('rejects garbage', () => {
    expect(() => parseRange('ZZ')).toThrow()
    expect(() => parseRange('AKx')).toThrow()
  })
})

describe('combos', () => {
  it('pair=6, suited=4, offsuit=12', () => {
    expect(comboCount(parseRange('AA'))).toBe(6)
    expect(comboCount(parseRange('AKs'))).toBe(4)
    expect(comboCount(parseRange('AKo'))).toBe(12)
  })

  it('whole deck is 1326 combos', () => {
    const all = handClassGrid().flat()
    expect(comboCount(new Set(all))).toBe(1326)
  })
})

describe('grid', () => {
  it('pairs on diagonal, suited above, offsuit below', () => {
    expect(handClassAt(0, 0)).toBe('AA')
    expect(handClassAt(0, 1)).toBe('AKs')
    expect(handClassAt(1, 0)).toBe('AKo')
    expect(handClassAt(12, 12)).toBe('22')
    expect(handClassAt(11, 12)).toBe('32s')
  })
})
