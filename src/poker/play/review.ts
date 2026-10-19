import { type Card, cardToString, fullDeck } from '../cards'
import { mulberry32 } from '../equity'
import { evaluate } from '../evaluator'
import { preflopAction } from '../preflop'
import type { Position } from '../preflop'
import { handClassOfHole, parseRange } from '../range'
import type { HandClass } from '../range'
import { actionProbabilities, facingSpot, preflopContext, rfiOf, sameAction } from './bot'
import { BIG_BLIND, applyAction, legalActions, newHand, positionOf, potOf } from './engine'
import type { Action, ActionRecord, HandState, Street } from './engine'
import { chenScore, comboKey } from './strength'

export type Verdict = 'good' | 'marginal' | 'mistake' | 'ungraded'
/** What sort of decision it was, for per-kind accuracy. */
export type DecisionKind = 'preflop-open' | 'preflop-defend' | 'postflop-callfold'

export type MistakeCategory =
  | 'preflop-open-missed'
  | 'preflop-open-too-loose'
  | 'preflop-limp'
  | 'preflop-defend-fold'
  | 'preflop-defend-too-loose'
  | 'preflop-3bet-mismatch'
  | 'postflop-fold-too-much'
  | 'postflop-call-too-much'

export const CATEGORY_LABEL: Record<MistakeCategory, string> = {
  'preflop-open-missed': 'ไม่เปิด (fold) มือที่ควร raise first-in',
  'preflop-open-too-loose': 'เปิดมือที่อยู่นอก range',
  'preflop-limp': 'Limp แทนที่จะ raise หรือ fold',
  'preflop-defend-fold': 'Fold มือที่ควรสู้ต่อเมื่อเจอคน raise',
  'preflop-defend-too-loose': 'สู้ต่อด้วยมือที่ควร fold เมื่อเจอคน raise',
  'preflop-3bet-mismatch': 'เลือก call / 3-bet สลับกับตาราง',
  'postflop-fold-too-much': 'Fold ทั้งที่ call แล้วได้กำไร',
  'postflop-call-too-much': 'Call ทั้งที่ equity ไม่พอ',
}

export const KIND_LABEL: Record<DecisionKind, string> = {
  'preflop-open': 'Preflop: เปิดเกม',
  'preflop-defend': 'Preflop: เจอคน raise',
  'postflop-callfold': 'Postflop: call/fold เมื่อเจอ bet (heads-up)',
}

export interface DecisionReview {
  /** Index of the action in hand.actions. */
  index: number
  street: Street
  seat: number
  taken: ActionRecord
  verdict: Verdict
  kind: DecisionKind | null
  category: MistakeCategory | null
  recommended: string | null
  explanation: string
  /** Estimated EV given up, in big blinds (postflop call/fold only). */
  evLossBB: number | null
  /** The call was close to break-even or just past the edge of a range. */
  borderline: boolean
  hole: string[]
  board: string[]
  /** Chips in the pot and chips to call when the decision was made. */
  pot: number
  toCall: number
}

export interface ReviewSummary {
  graded: number
  good: number
  marginal: number
  mistakes: number
  ungraded: number
  evLostBB: number
}

export interface HandReview {
  heroSeat: number
  decisions: DecisionReview[]
  summary: ReviewSummary
}

const bb = (chips: number) => `${Math.round((chips / BIG_BLIND) * 10) / 10}`
const pct = (x: number) => `${Math.round(x * 100)}%`

// ---------------------------------------------------------------------------
// Replay and range inference

const toAction = (a: ActionRecord): Action => (a.type === 'raise' ? { type: 'raise', to: a.to } : { type: a.type as 'fold' | 'check' | 'call' })

/** Re-deals the hand and replays it; `befores[i]` is the state just before `hand.actions[i]`. */
export function replayStates(hand: HandState): { befores: HandState[]; final: HandState } {
  let s = newHand({
    button: hand.button,
    seed: hand.seed,
    deal: { holes: hand.players.map((p) => p.hole), board: hand.runout },
  })
  const befores: HandState[] = []
  for (const a of hand.actions) {
    befores.push(s)
    if (a.type !== 'blind') s = applyAction(s, toAction(a))
  }
  return { befores, final: s }
}

