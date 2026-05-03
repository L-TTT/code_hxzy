interface EventPhoto {
  url?: string
  fileId?: string
  caption?: string
}

interface EventMusic {
  title?: string
  url?: string
  src?: string
  artist?: string
}

interface EventData {
  _id?: string
  title: string
  date: string
  type: string
  description?: string
  photos?: EventPhoto[]
  music?: EventMusic
  location?: string
}

Component({
  data: {
    themeClass: '',
    customBgPath: '',
    event: {} as EventData,
    statusBarHeight: 0,
    navBarHeight: 0,
    scrollHeight: 600,
    isPlaying: false,
    progress: 0,
    loading: true,
    eventId: '',
    eventTypeText: '',
    typeEmoji: '',
  },
  lifetimes: {
    attached() {
      this.loadTheme()
      this.initNavBar()
    },
    ready() {
      this.loadEventData()
    },
    detached() {
      this.stopMusic()
    },
  },

  pageLifetimes: {
    show() {
      this.loadTheme()
    },
  },
  methods: {
    loadTheme() {
      const settings = wx.getStorageSync('appSettings') || {}
      const theme = settings.theme || 'ink'
      let themeClass = theme !== 'ink' ? `theme-${theme}` : ''
      let customBgPath = ''
      if (theme === 'custom' && settings.customBgPath) {
        themeClass = 'theme-custom'
        customBgPath = settings.customBgPath
      }
      this.setData({ themeClass, customBgPath })
    },

    initNavBar() {
      try {
        const sysInfo = wx.getSystemInfoSync()
        const menuBtn = wx.getMenuButtonBoundingClientRect()
        const statusBarHeight = sysInfo.statusBarHeight || 44
        const navContentHeight = (menuBtn.top - statusBarHeight) * 2 + menuBtn.height
        const navBarHeight = statusBarHeight + navContentHeight
        const scrollHeight = sysInfo.windowHeight - navBarHeight
        this.setData({ statusBarHeight, navBarHeight: navContentHeight, scrollHeight: scrollHeight > 0 ? scrollHeight : 600 })
      } catch (_e) {
        this.setData({ statusBarHeight: 44, navBarHeight: 44, scrollHeight: 600 })
      }
    },

    async loadEventData() {
      let eventId = ''
      try {
        const pages = getCurrentPages()
        const cur = pages[pages.length - 1] as any
        eventId = (cur && cur.options && cur.options.id) || ''
      } catch (_e) {
        eventId = ''
      }

      if (!eventId) {
        this.setData({ loading: false })
        wx.showToast({ title: '参数错误', icon: 'none' })
        return
      }

      this.setData({ eventId, loading: true })
      try {
        const res = await wx.cloud.callFunction({
          name: 'eventManager',
          data: { action: 'get', eventId },
        })
        const result = res.result as any
        if (result && result.code === 0 && result.data) {
          const event = result.data
          try {
            await this.resolvePhotoUrls(event)
          } catch (_e) {
            void 0
          }
          const typeInfo = this.getTypeInfo(event.type)
          this.setData({
            event,
            eventTypeText: typeInfo.text,
            typeEmoji: typeInfo.emoji,
          })
        } else {
          wx.showToast({ title: (result && result.message) || '事件不存在', icon: 'none' })
        }
      } catch (_err) {
        wx.showToast({ title: '加载失败', icon: 'none' })
      } finally {
        this.setData({ loading: false })
      }
    },

    async resolvePhotoUrls(event: EventData) {
      if (!event.photos) return
      const fileIds = event.photos
        .filter(p => p.fileId && !p.url)
        .map(p => p.fileId!)
      if (fileIds.length === 0) return

      try {
        const res = await wx.cloud.callFunction({
          name: 'uploadManager',
          data: { action: 'getTempUrl', fileIds },
        })
        const result = res.result as any
        if (result && result.code === 0 && result.data) {
          const urlMap: Record<string, string> = {}
          result.data.forEach((item: { fileID: string; tempFileURL: string }) => {
            if (item.tempFileURL) urlMap[item.fileID] = item.tempFileURL
          })
          event.photos.forEach(p => {
            if (p.fileId && urlMap[p.fileId]) {
              p.url = urlMap[p.fileId]
            }
          })
        }
      } catch (_err) {
        void 0
      }
    },

    getTypeInfo(type: string): { text: string; emoji: string } {
      const map: Record<string, { text: string; emoji: string }> = {
        birthday: { text: '生日', emoji: '\u{1F382}' },
        anniversary: { text: '纪念日', emoji: '\u{1F495}' },
        daily: { text: '日常', emoji: '\u{1F33F}' },
        special: { text: '特殊', emoji: '\u2728' },
      }
      return map[type] || { text: '事件', emoji: '\u{1F3B5}' }
    },

    goBack() {
      wx.navigateBack()
    },

    previewPhoto(e: { currentTarget: { dataset: { index: number } } }) {
      const { event } = this.data
      if (!event.photos || event.photos.length === 0) return
      const urls = event.photos
        .map(p => p.url || p.fileId)
        .filter(Boolean) as string[]
      if (urls.length === 0) return
      const idx = Math.min(e.currentTarget.dataset.index, urls.length - 1)
      wx.previewImage({ urls, current: urls[idx] })
    },

    togglePlay() {
      if (this.data.isPlaying) {
        this.pauseMusic()
      } else {
        this.playMusic()
      }
    },

    playMusic() {
      const music = this.data.event.music
      if (!music || (!music.url && !music.src)) {
        wx.showToast({ title: '暂无可播放音乐', icon: 'none' })
        return
      }
      const app = getApp<IAppOption>()
      if (!app.globalData.innerAudioContext) {
        app.globalData.innerAudioContext = wx.createInnerAudioContext()
      }
      const audio = app.globalData.innerAudioContext
      const src = music.url || music.src || ''
      if (audio.src !== src) {
        audio.src = src
      }
      audio.play()
      this.setData({ isPlaying: true })

      audio.onTimeUpdate(() => {
        if (audio.duration > 0) {
          this.setData({ progress: Math.floor((audio.currentTime / audio.duration) * 100) })
        }
      })
      audio.onEnded(() => {
        this.setData({ isPlaying: false, progress: 0 })
      })
      audio.onError(() => {
        this.setData({ isPlaying: false })
        wx.showToast({ title: '播放失败', icon: 'none' })
      })
    },

    pauseMusic() {
      const app = getApp<IAppOption>()
      if (app.globalData.innerAudioContext) {
        app.globalData.innerAudioContext.pause()
      }
      this.setData({ isPlaying: false })
    },

    stopMusic() {
      const app = getApp<IAppOption>()
      if (app.globalData.innerAudioContext) {
        app.globalData.innerAudioContext.stop()
      }
      this.setData({ isPlaying: false, progress: 0 })
    },

    onProgressChange(e: { detail: { value: number } }) {
      const app = getApp<IAppOption>()
      const audio = app.globalData.innerAudioContext
      if (audio && audio.duration > 0) {
        audio.seek((e.detail.value / 100) * audio.duration)
      }
      this.setData({ progress: e.detail.value })
    },

    editEvent() {
      const { eventId } = this.data
      if (eventId) {
        wx.navigateTo({ url: `/pages/event-edit/event-edit?id=${eventId}` })
      }
    },

    async deleteEvent() {
      const modalRes = await wx.showModal({
        title: '确认删除',
        content: '确定要删除这个事件吗？删除后无法恢复。',
        confirmText: '删除',
        confirmColor: '#FF6B6B',
        cancelText: '取消',
      })

      if (!modalRes.confirm) return

      const { eventId } = this.data
      wx.showLoading({ title: '删除中...' })
      try {
        const res = await wx.cloud.callFunction({
          name: 'eventManager',
          data: { action: 'delete', eventId },
        })
        wx.hideLoading()
        const result = res.result as any
        if (result && result.code === 0) {
          wx.showToast({ title: '已删除', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 1500)
        } else {
          wx.showToast({ title: (result && result.message) || '删除失败', icon: 'none' })
        }
      } catch (_err) {
        wx.hideLoading()
        wx.showToast({ title: '网络错误', icon: 'none' })
      }
    },

    onShareAppMessage() {
      const { event } = this.data
      return {
        title: `${event.title} - 和弦之约`,
        path: `/pages/event-detail/event-detail?id=${this.data.eventId}`,
      }
    },
  },
})
