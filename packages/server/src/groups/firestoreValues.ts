export type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } }

export function toFirestoreValue(value: unknown): FirestoreValue {
  if (typeof value === 'string') return { stringValue: value }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value }
  }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toFirestoreValue) } }
  if (typeof value === 'object' && value !== null) {
    return { mapValue: { fields: toFirestoreFields(value as Record<string, unknown>) } }
  }
  return { stringValue: String(value) }
}

export function fromFirestoreValue(value: FirestoreValue): unknown {
  if ('stringValue' in value) return value.stringValue
  if ('integerValue' in value) return Number(value.integerValue)
  if ('doubleValue' in value) return value.doubleValue
  if ('booleanValue' in value) return value.booleanValue
  if ('arrayValue' in value) return (value.arrayValue.values ?? []).map(fromFirestoreValue)
  return fromFirestoreFields(value.mapValue.fields ?? {})
}

export function toFirestoreFields(obj: Record<string, unknown>): Record<string, FirestoreValue> {
  return Object.fromEntries(Object.entries(obj).map(([key, val]) => [key, toFirestoreValue(val)]))
}

export function fromFirestoreFields(fields: Record<string, FirestoreValue>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).map(([key, val]) => [key, fromFirestoreValue(val)]))
}
