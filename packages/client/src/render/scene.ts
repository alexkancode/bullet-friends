import type { EnemyState, GameDesign, GameState, PlayerState } from '@bullet/core'
import { designEnemy, designGear, ARENA, PLAYER_RADIUS, PROJECTILE_RADIUS, ORB_RADIUS } from '@bullet/core'
import type { SpriteStore } from './sprites.js'
import type { CamFeeds } from '../camera/feeds.js'
import { playerColor, GAME, INK, SURFACE } from './palette.js'
import { placeGear, stackGear } from './gearLayout.js'
import type { WornGear } from './gearLayout.js'


export interface SceneDeps {
  canvas: HTMLCanvasElement
  sprites: SpriteStore
  feeds: CamFeeds
  selfVideo: HTMLVideoElement
  design: GameDesign
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
  for (const orb of state.orbs) drawOrb(ctx, deps, orb.pos.x, orb.pos.y, scale)
  for (const enemy of state.enemies) drawEnemy(ctx, deps, enemy, scale)
  for (const proj of state.projectiles) drawProjectile(ctx, proj.pos.x, proj.pos.y)
  state.players.forEach((player, index) => drawPlayer(ctx, deps, player, index, player.id === selfId, scale))

  ctx.restore()
}

let arenaGrid: Path2D | undefined

function gridPath(): Path2D {
  if (arenaGrid) return arenaGrid
  const path = new Path2D()
  for (let x = 100; x < ARENA.width; x += 100) {
    path.moveTo(x, 0)
    path.lineTo(x, ARENA.height)
  }
  for (let y = 100; y < ARENA.height; y += 100) {
    path.moveTo(0, y)
    path.lineTo(ARENA.width, y)
  }
  arenaGrid = path
  return path
}

function drawArena(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = SURFACE.panel
  ctx.fillRect(0, 0, ARENA.width, ARENA.height)
  ctx.strokeStyle = INK.gridline
  ctx.lineWidth = 1
  ctx.stroke(gridPath())
  ctx.strokeStyle = INK.baseline
  ctx.lineWidth = 4
  ctx.strokeRect(0, 0, ARENA.width, ARENA.height)
}

const ORB_GLOW = ORB_RADIUS * 2.4

function paintOrb(ctx: CanvasRenderingContext2D, width: number): void {
  const radius = width / 2
  const glow = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius)
  glow.addColorStop(0, GAME.orb)
  glow.addColorStop(1, 'rgba(25, 158, 112, 0)')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(radius, radius, radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#8ff0c8'
  ctx.beginPath()
  ctx.arc(radius, radius, width * 0.125, 0, Math.PI * 2)
  ctx.fill()
}

function drawOrb(ctx: CanvasRenderingContext2D, deps: SceneDeps, x: number, y: number, scale: number): void {
  const size = ORB_GLOW * 2
  const sprite = deps.sprites.rendered('orb', size * scale, size * scale, paintOrb)
  ctx.drawImage(sprite, x - ORB_GLOW, y - ORB_GLOW, size, size)
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

function drawEnemy(ctx: CanvasRenderingContext2D, deps: SceneDeps, enemy: EnemyState, scale: number): void {
  const size = enemy.radius * 2.2
  const sprite = deps.sprites.bitmap(designEnemy(deps.design, enemy.kind)?.art ?? '', size * scale, size * scale)
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

function drawPlayer(ctx: CanvasRenderingContext2D, deps: SceneDeps, player: PlayerState, index: number, isSelf: boolean, scale: number): void {
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

  for (const worn of stackGear(player.gear, id => designGear(deps.design, id)?.slot, player.id, r)) drawGear(ctx, deps, worn, x, y, r, scale)

  ctx.fillStyle = INK.secondary
  ctx.font = '600 16px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(player.alive ? player.name : `${player.name} (down)`, x, y + r + 20)
  drawBar(ctx, x, y + r + 28, r * 2, 6, player.hp / player.stats.maxHp, GAME.hpGood)
}

function drawGear(ctx: CanvasRenderingContext2D, deps: SceneDeps, worn: WornGear, x: number, y: number, r: number, scale: number): void {
  const item = designGear(deps.design, worn.gearId)
  if (!item) return
  const image = deps.sprites.ready(item.art)
  if (!image) return
  const { width, height, centerYOffset } = placeGear(item.slot, r, image.naturalHeight / image.naturalWidth)
  const sprite = deps.sprites.bitmap(item.art, width * scale, height * scale)
  if (!sprite) return
  const centerX = x + worn.xOffset
  const centerY = y + centerYOffset + worn.yOffset
  ctx.save()
  ctx.translate(centerX, centerY)
  if (worn.mirrored) ctx.scale(-1, 1)
  ctx.drawImage(sprite, -width / 2, -height / 2, width, height)
  ctx.restore()
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
