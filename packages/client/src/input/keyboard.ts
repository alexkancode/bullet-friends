import type { Vec } from '@bullet/core'

const KEY_VECTORS: Record<string, Vec> = {
  KeyW: { x: 0, y: -1 },
  ArrowUp: { x: 0, y: -1 },
  KeyS: { x: 0, y: 1 },
  ArrowDown: { x: 0, y: 1 },
  KeyA: { x: -1, y: 0 },
  ArrowLeft: { x: -1, y: 0 },
  KeyD: { x: 1, y: 0 },
  ArrowRight: { x: 1, y: 0 }
}

export interface MovementKeys {
  current(): Vec
  dispose(): void
}

export function trackMovementKeys(): MovementKeys {
  const held = new Set<string>()

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.code in KEY_VECTORS && !isTyping(event)) held.add(event.code)
  }
  const onKeyUp = (event: KeyboardEvent) => held.delete(event.code)
  const onBlur = () => held.clear()

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)

  return {
    current() {
      let x = 0
      let y = 0
      for (const code of held) {
        const vec = KEY_VECTORS[code]
        if (!vec) continue
        x += vec.x
        y += vec.y
      }
      return { x: Math.sign(x), y: Math.sign(y) }
    },
    dispose() {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }
}

function isTyping(event: KeyboardEvent): boolean {
  return event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement
}