/**
 * Which hole cards would have made `seat` play the way it did up to action `upTo`?
 * Each hand is weighted by the product of the bot policy's probability of every action it took.
 */
export function inferRange(
  befores: HandState[],
  actions: ActionRecord[],
  seat: number,
  upTo: number,
  heroHole: [Card, Card],
): Map<number, number> {
  const dead = new Set<Card>([...befores[upTo].board, ...heroHole])
  const live = fullDeck().filter((c) => !dead.has(c))
  const observed = actions
    .slice(0, upTo)
    .map((a, i) => ({ taken: toAction(a), i, own: a.seat === seat && a.type !== 'blind' }))
    .filter((x) => x.own)

  const weights = new Map<number, number>()
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const combo: [Card, Card] = [live[i], live[j]]
      let w = 1
      for (const { taken, i: idx } of observed) {
        w *= actionProbabilities(befores[idx], combo).find((x) => sameAction(x.action, taken))?.p ?? 0
        if (w === 0) break
      }
      if (w > 0) weights.set(comboKey(live[i], live[j]), w)
    }
  }
  return weights
}

const FLOP_RUNOUT_SAMPLES = 150

/** Hero's equity against a weighted set of hands, using exact runouts on the turn and river and samples on the flop. */
function equityVsRange(hero: [Card, Card], board: Card[], weights: Map<number, number>, seed: number): number {
  const maxWeight = Math.max(...weights.values())
  const combos = [...weights]
    .filter(([, w]) => w >= maxWeight * 1e-3)
    .map(([key, w]) => ({ a: Math.floor(key / 52), b: key % 52, w }))

  const dead = new Set<Card>([...hero, ...board])
  const deck = fullDeck().filter((c) => !dead.has(c))
  const need = 5 - board.length
  let runouts: Card[][]
  if (need === 0) runouts = [[]]
  else if (need === 1) runouts = deck.map((c) => [c])
  else {
    const rng = mulberry32(seed)
    runouts = []
    for (let k = 0; k < FLOP_RUNOUT_SAMPLES; k++) {
      const i = Math.floor(rng() * deck.length)
      let j = Math.floor(rng() * (deck.length - 1))
      if (j >= i) j++
      runouts.push([deck[i], deck[j]])
    }
  }
  const heroScores = runouts.map((r) => evaluate([...hero, ...board, ...r]))

  let total = 0
  let weightSum = 0
  for (const { a, b, w } of combos) {
    let won = 0
    let seen = 0
    runouts.forEach((r, k) => {
      if (r.includes(a) || r.includes(b)) return
      const villain = evaluate([a, b, ...board, ...r])
      won += heroScores[k] > villain ? 1 : heroScores[k] === villain ? 0.5 : 0
      seen++
    })
    if (seen === 0) continue
    total += w * (won / seen)
    weightSum += w
  }
  return total / weightSum
}

// ---------------------------------------------------------------------------
// Preflop

type Graded = Pick<DecisionReview, 'verdict' | 'kind' | 'category' | 'recommended' | 'explanation' | 'evLossBB' | 'borderline'>

const ungraded = (explanation: string): Graded => ({
  verdict: 'ungraded',
  kind: null,
  category: null,
  recommended: null,
  explanation,
  evLossBB: null,
  borderline: false,
})

type OpenPosition = 'UTG' | 'HJ' | 'CO' | 'BTN' | 'SB'
const PREMIUM = parseRange('TT+,AJs+,KQs,AQo+')
/** The next-tighter and next-wider opening ranges, to tell a borderline hand from a clear one. */
const TIGHTER: Record<OpenPosition, Set<HandClass>> = {
  UTG: PREMIUM,
  HJ: rfiOf('UTG'),
  CO: rfiOf('HJ'),
  BTN: rfiOf('CO'),
  SB: rfiOf('HJ'),
}
const WIDER: Record<OpenPosition, Set<HandClass> | null> = {
  UTG: rfiOf('HJ'),
  HJ: rfiOf('CO'),
  CO: rfiOf('BTN'),
  BTN: null,
  SB: rfiOf('BTN'),
}

