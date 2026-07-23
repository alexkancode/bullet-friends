import type { GearSlot } from '@bullet/core'

export const FACE_CLEAR_RATIO = 0.3

const EDGE_INSET_RATIO = 0.06

const SLOT_WIDTH_RATIO: Record<GearSlot, number> = {
  hat: 1.4,
  eyes: 0.85,
  nose: 0.7,
  mouth: 0.9
}

export interface GearPlacement {
  width: number
  height: number
  centerYOffset: number
}

export function placeGear(slot: GearSlot, radius: number, aspect: number): GearPlacement {
  const rawWidth = radius * 2 * SLOT_WIDTH_RATIO[slot]
  const { width, height } = fitToBand(rawWidth, rawWidth * aspect, bandHeight(slot, radius))
  return { width, height, centerYOffset: centerFor(slot, radius, height) }
}

function bandHeight(slot: GearSlot, radius: number): number {
  if (slot === 'hat' || slot === 'mouth') return Infinity
  return radius - radius * EDGE_INSET_RATIO - radius * FACE_CLEAR_RATIO
}

function centerFor(slot: GearSlot, radius: number, height: number): number {
  const inset = radius * EDGE_INSET_RATIO
  if (slot === 'hat') return -radius - height / 2
  if (slot === 'eyes') return -radius + inset + height / 2
  if (slot === 'nose') return radius - inset - height / 2
  return radius + height / 2
}

function fitToBand(width: number, height: number, maxHeight: number): { width: number; height: number } {
  if (height <= maxHeight) return { width, height }
  const scale = maxHeight / height
  return { width: width * scale, height: maxHeight }
}
