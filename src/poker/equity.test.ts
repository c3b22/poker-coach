import { describe, expect, it } from 'vitest'
import { parseCards } from './cards'
import { equity, mulberry32 } from './equity'

const hand = (s: string) => parseCards(s)

describe('equity: exact enumeration', () => {
  it('river: made hand beats worse hand 100%', () => {
    const r = equity([hand('As Ad'), hand('Kc Kd')], hand('2h 7c 9d Js 3c'))
    expect(r[0].equity).toBe(1)
    expect(r[1].equity).toBe(0)
  })

  it('river: identical strength splits', () => {
    const r = equity([hand('2c 3d'), hand('2h 3s')], hand('As Ks Qs Js Ts'))
    expect(r[0].equity).toBe(0.5)
    expect(r[0].tie).toBe(1)
  })

  it('turn: counts every out exactly (15 of 44)', () => {
    // Hero Ah5h vs KsKd on 9h 2c Td 4h. Hero wins with: 9 hearts (flush),
    // 3 aces (aces up over kings), 3 non-heart threes (wheel). 9+3+3 = 15.
    const r = equity([hand('Ah 5h'), hand('Ks Kd')], hand('9h 2c Td 4h'))
    expect(r[0].win).toBeCloseTo(15 / 44, 9)
  })

  it('probabilities sum to 1 per hand', () => {
    const r = equity([hand('Qs Qd'), hand('Ac Kc')], hand('2h 7c 9d'))
    for (const x of r) expect(x.win + x.tie + x.lose).toBeCloseTo(1, 9)
  })
})

describe('equity: Monte Carlo preflop', () => {
  it('AA vs KK is about 82/18', () => {
    const r = equity([hand('As Ad'), hand('Kc Kd')], [], { iterations: 20000, rng: mulberry32(1) })
    expect(r[0].equity).toBeGreaterThan(0.8)
    expect(r[0].equity).toBeLessThan(0.84)
  })

  it('AKs vs QQ is a coin flip (≈46/54)', () => {
    const r = equity([hand('As Ks'), hand('Qc Qd')], [], { iterations: 20000, rng: mulberry32(2) })
    expect(r[0].equity).toBeGreaterThan(0.43)
    expect(r[0].equity).toBeLessThan(0.49)
  })

  it('is deterministic for a given seed', () => {
    const run = () => equity([hand('As Ad'), hand('Kc Kd')], [], { iterations: 500, rng: mulberry32(7) })
    expect(run()).toEqual(run())
  })
})

describe('equity: validation', () => {
  it('rejects duplicate cards', () => {
    expect(() => equity([hand('As Ad'), hand('As Kd')], [])).toThrow()
  })
})
