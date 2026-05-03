Component({
  data: {
    themeClass: '',
    activeTheme: 'ink',
    autoPlay: true,
    bgMusic: true,
    swiperMode: false,
    staffStyle: '五线谱',
    customBgPath: '',
    statusBarHeight: 0,
    navBarHeight: 0,
    scrollHeight: 0,
    partner1Name: '',
    partner1Nickname: '',
    partner2Name: '',
    partner2Nickname: '',
    startDate: '2024-02-14',
    coupleId: '',
  },
  lifetimes: {
    attached() {
      this.loadTheme()
      this.initNavBar()
      this.loadSettings()
      this.loadCoupleInfo()
    },
  },
  pageLifetimes: {
    show() {
      const app = getApp<IAppOption>()
      const newCoupleId = app.globalData.coupleId || ''
      if (newCoupleId !== this.data.coupleId) {
        this.setData({ coupleId: newCoupleId })
        if (newCoupleId) {
          this.loadCoupleFromCloud()
        }
      }
    },
    hide() {
      this.autoSaveCoupleInfo()
    },
  },
  methods: {
    loadTheme() {
      const settings = wx.getStorageSync('appSettings') || {}
      const theme = settings.theme || 'ink'
      let themeClass = theme !== 'ink' ? `theme-${theme}` : ''
      let customBgStyle = ''
      if (theme === 'custom' && settings.customBgPath) {
        themeClass = 'theme-custom'
        customBgStyle = `background-color:transparent;background-image:url(${settings.customBgPath});background-size:cover;background-position:center;`
      }
      this.setData({ themeClass, customBgStyle, customBgPath: settings.customBgPath || '' })
    },

    initNavBar() {
      try {
        const sysInfo = wx.getSystemInfoSync()
        const menuBtn = wx.getMenuButtonBoundingClientRect()
        const statusBarHeight = sysInfo.statusBarHeight || 44
        const navBarHeight = (menuBtn.top - statusBarHeight) * 2 + menuBtn.height
        const scrollHeight = sysInfo.windowHeight - navBarHeight - statusBarHeight
        this.setData({ statusBarHeight, navBarHeight, scrollHeight })
      } catch (_e) {
        this.setData({ statusBarHeight: 44, navBarHeight: 44, scrollHeight: 600 })
      }
    },

    loadSettings() {
      const settings = wx.getStorageSync('appSettings') || {}
      this.setData({
        activeTheme: settings.theme || 'ink',
        autoPlay: settings.autoPlay !== false,
        bgMusic: settings.bgMusic !== false,
        swiperMode: settings.swiperMode === true,
        staffStyle: settings.staffStyle || '五线谱',
        customBgPath: settings.customBgPath || '',
      })
    },

    loadCoupleInfo() {
      const app = getApp<IAppOption>()
      this.setData({ coupleId: app.globalData.coupleId || '' })
      if (app.globalData.coupleId) {
        this.loadCoupleFromCloud()
      } else {
        this.loadCoupleFromLocal()
      }
    },

    async loadCoupleFromCloud() {
      try {
        const res = await wx.cloud.callFunction({
          name: 'coupleManager',
          data: { action: 'getStatus' },
        })
        const result = res.result as any
        if (result && result.code === 0 && result.data.paired) {
          const d = result.data
          this.setData({
            partner1Name: d.partner1.name || '',
            partner1Nickname: d.partner1.name || '',
            partner2Name: d.partner2.name || '',
            partner2Nickname: d.partner2.name || '',
            startDate: d.startDate || '2024-02-14',
          })
          wx.setStorageSync('coupleInfo', {
            partner1: { name: d.partner1.name, nickname: d.partner1.name },
            partner2: { name: d.partner2.name, nickname: d.partner2.name },
            startDate: d.startDate || '2024-02-14',
          })
        } else {
          this.loadCoupleFromLocal()
        }
      } catch (_err) {
        this.loadCoupleFromLocal()
      }
    },

    loadCoupleFromLocal() {
      const saved = wx.getStorageSync('coupleInfo')
      if (saved) {
        if (saved.partner1) {
          this.setData({
            partner1Name: saved.partner1.name || '',
            partner1Nickname: saved.partner1.nickname || '',
            partner2Name: saved.partner2.name || '',
            partner2Nickname: saved.partner2.nickname || '',
            startDate: saved.startDate || '2024-02-14',
          })
        } else if (saved.male) {
          this.setData({
            partner1Name: saved.male.name || '',
            partner1Nickname: saved.male.nickname || '',
            partner2Name: saved.female.name || '',
            partner2Nickname: saved.female.nickname || '',
            startDate: saved.startDate || '2024-02-14',
          })
        }
      }
    },

    saveSettings() {
      wx.setStorageSync('appSettings', {
        theme: this.data.activeTheme,
        autoPlay: this.data.autoPlay,
        bgMusic: this.data.bgMusic,
        swiperMode: this.data.swiperMode,
        staffStyle: this.data.staffStyle,
        customBgPath: this.data.customBgPath,
      })
    },

    goBack() {
      wx.navigateBack()
    },

    goToPair() {
      wx.navigateTo({ url: '/pages/pair/pair' })
    },

    setTheme(e: { currentTarget: { dataset: { theme: string } } }) {
      const theme = e.currentTarget.dataset.theme
      if (theme === 'custom' && !this.data.customBgPath) {
        this.chooseCustomBg()
        return
      }
      this.applyTheme(theme)
    },

    applyTheme(theme: string) {
      this.setData({ activeTheme: theme })
      this.saveSettings()
      let themeClass = theme !== 'ink' ? `theme-${theme}` : ''
      let customBgStyle = ''
      if (theme === 'custom' && this.data.customBgPath) {
        themeClass = 'theme-custom'
        customBgStyle = `background-color:transparent;background-image:url(${this.data.customBgPath});background-size:cover;background-position:center;`
      }
      this.setData({ themeClass, customBgStyle })
      const app = getApp<IAppOption>()
      app.globalData.theme = theme
      wx.showToast({ title: '主题已切换', icon: 'success' })
    },

    chooseCustomBg() {
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album'],
        success: (res) => {
          const tempPath = res.tempFiles[0].tempFilePath
          const fs = wx.getFileSystemManager()
          const savedPath = `${wx.env.USER_DATA_PATH}/custom_theme_bg.jpg`
          try {
            fs.saveFile({
              tempFilePath: tempPath,
              filePath: savedPath,
              success: () => {
                this.setData({ customBgPath: savedPath })
                this.applyTheme('custom')
              },
              fail: () => {
                this.setData({ customBgPath: tempPath })
                this.applyTheme('custom')
              },
            })
          } catch (_e) {
            this.setData({ customBgPath: tempPath })
            this.applyTheme('custom')
          }
        },
      })
    },

    toggleAutoPlay() {
      this.setData({ autoPlay: !this.data.autoPlay })
      this.saveSettings()
    },

    toggleBgMusic() {
      const newValue = !this.data.bgMusic
      this.setData({ bgMusic: newValue })
      this.saveSettings()
      const app = getApp<IAppOption>()
      if (newValue) {
        if (!app.globalData.bgAudioContext) {
          app.globalData.bgAudioContext = wx.createInnerAudioContext()
          app.globalData.bgAudioContext.loop = true
        }
        app.globalData.bgAudioContext.play()
      } else if (app.globalData.bgAudioContext) {
        app.globalData.bgAudioContext.pause()
      }
    },

    openStaffStyle() {
      wx.showActionSheet({
        itemList: ['五线谱', '简谱', '无谱线'],
        success: (res) => {
          const styles = ['五线谱', '简谱', '无谱线']
          this.setData({ staffStyle: styles[res.tapIndex] })
          this.saveSettings()
          wx.showToast({ title: `已切换为${styles[res.tapIndex]}`, icon: 'success' })
        },
      })
    },

    onPartner1NameInput(e: { detail: { value: string } }) {
      this.setData({ partner1Name: e.detail.value })
    },

    onPartner1NicknameInput(e: { detail: { value: string } }) {
      this.setData({ partner1Nickname: e.detail.value })
    },

    onPartner2NameInput(e: { detail: { value: string } }) {
      this.setData({ partner2Name: e.detail.value })
    },

    onPartner2NicknameInput(e: { detail: { value: string } }) {
      this.setData({ partner2Nickname: e.detail.value })
    },

    onStartDateChange(e: { detail: { value: string } }) {
      this.setData({ startDate: e.detail.value })
    },

    saveCoupleInfo() {
      if (!this.data.partner1Name.trim() || !this.data.partner2Name.trim()) {
        wx.showToast({ title: '请填写姓名', icon: 'none' })
        return
      }
      this.doSaveCoupleInfo()
      wx.showToast({ title: '保存成功', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 1200)
    },

    autoSaveCoupleInfo() {
      this.doSaveCoupleInfo()
    },

    doSaveCoupleInfo() {
      const coupleInfo = {
        partner1: {
          name: this.data.partner1Name.trim(),
          nickname: this.data.partner1Nickname.trim() || this.data.partner1Name.trim(),
        },
        partner2: {
          name: this.data.partner2Name.trim(),
          nickname: this.data.partner2Nickname.trim() || this.data.partner2Name.trim(),
        },
        startDate: this.data.startDate,
      }
      wx.setStorageSync('coupleInfo', coupleInfo)
      const app = getApp<IAppOption>()
      if (app.globalData.coupleId) {
        wx.cloud.callFunction({
          name: 'coupleManager',
          data: {
            action: 'updateCoupleInfo',
            data: {
              partner1_name: this.data.partner1Name.trim(),
              partner2_name: this.data.partner2Name.trim(),
              startDate: this.data.startDate,
            },
          },
        })
      }
    },

    toggleSwiperMode() {
      this.setData({ swiperMode: !this.data.swiperMode })
      this.saveSettings()
    },

    async backupData() {
      wx.showLoading({ title: '备份中...' })
      try {
        const res = await wx.cloud.callFunction({
          name: 'eventManager',
          data: { action: 'list' },
        })
        wx.hideLoading()
        const result = res.result as any
        if (result && result.code === 0) {
          const data = JSON.stringify(result.data, null, 2)
          wx.setStorageSync('backupData', data)
          wx.showToast({ title: `已备份${(result.data || []).length}条记录`, icon: 'success' })
        } else {
          wx.showToast({ title: '备份失败', icon: 'none' })
        }
      } catch (_err) {
        wx.hideLoading()
        wx.showToast({ title: '网络错误', icon: 'none' })
      }
    },

    async exportPdf() {
      wx.showLoading({ title: '导出中...' })
      try {
        const res = await wx.cloud.callFunction({
          name: 'pdfExporter',
          data: { includePhotos: true },
        })
        wx.hideLoading()
        const result = res.result as any
        if (result && result.code === 0) {
          wx.showToast({ title: '数据已获取，请在画册页导出', icon: 'success' })
        } else {
          wx.showToast({ title: '导出失败', icon: 'none' })
        }
      } catch (_err) {
        wx.hideLoading()
        wx.showToast({ title: '网络错误', icon: 'none' })
      }
    },

    clearCache() {
      wx.showModal({
        title: '清除缓存',
        content: '确定要清除所有缓存数据吗？设置项也会重置。',
        confirmText: '清除',
        confirmColor: '#FF6B6B',
        success: (res) => {
          if (res.confirm) {
            wx.clearStorageSync()
            this.setData({
              activeTheme: 'ink',
              autoPlay: true,
              bgMusic: true,
              staffStyle: '五线谱',
            })
            wx.showToast({ title: '缓存已清除', icon: 'success' })
          }
        },
      })
    },

    openAbout() {
      wx.showModal({
        title: '关于和弦之约',
        content: '和弦之约 v1.0\n\n一款面向情侣的纪念画册小程序，以钢琴五线谱为视觉载体，帮助记录恋爱全过程关键回忆。\n\n辰 & 念',
        showCancel: false,
        confirmText: '知道了',
        confirmColor: '#C9A96E',
      })
    },

    openHelp() {
      wx.showModal({
        title: '帮助中心',
        content: '1. 画册页：浏览所有回忆事件\n2. 管理页：新增/编辑/删除事件\n3. 设置页：主题、音乐、导出等\n\n如遇问题请联系开发者',
        showCancel: false,
        confirmText: '知道了',
        confirmColor: '#C9A96E',
      })
    },

    onShareAppMessage() {
      return {
        title: '和弦之约 - 用乐谱记录我们的爱情故事',
        path: '/pages/home/home',
      }
    },
  },
})
