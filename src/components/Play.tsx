import { useEffect, useRef, useState } from 'react'
import { mulberry32 } from '../poker/equity'
import { chooseAction } from '../poker/play/bot'
import { START_STACK, applyAction, newHand, SEATS } from '../poker/play/engine'
import type { Action, HandState } from '../poker/play/engine'
import { ActionBar } from './play/ActionBar'
import { HERO, bb, describeActions, seatName } from './play/format'
import { TableView } from './play/TableView'

const BOT_DELAY_MS = 600
const ODDS_KEY = 'poker-coach:show-odds'

const dealHand = (n: number) => newHand({ button: n % SEATS, seed: Math.floor(Math.random() * 2 ** 31) })

const botMove = (h: HandState) => applyAction(h, chooseAction(h, mulberry32(h.seed + h.actions.length)))

/** Once the hero folds nothing more to watch: play the bots out instantly. */
function finishWithBots(h: HandState): HandState {
  let s = h
  while (s.result === null) s = botMove(s)
  return s
}

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

export function Play() {
  const [handNo, setHandNo] = useState(0)
  const [hand, setHand] = useState(() => dealHand(0))
  const [session, setSession] = useState({ hands: 0, net: 0 })
  const [showOdds, setShowOdds] = useState(() => readFlag(ODDS_KEY))
  const counted = useRef<number | null>(null)

  // Bots act one at a time with a short pause so the hand can be followed.
  useEffect(() => {
    if (hand.result || hand.toAct === null || hand.toAct === HERO) return
    const t = setTimeout(() => setHand(botMove), BOT_DELAY_MS)
    return () => clearTimeout(t)
  }, [hand])

  // Add each finished hand to the session total exactly once.
  useEffect(() => {
    if (!hand.result || counted.current === hand.seed) return
    counted.current = hand.seed
    const net = hand.players[HERO].stack - START_STACK
    setSession((s) => ({ hands: s.hands + 1, net: s.net + net }))
  }, [hand])

  const act = (a: Action) => setHand((h) => (a.type === 'fold' ? finishWithBots(applyAction(h, a)) : applyAction(h, a)))

  const nextHand = () => {
    setHandNo((n) => n + 1)
    setHand(dealHand(handNo + 1))
  }

  const toggleOdds = (on: boolean) => {
    setShowOdds(on)
    try {
      localStorage.setItem(ODDS_KEY, on ? '1' : '0')
    } catch {
      // Preference just won't persist.
    }
  }

  const result = hand.result
  const heroNet = hand.players[HERO].stack - START_STACK
  const heroTurn = hand.toAct === HERO

  return (
    <section className="panel">
      <h2>เล่นจริง</h2>
      <p className="muted">
        เล่นทีละมือกับบอท 5 ตัว ชิปจำลอง stack 100bb ทุกมือ · มือที่ {session.hands + (result ? 0 : 1)} · ผลรวม session{' '}
        <strong>
          {session.net >= 0 ? '+' : ''}
          {bb(session.net)}bb
        </strong>
      </p>

      <label className="pa-toggle">
        <input type="checkbox" checked={showOdds} onChange={(e) => toggleOdds(e.target.checked)} />
        แสดง pot odds ระหว่างเล่น
      </label>

      <TableView hand={hand} />

      {!result && heroTurn && <ActionBar key={hand.actions.length} hand={hand} showOdds={showOdds} onAction={act} />}
      {!result && !heroTurn && (
        <p className="pa-wait" role="status">
          รอ {seatName(hand.toAct ?? 0)} ตัดสินใจ…
        </p>
      )}

      {result && (
        <div className={`feedback ${heroNet < 0 ? 'wrong' : ''}`} role="status">
          <strong>
            {heroNet > 0 ? `คุณชนะ +${bb(heroNet)}bb` : heroNet < 0 ? `คุณเสีย ${bb(heroNet)}bb` : 'คุณเสมอตัว 0bb'}
          </strong>
          <p>
            ผู้ชนะ: {result.winners.map(seatName).join(', ')}
            {result.showdown ? ' (เปิดไพ่)' : ' (คนอื่น fold หมด)'}
          </p>
          <button className="primary" onClick={nextHand} autoFocus>
            เริ่มมือใหม่
          </button>
        </div>
      )}

      <details className="pt-log">
        <summary>ประวัติการเล่นมือนี้</summary>
        <ol>
          {describeActions(hand.actions).map(({ record, text }, i) => (
            <li key={i}>
              <span className="muted">{record.street}</span> {seatName(record.seat)} {text}
            </li>
          ))}
        </ol>
      </details>
    </section>
  )
}