function gradeFirstIn(pos: OpenPosition, cls: HandClass, taken: ActionRecord): Graded {
  const shouldOpen = rfiOf(pos).has(cls)
  const recommended = shouldOpen ? 'Raise' : 'Fold'
  const rule = `${cls} ${shouldOpen ? 'อยู่ใน' : 'ไม่อยู่ใน'}ช่วงเปิดของ ${pos} ในตาราง`
  const kind: DecisionKind = 'preflop-open'
  const matches = taken.type === 'raise' ? shouldOpen : taken.type === 'fold' ? !shouldOpen : false

  if (matches) {
    return { verdict: 'good', kind, category: null, recommended, explanation: `${rule} → ${recommended.toLowerCase()} ถูกตามตาราง`, evLossBB: null, borderline: false }
  }

  const borderline = shouldOpen
    ? !TIGHTER[pos].has(cls)
    : (WIDER[pos]?.has(cls) ?? chenScore(cls) >= 4)
  const category: MistakeCategory =
    taken.type === 'call' ? 'preflop-limp' : shouldOpen ? 'preflop-open-missed' : 'preflop-open-too-loose'
  const what = taken.type === 'call' ? 'limp' : taken.type
  return {
    verdict: borderline ? 'marginal' : 'mistake',
    kind,
    category,
    recommended,
    explanation: `${rule} ตารางแนะนำ ${recommended.toLowerCase()} แต่คุณ ${what}${borderline ? ' (มืออยู่ใกล้ขอบ range จึงเป็นข้อก้ำกึ่ง)' : ''}`,
    evLossBB: null,
    borderline,
  }
}

const ACTION_LABEL = { raise: 'Raise (3-bet)', call: 'Call', fold: 'Fold' } as const

function gradeFacingOpen(hero: Position, opener: Position, cls: HandClass, taken: ActionRecord): Graded {
  const spot = facingSpot(hero, opener)!
  const expected = preflopAction(cls, spot)
  const did = taken.type === 'raise' ? 'raise' : taken.type === 'call' ? 'call' : 'fold'
  const kind: DecisionKind = 'preflop-defend'
  const recommended = ACTION_LABEL[expected]
  const rule = `${hero} เจอ ${opener} เปิด: ตารางแนะนำ ${recommended} กับ ${cls}`

  if (did === expected) {
    return { verdict: 'good', kind, category: null, recommended, explanation: `${rule} คุณทำตามตาราง`, evLossBB: null, borderline: false }
  }

  const c = chenScore(cls)
  let verdict: 'marginal' | 'mistake'
  let category: MistakeCategory
  if (expected === 'raise' && did === 'fold') [verdict, category] = ['mistake', 'preflop-defend-fold']
  else if (expected === 'call' && did === 'fold') [verdict, category] = [c >= 8 ? 'mistake' : 'marginal', 'preflop-defend-fold']
  else if (expected === 'fold') [verdict, category] = [c <= 4 ? 'mistake' : 'marginal', 'preflop-defend-too-loose']
  else [verdict, category] = ['marginal', 'preflop-3bet-mismatch'] // raise <-> call
  return {
    verdict,
    kind,
    category,
    recommended,
    explanation: `${rule} แต่คุณ ${did}${verdict === 'marginal' ? ' (ก้ำกึ่ง: ไม่ผิดร้ายแรง)' : ''}`,
    evLossBB: null,
    borderline: verdict === 'marginal',
  }
}

function gradePreflop(before: HandState, seat: number, taken: ActionRecord): Graded {
  const pos = positionOf(seat, before.button)
  const cls = handClassOfHole(...before.players[seat].hole)
  const { raises, calls } = preflopContext(before)

  if (raises.length === 0 && calls === 0 && pos !== 'BB') return gradeFirstIn(pos, cls, taken)

  if (raises.length === 1 && calls === 0) {
    const opener = positionOf(raises[0].seat, before.button)
    if (facingSpot(pos, opener)) return gradeFacingOpen(pos, opener, cls, taken)
    return ungraded(`ไม่ตัดสิน: ยังไม่มีตารางสำหรับ ${pos} เจอ ${opener} เปิด`)
  }
  if (raises.length === 0) return ungraded('ไม่ตัดสิน: pot ที่มีคน limp ยังไม่มีตาราง')
  return ungraded('ไม่ตัดสิน: เจอ 3-bet ขึ้นไป หรือมีคน call แล้ว ยังไม่มีตารางสำหรับสปอตนี้')
}

// ---------------------------------------------------------------------------
// Postflop

