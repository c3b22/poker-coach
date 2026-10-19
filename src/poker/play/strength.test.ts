import { describe, expect, it } from 'vitest'
import { parseCards } from '../cards'
import { handClassOfHole } from '../range'
import { chenScore, strengthOf } from './strength'

const hole = (s: string) => parseCards(s) as [number, number]

describe('handClassOfHole', () => {
  it('names pairs, suited and offsuit hands with the higher card first', () => {
    expect(handClassOfHole(...hole('Ad Ah'))).toBe('AA')
    expect(handClassOfHole(...hole('Ks As'))).toBe('AKs')
    expect(handClassOfHole(...hole('Kd 7c'))).toBe('K7o')
    expect(handClassOfHole(...hole('2h 3h'))).toBe('32s')
  })
})

describe('chenScore', () => {
  it('matches the published formula on known hands', () => {
    expect(chenScore('AA')).toBe(20)
    expect(chenScore('KK')).toBe(16)
    expect(chenScore('QQ')).toBe(14)
    expect(chenScore('AKs')).toBe(12)
    expect(chenScore('AKo')).toBe(10)
    expect(chenScore('76s')).toBe(7)
    expect(chenScore('55')).toBe(6)
  })

  it('rates junk below zero and orders hands sensibly', () => {
    expect(chenScore('72o')).toBeLessThan(0)
    expect(chenScore('AKs')).toBeGreaterThan(chenScore('AKo'))
    expect(chenScore('JTs')).toBeGreaterThan(chenScore('J7o'))
  })
})

describe('strengthOf (post-flop percentile among all hands, draws included)', () => {
  const s = (h: string, board: string) => strengthOf(parseCards(board), hole(h))

  it('sets and better are near the top, air is near the bottom', () => {
    expect(s('Jh Jd', 'Js 7d 2c')).toBeGreaterThan(0.95)
    expect(s('4h 3d', 'Js 7d 2c')).toBeLessThan(0.25)
  })

  it('orders made hands: top pair > middle pair > ace high', () => {
    const board = 'Ks 8d 3c'
    const topPair = s('Kd Qh', board)
    const middlePair = s('8h 5d', board)
    const aceHigh = s('Ah 5s', board)
    expect(topPair).toBeGreaterThan(middlePair)
    expect(middlePair).toBeGreaterThan(aceHigh)
  })

  it('a flush draw is worth more than the same hand without the draw', () => {
    const board = 'Ks 8s 3c'
    expect(s('As 5s', board)).toBeGreaterThan(s('Ah 5d', board))
    expect(s('Qs Js', board)).toBeGreaterThan(s('Qd Jh', board))
  })

  it('has no draw bonus on the river', () => {
    const board = 'Ks 8s 3c 2d 9h'
    expect(s('Ah 5s', board)).toBeCloseTo(s('Ah 5d', board), 9)
  })

  it('stays within [0, 1]', () => {
    const board = parseCards('As Kd 7c')
    for (const h of ['Ah Ad', '2c 3d', 'Qs Js']) {
      const v = strengthOf(board, hole(h))
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })
})
