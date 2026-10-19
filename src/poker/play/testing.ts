import { fullDeck, parseCards } from '../cards'
import { mulberry32 } from '../equity'
import { chooseAction } from './bot'
import { applyAction, legalActions, newHand } from './engine'
import type { Action, HandState } from './engine'

/** Test helpers: build deals and play hands out with a scripted hero and optional scripted bots. */

/** Button on seat 0. Gives `seat` the given hole cards and fills the other seats with unused cards. */
export function setup(seat: number, hole: string, board = 'Js 7d 2c 9h Kd'): HandState {
  const mine = parseCards(hole)
  const boardCards = parseCards(board)
  const used = new Set([...mine, ...boardCards])
  const spare = fullDeck().filter((c) => !used.has(c))
  const holes = Array.from({ length: 6 }, (_, i) =>
    i === seat ? (mine as [number, number]) : ([spare.pop()!, spare.pop()!] as [number, number]),
  )
  return newHand({ button: 0, seed: 1, deal: { holes, board: boardCards } })
}

export const fold: Action = { type: 'fold' }
export const check: Action = { type: 'check' }
export const call: Action = { type: 'call' }
export const raise = (to: number): Action => ({ type: 'raise', to })

/**
 * Plays a hand to the end. The hero follows `heroPlan` (then checks or folds), bots follow `script`
 * when it returns an action and their own policy otherwise.
 */
export function runHand(opts: {
  heroSeat: number
  hole: string
  board?: string
  heroPlan: Action[]
  script?: (s: HandState) => Action | null
}): HandState {
  let s = setup(opts.heroSeat, opts.hole, opts.board)
  const plan = [...opts.heroPlan]
  const rng = mulberry32(5)
  while (s.result === null) {
    if (s.toAct === opts.heroSeat) {
      const fallback: Action = legalActions(s)!.canCheck ? check : fold
      s = applyAction(s, plan.shift() ?? fallback)
    } else {
      s = applyAction(s, opts.script?.(s) ?? chooseAction(s, rng))
    }
  }
  return s
}
