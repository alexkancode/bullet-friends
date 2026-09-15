import type { EnemyDesign, GameDesign, GearItem, LevelDesign, StatKey } from '@bullet/core'
import { defaultDesign, GEAR_SLOTS } from '@bullet/core'
import { addEnemy, addGear, addLevel, removeLevel, updateEnemy, updateGear, updateLevel } from './designEdit.js'
import { fileToArtDataUrl } from './assetUpload.js'
import { artUrl } from '../render/sprites.js'
import { describeModifier } from './shop.js'

type Tab = 'levels' | 'enemies' | 'gear'

const STAT_KEYS: StatKey[] = ['maxHp', 'damage', 'fireRateMs', 'moveSpeed', 'pickupRadius']

export interface DesignerHost {
  overlay: HTMLElement
  nameInput: HTMLInputElement
  tabsHost: HTMLElement
  sectionHost: HTMLElement
  note: HTMLElement
  saveButton: HTMLButtonElement
  closeButton: HTMLButtonElement
}

export class DesignerStudio {
  private draft: GameDesign = defaultDesign()
  private designId: string | undefined
  private tab: Tab = 'levels'

  constructor(
    private readonly host: DesignerHost,
    private readonly artBase: string,
    private readonly save: (design: GameDesign, id: string | undefined) => Promise<string | undefined>,
    private readonly onSaved: () => void
  ) {
    host.closeButton.addEventListener('click', () => {
      host.overlay.hidden = true
    })
    host.saveButton.addEventListener('click', () => void this.saveDraft())
    host.nameInput.addEventListener('change', () => {
      this.draft = { ...this.draft, name: this.host.nameInput.value.trim().slice(0, 40) || this.draft.name }
    })
  }

  open(design: GameDesign, designId: string | undefined): void {
    this.draft = JSON.parse(JSON.stringify(design)) as GameDesign
    this.designId = designId
    this.tab = 'levels'
    this.host.overlay.hidden = false
    this.host.note.textContent = ''
    this.render()
  }

  private async saveDraft(): Promise<void> {
    this.host.saveButton.disabled = true
    const savedId = await this.save(this.draft, this.designId)
    this.host.saveButton.disabled = false
    if (!savedId) {
      this.host.note.textContent = 'Could not save — check the fields and try again'
      return
    }
    this.designId = savedId
    this.host.note.textContent = `Saved "${this.draft.name}"`
    this.onSaved()
  }

  private apply(next: GameDesign | undefined): void {
    if (!next) {
      this.host.note.textContent = 'That change was not valid and was not applied'
      this.render()
      return
    }
    this.draft = next
    this.host.note.textContent = ''
    this.render()
  }

  private render(): void {
    this.host.nameInput.value = this.draft.name
    this.renderTabs()
    this.host.sectionHost.replaceChildren()
    if (this.tab === 'levels') this.renderLevels()
    if (this.tab === 'enemies') this.renderEnemies()
    if (this.tab === 'gear') this.renderGear()
  }

