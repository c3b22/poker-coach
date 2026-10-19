import { RangeViewer } from './components/RangeViewer'
import './App.css'

export default function App() {
  return (
    <main className="app">
      <header>
        <h1>Poker Coach</h1>
        <p className="muted">ฝึก Texas Hold'em No-Limit 6-max (ชิปจำลอง ไม่มีเงินจริง)</p>
      </header>
      <RangeViewer />
    </main>
  )
}
