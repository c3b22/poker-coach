const SUIT_SYMBOL: Record<string, string> = { c: '♣', d: '♦', h: '♥', s: '♠' }
const SUIT_NAME: Record<string, string> = { c: 'clubs', d: 'diamonds', h: 'hearts', s: 'spades' }

export function PlayingCard({ code }: { code: string }) {
  const rank = code[0] === 'T' ? '10' : code[0]
  const suit = code[1]
  const red = suit === 'd' || suit === 'h'
  return (
    <span className={`card ${red ? 'red' : 'black'}`} role="img" aria-label={`${rank} of ${SUIT_NAME[suit]}`}>
      <span className="card-corner" aria-hidden="true">
        <span className="card-rank">{rank}</span>
        <span className="card-suit">{SUIT_SYMBOL[suit]}</span>
      </span>
      <span className="card-pip" aria-hidden="true">
        {SUIT_SYMBOL[suit]}
      </span>
    </span>
  )
}
