import { useState } from 'react'
import { CATEGORY_LABEL, KIND_LABEL } from '../../poker/play/review'
import type { DecisionKind, MistakeCategory } from '../../poker/play/review'
import type { HandRecord, PlayData } from '../../poker/play/playHistory'
import { PlayingCard } from '../PlayingCard'
import { bb } from './format'
import { ReviewPanel } from './ReviewPanel'

const KINDS: DecisionKind[] = ['preflop-open', 'preflop-defend', 'postflop-callfold']
const signed = (chips: number) => `${chips > 0 ? '+' : ''}${bb(chips)}bb`

export function PlayHistory({ data, onClear }: { data: PlayData; onClear: () => void }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const s = data.stats

  if (s.hands === 0) {
    return <p className="muted">ยังไม่มีประวัติ เล่นให้จบสักมือแล้วรีวิวจะถูกเก็บไว้ที่นี่ (ในเบราว์เซอร์นี้เท่านั้น)</p>
  }

  const accuracy = s.graded ? Math.round((s.good / s.graded) * 100) : null
  const categories = (Object.entries(s.byCategory) as [MistakeCategory, number][]).sort((a, b) => b[1] - a[1])

  const confirmClear = () => {
    if (window.confirm('ล้างประวัติและสถิติทั้งหมดของโหมดเล่นจริง? ย้อนกลับไม่ได้')) onClear()
  }

  return (
    <div className="ph">
      <h3>สถิติสะสม</h3>
      <ul className="ph-totals">
        <li>
          <span className="muted">มือที่เล่น</span> <strong>{s.hands}</strong>
        </li>
        <li>
          <span className="muted">ผลรวม</span> <strong>{signed(s.netChips)}</strong>
        </li>
        <li>
          <span className="muted">ตัดสินได้ถูก</span> <strong>{accuracy === null ? '–' : `${accuracy}%`}</strong>{' '}
          <span className="muted">
            ({s.good}/{s.graded})
          </span>
        </li>
        <li>
          <span className="muted">EV ที่เสียโดยประมาณ</span> <strong>~{Math.round(s.evLostBB * 10) / 10}bb</strong>
        </li>
      </ul>

      <table className="stats">
        <caption>ความแม่นยำตามประเภทการตัดสินใจ</caption>
        <thead>
          <tr>
            <th>ประเภท</th>
            <th>จุดที่ตัดสิน</th>
            <th>ก้ำกึ่ง</th>
            <th>พลาด</th>
          </tr>
        </thead>
        <tbody>
          {KINDS.map((k) => (
            <tr key={k}>
              <td>{KIND_LABEL[k]}</td>
              <td>{s.byKind[k].total}</td>
              <td>{s.byKind[k].marginal}</td>
              <td>{s.byKind[k].mistake}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {categories.length > 0 && (
        <>
          <h3>ข้อผิดพลาดที่เจอบ่อย</h3>
          <ol className="ph-cats">
            {categories.map(([cat, n]) => (
              <li key={cat}>
                <strong>{n}×</strong> {CATEGORY_LABEL[cat]}
              </li>
            ))}
          </ol>
        </>
      )}

      <h3>{data.hands.length} มือล่าสุด</h3>
      <ul className="ph-list">
        {data.hands.map((h: HandRecord) => {
          const open = openId === h.id
          return (
            <li key={h.id} className={open ? 'open' : ''}>
              <button
                className="ph-row"
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : h.id)}
              >
                <span className="rv-cards">
                  {h.hole.map((c) => (
                    <PlayingCard key={c} code={c} />
                  ))}
                </span>
                <span className="ph-when muted">
                  {new Date(h.at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
                <strong className={h.net < 0 ? 'ph-neg' : ''}>{signed(h.net)}</strong>
                <span className="muted">
                  {h.review.summary.mistakes > 0 ? `พลาด ${h.review.summary.mistakes}` : ''}
                  {h.review.summary.marginal > 0 ? ` ก้ำกึ่ง ${h.review.summary.marginal}` : ''}
                  {h.review.summary.graded === 0 ? 'ไม่มีจุดตัดสิน' : ''}
                </span>
              </button>
              {open && <ReviewPanel review={h.review} title="รีวิวมือนี้ (ย้อนหลัง)" />}
            </li>
          )
        })}
      </ul>

      <button className="choice ph-clear" onClick={confirmClear}>
        ล้างประวัติและสถิติ
      </button>
    </div>
  )
}
