import type { PlayerState } from '@bullet/core'
import { buildDamagePairs, buildMetricSeries, buildStatTiles, cumulative, METRICS } from './statsData.js'
import type { MetricSeries } from './statsData.js'
import { playerColor, INK } from '../render/palette.js'

const SVG_NS = 'http://www.w3.org/2000/svg'
const CHART = { width: 340, height: 190, top: 16, right: 76, bottom: 26, left: 40 }
const BAR_GAP = 2
const BAR_END_RADIUS = 4
const TAKEN_BAR_COLOR = '#898781'

type ScaleKind = 'point' | 'band'

interface Frame {
  svg: SVGSVGElement
  plotWidth: number
  plotHeight: number
  yAt: (value: number) => number
  xAt: (index: number) => number
}

export function renderStatsCharts(legendHost: HTMLElement, chartsHost: HTMLElement, tableHost: HTMLElement, players: PlayerState[]): void {
  renderLegend(legendHost, players)
  chartsHost.replaceChildren()
  chartsHost.append(buildTiles(players))
  chartsHost.append(buildKillsBars(players))
  chartsHost.append(buildDamageChart(players))
  chartsHost.append(buildXpLine(players))
  renderTotalsTable(tableHost, players)
}

function buildTiles(players: PlayerState[]): HTMLElement {
  const row = document.createElement('div')
  row.className = 'stat-tiles'
  for (const tile of buildStatTiles(players)) {
    const box = document.createElement('div')
    box.className = 'stat-tile'
    const value = document.createElement('div')
    value.className = 'stat-tile-value'
    value.textContent = tile.value
    const label = document.createElement('div')
    label.className = 'stat-tile-label'
    label.textContent = tile.label
    box.append(value, label)
    row.append(box)
  }
  return row
}

function buildKillsBars(players: PlayerState[]): HTMLElement {
  const series = buildMetricSeries(players, 'kills')
  const waves = Math.max(1, ...series.map(s => s.values.length))
  const maxValue = Math.max(1, ...series.flatMap(s => s.values)) * 1.1
  const { figure, frame } = chartFigure('Kills per wave', waves, maxValue, 'band')

  const groupWidth = frame.plotWidth / waves
  const barWidth = Math.min(22, Math.max(4, (groupWidth - 8) / Math.max(1, series.length) - BAR_GAP))
  for (const s of series) {
    const color = playerColor(s.colorIndex)
    s.values.forEach((value, wave) => {
      if (value === 0) return
      const groupCenter = frame.xAt(wave)
      const offset = (s.colorIndex - (series.length - 1) / 2) * (barWidth + BAR_GAP)
      const x = groupCenter + offset - barWidth / 2
      const y = frame.yAt(value)
      const bar = roundedTopBar(x, y, barWidth, frame.yAt(0) - y, color)
      const tooltip = document.createElementNS(SVG_NS, 'title')
      tooltip.textContent = `${s.name} — wave ${wave + 1}: ${formatValue(value)} kills`
      bar.append(tooltip)
      frame.svg.append(bar)
    })
  }
  return figure
}

function buildDamageChart(players: PlayerState[]): HTMLElement {
  const pairs = buildDamagePairs(players)
  const figure = document.createElement('figure')
  figure.className = 'chart'
  const caption = document.createElement('figcaption')
  caption.className = 'chart-title'
  caption.textContent = 'Damage dealt vs taken'
  figure.append(caption)

  const rowHeight = 44
  const height = Math.max(CHART.height, pairs.length * rowHeight + 24)
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', `0 0 ${CHART.width} ${height}`)
  svg.setAttribute('role', 'img')
  svg.setAttribute('aria-label', 'Damage dealt versus damage taken per player')

  const left = 92
  const plotWidth = CHART.width - left - 52
  const maxValue = Math.max(1, ...pairs.flatMap(p => [p.dealt, p.taken]))

  pairs.forEach((pair, index) => {
    const rowTop = 12 + index * rowHeight
    const name = svgText(truncate(pair.name, 12), left - 8, rowTop + 15, 'chart-end-label', 'end')
    svg.append(name)
    appendHorizontalBar(svg, left, rowTop, plotWidth, pair.dealt, maxValue, playerColor(pair.colorIndex), index === 0 ? 'dealt' : undefined)
    appendHorizontalBar(svg, left, rowTop + 15, plotWidth, pair.taken, maxValue, TAKEN_BAR_COLOR, index === 0 ? 'taken' : undefined)
  })

  figure.append(svg)
  return figure
}

