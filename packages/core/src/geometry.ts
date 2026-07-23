import { ARENA } from './constants.js'

export interface Vec {
  x: number
  y: number
}

export function add(a: Vec, b: Vec): Vec {
  return { x: a.x + b.x, y: a.y + b.y }
}

export function scale(v: Vec, s: number): Vec {
  return { x: v.x * s, y: v.y * s }
}

export function normalize(v: Vec): Vec {
  const len = Math.hypot(v.x, v.y)
  if (len === 0) return { x: 0, y: 0 }
  return { x: v.x / len, y: v.y / len }
}

export function dist(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function circlesOverlap(a: Vec, ra: number, b: Vec, rb: number): boolean {
  return dist(a, b) < ra + rb
}

export function clampToArena(pos: Vec, radius: number): Vec {
  return {
    x: Math.min(Math.max(pos.x, radius), ARENA.width - radius),
    y: Math.min(Math.max(pos.y, radius), ARENA.height - radius)
  }
}
