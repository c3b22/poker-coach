import { cardToString } from '../../poker/cards'
import { CATEGORY_LABELS } from '../../poker/drill'
import { categoryOf, evaluate } from '../../poker/evaluator'
import { positionOf, potOf } from '../../poker/play/engine'
import type { HandState, PlayerState } from '../../poker/play/engine'
import { PlayingCard } from '../PlayingCard'
import { HERO, bb, describeActions, seatName } from './format'

function CardBack() {
  return <span className="card back" role="img" aria-label="ไพ่คว่ำ" />
}

function Seat({ hand, player }: { hand: HandState; player: PlayerState }) {
  const { seat } = player
  const isHero = seat === HERO
  const showdown = hand.result?.showdown === true
  const faceUp = isHero || (showdown && !player.folded)
  const won = hand.result?.winners.includes(seat) === true

  const last = describeActions(hand.actions)
    .filter((x) => x.record.seat === seat && x.record.type !== 'blind')
    .at(-1)
  // Show what the seat did on this street (or that it has folded).
  const status = player.folded ? 'fold' : last && last.record.street === hand.street ? last.text : ''
  const toAct = hand.toAct === seat

  return (
    <div
      className={`pt-seat pt-s${seat} ${player.folded ? 'folded' : ''} ${toAct ? 'acting' : ''} ${won ? 'won' : ''}`}
      aria-label={`${seatName(seat)} ${positionOf(seat, hand.button)}`}
    >
      <div className="pt-head">
        <strong>{seatName(seat)}</strong>
        <span className="pt-pos">{positionOf(seat, hand.button)}</span>
        {seat === hand.button && <span className="pt-dealer" title="Dealer button">D</span>}
      </div>
      <div className="pt-cards">
        {player.folded && !isHero ? null : faceUp
          ? player.hole.map((c) => <PlayingCard key={c} code={cardToString(c)} />)
          : [0, 1].map((i) => <CardBack key={i} />)}
      </div>
      <div className="pt-meta">
        <span>{bb(player.stack)}bb</span>
        {player.committed > 0 && !hand.result && !status && <span className="pt-bet">bet {bb(player.committed)}</span>}
        {status && <span className="pt-status">{status}</span>}
      </div>
      {showdown && !player.folded && (
        <div className="pt-hand">{CATEGORY_LABELS[categoryOf(evaluate([...player.hole, ...hand.runout]))]}</div>
      )}
    </div>
  )
}

export function TableView({ hand }: { hand: HandState }) {
  return (
    <div className="pt">
      {hand.players.map((p) => (
        <Seat key={p.seat} hand={hand} player={p} />
      ))}
      <div className="pt-board">
        <div className="pt-cards" aria-label="Board">
          {hand.board.length === 0 && <span className="muted">ยังไม่มีไพ่บน board</span>}
          {hand.board.map((c) => (
            <PlayingCard key={c} code={cardToString(c)} />
          ))}
        </div>
        <div className="pt-pot">Pot {bb(potOf(hand))}bb</div>
      </div>
    </div>
  )
}