function appendHorizontalBar(svg: SVGSVGElement, left: number, top: number, plotWidth: number, value: number, maxValue: number, color: string, measureLabel: string | undefined): void {
  const width = Math.max(2, (value / maxValue) * plotWidth)
  const bar = document.createElementNS(SVG_NS, 'path')
  const r = Math.min(BAR_END_RADIUS, width / 2)
  const barHeight = 11
  bar.setAttribute(
    'd',
    `M${left},${top} L${left + width - r},${top} Q${left + width},${top} ${left + width},${top + r} L${left + width},${top + barHeight - r} Q${left + width},${top + barHeight} ${left + width - r},${top + barHeight} L${left},${top + barHeight} Z`
  )
  bar.setAttribute('fill', color)
  const tooltip = document.createElementNS(SVG_NS, 'title')
  tooltip.textContent = `${measureLabel ?? 'damage'}: ${formatValue(value)}`
  bar.append(tooltip)
  svg.append(bar)
  svg.append(svgText(measureLabel ? `${formatValue(value)} ${measureLabel}` : formatValue(value), left + width + 5, top + 9, 'chart-tick', 'start'))
}

function buildXpLine(players: PlayerState[]): HTMLElement {
  const series = buildMetricSeries(players, 'xpGained').map(s => ({ ...s, values: cumulative(s.values) }))
  const waves = Math.max(1, ...series.map(s => s.values.length))
  const maxValue = Math.max(1, ...series.flatMap(s => s.values)) * 1.1
  const { figure, frame } = chartFigure('Total XP', waves, maxValue, 'point')

  for (const s of series) {
    const color = playerColor(s.colorIndex)
    if (s.values.length > 1) {
      const path = document.createElementNS(SVG_NS, 'path')
      path.setAttribute('d', s.values.map((v, i) => `${i === 0 ? 'M' : 'L'}${frame.xAt(i)},${frame.yAt(v)}`).join(' '))
      path.setAttribute('fill', 'none')
      path.setAttribute('stroke', color)
      path.setAttribute('stroke-width', '2')
      path.setAttribute('stroke-linejoin', 'round')
      frame.svg.append(path)
    }
    s.values.forEach((value, i) => {
      const marker = document.createElementNS(SVG_NS, 'circle')
      marker.setAttribute('cx', String(frame.xAt(i)))
      marker.setAttribute('cy', String(frame.yAt(value)))
      marker.setAttribute('r', '4')
      marker.setAttribute('fill', color)
      const tooltip = document.createElementNS(SVG_NS, 'title')
      tooltip.textContent = `${s.name} — wave ${i + 1}: ${formatValue(value)} xp total`
      marker.append(tooltip)
      frame.svg.append(marker)
    })
    endLabel(frame, s)
  }
  return figure
}

