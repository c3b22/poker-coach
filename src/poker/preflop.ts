import data from '../data/preflop-ranges.json'
import { type HandClass, parseRange } from './range'

export type Position = 'UTG' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB'
export type PreflopAction = 'raise' | 'call' | 'fold'

/** Positions that can open the pot (everyone folds to them), earliest first. */
export const RFI_POSITIONS = ['UTG', 'HJ', 'CO', 'BTN', 'SB'] as const satisfies readonly Position[]

export interface FacingOpenSpot {
  hero: Position
  villain: Position
  raise: Set<HandClass>
  call: Set<HandClass>
}

export const PREFLOP_NOTE: string = data.note

export function rfiRange(pos: (typeof RFI_POSITIONS)[number]): Set<HandClass> {
  return parseRange(data.rfi[pos])
}

export function facingOpenSpots(): FacingOpenSpot[] {
  return data.facingOpen.map((s) => ({
    hero: s.hero as Position,
    villain: s.villain as Position,
    raise: parseRange(s.raise),
    call: parseRange(s.call),
  }))
}

export function preflopAction(hand: HandClass, spot: FacingOpenSpot): PreflopAction {
  if (spot.raise.has(hand)) return 'raise'
  if (spot.call.has(hand)) return 'call'
  return 'fold'
}
