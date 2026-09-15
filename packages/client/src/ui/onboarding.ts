export interface OnboardProfile {
  userId: string
  name: string
  email: string
  camConsent?: boolean
}

export type OnboardStep = 'auth' | 'consent' | 'group' | 'ready'

export function nextStep(profile: OnboardProfile | undefined, hasActiveGroup: boolean): OnboardStep {
  if (!profile) return 'auth'
  if (profile.camConsent === undefined) return 'consent'
  return hasActiveGroup ? 'ready' : 'group'
}

export type GroupSelectReason = 'load' | 'switch'

export function selectGroup<T extends { id: string }>(groups: T[], current: T | undefined, reason: GroupSelectReason): T | undefined {
  if (reason === 'switch') return undefined
  if (current) return groups.find(g => g.id === current.id) ?? current
  return groups.length === 1 ? groups[0] : undefined
}
