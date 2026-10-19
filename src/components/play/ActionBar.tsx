import { useState } from 'react'
import { BIG_BLIND, legalActions, potOf } from '../../poker/play/engine'
import type { Action, HandState } from '../../poker/play/engine'
import { bb, raisePresets } from './format'

export function ActionBar({
  hand,
  showOdds,
  onAction,
}: {
  hand: HandState
  showOdds: boolean
  onAction: (a: Action) => void
}) {
  const [custom, setCustom] = useState('')
  const la = legalActions(hand)
  if (!la) return null

  const presets = la.canRaise ? raisePresets(hand, la) : []
  const customTo = Math.round(Number(custom) * BIG_BLIND)
  const customOk = custom !== '' && customTo >= la.minRaiseTo && customTo <= la.maxRaiseTo
  const need = la.callAmount / (potOf(hand) + la.callAmount)
  const verb = hand.currentBet === 0 ? 'Bet' : 'Raise to'

  const send = (a: Action) => {
    setCustom('')
    onAction(a)
  }

  return (
    <div className="pa" role="group" aria-label="การตัดสินใจของคุณ">
      {showOdds && la.canCall && (
        <p className="pa-odds" role="status">
          Call {bb(la.callAmount)}bb เข้า pot {bb(potOf(hand))}bb → ต้องมี equity อย่างน้อย {(need * 100).toFixed(0)}%
        </p>
      )}
      <div className="pa-main">
        <button className="choice" onClick={() => send({ type: 'fold' })}>
          Fold
        </button>
        {la.canCheck && (
          <button className="choice" onClick={() => send({ type: 'check' })}>
            Check
          </button>
        )}
        {la.canCall && (
          <button className="choice" onClick={() => send({ type: 'call' })}>
            Call {bb(la.callAmount)}bb
          </button>
        )}
      </div>
      {la.canRaise && (
        <div className="pa-raise">
          <span className="pa-label">{verb}</span>
          {presets.map((p) => (
            <button key={p.label} className="primary" onClick={() => send({ type: 'raise', to: p.to })}>
              {p.label} <small>({bb(p.to)}bb)</small>
            </button>
          ))}
          <button className="primary" onClick={() => send({ type: 'raise', to: la.maxRaiseTo })}>
            All-in <small>({bb(la.maxRaiseTo)}bb)</small>
          </button>
          <form
            className="pa-custom"
            onSubmit={(e) => {
              e.preventDefault()
              if (customOk) send({ type: 'raise', to: customTo })
            }}
          >
            <label>
              <span className="visually-hidden">จำนวน bb</span>
              <input
                type="number"
                inputMode="decimal"
                step={0.5}
                min={la.minRaiseTo / BIG_BLIND}
                max={la.maxRaiseTo / BIG_BLIND}
                placeholder={`${bb(la.minRaiseTo)}–${bb(la.maxRaiseTo)}`}
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
              />
              <span>bb</span>
            </label>
            <button className="choice" type="submit" disabled={!customOk}>
              ยืนยัน
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
