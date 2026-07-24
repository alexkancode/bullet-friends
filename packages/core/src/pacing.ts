export function waveDurationMs(wave: number): number {
  return 20000 + (wave - 1) * 4000
}

export function spawnIntervalMs(wave: number): number {
  return Math.max(300, 1100 - (wave - 1) * 100)
}
