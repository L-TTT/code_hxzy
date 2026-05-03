Component({
  data: {
    themeClass: '',
    customBgPath: '',
    mode: 'invite' as 'invite' | 'join',
    inviteCode: '',
    inputCode: '',
    inputFocus: false,
    loading: false,
    joining: false,
    fromSettings: false,
    statusBarHeight: 0,
    navBarHeight: 0,
    scrollHeight: 600,
  },

  lifetimes: {
    attached() {
      this.loadTheme()
      this.initNavBar()
      const pages = getCurrentPages()
      const currentPage = pages[pages.length - 1]
      if (pages.length >= 2) {
        const prevPage = pages[pages.length - 2]
        if (prevPage.route && prevPage.route.indexOf('settings') >= 0) {
          this.setData({ fromSettings: true })
        }
      }
      if (currentPage.options && currentPage.options.code) {
        this.setData({
          mode: 'join',
          inputCode: (currentPage.options.code as string).toUpperCase(),
        })
      }
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
        const info = wx.getSystemInfoSync()
        const menuBtn = wx.getMenuButtonBoundingClientRect()
        const statusBarHeight = info.statusBarHeight
        const navContentHeight = (menuBtn.top - statusBarHeight) * 2 + menuBtn.height
        const navBarHeight = statusBarHeight + navContentHeight
        const scrollHeight = info.windowHeight - navBarHeight
        this.setData({
          statusBarHeight,
          navBarHeight: navContentHeight,
          scrollHeight: scrollHeight > 0 ? scrollHeight : 600,
        })
      } catch (_e) {
        void 0
      }
    },

    goBack() {
      wx.navigateBack()
    },

    switchMode(e: any) {
      this.setData({ mode: e.currentTarget.dataset.mode })
    },

    async generateCode() {
      this.setData({ loading: true })
      try {
        const res = await wx.cloud.callFunction({
          name: 'coupleManager',
          data: { action: 'createInvite' },
        })
        const result = res.result as any
        if (result.code === 0) {
          this.setData({ inviteCode: result.data.inviteCode })
        } else {
          wx.showToast({ title: result.message || '生成失败', icon: 'none' })
        }
      } catch (_err) {
        wx.showToast({ title: '网络错误', icon: 'none' })
      }
      this.setData({ loading: false })
    },

    copyCode() {
      if (!this.data.inviteCode) return
      wx.setClipboardData({
        data: this.data.inviteCode,
        success: () => {
          wx.showToast({ title: '已复制', icon: 'success' })
        },
      })
    },

    onCodeInput(e: any) {
      const value = (e.detail.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
      this.setData({ inputCode: value.slice(0, 6) })
    },

    async joinSpace() {
      if (this.data.inputCode.length !== 6 || this.data.joining) return
      this.setData({ joining: true })
      try {
        const res = await wx.cloud.callFunction({
          name: 'coupleManager',
          data: { action: 'acceptInvite', inviteCode: this.data.inputCode },
        })
        const result = res.result as any
        if (result.code === 0) {
          wx.showToast({ title: '配对成功', icon: 'success' })
          const app = getApp<IAppOption>()
          app.globalData.coupleId = result.data.coupleId
          setTimeout(() => {
            if (this.data.fromSettings) {
              wx.navigateBack()
            } else {
              wx.switchTab({ url: '/pages/home/home' })
            }
          }, 1500)
        } else {
          wx.showToast({ title: result.message || '加入失败', icon: 'none' })
        }
      } catch (_err) {
        wx.showToast({ title: '网络错误', icon: 'none' })
      }
      this.setData({ joining: false })
    },

    skipPair() {
      if (this.data.fromSettings) {
        wx.navigateBack()
      } else {
        wx.switchTab({ url: '/pages/home/home' })
      }
    },

    onShareAppMessage() {
      return {
        title: '💕 来和弦之约，和我一起记录美好时光',
        path: `/pages/pair/pair?code=${this.data.inviteCode}`,
      }
    },
  },
})
