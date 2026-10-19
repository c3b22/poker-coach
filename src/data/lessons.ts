import type { Topic } from '../poker/drill'

export interface Lesson {
  id: string
  title: string
  summary: string
  sections: { heading: string; body: string[] }[]
  /** Topics to practise after reading; the first one is opened by the practice button. */
  practice: Topic[]
}

export const LESSONS: Lesson[] = [
  {
    id: 'hand-ranking',
    title: '1. Hand ranking และ equity',
    summary: 'อันดับไพ่ วิธีตัดสินผู้ชนะ และความหมายของ equity',
    practice: ['basics'],
    sections: [
      {
        heading: 'อันดับไพ่จากสูงไปต่ำ',
        body: [
          'Straight flush > Four of a kind > Full house > Flush > Straight > Three of a kind > Two pair > One pair > High card',
          'ใน Texas Hold\'em คุณใช้ไพ่ 5 ใบที่ดีที่สุดจากไพ่ 7 ใบ (ไพ่ในมือ 2 ใบ + board 5 ใบ) จะใช้ไพ่ในมือกี่ใบก็ได้ รวมถึงศูนย์ใบ (เล่น board)',
          'Straight ต่ำสุดคือ A-2-3-4-5 (wheel) ซึ่งต่ำกว่า straight 2-3-4-5-6',
        ],
      },
      {
        heading: 'เมื่อ hand เหมือนกัน',
        body: [
          'ถ้าประเภทเดียวกัน ให้เทียบไพ่ที่สูงกว่าก่อน เช่น pair เอซชนะ pair คิง',
          'ถ้ายังเท่ากัน ให้เทียบ kicker (ไพ่ที่เหลือ) เช่น A♠K♦ กับ A♥Q♦ บน board A-7-2-5-9 ทั้งคู่มี pair เอซ แต่ K สูงกว่า Q จึงชนะ',
          'ถ้าไพ่ 5 ใบที่ดีที่สุดเหมือนกันทุกใบ ผลคือเสมอและแบ่ง pot ดอก (suit) ไม่มีผลต่ออันดับ',
        ],
      },
      {
        heading: 'Equity คืออะไร',
        body: [
          'Equity คือสัดส่วนของ pot ที่คุณคาดว่าจะได้ ถ้าไพ่ที่เหลือถูกเปิดจนจบมือ เช่น AA ต่อ KK ก่อน flop ชนะประมาณ 82% (equity ≈ 82%)',
          'ผลเสมอนับเป็นครึ่งหนึ่งหรือหนึ่งส่วนตามจำนวนคนที่เสมอ ลองหา equity ของมือต่าง ๆ ได้ในแท็บ "เครื่องมือ"',
        ],
      },
    ],
  },
  {
    id: 'position-preflop',
    title: '2. Position และ preflop ranges',
    summary: 'ทำไมตำแหน่งสำคัญ และควรเปิดหรือรับมือ raise ด้วยมือแบบไหน',
    practice: ['rfi', 'facing-open'],
    sections: [
      {
        heading: 'ตำแหน่งบนโต๊ะ 6-max',
        body: [
          'ตามลำดับการพูดก่อน flop: UTG → HJ → CO → BTN → SB → BB หลัง flop SB พูดก่อนและ BTN พูดหลังสุด',
          'ยิ่งพูดทีหลังยิ่งได้ข้อมูลเพิ่ม (คนอื่นทำอะไรไปแล้ว) จึงเล่นมือที่อ่อนกว่าได้ ดังนั้น range ที่เปิดจาก BTN กว้างกว่า UTG มาก',
        ],
      },
      {
        heading: 'RFI (Raise First In)',
        body: [
          'ถ้าทุกคนก่อนหน้า fold ให้ raise (ประมาณ 2.5–3 bb) หรือ fold โดยไม่ต้อง limp',
          'ในตารางของแอป UTG เปิดประมาณ 12% ของมือ, CO ประมาณ 21%, BTN ประมาณ 42% ส่วน SB (ที่ต้องเจอ BB ด้วย) ประมาณ 33% แคบกว่า BTN',
        ],
      },
      {
        heading: 'เมื่อมีคน raise มาก่อน',
        body: [
          'มีสามทางเลือก: 3-bet (raise ต่อ), call หรือ fold มือแรงจริงและบางมือที่ block มือแรง (เช่น A5s) ใช้ 3-bet ส่วนมือกลาง ๆ ที่เล่น postflop ได้ดี (pair กลาง suited connector) ใช้ call',
          'BB ปิด action และจ่ายเพียงส่วนต่างจาก blind จึง defend กว้างที่สุด ส่วนคนที่เหลือต้องแคบกว่า โดยเฉพาะเมื่อเจอคนเปิดจากตำแหน่งต้น',
          'ตารางทั้งหมดเป็นแนวทางโดยประมาณ ไม่ใช่ GTO ใช้เป็นจุดเริ่มต้น แล้วค่อยปรับตามคู่ต่อสู้',
        ],
      },
    ],
  },
  {
    id: 'pot-odds',
    title: '3. Pot odds, outs และ rule of 2 and 4',
    summary: 'คำนวณว่าคุ้มไหมที่จะ call เมื่อกำลังรอ draw',
    practice: ['pot-odds'],
    sections: [
      {
        heading: 'Pot odds และ equity ที่ต้องมี',
        body: [
          'ถ้าคู่ต่อสู้ bet B เข้า pot P (ก่อน bet) คุณจ่าย B เพื่อชิง P + B equity ขั้นต่ำที่ต้องมีเพื่อให้ call ไม่ขาดทุนคือ B ÷ (P + 2B)',
          'ตัวอย่าง pot 100 คู่ต่อสู้ bet 50 → 50 ÷ 200 = 25% ถ้า bet เท่า pot → 100 ÷ 300 = 33%',
        ],
      },
      {
        heading: 'นับ outs',
        body: [
          'Out คือไพ่ที่เหลือในสำรับที่ช่วยให้คุณได้มือที่ชนะ เช่น flush draw มี 9 outs, open-ended straight draw มี 8 outs, gutshot มี 4 outs',
          'อย่านับ out ซ้ำ และระวังไพ่ที่ทำให้คู่ต่อสู้ได้มือที่ดีกว่าด้วย',
        ],
      },
      {
        heading: 'Rule of 4 and 2',
        body: [
          'บน flop (เหลือสองใบ) นำ outs × 4 ได้ equity โดยประมาณ ส่วนบน turn (เหลือหนึ่งใบ) นำ outs × 2',
          'ค่าจริง: 9 outs บน flop ≈ 35% (rule of 4 ให้ 36%) บน turn ≈ 19.6% (rule of 2 ให้ 18%) ยิ่ง outs เยอะ rule of 4 จะยิ่งประมาณเกินจริงเล็กน้อย',
          'โจทย์ในแอปนี้ไม่คิด implied odds (เงินที่จะได้เพิ่มเมื่อเข้า) และเลี่ยงกรณีที่ใกล้จุดคุ้มทุนเกินไป',
        ],
      },
    ],
  },
  {
    id: 'postflop',
    title: '4. Postflop: c-bet, board texture, value vs bluff',
    summary: 'อ่านลักษณะ board และตัดสินใจว่าจะ bet เพื่ออะไร',
    practice: ['postflop'],
    sections: [
      {
        heading: 'Board texture',
        body: [
          'Dry board (เช่น A-7-2 ต่างดอก) draw เกิดยาก มือที่แรงอยู่ตรงข้ามกันชัด ส่วน wet board (เช่น 9♥8♥7♠) มี straight และ flush draw เยอะ equity ของแต่ละมือเปลี่ยนเร็ว',
          'Board ที่มีไพ่สูง (A, K) เอื้อคนที่ raise ก่อน flop เพราะ range ของเขามี A, K มากกว่า ส่วน board ต่ำและเรียงกันเอื้อคนที่ call',
        ],
      },
      {
        heading: 'C-bet (continuation bet)',
        body: [
          'C-bet คือการ bet ต่อบน flop ของคนที่ raise ก่อน flop โดยปกติ: board แห้งและเอื้อเรา → bet บ่อยด้วยขนาดเล็ก (~1/3 pot), board เปียกหรือเล่นหลายคน → check มากขึ้นและ bet เฉพาะมือที่มีเหตุผล',
          'ขนาดเล็กใช้ได้เมื่อ range ของเรามีข้อได้เปรียบ ขนาดใหญ่เมื่ออยากเก็บ value จากมือแรงหรือกดดันมือ draw',
        ],
      },
      {
        heading: 'Value, bluff และ bluff-catcher',
        body: [
          'Value bet: bet เมื่อมือที่แพ้เรายังจะ call ได้ ถ้ามีแต่มือที่ชนะเราที่ call ก็ไม่ควร bet',
          'Bluff: เลือกมือที่ไม่มี showdown value และดีที่สุดคือมือที่ block ไพ่แรงของคู่ต่อสู้ (เช่น ถือ A ของดอกที่ board ครบ flush)',
          'Bluff-catcher: เมื่อโดน bet ใช้สูตร pot odds เดิม ถ้าคู่ต่อสู้ bet ขนาดเท่า pot เขาต้อง bluff อย่างน้อย 33% ของเวลา คุณถึงจะ call ได้คุ้ม',
        ],
      },
    ],
  },
]
