import type { EnemyState, GameState, PlayerState } from '@bullet/core'
import { gearById, ARENA, PLAYER_RADIUS, PROJECTILE_RADIUS, ORB_RADIUS } from '@bullet/core'
import type { SpriteStore } from './sprites.js'
import type { CamFeeds } from '../camera/feeds.js'
import { playerColor, GAME, INK, SURFACE } from './palette.js'
import { placeGear } from './gearLayout.js'

const ENEMY_ART: Record<EnemyState['kind'], string> = {
  blob: 'art/blob.svg',
  sprinter: 'art/sprinter.svg',
  brute: 'art/brute.svg'
}


export interface SceneDeps {
  canvas: HTMLCanvasElement
  sprites: SpriteStore
  feeds: CamFeeds
  selfVideo: HTMLVideoElement
}

export function drawScene(deps: SceneDeps, state: GameState, selfId: string | undefined): void {
  const ctx = deps.canvas.getContext('2d')
  if (!ctx) return
  const { width, height } = deps.canvas
  ctx.fillStyle = SURFACE.page
  ctx.fillRect(0, 0, width, height)

  const scale = Math.min(width / ARENA.width, height / ARENA.height) * 0.96
  ctx.save()
  ctx.translate((width - ARENA.width * scale) / 2, (height - ARENA.height * scale) / 2)
  ctx.scale(scale, scale)

  drawArena(ctx)
  for (const orb of state.orbs) drawOrb(ctx, orb.pos.x, orb.pos.y)
  for (const enemy of state.enemies) drawEnemy(ctx, deps.sprites, enemy)
  for (const proj of state.projectiles) drawProjectile(ctx, proj.pos.x, proj.pos.y)
  state.players.forEach((player, index) => drawPlayer(ctx, deps, player, index, player.id === selfId))

  ctx.restore()
}

function drawArena(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = SURFACE.panel
  ctx.fillRect(0, 0, ARENA.width, ARENA.height)
  ctx.strokeStyle = INK.gridline
  ctx.lineWidth = 1
  for (let x = 100; x < ARENA.width; x += 100) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, ARENA.height)
    ctx.stroke()
  }
  for (let y = 100; y < ARENA.height; y += 100) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(ARENA.width, y)
    ctx.stroke()
  }
  ctx.strokeStyle = INK.baseline
  ctx.lineWidth = 4
  ctx.strokeRect(0, 0, ARENA.width, ARENA.height)
}

function drawOrb(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const glow = ctx.createRadialGradient(x, y, 0, x, y, ORB_RADIUS * 2.4)
  glow.addColorStop(0, GAME.orb)
  glow.addColorStop(1, 'rgba(25, 158, 112, 0)')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(x, y, ORB_RADIUS * 2.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#8ff0c8'
  ctx.beginPath()
  ctx.arc(x, y, ORB_RADIUS * 0.6, 0, Math.PI * 2)
  ctx.fill()
}

function drawProjectile(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = GAME.projectile
  ctx.beginPath()
  ctx.arc(x, y, PROJECTILE_RADIUS, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255, 209, 102, 0.35)'
  ctx.beginPath()
  ctx.arc(x, y, PROJECTILE_RADIUS * 1.9, 0, Math.PI * 2)
  ctx.fill()
}

function drawEnemy(ctx: CanvasRenderingContext2D, sprites: SpriteStore, enemy: EnemyState): void {
  const sprite = sprites.ready(ENEMY_ART[enemy.kind])
  const size = enemy.radius * 2.2
  if (sprite) {
    ctx.drawImage(sprite, enemy.pos.x - size / 2, enemy.pos.y - size / 2, size, size)
  } else {
    ctx.fillStyle = GAME.danger
    ctx.beginPath()
    ctx.arc(enemy.pos.x, enemy.pos.y, enemy.radius, 0, Math.PI * 2)
    ctx.fill()
  }
  if (enemy.hp < enemy.maxHp) {
    drawBar(ctx, enemy.pos.x, enemy.pos.y - enemy.radius - 10, enemy.radius * 1.6, 5, enemy.hp / enemy.maxHp, GAME.danger)
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, deps: SceneDeps, player: PlayerState, index: number, isSelf: boolean): void {
  const { x, y } = player.pos
  const r = PLAYER_RADIUS
  const color = playerColor(index)

  ctx.save()
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.clip()
  const face = isSelf ? readyVideo(deps.selfVideo) : deps.feeds.get(player.id)
  if (face) {
    const side = 'videoWidth' in face ? faceSide(face) : { w: face.width, h: face.height }
    const crop = Math.min(side.w, side.h)
    ctx.drawImage(face, (side.w - crop) / 2, (side.h - crop) / 2, crop, crop, x - r, y - r, r * 2, r * 2)
  } else {
    ctx.fillStyle = color
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
    ctx.fillStyle = INK.primary
    ctx.font = `bold ${r}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(player.name.charAt(0).toUpperCase(), x, y)
  }
  if (!player.alive) {
    ctx.fillStyle = 'rgba(13, 13, 13, 0.72)'
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }
  ctx.restore()

  ctx.strokeStyle = player.alive ? color : INK.muted
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.stroke()

  for (const gearId of player.gear) drawGear(ctx, deps.sprites, gearId, x, y, r)

  ctx.fillStyle = INK.secondary
  ctx.font = '600 16px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(player.alive ? player.name : `${player.name} (down)`, x, y + r + 20)
  drawBar(ctx, x, y + r + 28, r * 2, 6, player.hp / player.stats.maxHp, GAME.hpGood)
}

function drawGear(ctx: CanvasRenderingContext2D, sprites: SpriteStore, gearId: string, x: number, y: number, r: number): void {
  const item = gearById(gearId)
  if (!item) return
  const sprite = sprites.ready(item.art)
  if (!sprite) return
  const { width, height, centerYOffset } = placeGear(item.slot, r, sprite.naturalHeight / sprite.naturalWidth)
  ctx.drawImage(sprite, x - width / 2, y + centerYOffset - height / 2, width, height)
}

function drawBar(ctx: CanvasRenderingContext2D, cx: number, top: number, width: number, height: number, ratio: number, color: string): void {
  const clamped = Math.max(0, Math.min(1, ratio))
  ctx.fillStyle = SURFACE.page
  ctx.fillRect(cx - width / 2, top, width, height)
  ctx.fillStyle = color
  ctx.fillRect(cx - width / 2, top, width * clamped, height)
}

function readyVideo(video: HTMLVideoElement): HTMLVideoElement | undefined {
  return video.readyState >= video.HAVE_CURRENT_DATA && video.videoWidth > 0 ? video : undefined
}

function faceSide(video: HTMLVideoElement): { w: number; h: number } {
  return { w: video.videoWidth, h: video.videoHeight }
}
