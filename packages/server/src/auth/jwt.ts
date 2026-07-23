export function decodeSegment<T>(segment: string): T | undefined {
  try {
    return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')) as T
  } catch {
    return undefined
  }
}

export function base64UrlEncode(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}
