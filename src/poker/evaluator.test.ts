import { describe, expect, it } from 'vitest'
import { parseCards } from './cards'
import { Category, categoryOf, evaluate } from './evaluator'

const score = (s: string) => evaluate(parseCards(s))

describe('evaluate: categories', () => {
  const cases: [string, Category][] = [
    ['As Ks Qs Js Ts', Category.StraightFlush],
    ['9c 9d 9h 9s 2c', Category.FourOfAKind],
    ['Kc Kd Kh 2s 2c', Category.FullHouse],
    ['Ac 9c 7c 5c 2c', Category.Flush],
    ['5c 6d 7h 8s 9c', Category.Straight],
    ['Qc Qd Qh 7s 2c', Category.ThreeOfAKind],
    ['Jc Jd 4h 4s 2c', Category.TwoPair],
    ['Ac Ad 7h 5s 2c', Category.Pair],
    ['Ac Jd 7h 5s 2c', Category.HighCard],
  ]
  for (const [hand, cat] of cases) {
    it(`${hand} is category ${cat}`, () => {
      expect(categoryOf(score(hand))).toBe(cat)
    })
  }

  it('wheel (A-5) is a straight, ranked below 6-high', () => {
    expect(categoryOf(score('Ac 2d 3h 4s 5c'))).toBe(Category.Straight)
    expect(score('Ac 2d 3h 4s 5c')).toBeLessThan(score('2c 3d 4h 5s 6c'))
  })

  it('steel wheel is a straight flush', () => {
    expect(categoryOf(score('Ac 2c 3c 4c 5c'))).toBe(Category.StraightFlush)
  })
})

describe('evaluate: comparisons', () => {
  it('higher category beats lower', () => {
    expect(score('2c 2d 2h 3s 3c')).toBeGreaterThan(score('Ac Kc Qc Jc 9c'))
  })

  it('kickers break pair ties', () => {
    expect(score('Ac Ad Kh 5s 2c')).toBeGreaterThan(score('Ac Ad Qh 5s 2c'))
  })

  it('second pair matters in two pair', () => {
    expect(score('Kc Kd 3h 3s 2c')).toBeGreaterThan(score('Kc Kd 2h 2s Ac'))
  })

  it('identical ranks in different suits tie', () => {
    expect(score('Ac Kd 9h 5s 2c')).toBe(score('Ad Kh 9s 5c 2d'))
  })
})

describe('evaluate: 7 cards', () => {
  it('picks the best five of seven', () => {
    expect(categoryOf(score('As Ad Ah 2c 2d 9s 4h'))).toBe(Category.FullHouse)
  })

  it('finds a straight hidden among pairs', () => {
    expect(categoryOf(score('5c 6d 7h 8s 9c 9d 2h'))).toBe(Category.Straight)
  })

  it('prefers flush over straight when both exist', () => {
    expect(categoryOf(score('2h 5h 7h 9h Kh 6c 8d'))).toBe(Category.Flush)
  })

  it('board plays: both players tie', () => {
    const board = 'Ac Kc Qc Jc Tc'
    expect(score(`${board} 2d 3d`)).toBe(score(`${board} 4h 5h`))
  })
})

describe('evaluate: input validation', () => {
  it('rejects fewer than 5 cards', () => {
    expect(() => evaluate(parseCards('As Ks Qs Js'))).toThrow()
  })
})
