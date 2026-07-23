export const PROTOCOL_VERSION = 1

export function isCompatible(version: number): boolean {
  return version === PROTOCOL_VERSION
}
