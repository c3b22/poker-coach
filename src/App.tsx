import { useState } from 'react'
import type { ReactNode } from 'react'
import { Drill } from './components/Drill'
import { EquityCalculator } from './components/EquityCalculator'
import { Lessons } from './components/Lessons'
import { PotOddsCalculator } from './components/PotOddsCalculator'
import { RangeViewer } from './components/RangeViewer'
import type { Topic } from './poker/drill'
import './App.css'

type Tab = 'lessons' | 'drill' | 'tools'

const icon = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
)

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  {
    id: 'lessons',
    label: 'บทเรียน',
    icon: icon(
      <>
        <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5z" />
        <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5a1.5 1.5 0 0 1 1.5 1.5z" />
      </>,
    ),
  },
  {
    id: 'drill',
    label: 'ฝึกโจทย์',
    icon: icon(
      <>
        <path d="M5 4h11l3 3v13H5z" />
        <path d="m9 13 2 2 4-4.5" />
      </>,
    ),
  },
  {
    id: 'tools',
    label: 'เครื่องมือ',
    icon: icon(
      <>
        <rect x="5" y="3" width="14" height="18" rx="2" />
        <path d="M8 7h8M8 12h2M14 12h2M8 16h2M14 16h2" />
      </>,
    ),
  },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('lessons')
  const [drillTopic, setDrillTopic] = useState<Topic | 'all'>('all')
  // Bumped on each "practice" jump so Drill remounts with the chosen topic.
  const [drillKey, setDrillKey] = useState(0)

  const practice = (topic: Topic) => {
    setDrillTopic(topic)
    setDrillKey((k) => k + 1)
    setTab('drill')
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            ♠
          </span>
          <div>
            <h1>Poker Coach</h1>
            <p className="brand-sub">ฝึก Texas Hold'em No-Limit 6-max · ชิปจำลอง ไม่มีเงินจริง</p>
          </div>
        </div>
        <nav className="tabs" aria-label="เมนู">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'on' : ''} aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
      </header>
      <main className="app">
        {tab === 'lessons' && <Lessons onPractice={practice} />}
        {tab === 'drill' && <Drill key={drillKey} initialFilter={drillTopic} />}
        {tab === 'tools' && (
          <>
            <EquityCalculator />
            <RangeViewer />
            <PotOddsCalculator />
          </>
        )}
      </main>
    </div>
  )
}
