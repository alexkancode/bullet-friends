export type StatsExitAction = 'playAgain' | 'disconnect'

export interface StatsExit {
  label: string
  action: StatsExitAction
}

export function statsExit(leaveRequested: boolean): StatsExit {
  if (leaveRequested) return { label: 'Back to group', action: 'disconnect' }
  return { label: 'Back to lobby', action: 'playAgain' }
}
