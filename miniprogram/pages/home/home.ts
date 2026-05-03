import { EventData } from '../../utils/types'

interface MusicTrack {
  title: string
  artist: string
  src: string
}

Component({
  data: {
    themeClass: '',
    currentPage: 0,
    totalPages: 1,
    pages: [] as Array<{ type: string; data: EventData | null }>,
    statusBarHeight: 0,
    navBarHeight: 0,
    navBarRight: 0,
    events: [] as EventData[],
    startDate: '2024-02-14',
    coupleInfo: {
      partner1: { name: '他', nickname: '他' },
      partner2: { name: '她', nickname: '她' },
    },
    swiperMode: false,
    daysTogether: 0,
    loading: false,
    isPlaying: false,
    currentMusic: null as MusicTrack | null,
    musicProgress: 0,
    currentTrack: 0,
    musicList: [] as MusicTrack[],
    showPageJump: false,
    jumpPage: 1,
    flipAnimation: '',
    canFlip: true,
    touchStartX: 0,
    lowPerformance: false,
    flipDuration: 500,
    partnerActivities: [] as any[],
    showActivityPanel: false,
    unreadCount: 0,
    staffStyle: '五线谱',
    customBgPath: '',
  },
  properties: {},
  observers: {},
  lifetimes: {
    attached() {
      this.loadTheme()
      this.initNavBar()
      this.loadData()
    },
    detached() {
      this.clearAutoPlayTimer()
      this.stopWatch()
    },
  },
  pageLifetimes: {
    show() {
      if (typeof this.getTabBar === 'function' && this.getTabBar()) {
        this.getTabBar().setData({ selected: 0 })
      }
      this.loadTheme()
      this.loadData()
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
      this.setData({
        themeClass,
        customBgPath,
        staffStyle: settings.staffStyle || '五线谱',
      })
    },

    initNavBar() {
      const sysInfo = wx.getSystemInfoSync()
      const menuBtn = wx.getMenuButtonBoundingClientRect()
      const statusBarHeight = sysInfo.statusBarHeight || 44
      const navBarHeight = (menuBtn.top - statusBarHeight) * 2 + menuBtn.height
      const navBarRight = sysInfo.windowWidth - menuBtn.left + 16
      const lowPerformance = this.checkPerformance(sysInfo)
      this.setData({
        statusBarHeight,
        navBarHeight,
        navBarRight,
        lowPerformance,
        flipDuration: lowPerformance ? 200 : 500,
      })
    },

    checkPerformance(sysInfo: WechatMiniprogram.SystemInfo): boolean {
      const bl = (sysInfo as any).benchmarkLevel
      if (bl !== undefined && bl !== -1 && bl < 5) return true
      if (sysInfo.platform === 'android') {
        const match = sysInfo.system && sysInfo.system.match(/Android\s+(\d+)/i)
        if (match && parseInt(match[1]) < 8) return true
        if (sysInfo.screenWidth < 360) return true
      }
      return false
    },

    async loadData() {
      this.setData({ loading: true })
      try {
        const settings = wx.getStorageSync('appSettings') || {}
        let coupleInfo = this.data.coupleInfo
        let startDate = this.data.startDate

        const app = getApp<IAppOption>()
        if (app.globalData.coupleId) {
          try {
            const statusRes = await wx.cloud.callFunction({
              name: 'coupleManager',
              data: { action: 'getStatus' },
            })
            const statusResult = statusRes.result as any
            if (statusResult && statusResult.code === 0 && statusResult.data && statusResult.data.paired) {
              const cloudData = statusResult.data
              coupleInfo = {
                partner1: { name: cloudData.partner1.name || '他', nickname: cloudData.partner1.name || '他' },
                partner2: { name: cloudData.partner2.name || '她', nickname: cloudData.partner2.name || '她' },
              }
              if (cloudData.startDate) {
                startDate = cloudData.startDate
              }
              wx.setStorageSync('coupleInfo', { ...coupleInfo, startDate })
            }
          } catch (_cloudErr) {
            const savedCouple = wx.getStorageSync('coupleInfo')
            if (savedCouple) {
              if (savedCouple.partner1) {
                coupleInfo = savedCouple
              } else if (savedCouple.male) {
                coupleInfo = { partner1: savedCouple.male, partner2: savedCouple.female }
              }
              if (savedCouple.startDate) { startDate = savedCouple.startDate }
            }
          }
        } else {
          const savedCouple = wx.getStorageSync('coupleInfo')
          if (savedCouple) {
            if (savedCouple.partner1) {
              coupleInfo = savedCouple
            } else if (savedCouple.male) {
              coupleInfo = {
                partner1: savedCouple.male,
                partner2: savedCouple.female,
              }
            }
            if (savedCouple.startDate) {
              startDate = savedCouple.startDate
            }
          }
        }

        const [eventsRes, daysResult] = await Promise.all([
          this.fetchEvents(),
          this.calculateDays(startDate),
        ])

        const musicList = this.buildMusicList(eventsRes)
        const swiperMode = settings.swiperMode === true
        const pages = this.buildPages(eventsRes, swiperMode)

        this.setData({
          events: eventsRes,
          daysTogether: daysResult,
          totalPages: pages.length,
          pages,
          musicList,
          currentTrack: 0,
          currentMusic: musicList.length > 0 ? musicList[0] : null,
          coupleInfo,
          startDate,
          swiperMode,
        })

        if (settings.autoPlay && swiperMode) {
          this.startAutoPlay()
        }
      } catch (err) {
        console.error('加载数据失败:', err)
        wx.showToast({ title: '加载失败', icon: 'none' })
      } finally {
        this.setData({ loading: false })
      }
    },

    async fetchEvents(): Promise<EventData[]> {
      try {
        const res = await wx.cloud.callFunction({
          name: 'eventManager',
          data: { action: 'list', filter: { sortOrder: 'asc' } },
        })
        const result = res.result as any
        if (result && result.code === 0) {
          const events: EventData[] = result.data || []
          await this.resolvePhotoUrls(events)
          this.startWatch()
          this.loadPartnerActivity()
          return events
        }
        return []
      } catch (err) {
        console.error('获取事件列表失败:', err)
        return []
      }
    },

    startWatch() {
      this.stopWatch()
      const app = getApp<IAppOption>()
      const coupleId = app.globalData.coupleId
      if (!coupleId) return

      try {
        const db = wx.cloud.database()
        ;(this as any).eventWatcher = db.collection('events')
          .where({ coupleId })
          .watch({
            onChange: (snapshot: any) => {
              if (snapshot && snapshot.docs && snapshot.docs.length !== this.data.events.length) {
                this.loadData()
              }
            },
            onError: () => { void 0 },
          })
      } catch (_e) { void 0 }
    },

    stopWatch() {
      if ((this as any).eventWatcher) {
        try { (this as any).eventWatcher.close() } catch (_e) { void 0 }
        ;(this as any).eventWatcher = null
      }
    },

    async loadPartnerActivity() {
      const app = getApp<IAppOption>()
      if (!app.globalData.coupleId) return

      try {
        const lastViewed = wx.getStorageSync('activityLastViewed') || 0
        const res = await wx.cloud.callFunction({
          name: 'eventManager',
          data: { action: 'getPartnerActivity', since: lastViewed },
        })
        const result = res.result as any
        if (result && result.code === 0 && result.data) {
          const activities = result.data.map((a: any) => {
            const actionMap: Record<string, string> = {
              create: '创建了',
              update: '更新了',
              delete: '删除了',
            }
            return {
              ...a,
              actionText: actionMap[a.action] || a.action,
              timeText: this.formatActivityTime(a.createdAt),
            }
          })
          this.setData({
            partnerActivities: activities,
            unreadCount: activities.length,
          })
        }
      } catch (_e) { void 0 }
    },

    formatActivityTime(createdAt: any): string {
      if (!createdAt) return ''
      const date = new Date(createdAt)
      const now = new Date()
      const diff = now.getTime() - date.getTime()
      if (diff < 60000) return '刚刚'
      if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
      if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
      return `${date.getMonth() + 1}/${date.getDate()}`
    },

    toggleActivityPanel() {
      const show = !this.data.showActivityPanel
      this.setData({ showActivityPanel: show })
      if (!show && this.data.unreadCount > 0) {
        wx.setStorageSync('activityLastViewed', Date.now())
        this.setData({ unreadCount: 0 })
      }
    },

    closeActivityPanel() {
      if (this.data.unreadCount > 0) {
        wx.setStorageSync('activityLastViewed', Date.now())
        this.setData({ unreadCount: 0 })
      }
      this.setData({ showActivityPanel: false })
    },

    async resolvePhotoUrls(events: EventData[]) {
      const fileIds: string[] = []
      events.forEach(e => {
        if (e.photos) {
          e.photos.forEach((p: any) => {
            if (p.fileId && !p.url) fileIds.push(p.fileId)
          })
        }
      })
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
          events.forEach(e => {
            if (e.photos) {
              e.photos.forEach((p: any) => {
                if (p.fileId && urlMap[p.fileId]) {
                  p.url = urlMap[p.fileId]
                }
              })
            }
          })
        }
      } catch (_err) {
        void 0
      }
    },

    async calculateDays(startDateStr?: string): Promise<number> {
      const startDate = new Date(startDateStr || this.data.startDate)
      const now = new Date()
      const diffTime = Math.abs(now.getTime() - startDate.getTime())
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    },

    getCurrentEvent(): EventData | undefined {
      const page = this.data.pages[this.data.currentPage]
      if (!page || page.type !== 'event' || !page.data) return undefined
      return page.data as EventData
    },

    navigateToPage(targetPage: number) {
      if (targetPage < 0 || targetPage >= this.data.totalPages) return
      const direction = targetPage > this.data.currentPage ? 'flip-left' : 'flip-right'
      this.triggerFlip(direction, () => {
        this.setData({ currentPage: targetPage })
      })
    },

    onPageChange(e: { detail: { current: number } }) {
      this.setData({ currentPage: e.detail.current })
    },

    prevPage() {
      this.navigateToPage(this.data.currentPage - 1)
    },

    nextPage() {
      this.navigateToPage(this.data.currentPage + 1)
    },

    triggerFlip(animation: string, callback: () => void) {
      if (!this.data.canFlip) return
      if (this.data.lowPerformance) {
        callback()
        return
      }
      this.setData({ flipAnimation: animation, canFlip: false })
      setTimeout(() => {
        callback()
        this.setData({ flipAnimation: '' })
        setTimeout(() => this.setData({ canFlip: true }), 100)
      }, 500)
    },

    onTouchStart(e: { touches: Array<{ clientX: number; clientY: number }> }) {
      this.setData({ touchStartX: e.touches[0].clientX })
    },

    onTouchEnd(e: { changedTouches: Array<{ clientX: number; clientY: number }> }) {
      const touchEndX = e.changedTouches[0].clientX
      const diffX = touchEndX - this.data.touchStartX
      if (Math.abs(diffX) > 60) {
        if (diffX > 0) {
          this.prevPage()
        } else {
          this.nextPage()
        }
      }
    },

    showPageJumpModal() {
      this.setData({ showPageJump: true, jumpPage: this.data.currentPage + 1 })
    },

    hidePageJumpModal() {
      this.setData({ showPageJump: false })
    },

    onJumpPageInput(e: { detail: { value: string } }) {
      this.setData({ jumpPage: parseInt(e.detail.value) || 1 })
    },

    confirmJumpPage() {
      const page = this.data.jumpPage
      if (page >= 1 && page <= this.data.totalPages) {
        this.navigateToPage(page - 1)
        this.setData({ showPageJump: false })
      } else {
        wx.showToast({ title: `请输入 1-${this.data.totalPages} 之间的页码`, icon: 'none' })
      }
    },

    onEventTap(e: { detail: { eventId: string } }) {
      wx.navigateTo({ url: `/pages/event-detail/event-detail?id=${e.detail.eventId}` })
    },

    toggleMusic() {
      const track = this.data.musicList[this.data.currentTrack]
      if (!track) {
        wx.showToast({ title: '暂无可播放音乐', icon: 'none' })
        return
      }
      if (this.data.isPlaying) {
        this.pauseMusic()
      } else {
        this.playMusic(track)
      }
    },

    playMusic(track: MusicTrack) {
      const app = getApp<IAppOption>()
      if (!app.globalData.innerAudioContext) {
        app.globalData.innerAudioContext = wx.createInnerAudioContext()
      }
      const audio = app.globalData.innerAudioContext
      if (audio.src !== track.src) {
        audio.src = track.src
      }
      audio.play()
      this.setData({ isPlaying: true, currentMusic: track })

      audio.onTimeUpdate(() => {
        if (audio.duration > 0) {
          this.setData({ musicProgress: Math.floor((audio.currentTime / audio.duration) * 100) })
        }
      })
      audio.onEnded(() => {
        this.setData({ isPlaying: false, musicProgress: 0 })
        this.nextTrack()
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

    nextTrack() {
      const list = this.data.musicList
      if (list.length === 0) return
      const nextIdx = (this.data.currentTrack + 1) % list.length
      this.setData({ currentTrack: nextIdx, musicProgress: 0 })
      this.playMusic(list[nextIdx])
    },

    prevTrack() {
      const list = this.data.musicList
      if (list.length === 0) return
      const prevIdx = (this.data.currentTrack - 1 + list.length) % list.length
      this.setData({ currentTrack: prevIdx, musicProgress: 0 })
      this.playMusic(list[prevIdx])
    },

    onProgressChange(e: { detail: { value: number } }) {
      const app = getApp<IAppOption>()
      const audio = app.globalData.innerAudioContext
      if (audio && audio.duration > 0) {
        audio.seek((e.detail.value / 100) * audio.duration)
      }
      this.setData({ musicProgress: e.detail.value })
    },

    openSettings() {
      wx.navigateTo({ url: '/pages/settings/settings' })
    },

    toggleSwiperMode() {
      const newMode = !this.data.swiperMode
      const settings = wx.getStorageSync('appSettings') || {}
      settings.swiperMode = newMode
      wx.setStorageSync('appSettings', settings)
      const pages = this.buildPages(this.data.events, newMode)
      if (!newMode) {
        this.clearAutoPlayTimer()
      }
      this.setData({
        swiperMode: newMode,
        currentPage: 0,
        totalPages: pages.length,
        pages,
      })
      if (newMode && settings.autoPlay) {
        this.startAutoPlay()
      }
    },

    startAutoPlay() {
      this.clearAutoPlayTimer()
      ;(this as any).autoPlayTimer = setInterval(() => {
        if (this.data.currentPage < this.data.totalPages - 1) {
          this.nextPage()
        } else {
          this.navigateToPage(0)
        }
      }, 3000)
    },

    clearAutoPlayTimer() {
      if ((this as any).autoPlayTimer) {
        clearInterval((this as any).autoPlayTimer)
        ;(this as any).autoPlayTimer = undefined
      }
    },

    buildPages(events: EventData[], swiperMode?: boolean): Array<{ type: string; data: EventData | null }> {
      const pages: Array<{ type: string; data: EventData | null }> = [{ type: 'cover', data: null }]
      if (swiperMode) {
        pages.push({ type: 'stats', data: null })
        const sorted = [...events].reverse()
        sorted.forEach(event => pages.push({ type: 'event', data: event }))
      } else {
        events.forEach(event => pages.push({ type: 'event', data: event }))
        pages.push({ type: 'back', data: null })
      }
      return pages
    },

    buildMusicList(events: EventData[]): MusicTrack[] {
      return events
        .filter(e => e.music && (e.music.url || e.music.src))
        .map(e => ({
          title: e.music!.title || e.title,
          artist: e.music!.artist || '',
          src: e.music!.url || e.music!.src || '',
        }))
    },

    refreshMusicList() {
      const list = this.buildMusicList(this.data.events)
      this.setData({ musicList: list })
    },

    async sharePage() {
      const currentEvent = this.getCurrentEvent()
      if (!currentEvent) {
        wx.showToast({ title: '当前无事件', icon: 'none' })
        return
      }

      wx.showLoading({ title: '生成海报中...' })

      try {
        const res = await wx.cloud.callFunction({
          name: 'shareManager',
          data: { action: 'generateShareCard', eventId: currentEvent._id },
        })

        wx.hideLoading()

        const result = res.result as any
        if (result && result.code === 0) {
          wx.showActionSheet({
            itemList: ['保存海报到相册', '分享给好友'],
            success: async (action) => {
              if (action.tapIndex === 0) {
                await this.drawAndSavePoster(result.data)
              } else {
                wx.showToast({ title: '请点击右上角分享', icon: 'none' })
              }
            },
          })
        } else {
          wx.showToast({ title: (result && result.message) || '生成失败', icon: 'none' })
        }
      } catch (_err) {
        wx.hideLoading()
        wx.showToast({ title: '分享失败', icon: 'none' })
      }
    },

    async drawAndSavePoster(data: { event?: { title?: string; date?: string; description?: string } }) {
      wx.showLoading({ title: '绘制海报中...' })
      const ctx = wx.createCanvasContext('posterCanvas', this)

      ctx.setFillStyle('#0f1023')
      ctx.fillRect(0, 0, 750, 1334)

      ctx.setStrokeStyle('#C9A96E')
      ctx.setLineWidth(2)
      for (let i = 0; i < 5; i++) {
        ctx.moveTo(50, 200 + i * 40)
        ctx.lineTo(700, 200 + i * 40)
        ctx.stroke()
      }

      ctx.setFillStyle('#FFF8F0')
      ctx.setFontSize(48)
      ctx.fillText((data.event && data.event.title) || '和弦之约', 100, 150)

      ctx.setFillStyle('#C9A96E')
      ctx.setFontSize(32)
      ctx.fillText((data.event && data.event.date) || '', 100, 500)

      ctx.setFillStyle('#FFF8F0')
      ctx.setFontSize(28)
      ctx.fillText((data.event && data.event.description) || '', 100, 560)

      ctx.setFillStyle('#C9A96E')
      ctx.setFontSize(24)
      ctx.fillText('和弦之约 · Melody of Love', 200, 1250)

      ctx.draw(false, () => {
        setTimeout(() => {
          wx.canvasToTempFilePath({
            canvasId: 'posterCanvas',
            quality: 1,
            success: (res) => {
              wx.hideLoading()
              wx.saveImageToPhotosAlbum({
                filePath: res.tempFilePath,
                success: () => wx.showToast({ title: '已保存', icon: 'success' }),
                fail: (saveErr) => {
                  if (saveErr.errMsg && saveErr.errMsg.includes('auth deny')) {
                    wx.showModal({
                      title: '提示',
                      content: '需要相册权限，请在设置中开启',
                      confirmText: '去设置',
                      success: (r) => {
                        if (r.confirm) wx.openSetting()
                      },
                    })
                  }
                },
              })
            },
            fail: () => {
              wx.hideLoading()
              wx.showToast({ title: '保存失败', icon: 'none' })
            },
          })
        }, 500)
      })
    },

    async downloadPage() {
      const app = getApp<IAppOption>()
      const adEnabled = app.globalData.adEnabled

      try {
        const pointsRes = await wx.cloud.callFunction({
          name: 'adManager',
          data: { action: 'getPoints' },
        })
        const pointsResult = pointsRes.result as any
        const currentPoints = (pointsResult && pointsResult.data && pointsResult.data.points) || 0

        if (!adEnabled) {
          const modalRes = await wx.showModal({
            title: '下载',
            content: `消耗30积分下载（当前积分：${currentPoints}）`,
            confirmText: '确定',
            cancelText: '取消',
          })
          if (modalRes.confirm) {
            if (currentPoints < 30) {
              wx.showToast({ title: '积分不足', icon: 'none' })
              return
            }
            await this.consumePointsAndDownload()
          }
          return
        }

        wx.showActionSheet({
          itemList: [`花费30积分（当前${currentPoints}）`, '观看广告获得30积分'],
          success: async (res) => {
            if (res.tapIndex === 0) {
              if (currentPoints < 30) {
                wx.showToast({ title: '积分不足，请先观看广告', icon: 'none' })
                return
              }
              await this.consumePointsAndDownload()
            } else {
              this.showRewardedVideoAd()
            }
          },
        })
      } catch (_err) {
        wx.showToast({ title: '查询积分失败', icon: 'none' })
      }
    },

    async consumePointsAndDownload() {
      try {
        const res = await wx.cloud.callFunction({
          name: 'adManager',
          data: { action: 'consumePoints', points: 30 },
        })

        const result = res.result as any
        if (result && result.code === 0) {
          wx.showToast({ title: '下载开始', icon: 'success' })
        } else {
          wx.showToast({ title: (result && result.message) || '积分不足', icon: 'none' })
        }
      } catch (_err) {
        wx.showToast({ title: '操作失败', icon: 'none' })
      }
    },

    showRewardedVideoAd() {
      const app = getApp<IAppOption>()
      const adUnitId = app.globalData.adUnitId
      if (!adUnitId) {
        wx.showToast({ title: '广告暂未开放', icon: 'none' })
        return
      }

      const videoAd = wx.createRewardedVideoAd({ adUnitId })

      videoAd.onClose((res) => {
        if (res && res.isEnded) {
          wx.cloud
            .callFunction({ name: 'adManager', data: { action: 'recordAdWatch' } })
            .then((adRes) => {
              const adResult = adRes.result as any
              if (adResult && adResult.code === 0) {
                wx.showToast({
                  title: `获得${adResult.data.points}积分`,
                  icon: 'success',
                })
              }
            })
        } else {
          wx.showToast({ title: '未观看完整广告', icon: 'none' })
        }
      })

      videoAd.show().catch(() => {
        videoAd.load().then(() => videoAd.show())
      })
    },

    editPage() {
      const currentEvent = this.getCurrentEvent()
      const url = currentEvent
        ? `/pages/event-edit/event-edit?id=${currentEvent._id}`
        : '/pages/event-edit/event-edit'
      wx.navigateTo({ url })
    },

    async deleteEvent() {
      const currentEvent = this.getCurrentEvent()
      if (!currentEvent) {
        wx.showToast({ title: '当前无事件', icon: 'none' })
        return
      }

      const modalRes = await wx.showModal({
        title: '确认删除',
        content: '删除后无法恢复，确定删除吗？',
        confirmText: '删除',
        confirmColor: '#FF6B6B',
      })

      if (!modalRes.confirm) return

      try {
        const res = await wx.cloud.callFunction({
          name: 'eventManager',
          data: { action: 'delete', eventId: currentEvent._id },
        })

        const result = res.result as any
        if (result && result.code === 0) {
          wx.showToast({ title: '已删除', icon: 'success' })
          await this.loadData()
        } else {
          wx.showToast({ title: (result && result.message) || '删除失败', icon: 'none' })
        }
      } catch (_err) {
        wx.showToast({ title: '网络错误', icon: 'none' })
      }
    },

    async exportPDF() {
      wx.showLoading({ title: '正在导出...' })

      try {
        const res = await wx.cloud.callFunction({
          name: 'pdfExporter',
          data: { includePhotos: true },
        })

        const result = res.result as any
        if (result && result.code === 0 && result.data) {
          const events = result.data.events || this.data.events
          await this.renderPDFToAlbum(events, result.data.userInfo)
        } else {
          wx.showToast({ title: '导出失败', icon: 'none' })
        }
      } catch (_err) {
        wx.showToast({ title: '导出失败', icon: 'none' })
      } finally {
        wx.hideLoading()
      }
    },

    async renderPDFToAlbum(events: EventData[], userInfo?: { nickName?: string }) {
      const ctx = wx.createCanvasContext('pdfCanvas', this)
      const W = 750
      const H = 1334

      ctx.setFillStyle('#0f1023')
      ctx.fillRect(0, 0, W, H)

      ctx.setFillStyle('#C9A96E')
      ctx.setFontSize(56)
      ctx.setTextAlign('center')
      ctx.fillText('和弦之约', W / 2, 200)

      ctx.setFillStyle('#FFF8F0')
      ctx.setFontSize(28)
      ctx.fillText(`${this.data.coupleInfo.partner1.nickname} & ${this.data.coupleInfo.partner2.nickname}`, W / 2, 280)

      ctx.setFillStyle('#C9A96E')
      ctx.setFontSize(22)
      ctx.fillText(`相恋第 ${this.data.daysTogether} 天 · ${events.length} 个回忆`, W / 2, 340)

      if (userInfo && userInfo.nickName) {
        ctx.setFillStyle('rgba(255,248,240,0.4)')
        ctx.setFontSize(20)
        ctx.fillText(`制作人：${userInfo.nickName}`, W / 2, 400)
      }

      ctx.setTextAlign('left')
      let y = 480
      events.slice(0, 6).forEach(event => {
        if (y > H - 120) return

        ctx.setFillStyle('#C9A96E')
        ctx.setFontSize(24)
        ctx.fillText(this.getEventTypeText(event.type), 60, y)
        y += 40

        ctx.setFillStyle('#FFF8F0')
        ctx.setFontSize(32)
        ctx.fillText(event.title, 60, y)
        y += 46

        ctx.setFillStyle('rgba(201,169,110,0.6)')
        ctx.setFontSize(22)
        ctx.fillText(this.formatDate(event.date), 60, y)
        y += 38

        if (event.description) {
          ctx.setFillStyle('rgba(255,248,240,0.6)')
          ctx.setFontSize(22)
          const desc = event.description.length > 40 ? event.description.slice(0, 40) + '...' : event.description
          ctx.fillText(desc, 60, y)
          y += 38
        }

        ctx.setStrokeStyle('rgba(201,169,110,0.15)')
        ctx.setLineWidth(1)
        ctx.moveTo(60, y + 10)
        ctx.lineTo(W - 60, y + 10)
        ctx.stroke()
        y += 40
      })

      ctx.setTextAlign('center')
      ctx.setFillStyle('#C9A96E')
      ctx.setFontSize(20)
      ctx.fillText('和弦之约 · Melody of Love', W / 2, H - 80)

      ctx.draw(false, () => {
        setTimeout(() => {
          wx.canvasToTempFilePath({
            canvasId: 'pdfCanvas',
            quality: 1,
            fileType: 'jpg',
            success: (res) => {
              wx.saveImageToPhotosAlbum({
                filePath: res.tempFilePath,
                success: () => wx.showToast({ title: '画册已保存相册', icon: 'success' }),
                fail: (saveErr) => {
                  if (saveErr.errMsg && saveErr.errMsg.includes('auth deny')) {
                    wx.showModal({
                      title: '需要相册权限',
                      content: '请在设置中开启相册权限',
                      confirmText: '去设置',
                      success: (r) => { if (r.confirm) wx.openSetting() },
                    })
                  }
                },
              })
            },
            fail: () => {
              wx.showToast({ title: '渲染失败', icon: 'none' })
            },
          })
        }, 500)
      })
    },

    onShareAppMessage() {
      const currentEvent = this.getCurrentEvent()
      const title = currentEvent
        ? `${currentEvent.title} - 和弦之约`
        : `相恋第${this.data.daysTogether}天 - 和弦之约`
      return {
        title,
        path: '/pages/home/home',
      }
    },

    previewPhoto(e?: { currentTarget?: { dataset?: { url?: string } } }) {
      const event = this.getCurrentEvent()
      if (!event || !event.photos || event.photos.length === 0) return
      const urls = event.photos.map((p: any) => p.url || p.fileId).filter(Boolean)
      if (urls.length === 0) return
      const current = (e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.url) || urls[0]
      wx.previewImage({ urls, current })
    },

    addPhoto() {
      wx.chooseMedia({
        count: 9,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          const files = res.tempFiles.map((f: any) => f.tempFilePath)
          wx.showToast({ title: `已选择${files.length}张照片`, icon: 'success' })
        },
      })
    },

    uploadPhotos() {
      wx.showToast({ title: '照片已选择', icon: 'success' })
    },

    toggleBgMusic() {
      const app = getApp<IAppOption>()
      const settings = wx.getStorageSync('appSettings') || {}
      settings.bgMusic = !settings.bgMusic
      wx.setStorageSync('appSettings', settings)

      if (settings.bgMusic) {
        if (!app.globalData.bgAudioContext) {
          app.globalData.bgAudioContext = wx.createInnerAudioContext()
          app.globalData.bgAudioContext.loop = true
        }
        app.globalData.bgAudioContext.play()
      } else if (app.globalData.bgAudioContext) {
        app.globalData.bgAudioContext.pause()
      }
    },

    quickJump() {
      wx.showModal({
        title: '快速跳转',
        content: `当前第 ${this.data.currentPage + 1} 页，共 ${this.data.totalPages} 页`,
        editable: true,
        placeholderText: '输入页码',
        success: (res) => {
          if (res.confirm && res.content) {
            const target = parseInt(res.content)
            if (target >= 1 && target <= this.data.totalPages) {
              this.navigateToPage(target - 1)
            } else {
              wx.showToast({ title: '页码无效', icon: 'none' })
            }
          }
        },
      })
    },

    showCustomToast(icon: string, title: string) {
      wx.showToast({ title: icon + ' ' + title, icon: 'none' })
    },

    getEventTypeText(type: string): string {
      const typeMap: Record<string, string> = {
        birthday: '🎂 生日',
        anniversary: '💕 纪念日',
        daily: '🌿 日常',
        special: '✨ 特殊',
      }
      return typeMap[type] || ' 事件'
    },

    formatDate(dateStr: string): string {
      const date = new Date(dateStr)
      const y = date.getFullYear()
      const m = date.getMonth() + 1
      const d = date.getDate()
      const pad = (n: number) => (n < 10 ? '0' + n : '' + n)
      return `${y}.${pad(m)}.${pad(d)}`
    },
  },
})