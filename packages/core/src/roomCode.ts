export function roomCodeForGroup(groupId: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ23456789'
  let hash = 0x811c9dc5
  for (let i = 0; i < groupId.length; i++) {
    hash ^= groupId.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += alphabet[hash % alphabet.length]
    hash = (Math.imul(hash ^ (hash >>> 13), 0x5bd1e995) >>> 0) + i
  }
  return code
}
