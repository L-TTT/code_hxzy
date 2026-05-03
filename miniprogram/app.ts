App<IAppOption>({
  globalData: {
    isLoggedIn: false,
    userInfo: undefined,
    theme: 'ink',
    coupleId: '',
    startDate: '2024-02-14',
    coupleInfo: {
      male: { name: '李', nickname: '' },
      female: { name: '杨', nickname: '' },
    },
    adEnabled: false,
    adUnitId: '',
  },
  onLaunch() {
    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)

    wx.cloud.init({
      env: 'toust-d9gu1e0km340d2d2f',
      traceUser: true,
    })

    const settings = wx.getStorageSync('appSettings') || {}
    if (settings.theme) {
      this.globalData.theme = settings.theme
    }

    this.checkLoginStatus()
  },
  async checkLoginStatus() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'login'
      })
      
      if (res.result && (res.result as any).code === 0) {
        this.globalData.isLoggedIn = true
        this.globalData.userInfo = (res.result as any).data.userInfo
        if ((res.result as any).data.userInfo && (res.result as any).data.userInfo.coupleId) {
          this.globalData.coupleId = (res.result as any).data.userInfo.coupleId
        }
      }
    } catch (err) {
      console.error('检查登录状态失败:', err)
    }
  },
})