function chartFigure(label: string, waves: number, maxValue: number, scale: ScaleKind): { figure: HTMLElement; frame: Frame } {
  const figure = document.createElement('figure')
  figure.className = 'chart'
  const caption = document.createElement('figcaption')
  caption.className = 'chart-title'
  caption.textContent = label
  figure.append(caption)

  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', `0 0 ${CHART.width} ${CHART.height}`)
  svg.setAttribute('role', 'img')
  svg.setAttribute('aria-label', `${label} per wave`)

  const plotWidth = CHART.width - CHART.left - CHART.right
  const plotHeight = CHART.height - CHART.top - CHART.bottom
  const frame: Frame = {
    svg,
    plotWidth,
    plotHeight,
    yAt: value => CHART.top + plotHeight - (value / maxValue) * plotHeight,
    xAt: index =>
      scale === 'band'
        ? CHART.left + ((index + 0.5) / waves) * plotWidth
        : CHART.left + (waves === 1 ? plotWidth / 2 : (index / (waves - 1)) * plotWidth)
  }

  for (let g = 0; g <= 2; g++) {
    const value = (maxValue / 2) * g
    const line = document.createElementNS(SVG_NS, 'line')
    line.setAttribute('x1', String(CHART.left))
    line.setAttribute('x2', String(CHART.left + plotWidth))
    line.setAttribute('y1', String(frame.yAt(value)))
    line.setAttribute('y2', String(frame.yAt(value)))
    line.setAttribute('stroke', g === 0 ? INK.baseline : INK.gridline)
    line.setAttribute('stroke-width', '1')
    svg.append(line)
    svg.append(svgText(formatValue(value), CHART.left - 6, frame.yAt(value) + 4, 'chart-tick', 'end'))
  }
  for (let w = 0; w < waves; w++) {
    svg.append(svgText(String(w + 1), frame.xAt(w), CHART.height - 8, 'chart-tick', 'middle'))
  }

  figure.append(svg)
  return { figure, frame }
}

function roundedTopBar(x: number, y: number, width: number, height: number, color: string): SVGPathElement {
  const bar = document.createElementNS(SVG_NS, 'path')
  const r = Math.min(BAR_END_RADIUS, width / 2, height)
  bar.setAttribute(
    'd',
    `M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height} Z`
  )
  bar.setAttribute('fill', color)
  return bar
}

function endLabel(frame: Frame, s: MetricSeries): void {
  const lastValue = s.values[s.values.length - 1]
  if (lastValue === undefined) return
  frame.svg.append(svgText(s.name, frame.xAt(s.values.length - 1) + 8, frame.yAt(lastValue) + 4, 'chart-end-label', 'start'))
}

function svgText(content: string, x: number, y: number, className: string, anchor: 'start' | 'middle' | 'end'): SVGTextElement {
  const text = document.createElementNS(SVG_NS, 'text')
  text.setAttribute('x', String(x))
  text.setAttribute('y', String(y))
  text.setAttribute('class', className)
  text.setAttribute('text-anchor', anchor)
  text.textContent = content
  return text
}

function renderLegend(host: HTMLElement, players: PlayerState[]): void {
  host.replaceChildren()
  if (players.length < 2) return
  players.forEach((player, index) => {
    const entry = document.createElement('span')
    entry.className = 'legend-entry'
    const swatch = document.createElement('span')
    swatch.className = 'legend-swatch'
    swatch.style.setProperty('--swatch', playerColor(index))
    const name = document.createElement('span')
    name.textContent = player.name
    entry.append(swatch, name)
    host.append(entry)
  })
}

function renderTotalsTable(host: HTMLElement, players: PlayerState[]): void {
  host.replaceChildren()
  const table = document.createElement('table')
  table.className = 'stats-table'
  const head = table.createTHead().insertRow()
  for (const text of ['Player', 'Level', ...METRICS.map(m => m.label)]) {
    const th = document.createElement('th')
    th.textContent = text
    head.append(th)
  }
  const body = table.createTBody()
  players.forEach((player, index) => {
    const row = body.insertRow()
    const nameCell = row.insertCell()
    const swatch = document.createElement('span')
    swatch.className = 'legend-swatch'
    swatch.style.setProperty('--swatch', playerColor(index))
    nameCell.append(swatch, document.createTextNode(` ${player.name}`))
    row.insertCell().textContent = String(player.level)
    for (const metric of METRICS) {
      const total = player.history.reduce((sum, entry) => sum + entry[metric.key], 0)
      row.insertCell().textContent = formatValue(total)
    }
  })
  host.append(table)
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}\u2026` : text
}

function formatValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}