  private renderTabs(): void {
    this.host.tabsHost.replaceChildren()
    const tabs: [Tab, string][] = [
      ['levels', `Levels (${this.draft.levels.length})`],
      ['enemies', `Enemies (${this.draft.enemies.length})`],
      ['gear', `Gear (${this.draft.gear.length})`]
    ]
    for (const [tab, label] of tabs) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = `tab${this.tab === tab ? ' tab-active' : ''}`
      button.textContent = label
      button.addEventListener('click', () => {
        this.tab = tab
        this.render()
      })
      this.host.tabsHost.append(button)
    }
  }

  private renderLevels(): void {
    this.draft.levels.forEach((level, index) => {
      this.host.sectionHost.append(this.levelCard(level, index))
    })
    this.host.sectionHost.append(this.addButton('Add level', () => this.apply(addLevel(this.draft))))
  }

  private levelCard(level: LevelDesign, index: number): HTMLElement {
    const card = document.createElement('div')
    card.className = 'designer-card'
    const title = document.createElement('div')
    title.className = 'designer-card-title'
    title.textContent = `Level ${index + 1}${index === this.draft.levels.length - 1 ? ' (repeats)' : ''}`
    card.append(title)
    card.append(
      this.numberField('Duration (s)', level.durationMs / 1000, value => this.apply(updateLevel(this.draft, index, { durationMs: value * 1000 }))),
      this.numberField('Spawn every (ms)', level.spawnIntervalMs, value => this.apply(updateLevel(this.draft, index, { spawnIntervalMs: value })))
    )
    const mix = document.createElement('div')
    mix.className = 'designer-mix'
    for (const enemy of this.draft.enemies) {
      const label = document.createElement('label')
      label.className = 'designer-check'
      const box = document.createElement('input')
      box.type = 'checkbox'
      box.checked = level.enemyIds.includes(enemy.id)
      box.addEventListener('change', () => {
        const enemyIds = box.checked ? [...level.enemyIds, enemy.id] : level.enemyIds.filter(id => id !== enemy.id)
        this.apply(updateLevel(this.draft, index, { enemyIds }))
      })
      label.append(box, document.createTextNode(enemy.name))
      mix.append(label)
    }
    card.append(mix)
    if (this.draft.levels.length > 1) {
      card.append(this.addButton('Remove level', () => this.apply(removeLevel(this.draft, index))))
    }
    return card
  }

  private renderEnemies(): void {
    for (const enemy of this.draft.enemies) {
      this.host.sectionHost.append(this.enemyCard(enemy))
    }
    this.host.sectionHost.append(this.addButton('Add enemy', () => this.apply(addEnemy(this.draft))))
  }

  private enemyCard(enemy: EnemyDesign): HTMLElement {
    const card = document.createElement('div')
    card.className = 'designer-card'
    card.append(this.artHeader(enemy.name, enemy.art, name => this.apply(updateEnemy(this.draft, enemy.id, { name })), art => this.apply(updateEnemy(this.draft, enemy.id, { art }))))
    card.append(
      this.numberField('Health', enemy.baseHp, value => this.apply(updateEnemy(this.draft, enemy.id, { baseHp: value }))),
      this.numberField('Speed', enemy.speed, value => this.apply(updateEnemy(this.draft, enemy.id, { speed: value }))),
      this.numberField('Size', enemy.radius, value => this.apply(updateEnemy(this.draft, enemy.id, { radius: value }))),
      this.numberField('Touch damage/s', enemy.touchDamagePerSecond, value => this.apply(updateEnemy(this.draft, enemy.id, { touchDamagePerSecond: value }))),
      this.numberField('XP drop', enemy.xpValue, value => this.apply(updateEnemy(this.draft, enemy.id, { xpValue: value }))),
      this.numberField('Spawn weight', enemy.weight, value => this.apply(updateEnemy(this.draft, enemy.id, { weight: value })))
    )
    return card
  }

  private renderGear(): void {
    for (const item of this.draft.gear) {
      this.host.sectionHost.append(this.gearCardEditor(item))
    }
    this.host.sectionHost.append(this.addButton('Add gear', () => this.apply(addGear(this.draft))))
  }

  private gearCardEditor(item: GearItem): HTMLElement {
    const card = document.createElement('div')
    card.className = 'designer-card'
    card.append(this.artHeader(item.name, item.art, name => this.apply(updateGear(this.draft, item.id, { name })), art => this.apply(updateGear(this.draft, item.id, { art }))))

    const slotLabel = document.createElement('label')
    slotLabel.className = 'designer-field'
    slotLabel.append(document.createTextNode('Worn on'))
    const slotSelect = document.createElement('select')
    for (const slot of GEAR_SLOTS) {
      const option = document.createElement('option')
      option.value = slot
      option.textContent = slot
      option.selected = item.slot === slot
      slotSelect.append(option)
    }
    slotSelect.addEventListener('change', () => this.apply(updateGear(this.draft, item.id, { slot: slotSelect.value as GearItem['slot'] })))
    slotLabel.append(slotSelect)
    card.append(slotLabel)

    item.modifiers.forEach((modifier, modIndex) => {
      const row = document.createElement('div')
      row.className = 'designer-mod'
      const statSelect = document.createElement('select')
      for (const stat of STAT_KEYS) {
        const option = document.createElement('option')
        option.value = stat
        option.textContent = stat
        option.selected = modifier.stat === stat
        statSelect.append(option)
      }
      const strength = document.createElement('input')
      strength.type = 'number'
      strength.step = '0.05'
      strength.value = String(modifier.mult ?? (modifier.flat !== undefined ? modifier.flat : 1))
      const isFlat = modifier.flat !== undefined
      const commit = () => {
        const value = Number(strength.value)
        const modifiers = item.modifiers.map((mod, i) =>
          i === modIndex ? { stat: statSelect.value as StatKey, ...(isFlat ? { flat: value } : { mult: value }) } : mod
        )
        this.apply(updateGear(this.draft, item.id, { modifiers }))
      }
      statSelect.addEventListener('change', commit)
      strength.addEventListener('change', commit)
      const summary = document.createElement('span')
      summary.className = 'cam-note'
      summary.textContent = describeModifier(modifier)
      row.append(statSelect, strength, summary)
      card.append(row)
    })
    return card
  }

  private artHeader(name: string, art: string, onName: (name: string) => void, onArt: (art: string) => void): HTMLElement {
    const header = document.createElement('div')
    header.className = 'designer-art-row'
    const img = document.createElement('img')
    img.className = 'designer-art'
    img.src = artUrl(this.artBase, art)
    img.alt = name
    const nameInput = document.createElement('input')
    nameInput.value = name
    nameInput.maxLength = 40
    nameInput.addEventListener('change', () => onName(nameInput.value))
    const upload = document.createElement('input')
    upload.type = 'file'
    upload.accept = 'image/*'
    upload.className = 'designer-upload'
    upload.addEventListener('change', () => {
      const file = upload.files?.[0]
      if (!file) return
      void fileToArtDataUrl(file).then(dataUrl => {
        if (dataUrl) onArt(dataUrl)
        else this.host.note.textContent = 'That image could not be read'
      })
    })
    header.append(img, nameInput, upload)
    return header
  }

  private numberField(label: string, value: number, onChange: (value: number) => void): HTMLElement {
    const field = document.createElement('label')
    field.className = 'designer-field'
    field.append(document.createTextNode(label))
    const input = document.createElement('input')
    input.type = 'number'
    input.value = String(value)
    input.addEventListener('change', () => onChange(Number(input.value)))
    field.append(input)
    return field
  }

  private addButton(label: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'button designer-add'
    button.textContent = label
    button.addEventListener('click', onClick)
    return button
  }
}
