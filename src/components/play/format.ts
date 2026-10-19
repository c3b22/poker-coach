import { BIG_BLIND, potOf } from '../../poker/play/engine'
import type { ActionRecord, HandState, LegalActions } from '../../poker/play/engine'

export const HERO = 0

/** Chips are half big blinds; show them as bb. */
export const bb = (chips: number) => `${chips / BIG_BLIND}`

export const seatName = (seat: number) => (seat === HERO ? 'คุณ' : `บอท ${seat}`)

/** One line per action, e.g. "bet 3bb". Postflop, the first raise on a street is called a bet. */
export function describeActions(actions: ActionRecord[]): { record: ActionRecord; text: string }[] {
  let betStreet: string | null = null
  return actions.map((a) => {
    const allIn = a.allIn ? ' (all-in)' : ''
    switch (a.type) {
      case 'blind':
        return { record: a, text: `วาง blind ${bb(a.amount)}bb` }
      case 'fold':
      case 'check':
        return { record: a, text: a.type }
      case 'call':
        return { record: a, text: `call ${bb(a.amount)}bb${allIn}` }
      case 'raise': {
        const opening = a.street !== 'preflop' && betStreet !== a.street
        betStreet = a.street
        return { record: a, text: `${opening ? 'bet' : 'raise to'} ${bb(a.to)}bb${allIn}` }
      }
    }
  })
}

export interface RaisePreset {
  label: string
  to: number
}

/** Quick raise sizes: multiples of the current bet preflop, fractions of the pot afterwards. */
export function raisePresets(state: HandState, la: LegalActions): RaisePreset[] {
  const pot = potOf(state)
  const candidates =
    state.street === 'preflop'
      ? [2.5, 3, 4].map((x) => ({ label: `${x}x`, to: state.currentBet * x }))
      : [1 / 3, 1 / 2, 3 / 4, 1].map((f) => ({
          label: `${Math.round(f * 100)}% pot`,
          to: state.currentBet + f * (pot + la.toCall),
        }))
  const out: RaisePreset[] = []
  for (const c of candidates) {
    const to = Math.min(Math.max(Math.round(c.to), la.minRaiseTo), la.maxRaiseTo)
    if (to >= la.maxRaiseTo) continue // the all-in button covers this
    if (out.some((o) => o.to === to)) continue
    out.push({ label: c.label, to })
  }
  return out
}
