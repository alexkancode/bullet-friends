import type { EnemyState, GameState, PlayerState } from './state.js'
import { add, circlesOverlap, dist, normalize, scale } from './geometry.js'
import { PLAYER_RADIUS, PROJECTILE_RADIUS, PROJECTILE_SPEED, PROJECTILE_TTL_MS, TICK_MS, ARENA } from './constants.js'

const dt = TICK_MS / 1000

export function fireWeapons(state: GameState): void {
  for (const player of state.players) {
    if (!player.alive) continue
    player.fireCooldownMs = Math.max(0, player.fireCooldownMs - TICK_MS)
    if (player.fireCooldownMs > 0) continue
    const target = nearestEnemy(state.enemies, player)
    if (!target) continue
    const direction = normalize({ x: target.pos.x - player.pos.x, y: target.pos.y - player.pos.y })
    state.projectiles.push({
      id: state.nextEntityId++,
      ownerId: player.id,
      pos: { ...player.pos },
      vel: scale(direction, PROJECTILE_SPEED),
      damage: player.stats.damage,
      ttlMs: PROJECTILE_TTL_MS
    })
    player.fireCooldownMs = player.stats.fireRateMs
  }
}

export function advanceProjectiles(state: GameState): void {
  state.projectiles = state.projectiles.filter(proj => {
    proj.pos = add(proj.pos, scale(proj.vel, dt))
    proj.ttlMs -= TICK_MS
    const inArena = proj.pos.x >= 0 && proj.pos.x <= ARENA.width && proj.pos.y >= 0 && proj.pos.y <= ARENA.height
    return proj.ttlMs > 0 && inArena
  })
}

export function moveEnemies(state: GameState): void {
  const alive = state.players.filter(p => p.alive)
  if (alive.length === 0) return
  for (const enemy of state.enemies) {
    const target = nearestPlayer(alive, enemy)
    if (!target) continue
    const direction = normalize({ x: target.pos.x - enemy.pos.x, y: target.pos.y - enemy.pos.y })
    enemy.pos = add(enemy.pos, scale(direction, enemy.speed * dt))
  }
}

export function resolveProjectileHits(state: GameState): void {
  state.projectiles = state.projectiles.filter(proj => {
    const target = state.enemies.find(e => circlesOverlap(proj.pos, PROJECTILE_RADIUS, e.pos, e.radius))
    if (!target) return true
    const applied = Math.min(target.hp, proj.damage)
    target.hp -= proj.damage
    const owner = state.players.find(p => p.id === proj.ownerId)
    if (owner) owner.waveStats.damageDealt += applied
    if (target.hp <= 0) killEnemy(state, target, owner)
    return false
  })
}

export function resolveContactDamage(state: GameState): void {
  for (const enemy of state.enemies) {
    for (const player of state.players) {
      if (!player.alive) continue
      if (!circlesOverlap(enemy.pos, enemy.radius, player.pos, PLAYER_RADIUS)) continue
      const damage = enemy.touchDamage * dt
      player.hp = Math.max(0, player.hp - damage)
      player.waveStats.damageTaken += damage
      if (player.hp <= 0) player.alive = false
    }
  }
}

function killEnemy(state: GameState, enemy: EnemyState, killer: PlayerState | undefined): void {
  state.enemies = state.enemies.filter(e => e.id !== enemy.id)
  state.orbs.push({ id: state.nextEntityId++, pos: { ...enemy.pos }, xp: enemy.xpValue })
  if (killer) killer.waveStats.kills += 1
}

function nearestEnemy(enemies: EnemyState[], player: PlayerState): EnemyState | undefined {
  return nearestBy(enemies, e => dist(e.pos, player.pos))
}

function nearestPlayer(players: PlayerState[], enemy: EnemyState): PlayerState | undefined {
  return nearestBy(players, p => dist(p.pos, enemy.pos))
}

function nearestBy<T>(items: T[], distanceOf: (item: T) => number): T | undefined {
  let best: T | undefined
  let bestDist = Infinity
  for (const item of items) {
    const d = distanceOf(item)
    if (d < bestDist) {
      bestDist = d
      best = item
    }
  }
  return best
}
