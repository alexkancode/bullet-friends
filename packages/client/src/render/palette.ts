export const PLAYER_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300']

export const INK = {
  primary: '#ffffff',
  secondary: '#c3c2b7',
  muted: '#898781',
  gridline: '#2c2c2a',
  baseline: '#383835'
}

export const SURFACE = {
  page: '#0d0d0d',
  panel: '#1a1a19'
}

export const GAME = {
  orb: '#199e70',
  projectile: '#ffd166',
  danger: '#d03b3b',
  hpGood: '#0ca30c'
}

export function playerColor(index: number): string {
  return PLAYER_COLORS[index % PLAYER_COLORS.length] ?? '#3987e5'
}
