import { useEffect, useState } from 'react'
import { TOPICS, TOPIC_LABEL } from '../poker/drill'
import type { Topic } from '../poker/drill'
import { loadProgress, nextQuestion, recordAnswer, saveProgress } from '../poker/progress'
import { PlayingCard } from './PlayingCard'

type Filter = Topic | 'all'

const accuracy = (correct: number, total: number) => (total ? `${Math.round((correct / total) * 100)}%` : '–')

export function Drill({ initialFilter = 'all' }: { initialFilter?: Filter }) {
  const [progress, setProgress] = useState(() => loadProgress(localStorage))
  const [filter, setFilter] = useState<Filter>(initialFilter)
  const [question, setQuestion] = useState(() => nextQuestion(progress, initialFilter, Math.random))
  const [answered, setAnswered] = useState<number | null>(null)

  useEffect(() => saveProgress(localStorage, progress), [progress])

  const choose = (i: number) => {
    if (answered !== null) return
    setAnswered(i)
    setProgress((p) => recordAnswer(p, question, i))
  }

  const next = (f: Filter = filter) => {
    setQuestion(nextQuestion(progress, f, Math.random))
    setAnswered(null)
  }

  const changeFilter = (f: Filter) => {
    setFilter(f)
    next(f)
  }

  const wasCorrect = answered === question.correct
  const evLost = answered !== null ? question.evLoss?.[answered] : undefined

  return (
    <section className="panel">
      <h2>ฝึกโจทย์</h2>

      <div className="controls">
        <label>
          หัวข้อ
          <select value={filter} onChange={(e) => changeFilter(e.target.value as Filter)}>
            <option value="all">ทุกหัวข้อ</option>
            {TOPICS.map((t) => (
              <option key={t} value={t}>
                {TOPIC_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
        {progress.missed.length > 0 && <span className="chip fold">รอทบทวน {progress.missed.length} ข้อ</span>}
      </div>

      <p className="muted">{TOPIC_LABEL[question.topic]}</p>
      <p className="prompt">{question.prompt}</p>
      {(question.board || question.cards) && (
        <div className="table">
          {question.board && (
            <div className="hand" aria-label="Board">
              {question.board.map((c) => (
                <PlayingCard key={c} code={c} />
              ))}
            </div>
          )}
          <div className="hands">
            {question.cards && (
              <div className="hand" aria-label="ไพ่ในมือคุณ">
                <span className="who">คุณ</span>
                {question.cards.map((c) => (
                  <PlayingCard key={c} code={c} />
                ))}
              </div>
            )}
            {question.villainCards && (
              <div className="hand villain" aria-label="ไพ่ของคู่ต่อสู้">
                <span className="who">คู่ต่อสู้</span>
                {question.villainCards.map((c) => (
                  <PlayingCard key={c} code={c} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="choices">
        {question.choices.map((c, i) => {
          const state = answered === null ? '' : i === question.correct ? 'right' : i === answered ? 'wrong' : 'dim'
          return (
            <button key={c} className={`choice ${state}`} disabled={answered !== null} onClick={() => choose(i)}>
              {c}
            </button>
          )
        })}
      </div>

      {answered !== null && (
        <div className={`feedback ${wasCorrect ? 'right' : 'wrong'}`} role="status">
          <strong>{wasCorrect ? 'ถูกต้อง' : `ไม่ถูก คำตอบคือ ${question.choices[question.correct]}`}</strong>
          <p>{question.explanation}</p>
          {evLost !== undefined && evLost > 0 && <p>EV ที่เสียไปจากคำตอบนี้: {evLost} chips</p>}
          <button className="primary" onClick={() => next()} autoFocus>
            ข้อต่อไป
          </button>
        </div>
      )}

      <table className="stats">
        <caption>สถิติ (เก็บในเบราว์เซอร์นี้)</caption>
        <thead>
          <tr>
            <th>หัวข้อ</th>
            <th>ถูก/ทั้งหมด</th>
            <th>แม่นยำ</th>
          </tr>
        </thead>
        <tbody>
          {TOPICS.map((t) => (
            <tr key={t}>
              <td>{TOPIC_LABEL[t]}</td>
              <td>
                {progress.stats[t].correct}/{progress.stats[t].total}
              </td>
              <td>{accuracy(progress.stats[t].correct, progress.stats[t].total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
