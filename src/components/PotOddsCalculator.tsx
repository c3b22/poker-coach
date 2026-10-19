import { useState } from 'react'
import { drawEquity, requiredEquity } from '../poker/drill'

const pct = (x: number) => `${(x * 100).toFixed(1)}%`

export function PotOddsCalculator() {
  const [pot, setPot] = useState(100)
  const [bet, setBet] = useState(50)
  const [outs, setOuts] = useState(9)
  const [street, setStreet] = useState<'flop' | 'turn'>('flop')

  const valid = pot > 0 && bet > 0 && outs >= 0 && outs <= 20
  const need = valid ? requiredEquity(pot, bet) : 0
  const have = valid ? drawEquity(outs, street) : 0
  const callEv = have * (pot + bet) - (1 - have) * bet

  return (
    <section className="panel">
      <h2>Pot odds calculator</h2>
      <p className="muted">Pot คือเงินกลางก่อนคู่ต่อสู้ bet (ไม่นับ implied odds)</p>
      <div className="controls">
        <label>
          Pot
          <input type="number" min={1} value={pot} onChange={(e) => setPot(Number(e.target.value))} />
        </label>
        <label>
          Bet
          <input type="number" min={1} value={bet} onChange={(e) => setBet(Number(e.target.value))} />
        </label>
        <label>
          Outs
          <input type="number" min={0} max={20} value={outs} onChange={(e) => setOuts(Number(e.target.value))} />
        </label>
        <label>
          Street
          <select value={street} onChange={(e) => setStreet(e.target.value as 'flop' | 'turn')}>
            <option value="flop">Flop (เหลือ 2 ใบ)</option>
            <option value="turn">Turn (เหลือ 1 ใบ)</option>
          </select>
        </label>
      </div>
      {valid ? (
        <ul className="calc-out" role="status">
          <li>
            Equity ที่ต้องมี: <strong>{pct(need)}</strong>
          </li>
          <li>
            Equity จาก {outs} outs: <strong>{pct(have)}</strong>
          </li>
          <li>
            EV ของ call: <strong>{callEv >= 0 ? '+' : ''}{callEv.toFixed(2)} chips</strong> → {callEv > 0 ? 'call ได้' : 'fold'}
          </li>
        </ul>
      ) : (
        <p className="muted">กรอก pot และ bet มากกว่า 0 และ outs 0–20</p>
      )}
    </section>
  )
}
