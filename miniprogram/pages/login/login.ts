Component({
  data: {
    themeClass: '',
    customBgPath: '',
    phase: 'loading' as 'loading' | 'register',
    statusBarHeight: 0,
    navBarHeight: 0,
    nickName: '',
    avatarUrl: '',
    role: '' as '' | 'male' | 'female',
    submitting: false,
    canIUseNicknameComp: wx.canIUse('input.type.nickname'),
  },
  lifetimes: {
    attached() {
      this.loadTheme()
      this.initNavBar()
      this.checkLogin()
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
      const sysInfo = wx.getSystemInfoSync()
      const statusBarHeight = sysInfo.statusBarHeight || 44
      this.setData({ statusBarHeight })
    },
    checkLogin() {
      wx.cloud.callFunction({
        name: 'login',
        success: (res: any) => {
          console.log('[login] 云函数返回:', res)
          const result = res.result
          if (result.code === 0 && !result.data.isNewUser) {
            const userInfo = result.data.userInfo
            const app = getApp<IAppOption>()
            app.globalData.userInfo = userInfo
            app.globalData.isLoggedIn = true
            if (userInfo.coupleId) {
              app.globalData.coupleId = userInfo.coupleId
            }
            wx.switchTab({ url: '/pages/home/home' })
          } else {
            this.setData({ phase: 'register' })
          }
        },
        fail: (err: any) => {
          console.error('[login] 云函数调用失败:', err)
          this.setData({ phase: 'register' })
        }
      })
    },
    onChooseAvatar(e: any) {
      this.setData({ avatarUrl: e.detail.avatarUrl })
    },
    onNicknameInput(e: any) {
      this.setData({ nickName: e.detail.value })
    },
    onNicknameChange(e: any) {
      this.setData({ nickName: e.detail.value })
    },
    selectRole(e: any) {
      const role = e.currentTarget.dataset.role
      this.setData({ role })
    },
    canSubmit() {
      const { nickName, role, submitting } = this.data
      return nickName.trim().length > 0 && role !== '' && !submitting
    },
    handleRegister() {
      const { nickName, avatarUrl, role } = this.data
      if (!nickName.trim()) {
        wx.showToast({ title: '请输入昵称', icon: 'none' })
        return
      }
      if (!role) {
        wx.showToast({ title: '请选择身份', icon: 'none' })
        return
      }

      this.setData({ submitting: true })

      wx.cloud.callFunction({
        name: 'register',
        data: {
          nickName: nickName.trim(),
          avatarUrl: avatarUrl,
          role: role,
        },
        success: (res: any) => {
          console.log('[register] 云函数返回:', res)
          const result = res.result
          if (result.code === 0) {
            const app = getApp<IAppOption>()
            app.globalData.userInfo = result.data
            app.globalData.isLoggedIn = true
            wx.showToast({ title: '注册成功', icon: 'success' })
            setTimeout(() => {
              wx.navigateTo({ url: '/pages/pair/pair' })
            }, 1000)
          } else {
            wx.showToast({ title: result.message || '注册失败', icon: 'none' })
          }
        },
        fail: (err: any) => {
          console.error('[register] 云函数调用失败:', err)
          wx.showToast({ title: '网络错误，请重试', icon: 'none' })
        },
        complete: () => {
          this.setData({ submitting: false })
        }
      })
    },
  },
})
