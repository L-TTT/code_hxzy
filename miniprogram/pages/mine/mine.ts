Component({
  data: {
    themeClass: '',
    customBgStyle: '',
    activeFilter: 'all',
    navBarRight: 0,
    navBarHeight: 0,
    statusBarHeight: 0,
    loading: false,
    events: [] as any[],
    filteredEvents: [] as any[],
    showModal: false,
    newEvent: {
      type: 'birthday',
      title: '',
      date: '',
      music: '',
      description: '',
    },
  },
  lifetimes: {
    attached() {
      this.loadTheme()
      this.initNavBar()
      this.loadEvents()
    },
  },
  pageLifetimes: {
    show() {
      if (typeof this.getTabBar === 'function' && this.getTabBar()) {
        this.getTabBar().setData({ selected: 1 })
      }
      this.loadTheme()
      this.loadEvents()
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
      const menuBtn = wx.getMenuButtonBoundingClientRect()
      const statusBarHeight = sysInfo.statusBarHeight || 44
      const navBarHeight = (menuBtn.top - statusBarHeight) * 2 + menuBtn.height
      const navBarRight = sysInfo.windowWidth - menuBtn.left + 16
      this.setData({ statusBarHeight, navBarHeight, navBarRight })
    },

    async loadEvents() {
      this.setData({ loading: true })
      try {
        const res = await wx.cloud.callFunction({
          name: 'eventManager',
          data: { action: 'list' },
        })
        const result = res.result as any
        if (result && result.code === 0) {
          const events = (result.data || []).map((e: any) => this.enrichEvent(e))
          this.setData({ events })
          this.filterEvents()
        }
      } catch (_err) {
        wx.showToast({ title: '加载失败', icon: 'none' })
      } finally {
        this.setData({ loading: false })
      }
    },

    enrichEvent(event: any) {
      const startDate = new Date('2024-02-14')
      const eventDate = new Date(event.date)
      const day = Math.max(0, Math.floor((eventDate.getTime() - startDate.getTime()) / 86400000))
      const dateStr = event.date.replace(/-/g, '.')
      const year = event.date.slice(0, 4)
      const typeMap: Record<string, { tagEmoji: string; tagName: string; bpm: number }> = {
        birthday: { tagEmoji: '🎂', tagName: '生日', bpm: 72 },
        anniversary: { tagEmoji: '�', tagName: '纪念日', bpm: 60 },
        daily: { tagEmoji: '🌿', tagName: '日常', bpm: 80 },
      }
      const info = typeMap[event.type] || { tagEmoji: '✨', tagName: '特殊', bpm: 72 }
      return {
        ...event,
        dateStr,
        day,
        year,
        tagEmoji: info.tagEmoji,
        tagName: info.tagName,
        bpm: info.bpm,
        musicName: (event.music && event.music.title) || '未设置',
      }
    },

    setFilter(e: { currentTarget: { dataset: { filter: string } } }) {
      this.setData({ activeFilter: e.currentTarget.dataset.filter })
      this.filterEvents()
    },

    filterEvents() {
      const { activeFilter, events } = this.data
      const filtered = activeFilter === 'all'
        ? events
        : events.filter((e: any) => e.type === activeFilter)

      let lastYear = ''
      filtered.forEach((e: any, i: number) => {
        e.showYear = i === 0 || e.year !== lastYear
        lastYear = e.year
      })

      this.setData({ filteredEvents: filtered })
    },

    showAddModal() {
      wx.navigateTo({ url: '/pages/event-edit/event-edit' })
    },

    hideAddModal() {
      this.setData({ showModal: false })
    },

    preventBubble() {
      // prevent event bubbling to modal-mask
    },

    selectType(e: { currentTarget: { dataset: { type: string } } }) {
      this.setData({ 'newEvent.type': e.currentTarget.dataset.type })
    },

    onInput(e: { currentTarget: { dataset: { field: string } }; detail: { value: string } }) {
      this.setData({ [`newEvent.${e.currentTarget.dataset.field}`]: e.detail.value })
    },

    onDateChange(e: { detail: { value: string } }) {
      this.setData({ 'newEvent.date': e.detail.value })
    },

    async confirmAdd() {
      const { newEvent } = this.data
      if (!newEvent.title.trim()) {
        wx.showToast({ title: '请输入事件标题', icon: 'none' })
        return
      }
      if (!newEvent.date) {
        wx.showToast({ title: '请选择日期', icon: 'none' })
        return
      }

      wx.showLoading({ title: '保存中...' })
      try {
        const res = await wx.cloud.callFunction({
          name: 'eventManager',
          data: {
            action: 'create',
            eventData: {
              title: newEvent.title,
              date: newEvent.date,
              type: newEvent.type,
              description: newEvent.description || '记录这个美好的瞬间',
              photos: [],
              music: { title: newEvent.music || '' },
            },
          },
        })
        wx.hideLoading()
        const result = res.result as any
        if (result && result.code === 0) {
          this.setData({ showModal: false })
          wx.showToast({ title: '保存成功', icon: 'success' })
          await this.loadEvents()
        } else {
          wx.showToast({ title: (result && result.message) || '保存失败', icon: 'none' })
        }
      } catch (_err) {
        wx.hideLoading()
        wx.showToast({ title: '网络错误', icon: 'none' })
      }
    },

    goToDetail(e: { currentTarget: { dataset: { id: string } } }) {
      wx.navigateTo({
        url: `/pages/event-detail/event-detail?id=${e.currentTarget.dataset.id}`,
      })
    },

    showEventMenu(e: { currentTarget: { dataset: { id: string } } }) {
      const id = e.currentTarget.dataset.id
      wx.showActionSheet({
        itemList: ['查看详情', '编辑', '删除'],
        success: (res) => {
          if (res.tapIndex === 0) {
            wx.navigateTo({ url: `/pages/event-detail/event-detail?id=${id}` })
          } else if (res.tapIndex === 1) {
            wx.navigateTo({ url: `/pages/event-edit/event-edit?id=${id}` })
          } else {
            this.deleteEvent(id)
          }
        },
      })
    },

    async deleteEvent(eventId: string) {
      const modalRes = await wx.showModal({
        title: '确认删除',
        content: '确定要删除这个事件吗？',
        confirmText: '删除',
        confirmColor: '#FF6B6B',
      })
      if (!modalRes.confirm) return

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
          await this.loadEvents()
        } else {
          wx.showToast({ title: (result && result.message) || '删除失败', icon: 'none' })
        }
      } catch (_err) {
        wx.hideLoading()
        wx.showToast({ title: '网络错误', icon: 'none' })
      }
    },

    switchTab(e: { currentTarget: { dataset: { tab: string } } }) {
      if (e.currentTarget.dataset.tab === 'home') {
        wx.switchTab({ url: '/pages/home/home' })
      }
    },
  },
})
