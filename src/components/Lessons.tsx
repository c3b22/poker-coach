import { useState } from 'react'
import { LESSONS } from '../data/lessons'
import type { Topic } from '../poker/drill'

export function Lessons({ onPractice }: { onPractice: (topic: Topic) => void }) {
  const [openId, setOpenId] = useState<string>(LESSONS[0].id)
  return (
    <section className="panel">
      <h2>บทเรียน</h2>
      <p className="muted">อ่านสั้น ๆ แล้วไปฝึกโจทย์หัวข้อนั้นต่อทันที</p>
      {LESSONS.map((lesson) => {
        const open = lesson.id === openId
        return (
          <article key={lesson.id} className={`lesson ${open ? 'open' : ''}`}>
            <h3>
              <button
                className="lesson-head"
                aria-expanded={open}
                aria-controls={`lesson-${lesson.id}`}
                onClick={() => setOpenId(open ? '' : lesson.id)}
              >
                <span>{lesson.title}</span>
                <span className="muted">{lesson.summary}</span>
              </button>
            </h3>
            {open && (
              <div id={`lesson-${lesson.id}`} className="lesson-body">
                {lesson.sections.map((s) => (
                  <section key={s.heading}>
                    <h4>{s.heading}</h4>
                    {s.body.map((p) => (
                      <p key={p}>{p}</p>
                    ))}
                  </section>
                ))}
                <button className="primary" onClick={() => onPractice(lesson.practice[0])}>
                  ไปฝึกโจทย์หัวข้อนี้
                </button>
              </div>
            )}
          </article>
        )
      })}
    </section>
  )
}
