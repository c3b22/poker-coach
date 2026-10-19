export type Rng = () => number

export const pick = <T>(items: readonly T[], rng: Rng): T => items[Math.floor(rng() * items.length)]

/** Fisher-Yates shuffle of a copy. */
export function shuffled<T>(items: readonly T[], rng: Rng): T[] {
  const a = items.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
