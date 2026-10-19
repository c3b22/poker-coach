import { useState } from 'react'
import { Drill } from './components/Drill'
import { RangeViewer } from './components/RangeViewer'
import './App.css'

type Tab = 'drill' | 'ranges'

export default function App() {
  const [tab, setTab] = useState<Tab>('drill')
  return (
    <main className="app">
      <header>
        <h1>Poker Coach</h1>
        <p className="muted">ฝึก Texas Hold'em No-Limit 6-max (ชิปจำลอง ไม่มีเงินจริง)</p>
        <nav className="seg" aria-label="เมนู">
          <button className={tab === 'drill' ? 'on' : ''} onClick={() => setTab('drill')}>
            ฝึกโจทย์
          </button>
          <button className={tab === 'ranges' ? 'on' : ''} onClick={() => setTab('ranges')}>
            Range viewer
          </button>
        </nav>
      </header>
      {tab === 'drill' ? <Drill /> : <RangeViewer />}
    </main>
  )
}
