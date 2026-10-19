import type { Question } from '../poker/drill'

const q = (x: Omit<Question, 'topic'>): Question => ({ topic: 'postflop', ...x })

const TEXTURE_NOTE =
  'Board แห้ง (dry) คือไพ่ต่างดอก ไม่ต่อเนื่อง หรือมีคู่ ทำให้ draw เกิดยาก ส่วน board เปียก (wet) คือไพ่ดอกเดียวกันหรือเรียงติดกัน มี draw เยอะ'

const texture = (id: string, board: string[], wet: boolean, why: string): Question =>
  q({
    id: `postflop|texture|${id}`,
    prompt: 'Board นี้เป็นแบบไหน?',
    board,
    choices: ['Dry (แห้ง)', 'Wet (เปียก)'],
    correct: wet ? 1 : 0,
    explanation: `${why} ${TEXTURE_NOTE}`,
  })

export const POSTFLOP_QUESTIONS: Question[] = [
  // --- C-bet ---
  q({
    id: 'postflop|cbet|dry-ace-high-miss',
    prompt:
      'คุณ raise จาก BTN แล้ว BB call เหลือสองคน flop ออกมาแล้ว BB check มาที่คุณ (คุณได้ position) ไม่มี pair ไม่มี draw จะทำอย่างไร?',
    cards: ['Kh', 'Qh'],
    board: ['As', '7d', '2c'],
    choices: ['C-bet เล็ก (~1/3 pot)', 'Check', 'C-bet ใหญ่ (pot)'],
    correct: 0,
    explanation:
      'Board A-high แห้งเอื้อ range ของผู้ raise (มี A มากกว่า) bet เล็กราคาถูก ทำให้มือที่แพ้ fold ได้บ่อย และคุณมี overcard K Q ไว้ช่วยเมื่อโดน call',
  }),
  q({
    id: 'postflop|cbet|wet-low-connected',
    prompt:
      'คุณ raise จาก CO แล้ว BB call เหลือสองคน flop ออกมา BB check มาที่คุณ คุณมีแค่ high card จะทำอย่างไร? (แนวทางทั่วไป ไม่ใช่ GTO)',
    cards: ['Ad', 'Kc'],
    board: ['9h', '8h', '7s'],
    choices: ['C-bet เล็ก (~1/3 pot)', 'Check', 'C-bet ใหญ่ (pot)'],
    correct: 1,
    explanation:
      'Board ต่ำและเรียงติดกันเอื้อ range ของคนที่ call (มี 87, 98, 76 และ draw เยอะ) มือคุณไม่มี pair หรือ draw แข็ง การ bet จะโดน call หรือ raise จากมือที่แรงกว่า check เพื่อดู card ถัดไปในราคาฟรี',
  }),
  q({
    id: 'postflop|cbet|multiway-air',
    prompt:
      'คุณ raise จาก UTG แล้วมี 3 คน call (รวมสี่คน) flop ออกมา ทุกคน check มาที่คุณ คุณยังไม่ได้ pair จะทำอย่างไร?',
    cards: ['Ah', 'Qd'],
    board: ['Kd', '8c', '3s'],
    choices: ['C-bet เล็ก (~1/3 pot)', 'Check', 'C-bet ใหญ่ (pot)'],
    correct: 1,
    explanation:
      'ยิ่งมีคนอยู่ในมือเยอะ โอกาสที่ทุกคน fold ก็ยิ่งต่ำ (ต้องมีคนมี K หรือ pair อย่างน้อยหนึ่งคน) การ bluff c-bet ในหลายคนจึงควรลดลงมาก',
  }),
  q({
    id: 'postflop|cbet|value-tptk',
    prompt:
      'คุณ raise จาก BTN แล้ว BB call เหลือสองคน flop ออกมา BB check มาที่คุณ คุณได้ top pair kicker แรงสุด จะทำอย่างไร?',
    cards: ['As', 'Kd'],
    board: ['Kh', '7d', '2c'],
    choices: ['Check', 'Bet ~1/2 pot (value)', 'All-in'],
    correct: 1,
    explanation:
      'คุณมีมือแรงที่ยังโดน call ได้จากมือที่แพ้ (K เล็ก, pair 7 ไป ฯลฯ) bet ขนาดกลางเก็บ value ได้ ส่วน all-in จะทำให้เหลือแต่มือที่ชนะคุณ call',
  }),

  // --- Board texture ---
  texture('A72r', ['As', '7d', '2c'], false, 'A-7-2 ต่างดอกทั้งหมด ไม่เรียงกัน'),
  texture('987hh', ['9h', '8h', '7s'], true, '9-8-7 เรียงติดกันและมีสองใบดอกเดียวกัน'),
  texture('KK4', ['Kd', 'Kc', '4s'], false, 'Board คู่ ต่างดอก ไม่มี straight draw'),
  texture('JT6ss', ['Js', 'Ts', '6d'], true, 'J-T ติดกันและสองใบเป็นโพดำ draw ทั้ง straight และ flush'),
  texture('852mono', ['8d', '6d', '5d'], true, 'ดอกเดียวกันทั้งสามใบและเรียงใกล้กัน'),
  texture('K72r', ['Kh', '7d', '2c'], false, 'K-7-2 ต่างดอก ห่างกัน draw ยาก'),

  // --- Value vs bluff ---
  q({
    id: 'postflop|value|river-tptk',
    prompt:
      'River ถึงแล้ว คุณอยู่ในตำแหน่ง BTN คู่ต่อสู้ (BB) check มาที่คุณ pot มี 100 chips คุณมี top pair kicker แรงสุดบน board แห้ง จะทำอย่างไร?',
    cards: ['As', 'Kd'],
    board: ['Kc', '7d', '2s', '5h', '9c'],
    choices: ['Bet ~2/3 pot', 'Check back'],
    correct: 0,
    explanation:
      'ถามตัวเองว่า "มือที่แพ้เรายังจะ call ไหม" ถ้าใช่ (K เล็ก, pair 9/7) ให้ bet เก็บ value ขนาด 1/2–2/3 pot กำลังดี',
  }),
  q({
    id: 'postflop|value|river-underpair',
    prompt:
      'River ถึงแล้ว คุณอยู่ในตำแหน่ง BTN คู่ต่อสู้ check มาที่คุณ คุณมีแค่ pair เล็กที่ต่ำกว่า board (underpair) จะทำอย่างไร?',
    cards: ['7s', '7d'],
    board: ['Ac', 'Kd', '9h', '4s', '2c'],
    choices: ['Bet ~2/3 pot', 'Check back'],
    correct: 1,
    explanation:
      'ถ้า bet มือที่แพ้จะ fold และมือที่ชนะจะ call มือคุณมี showdown value พอจะชนะ bluff บางส่วนอยู่แล้ว การ check back เก็บ showdown ไว้ดีกว่า',
  }),
  q({
    id: 'postflop|bluff|blocker',
    prompt:
      'River ถึงแล้ว board ดอกเดียวกันสามใบ (มี flush) คุณพลาด draw ทุกอย่างและไม่มี pair คู่ต่อสู้ check มา คุณจะ bluff ด้วยมือไหนดีกว่ากัน?',
    board: ['9s', '7s', '3s', 'Kd', '2h'],
    choices: ['A♠ 5♦ (ถือ A โพดำ)', '8♦ 6♦'],
    correct: 0,
    explanation:
      'A♠ เป็น blocker ของ nut flush ทำให้คู่ต่อสู้มี nut flush น้อยลงและมีโอกาส call ต่ำลง bluff ที่ดีควรถือไพ่ที่ block มือแรงของคู่ต่อสู้',
  }),
  q({
    id: 'postflop|catch|half-pot',
    prompt:
      'River ถึงแล้ว pot 100 chips คู่ต่อสู้ bet 50 คุณมี bluff-catcher (ชนะเฉพาะตอนเขา bluff) คุณคิดว่าเขา bluff ราว 30% ของเวลา จะ call หรือ fold?',
    choices: ['Call', 'Fold'],
    correct: 0,
    explanation:
      'Bet 50 เข้า pot 100 คุณต้องมี equity อย่างน้อย 50 ÷ (100 + 2×50) = 25% ถ้าเขา bluff 30% ซึ่งมากกว่า 25% การ call จึงมี EV เป็นบวก',
  }),
  q({
    id: 'postflop|catch|full-pot',
    prompt:
      'River ถึงแล้ว pot 100 chips คู่ต่อสู้ bet 100 (เท่า pot) คุณมี bluff-catcher คุณคิดว่าเขา bluff ราว 20% ของเวลา จะ call หรือ fold?',
    choices: ['Call', 'Fold'],
    correct: 1,
    explanation:
      'Bet เท่า pot คุณต้องมี equity อย่างน้อย 100 ÷ (100 + 2×100) = 33% แต่เขา bluff แค่ 20% จึงขาดทุนถ้า call ควร fold',
  }),
]
