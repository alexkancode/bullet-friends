export interface VisibilityControl {
  label: string
  next: boolean
}

export function visibilityControl(group: { ownerId: string; isPublic?: boolean } | undefined, userId: string): VisibilityControl | undefined {
  if (!group || group.ownerId !== userId) return undefined
  return group.isPublic ? { label: 'Make private', next: false } : { label: 'Make public', next: true }
}

export function memberLabel(count: number): string {
  return `${count} member${count === 1 ? '' : 's'}`
}
