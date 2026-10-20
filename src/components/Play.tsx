import { useEffect, useRef, useState } from 'react'
import { mulberry32 } from '../poker/equity'
import { chooseAction } from '../poker/play/bot'
import { START_STACK, applyAction, newHand, SEATS } from '../poker/play/engine'
import type { Action, HandState } from '../poker/play/engine'
import { clearPlayData, loadPlayData, makeHandRecord, recordHand, savePlayData } from '../poker/play/playHistory'
import { reviewHand } from '../poker/play/review'
import type { HandReview } from '../poker/play/review'
import { ActionBar } from './play/ActionBar'
import { HERO, bb, describeActions, seatName } from './play/format'
import { PlayHistory } from './play/PlayHistory'
import { ReviewPanel } from './play/ReviewPanel'
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

type View = 'table' | 'history'

export function Play() {
  const [view, setView] = useState<View>('table')
  const [handNo, setHandNo] = useState(0)
  const [hand, setHand] = useState(() => dealHand(0))
  const [session, setSession] = useState({ hands: 0, net: 0 })
  const [showOdds, setShowOdds] = useState(() => readFlag(ODDS_KEY))
  const [data, setData] = useState(() => loadPlayData(localStorage))
  const [review, setReview] = useState<HandReview | null>(null)
  const tableRef = useRef<HTMLDivElement>(null)
  const counted = useRef<number | null>(null)
  const reviewed = useRef<number | null>(null)

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

  // Review the finished hand once, after the result has painted, and keep it in the history.
  useEffect(() => {
    if (!hand.result || reviewed.current === hand.seed) return
    const t = setTimeout(() => {
      reviewed.current = hand.seed
      const r = reviewHand(hand, HERO)
      setReview(r)
      setData((d) => {
        const next = recordHand(d, makeHandRecord(hand, r, HERO, Date.now()))
        savePlayData(localStorage, next)
        return next
      })
    }, 30)
    return () => clearTimeout(t)
  }, [hand])

  const act = (a: Action) => setHand((h) => (a.type === 'fold' ? finishWithBots(applyAction(h, a)) : applyAction(h, a)))

  const nextHand = () => {
    setHandNo((n) => n + 1)
    setReview(null)
    setHand(dealHand(handNo + 1))
    // Bring the fresh table fully into view so the whole hand fits on screen.
    tableRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }

  const toggleOdds = (on: boolean) => {
    setShowOdds(on)
    try {
      localStorage.setItem(ODDS_KEY, on ? '1' : '0')
    } catch {
      // Preference just won't persist.
    }
  }

  const clearHistory = () => {
    clearPlayData(localStorage)
    setData(loadPlayData(localStorage))
  }

  const result = hand.result
  const heroNet = hand.players[HERO].stack - START_STACK
  const heroTurn = hand.toAct === HERO

  return (
    <section className="panel play">
      <h2 className="pa-title">เล่นจริง</h2>
      <div className="pa-head">
        <p className="muted">
          <span className="pa-desc">เล่นทีละมือกับบอท 5 ตัว ชิปจำลอง stack 100bb ทุกมือ · </span>มือที่ {session.hands + (result ? 0 : 1)} ·
          ผลรวม session{' '}
          <strong>
            {session.net >= 0 ? '+' : ''}
            {bb(session.net)}bb
          </strong>
        </p>
        {view === 'table' && (
          <label className="pa-toggle">
            <input type="checkbox" checked={showOdds} onChange={(e) => toggleOdds(e.target.checked)} />
            แสดง pot odds
          </label>
        )}
      </div>

      <div className="seg" role="tablist" aria-label="มุมมอง">
        <button role="tab" aria-selected={view === 'table'} className={view === 'table' ? 'on' : ''} onClick={() => setView('table')}>
          โต๊ะ
        </button>
        <button role="tab" aria-selected={view === 'history'} className={view === 'history' ? 'on' : ''} onClick={() => setView('history')}>
          ประวัติและสถิติ
        </button>
      </div>

      {view === 'history' && <PlayHistory data={data} onClear={clearHistory} />}

      {view === 'table' && (
        <>
          <div ref={tableRef} className="pt-wrap">
            <TableView hand={hand} />
          </div>

          <div className="pa-dock">
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
          </div>

          {result && !review && (
            <p className="pa-wait" role="status">
              กำลังวิเคราะห์มือนี้…
            </p>
          )}
          {result && review && <ReviewPanel review={review} />}

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
        </>
      )}
    </section>
  )
}