const CLOSE_TO_BREAKEVEN = 0.04

function gradePostflop(
  hand: HandState,
  befores: HandState[],
  index: number,
  seat: number,
  taken: ActionRecord,
): Graded {
  const before = befores[index]
  const alive = before.players.filter((p) => !p.folded)
  const la = legalActions(before)!

  if (alive.length > 2) return ungraded('ไม่ตัดสิน: มีหลายคนใน pot (multiway) ประเมิน equity ได้ไม่แม่นพอ')
  if (la.toCall === 0) return ungraded('ไม่ตัดสิน: การ bet / check ที่ไม่มีใคร bet ใส่ ขึ้นกับการอ่านคนและขนาด bet')
  if (taken.type === 'raise') return ungraded('ไม่ตัดสิน: การ raise ขึ้นกับการอ่านคน (ตรวจเฉพาะ call หรือ fold)')

  const villain = alive.find((p) => p.seat !== seat)!
  const hero = before.players[seat].hole
  const weights = inferRange(befores, hand.actions, villain.seat, index, hero)
  const equity = equityVsRange(hero, before.board, weights, hand.seed + index)
  const pot = potOf(before)
  const need = la.toCall / (pot + la.toCall)
  // Winning takes the pot (which already holds the bet); losing costs the call. Later streets are ignored.
  const ev = equity * pot - (1 - equity) * la.toCall
  const shouldCall = ev > 0
  const did = taken.type === 'call'
  const recommended = shouldCall ? 'Call' : 'Fold'
  const kind: DecisionKind = 'postflop-callfold'
  const borderline = Math.abs(equity - need) < CLOSE_TO_BREAKEVEN
  const maths =
    `เทียบกับ range ที่ บอท ${villain.seat} น่าจะถือเมื่อเล่นแบบนี้ equity ของคุณประมาณ ${pct(equity)} ` +
    `ส่วนที่ต้องมีเพื่อ call ${bb(la.toCall)}bb เข้า pot ${bb(pot)}bb คือ ${pct(need)} ` +
    `EV ของ call ≈ ${ev >= 0 ? '+' : ''}${bb(ev)}bb (ไม่นับ implied odds และการ bet ถนนถัดไป)`

  if (did === shouldCall) {
    return { verdict: 'good', kind, category: null, recommended, explanation: `${maths} → ${recommended.toLowerCase()} ถูกต้อง`, evLossBB: null, borderline }
  }
  const evLossBB = Math.round((Math.abs(ev) / BIG_BLIND) * 10) / 10
  return {
    verdict: evLossBB >= 1 ? 'mistake' : 'marginal',
    kind,
    category: shouldCall ? 'postflop-fold-too-much' : 'postflop-call-too-much',
    recommended,
    explanation: `${maths} → ควร ${recommended.toLowerCase()}${borderline ? ' (ใกล้จุดคุ้มทุน)' : ''}`,
    evLossBB,
    borderline,
  }
}

// ---------------------------------------------------------------------------

/** Reviews every decision `heroSeat` made in a finished hand. */
export function reviewHand(hand: HandState, heroSeat: number): HandReview {
  const { befores } = replayStates(hand)
  const decisions: DecisionReview[] = []

  hand.actions.forEach((taken, index) => {
    if (taken.seat !== heroSeat || taken.type === 'blind') return
    const before = befores[index]
    const graded =
      taken.street === 'preflop' ? gradePreflop(before, heroSeat, taken) : gradePostflop(hand, befores, index, heroSeat, taken)
    decisions.push({
      index,
      street: taken.street,
      seat: heroSeat,
      taken,
      ...graded,
      hole: before.players[heroSeat].hole.map(cardToString),
      board: before.board.map(cardToString),
      pot: potOf(before),
      toCall: legalActions(before)!.toCall,
    })
  })

  const count = (v: Verdict) => decisions.filter((d) => d.verdict === v).length
  const good = count('good')
  const marginal = count('marginal')
  const mistakes = count('mistake')
  return {
    heroSeat,
    decisions,
    summary: {
      graded: good + marginal + mistakes,
      good,
      marginal,
      mistakes,
      ungraded: count('ungraded'),
      evLostBB: decisions.reduce((n, d) => n + (d.evLossBB ?? 0), 0),
    },
  }
}
