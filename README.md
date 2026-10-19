# Poker Coach

เว็บแอปฝึก Texas Hold'em No-Limit cash game แบบ 6-max (stack 100bb) ด้วยชิปจำลอง ไม่มีเงินจริง
UI ภาษาไทย คงศัพท์โป๊กเกอร์เป็นภาษาอังกฤษ ทำงานฝั่ง client ทั้งหมด (ไม่มี backend)

## ใช้งาน

```bash
npm install
npm run dev     # เปิดที่ http://localhost:5173
npm test        # Vitest (ตรรกะหลักทั้งหมด)
npm run build   # typecheck + build
```

## มีอะไรบ้าง

- **บทเรียน** 4 หัวข้อ: hand ranking/equity, position และ preflop ranges, pot odds/outs, postflop พื้นฐาน
- **ฝึกโจทย์**: โจทย์สุ่มสร้าง (hand ranking, showdown, RFI, เจอ raise, pot odds) และโจทย์เขียนมือ (postflop) พร้อมเฉลยเหตุผล EV loss สถิติต่อหัวข้อ และโจทย์ที่ตอบผิดจะวนกลับมา (เก็บใน localStorage)
- **เครื่องมือ**: equity calculator (enumerate แน่นอนเมื่อไพ่เหลือน้อย ไม่งั้น Monte Carlo), range viewer, pot odds calculator

## โครงสร้าง

| ที่ไหน | คืออะไร |
| --- | --- |
| `src/poker/` | ตรรกะล้วน: `cards`, `evaluator` (7 ใบ), `equity`, `range` (parser สัญกรณ์ range), `preflop`, `drill` (ตัวสร้างโจทย์), `progress` |
| `src/data/preflop-ranges.json` | ตาราง preflop ที่ใช้ทั้ง viewer และโจทย์ แก้ไฟล์นี้ได้เลย |
| `src/data/postflop-questions.ts` | โจทย์ postflop ที่เขียนมือ |
| `src/data/lessons.ts` | เนื้อหาบทเรียน |
| `src/components/` | UI (React) |

## ข้อควรรู้

- ตาราง preflop เป็นแนวทางโดยประมาณตามตำราทั่วไป **ไม่ใช่ GTO จาก solver** ถ้ามีตารางที่เชื่อถือกว่า ให้แทนที่ `preflop-ranges.json`
- โจทย์ pot odds ไม่คิด implied odds และเลี่ยงกรณีใกล้จุดคุ้มทุน
- ยังไม่มีโหมดเล่นกับบอท (evaluator ออกแบบให้ใช้ซ้ำได้)
