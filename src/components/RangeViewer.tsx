import { useMemo, useState } from 'react'
import { PREFLOP_NOTE, RFI_POSITIONS, facingOpenSpots, preflopAction, rfiRange } from '../poker/preflop'
import type { PreflopAction } from '../poker/preflop'
import { comboCount, handClassGrid } from '../poker/range'
import type { HandClass } from '../poker/range'

type Mode = 'rfi' | 'facing'

const GRID = handClassGrid()
const ACTION_LABEL: Record<PreflopAction, string> = { raise: 'Raise / 3-bet', call: 'Call', fold: 'Fold' }

export function RangeViewer() {
  const spots = useMemo(() => facingOpenSpots(), [])
  const [mode, setMode] = useState<Mode>('rfi')
  const [pos, setPos] = useState<(typeof RFI_POSITIONS)[number]>('BTN')
  const [spotIdx, setSpotIdx] = useState(0)
  const [picked, setPicked] = useState<HandClass | null>(null)

  const rfi = useMemo(() => rfiRange(pos), [pos])
  const spot = spots[spotIdx]

  const actionOf = (h: HandClass): PreflopAction =>
    mode === 'rfi' ? (rfi.has(h) ? 'raise' : 'fold') : preflopAction(h, spot)

  const pct = (n: number) => `${((n / 1326) * 100).toFixed(1)}%`
  const raiseCombos = comboCount(mode === 'rfi' ? rfi : spot.raise)
  const callCombos = mode === 'rfi' ? 0 : comboCount(spot.call)

  return (
    <section className="panel">
      <h2>Range viewer</h2>
      <p className="muted">{PREFLOP_NOTE}</p>

      <div className="controls">
        <div className="seg" role="tablist" aria-label="โหมด">
          <button className={mode === 'rfi' ? 'on' : ''} onClick={() => setMode('rfi')}>
            เปิดเกม (RFI)
          </button>
          <button className={mode === 'facing' ? 'on' : ''} onClick={() => setMode('facing')}>
            เจอคน raise
          </button>
        </div>

        {mode === 'rfi' ? (
          <label>
            ตำแหน่ง
            <select value={pos} onChange={(e) => setPos(e.target.value as typeof pos)}>
              {RFI_POSITIONS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
        ) : (
          <label>
            สถานการณ์
            <select value={spotIdx} onChange={(e) => setSpotIdx(Number(e.target.value))}>
              {spots.map((s, i) => (
                <option key={i} value={i}>
                  {s.hero} เจอ {s.villain} เปิด
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="legend">
        <span className="chip raise">{ACTION_LABEL.raise} {pct(raiseCombos)}</span>
        {mode === 'facing' && <span className="chip call">{ACTION_LABEL.call} {pct(callCombos)}</span>}
        <span className="chip fold">Fold</span>
      </div>

      <div className="grid13" role="grid" aria-label="ตาราง range 13x13">
        {GRID.flat().map((h) => (
          <button
            key={h}
            className={`cell ${actionOf(h)} ${picked === h ? 'picked' : ''}`}
            onClick={() => setPicked(h)}
            aria-label={`${h}: ${ACTION_LABEL[actionOf(h)]}`}
          >
            {h}
          </button>
        ))}
      </div>

      <p className="pick" aria-live="polite">
        {picked ? (
          <>
            <strong>{picked}</strong> → {ACTION_LABEL[actionOf(picked)]}
          </>
        ) : (
          'แตะช่องเพื่อดูว่าควรทำอะไรกับมือนั้น'
        )}
      </p>
    </section>
  )
}
