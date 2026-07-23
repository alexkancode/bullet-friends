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
