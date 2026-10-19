import { describe, expect, it } from 'vitest'
import { comboCount } from './range'
import { RFI_POSITIONS, facingOpenSpots, preflopAction, rfiRange } from './preflop'

const pct = (set: Set<string>) => comboCount(set) / 1326

describe('RFI ranges', () => {
  it('open wider from later positions (UTG < HJ < CO < BTN)', () => {
    const order = ['UTG', 'HJ', 'CO', 'BTN'] as const
    const sizes = order.map((p) => pct(rfiRange(p)))
    for (let i = 1; i < sizes.length; i++) expect(sizes[i]).toBeGreaterThan(sizes[i - 1])
  })

  it('SB opens wider than HJ but narrower than BTN', () => {
    expect(pct(rfiRange('SB'))).toBeGreaterThan(pct(rfiRange('HJ')))
    expect(pct(rfiRange('SB'))).toBeLessThan(pct(rfiRange('BTN')))
  })

  it('stay in sane 6-max ballparks', () => {
    expect(pct(rfiRange('UTG'))).toBeGreaterThan(0.1)
    expect(pct(rfiRange('UTG'))).toBeLessThan(0.2)
    expect(pct(rfiRange('BTN'))).toBeGreaterThan(0.4)
    expect(pct(rfiRange('BTN'))).toBeLessThan(0.6)
  })

  it('every position opens AA and never opens 72o', () => {
    for (const p of RFI_POSITIONS) {
      expect(rfiRange(p).has('AA')).toBe(true)
      expect(rfiRange(p).has('72o')).toBe(false)
    }
  })

  it('a tighter position range is a subset of the next one for premium hands', () => {
    for (const h of ['AA', 'KK', 'AKs', 'AKo', 'QQ']) {
      for (const p of RFI_POSITIONS) expect(rfiRange(p).has(h)).toBe(true)
    }
  })
})

describe('facing an open', () => {
  it('raise and call never overlap', () => {
    for (const s of facingOpenSpots()) {
      for (const h of s.raise) expect(s.call.has(h), `${s.hero} vs ${s.villain}: ${h}`).toBe(false)
    }
  })

  it('3-bet tighter than calling plus 3-betting, and tighter vs earlier positions', () => {
    const bbVsBtn = facingOpenSpots().find((s) => s.hero === 'BB' && s.villain === 'BTN')!
    const bbVsUtg = facingOpenSpots().find((s) => s.hero === 'BB' && s.villain === 'UTG')!
    expect(comboCount(bbVsBtn.call) + comboCount(bbVsBtn.raise)).toBeGreaterThan(
      comboCount(bbVsUtg.call) + comboCount(bbVsUtg.raise),
    )
  })

  it('preflopAction classifies hands', () => {
    const spot = facingOpenSpots().find((s) => s.hero === 'BB' && s.villain === 'BTN')!
    expect(preflopAction('AA', spot)).toBe('raise')
    expect(preflopAction('76s', spot)).toBe('call')
    expect(preflopAction('72o', spot)).toBe('fold')
  })
})
