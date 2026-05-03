import { ScoreConfig, NoteData, CardData } from './types'

const defaultConfig: ScoreConfig = {
  lineColor: '#C9A96E',
  lineSpacing: 20,
  backgroundColor: '#0f1023',
  staffWidth: 0,
  staffHeight: 0
}

export class ScoreRenderer {
  private ctx: WechatMiniprogram.CanvasContext | null = null
  private config: ScoreConfig = defaultConfig

  constructor(canvasId: string, _dpr: number = 1) {
    this.ctx = wx.createCanvasContext(canvasId)
  }

  init(config: Partial<ScoreConfig> = {}) {
    this.config = { ...this.config, ...config }
    return this
  }

  drawStaff(config: ScoreConfig) {
    const ctx = this.ctx
    if (!ctx) return

    const { lineColor, lineSpacing, staffHeight } = config
    const staffWidth = config.staffWidth
    const startY = staffHeight / 2 - 2 * lineSpacing

    ctx.setStrokeStyle(lineColor)
    ctx.setLineWidth(1)

    for (let i = 0; i < 5; i++) {
      const y = startY + i * lineSpacing
      ctx.moveTo(0, y)
      ctx.lineTo(staffWidth, y)
      ctx.stroke()
    }

    return this
  }

  drawNote(note: NoteData) {
    const ctx = this.ctx
    if (!ctx) return

    const { lineSpacing, staffHeight } = this.config
    const startY = staffHeight / 2 - 2 * lineSpacing

    const x = this.calculateNoteX(note.timestamp)
    const y = startY + note.position * lineSpacing

    ctx.setFillStyle(this.getNoteColor(note.type))
    ctx.beginPath()
    ctx.arc(x, y, 6, 0, 2 * Math.PI)
    ctx.fill()

    ctx.setFillStyle('#C9A96E')
    ctx.setFontSize(10)
    ctx.fillText(this.getNoteSymbol(note.type), x + 8, y - 8)

    return this
  }

  drawCard(card: CardData) {
    const ctx = this.ctx
    if (!ctx) return

    const { x, y, width, height, description } = card

    ctx.setFillStyle('#1a1a2e')
    ctx.fillRect(x, y, width, height)

    ctx.setStrokeStyle('#C9A96E')
    ctx.setLineWidth(1)
    ctx.strokeRect(x, y, width, height)

    ctx.setFillStyle('#FFF8F0')
    ctx.setFontSize(12)
    ctx.fillText(description, x + 8, y + 20)

    return this
  }

  render() {
    if (this.ctx) {
      this.ctx.draw()
    }
  }

  clear() {
    if (this.ctx && this.config.staffWidth && this.config.staffHeight) {
      this.ctx.clearRect(0, 0, this.config.staffWidth, this.config.staffHeight)
    }
    return this
  }

  private calculateNoteX(timestamp: number): number {
    const { staffWidth } = this.config
    const now = Date.now()
    const ratio = (now - timestamp) / (now - 1707868800000)
    return staffWidth * Math.max(0, Math.min(1, ratio))
  }

  private getNoteColor(type: string): string {
    const colors: Record<string, string> = {
      standard: '#C9A96E',
      birthday: '#FF6B6B',
      anniversary: '#B76E79',
      daily: '#9B8EC1'
    }
    return colors[type] || colors.standard
  }

  private getNoteSymbol(type: string): string {
    const symbols: Record<string, string> = {
      standard: '♩',
      birthday: '🎂',
      anniversary: '❤️',
      daily: '♪'
    }
    return symbols[type] || symbols.standard
  }
}

export function createScoreRenderer(canvasId: string, config?: Partial<ScoreConfig>): ScoreRenderer {
  const renderer = new ScoreRenderer(canvasId)
  if (config) {
    renderer.init(config)
  }
  return renderer
}
