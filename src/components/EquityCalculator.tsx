import { useState } from 'react'
import { cardToString, parseCard } from '../poker/cards'
import { equity } from '../poker/equity'
import type { Equity } from '../poker/equity'
import { PlayingCard } from './PlayingCard'

const SLOTS = ['h1', 'h2', 'v1', 'v2', 'b1', 'b2', 'b3', 'b4', 'b5'] as const
type Slot = (typeof SLOTS)[number]
type Hand = Record<Slot, string | null>

const SLOT_LABEL: Record<Slot, string> = {
  h1: 'ไพ่ใบที่ 1',
  h2: 'ไพ่ใบที่ 2',
  v1: 'ไพ่ใบที่ 1',
  v2: 'ไพ่ใบที่ 2',
  b1: 'Flop 1',
  b2: 'Flop 2',
  b3: 'Flop 3',
  b4: 'Turn',
  b5: 'River',
}

const RANKS = [...'AKQJT98765432']
const SUIT_ROWS = [
  { code: 's', symbol: '♠', red: false },
  { code: 'h', symbol: '♥', red: true },
  { code: 'd', symbol: '♦', red: true },
  { code: 'c', symbol: '♣', red: false },
]

const empty = (): Hand => Object.fromEntries(SLOTS.map((s) => [s, null])) as Hand
const pct = (x: number) => `${(x * 100).toFixed(1)}%`

export function EquityCalculator() {
  const [hand, setHand] = useState<Hand>(empty)
  const [selected, setSelected] = useState<Slot>('h1')
  const [result, setResult] = useState<[Equity, Equity] | null>(null)
  const [busy, setBusy] = useState(false)

  const used = new Set(SLOTS.map((s) => hand[s]).filter((c): c is string => c !== null))
  const board = (['b1', 'b2', 'b3', 'b4', 'b5'] as const).map((s) => hand[s]).filter((c): c is string => c !== null)
  const boardOk = [0, 3, 4, 5].includes(board.length) && board.every((_, i) => hand[`b${i + 1}` as Slot] !== null)
  const ready = hand.h1 && hand.h2 && hand.v1 && hand.v2 && boardOk

  const pickCard = (code: string) => {
    const next = { ...hand, [selected]: code }
    setHand(next)
    setResult(null)
    const after = SLOTS.slice(SLOTS.indexOf(selected) + 1).find((s) => next[s] === null)
    if (after) setSelected(after)
  }

  const clearAll = () => {
    setHand(empty())
    setSelected('h1')
    setResult(null)
  }

  const calculate = () => {
    if (!ready) return
    setBusy(true)
    // Let the "calculating" state paint before the synchronous Monte Carlo run.
    setTimeout(() => {
      const [a, b] = equity(
        [
          [parseCard(hand.h1!), parseCard(hand.h2!)],
          [parseCard(hand.v1!), parseCard(hand.v2!)],
        ],
        board.map(parseCard),
        { iterations: 30000 },
      )
      setResult([a, b])
      setBusy(false)
    }, 20)
  }

  const slotButton = (s: Slot) => (
    <button
      key={s}
      className={`slot ${selected === s ? 'picked' : ''}`}
      onClick={() => setSelected(s)}
      aria-label={`${SLOT_LABEL[s]}${hand[s] ? `: ${hand[s]}` : ' (ว่าง)'}`}
      aria-pressed={selected === s}
    >
      {hand[s] ? <PlayingCard code={hand[s]!} /> : <span className="slot-empty">{SLOT_LABEL[s]}</span>}
    </button>
  )

  return (
    <section className="panel">
      <h2>Equity calculator</h2>
      <p className="muted">เลือกช่อง แล้วแตะไพ่ที่ต้องการ ไม่ใส่ board = คำนวณก่อน flop (สุ่ม 30,000 ครั้ง)</p>

      <div className="eq-row">
        <div>
          <h3>คุณ</h3>
          <div className="slots">{(['h1', 'h2'] as const).map(slotButton)}</div>
        </div>
        <div>
          <h3>คู่ต่อสู้</h3>
          <div className="slots">{(['v1', 'v2'] as const).map(slotButton)}</div>
        </div>
      </div>
      <h3>Board (ไม่บังคับ)</h3>
      <div className="slots">{(['b1', 'b2', 'b3', 'b4', 'b5'] as const).map(slotButton)}</div>

      <div className="picker" role="group" aria-label="เลือกไพ่">
        {SUIT_ROWS.map((suit) =>
          RANKS.map((r) => {
            const code = r + suit.code
            return (
              <button
                key={code}
                className={`pick-card ${suit.red ? 'red' : ''}`}
                disabled={used.has(code)}
                onClick={() => pickCard(code)}
                aria-label={cardToString(parseCard(code))}
              >
                {r === 'T' ? '10' : r}
                {suit.symbol}
              </button>
            )
          }),
        )}
      </div>

      <div className="controls">
        <button className="primary" onClick={calculate} disabled={!ready || busy}>
          {busy ? 'กำลังคำนวณ...' : 'คำนวณ equity'}
        </button>
        <button className="choice" onClick={clearAll}>
          ล้างทั้งหมด
        </button>
        {!ready && <span className="muted">ใส่ไพ่ให้ครบ 2 มือ และ board 0, 3, 4 หรือ 5 ใบ</span>}
      </div>

      {result && (
        <div className="eq-result" role="status">
          {(['คุณ', 'คู่ต่อสู้'] as const).map((who, i) => (
            <div key={who}>
              <div className="eq-label">
                <strong>{who}</strong> <span>{pct(result[i].equity)}</span>
                <span className="muted">
                  {' '}
                  (ชนะ {pct(result[i].win)}, เสมอ {pct(result[i].tie)})
                </span>
              </div>
              <div className="bar">
                <div className={`bar-fill ${i === 0 ? 'hero' : 'villain'}`} style={{ width: pct(result[i].equity) }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
