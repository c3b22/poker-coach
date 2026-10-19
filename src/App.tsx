import { useState } from 'react'
import { Drill } from './components/Drill'
import { EquityCalculator } from './components/EquityCalculator'
import { Lessons } from './components/Lessons'
import { PotOddsCalculator } from './components/PotOddsCalculator'
import { RangeViewer } from './components/RangeViewer'
import type { Topic } from './poker/drill'
import './App.css'

type Tab = 'lessons' | 'drill' | 'tools'

const TABS: { id: Tab; label: string }[] = [
  { id: 'lessons', label: 'บทเรียน' },
  { id: 'drill', label: 'ฝึกโจทย์' },
  { id: 'tools', label: 'เครื่องมือ' },
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
    <main className="app">
      <header>
        <h1>Poker Coach</h1>
        <p className="muted">ฝึก Texas Hold'em No-Limit 6-max (ชิปจำลอง ไม่มีเงินจริง)</p>
        <nav className="seg" aria-label="เมนู">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'on' : ''} aria-current={tab === t.id} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
      </header>
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
  )
}
