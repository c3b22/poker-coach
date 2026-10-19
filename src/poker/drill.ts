import { facingOpenSpots, preflopAction, rfiRange, RFI_POSITIONS } from './preflop'
import { comboCount, handClassGrid } from './range'
import type { HandClass } from './range'

export type Topic = 'rfi' | 'facing-open' | 'pot-odds'
export const TOPICS: readonly Topic[] = ['rfi', 'facing-open', 'pot-odds']
export const TOPIC_LABEL: Record<Topic, string> = {
  rfi: 'Preflop: เปิดเกม (RFI)',
  'facing-open': 'Preflop: เจอคน raise',
  'pot-odds': 'Pot odds และ outs',
}

/** A fully serialisable question, so missed ones can be stored and replayed. */
export interface Question {
  id: string
  topic: Topic
  prompt: string
  /** Hole cards to show, e.g. ['As', 'Kd']. */
  cards?: string[]
  choices: string[]
  correct: number
  explanation: string
  /** Chips lost by each choice versus the best one (only when it can be computed). */
  evLoss?: number[]
  meta?: Record<string, string | number>
}

type Rng = () => number

const SUITS = 'cdhs'
const GRID = handClassGrid().flat()

const pick = <T>(items: readonly T[], rng: Rng): T => items[Math.floor(rng() * items.length)]
const pct = (x: number, digits = 0) => `${(x * 100).toFixed(digits)}%`

/** Concrete hole cards for a hand class such as "AKs" or "77". */
export function dealHand(cls: HandClass, rng: Rng): [string, string] {
  const [r1, r2, kind] = cls
  const suits = [...SUITS]
  const first = suits.splice(Math.floor(rng() * suits.length), 1)[0]
  const second = kind === 's' ? first : pick(suits, rng)
  return [r1 + first, r2 + second]
}

/** Equity needed to call: you risk `bet` to win `pot + bet` (pot is before the bet). */
export const requiredEquity = (pot: number, bet: number) => bet / (pot + 2 * bet)

/** Exact chance to hit at least one of `outs` cards, ignoring implied odds. */
export function drawEquity(outs: number, street: 'flop' | 'turn'): number {
  if (street === 'turn') return outs / 46
  return 1 - ((47 - outs) / 47) * ((46 - outs) / 46)
}

export function generateQuestion(topic: Topic, rng: Rng): Question {
  switch (topic) {
    case 'rfi':
      return rfiQuestion(rng)
    case 'facing-open':
      return facingOpenQuestion(rng)
    case 'pot-odds':
      return potOddsQuestion(rng)
  }
}

function rfiQuestion(rng: Rng): Question {
  const position = pick(RFI_POSITIONS, rng)
  const range = rfiRange(position)
  const wantOpen = rng() < 0.5
  const pool = wantOpen ? [...range] : GRID.filter((h) => !range.has(h))
  const hand = pick(pool, rng)
  const inRange = range.has(hand)
  const share = comboCount(range) / 1326
  return {
    id: `rfi|${position}|${hand}`,
    topic: 'rfi',
    prompt: `6-max, stack 100bb ทุกคนก่อนคุณ fold มาถึงคุณที่ ${position} จะ raise เปิดหรือ fold?`,
    cards: dealHand(hand, rng),
    choices: ['Raise', 'Fold'],
    correct: inRange ? 0 : 1,
    explanation: `${hand} ${inRange ? 'อยู่ใน' : 'ไม่อยู่ใน'}ช่วงเปิดของ ${position} (เปิดประมาณ ${pct(share)} ของมือทั้งหมด) จึงควร ${inRange ? 'raise' : 'fold'}`,
    meta: { position, hand },
  }
}

function facingOpenQuestion(rng: Rng): Question {
  const spot = pick(facingOpenSpots(), rng)
  const fold = GRID.filter((h) => !spot.raise.has(h) && !spot.call.has(h))
  const buckets = [
    { action: 'raise' as const, hands: [...spot.raise] },
    { action: 'call' as const, hands: [...spot.call] },
    { action: 'fold' as const, hands: fold },
  ].filter((b) => b.hands.length > 0)
  const bucket = pick(buckets, rng)
  const hand = pick(bucket.hands, rng)
  const action = preflopAction(hand, spot)
  const choices = ['Raise (3-bet)', 'Call', 'Fold']
  const label = { raise: 'raise (3-bet)', call: 'call', fold: 'fold' }[action]
  return {
    id: `facing-open|${spot.hero}|${spot.villain}|${hand}`,
    topic: 'facing-open',
    prompt: `6-max, stack 100bb ${spot.villain} raise เปิดมา ทุกคนที่เหลือ fold คุณอยู่ที่ ${spot.hero} จะทำอะไร?`,
    cards: dealHand(hand, rng),
    choices,
    correct: choices.findIndex((c) => c.toLowerCase().startsWith(action)),
    explanation: `${spot.hero} เจอ ${spot.villain} เปิด: ${hand} อยู่ในกลุ่มที่ควร ${label} (3-bet ${pct(comboCount(spot.raise) / 1326, 1)}, call ${pct(comboCount(spot.call) / 1326, 1)} ของมือทั้งหมด)`,
    meta: { hero: spot.hero, villain: spot.villain, hand },
  }
}

const BET_FRACTIONS = [1 / 3, 1 / 2, 2 / 3, 3 / 4, 1]
/** Skip spots this close to break-even: the answer would hinge on implied odds, not maths. */
const MIN_MARGIN = 0.03

function potOddsQuestion(rng: Rng): Question {
  for (let attempt = 0; attempt < 1000; attempt++) {
    const pot = (2 + Math.floor(rng() * 19)) * 10
    const bet = Math.max(1, Math.round(pot * pick(BET_FRACTIONS, rng)))
    const street = rng() < 0.5 ? 'flop' : 'turn'
    const outs = 2 + Math.floor(rng() * 14)
    const equity = drawEquity(outs, street)
    const need = requiredEquity(pot, bet)
    if (Math.abs(equity - need) < MIN_MARGIN) continue

    const callEv = equity * (pot + bet) - (1 - equity) * bet
    const shouldCall = callEv > 0
    const round2 = (x: number) => Math.round(x * 100) / 100
    const rule = street === 'flop' ? outs * 4 : outs * 2
    return {
      id: `pot-odds|${pot}|${bet}|${street}|${outs}`,
      topic: 'pot-odds',
      prompt: `Pot ${pot} chips คู่ต่อสู้ bet ${bet} คุณมี draw ${outs} outs บน${street === 'flop' ? ' flop (เหลือ 2 ใบ)' : ' turn (เหลือ 1 ใบ)'} ไม่นับ implied odds ควร call หรือ fold?`,
      choices: ['Call', 'Fold'],
      correct: shouldCall ? 0 : 1,
      explanation: `ต้องมี equity อย่างน้อย ${pct(need, 1)} (bet ÷ (pot + 2×bet)) แต่ ${outs} outs ให้ ${pct(equity, 1)} (rule of ${street === 'flop' ? '4' : '2'} ประมาณ ${rule}%) จึงควร ${shouldCall ? 'call' : 'fold'} (EV ของ call ${callEv >= 0 ? '+' : ''}${round2(callEv)} chips)`,
      evLoss: shouldCall ? [0, round2(callEv)] : [round2(-callEv), 0],
      meta: { pot, bet, outs, street, equity },
    }
  }
  throw new Error('Could not generate a pot-odds question')
}
