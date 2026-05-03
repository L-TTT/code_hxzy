Component({
  properties: {
    type: {
      type: String,
      value: 'standard'
    },
    event: {
      type: Object,
      value: {}
    },
    showContent: {
      type: Boolean,
      value: true
    },
    animation: {
      type: String,
      value: 'fade-in'
    }
  },
  data: {
    symbol: '♩'
  },
  lifetimes: {
    attached() {
      this.updateSymbol()
    }
  },
  observers: {
    'type': function(_type: string) {
      this.updateSymbol()
    }
  },
  methods: {
    updateSymbol() {
      const symbols: Record<string, string> = {
        standard: '♩',
        birthday: '🎂',
        anniversary: '❤️',
        daily: '♪',
        special: '♫'
      }
      this.setData({
        symbol: symbols[this.properties.type] || '♩'
      })
    },
    onTap() {
      this.triggerEvent('tap', {
        eventId: this.properties.event._id,
        type: this.properties.type
      })
    },
    onPreviewPhoto() {
      if (this.properties.event.photos && this.properties.event.photos.length > 0) {
        wx.previewImage({
          urls: this.properties.event.photos.map((p: any) => p.url),
          current: this.properties.event.photos[0].url
        })
      }
    }
  }
})
