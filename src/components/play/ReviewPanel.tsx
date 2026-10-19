import { BIG_BLIND } from '../../poker/play/engine'
import type { ActionRecord, Street } from '../../poker/play/engine'
import { CATEGORY_LABEL } from '../../poker/play/review'
import type { DecisionReview, HandReview, Verdict } from '../../poker/play/review'
import { PlayingCard } from '../PlayingCard'
import { bb } from './format'

const VERDICT: Record<Verdict, { symbol: string; label: string }> = {
  good: { symbol: '✓', label: 'ถูก' },
  marginal: { symbol: '!', label: 'ก้ำกึ่ง' },
  mistake: { symbol: '✕', label: 'พลาด' },
  ungraded: { symbol: '–', label: 'ไม่ตัดสิน' },
}

const STREET: Record<Street, string> = { preflop: 'Preflop', flop: 'Flop', turn: 'Turn', river: 'River' }

function takenText(a: ActionRecord): string {
  switch (a.type) {
    case 'raise':
      return `raise to ${bb(a.to)}bb${a.allIn ? ' (all-in)' : ''}`
    case 'call':
      return `call ${bb(a.amount)}bb${a.allIn ? ' (all-in)' : ''}`
    default:
      return a.type
  }
}

function Decision({ d }: { d: DecisionReview }) {
  const v = VERDICT[d.verdict]
  return (
    <li className={`rv-item rv-${d.verdict}`}>
      <div className="rv-top">
        <span className="rv-badge">
          <span aria-hidden="true">{v.symbol}</span> {v.label}
        </span>
        <strong>{STREET[d.street]}</strong>
        <span className="muted rv-pot">
          pot {bb(d.pot)}bb{d.toCall > 0 ? ` · ต้อง call ${bb(d.toCall)}bb` : ''}
        </span>
      </div>
      <div className="rv-cards" aria-label="ไพ่ของคุณและ board">
        {d.hole.map((c) => (
          <PlayingCard key={c} code={c} />
        ))}
        {d.board.length > 0 && <span className="rv-sep" aria-hidden="true" />}
        {d.board.map((c) => (
          <PlayingCard key={c} code={c} />
        ))}
      </div>
      <p className="rv-line">
        คุณ: <strong>{takenText(d.taken)}</strong>
        {d.recommended && (
          <>
            {' '}
            · ควร: <strong>{d.recommended}</strong>
          </>
        )}
      </p>
      <p className="rv-why">{d.explanation}</p>
      {d.category && d.verdict !== 'good' && <p className="muted rv-cat">ประเภท: {CATEGORY_LABEL[d.category]}</p>}
      {d.evLossBB !== null && d.evLossBB > 0 && <p className="rv-ev">EV ที่เสียโดยประมาณ ~{d.evLossBB}bb</p>}
    </li>
  )
}

export function ReviewPanel({ review, title = 'รีวิวมือนี้' }: { review: HandReview; title?: string }) {
  const s = review.summary
  return (
    <section className="rv" aria-label={title}>
      <h3>{title}</h3>
      <p className="rv-summary" role="status">
        {s.graded === 0 ? (
          <>มือนี้ไม่มีจุดที่ตัดสินได้</>
        ) : (
          <>
            ตัดสินได้ {s.graded} จุด: ถูก <strong>{s.good}</strong> · ก้ำกึ่ง <strong>{s.marginal}</strong> · พลาด{' '}
            <strong>{s.mistakes}</strong>
            {s.evLostBB > 0 && <> · EV ที่เสียโดยประมาณ ~{Math.round(s.evLostBB * 10) / 10}bb</>}
          </>
        )}
        {s.ungraded > 0 && <span className="muted"> (ไม่ตัดสิน {s.ungraded} จุด)</span>}
      </p>
      <ol className="rv-list">
        {review.decisions.map((d) => (
          <Decision key={d.index} d={d} />
        ))}
      </ol>
      <p className="muted rv-note">
        คะแนนนี้วัดเทียบกับบอทตัวนี้ (ประเมิน range จาก policy ของบอท) และตาราง preflop ที่เป็นค่าประมาณ ไม่ใช่ GTO
        ตัดสินเฉพาะ preflop ที่มีตาราง และ call/fold ตอน heads-up ส่วนขนาด bet และ bluff ไม่ตัดสิน 1bb ={' '}
        {BIG_BLIND} chips
      </p>
    </section>
  )
}
