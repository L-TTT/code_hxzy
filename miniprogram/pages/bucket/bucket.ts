interface BucketItem {
  _id: string
  title: string
  description: string
  category: string
  status: 'pending' | 'done'
  createdBy: string
  createdAt: string
  completedAt: string | null
  completedBy: string
  linkedEventId: string
  timeText?: string
}

Component({
  data: {
    themeClass: '',
    customBgStyle: '',
    statusBarHeight: 0,
    scrollHeight: 0,
    loading: false,
    paired: false,
    items: [] as BucketItem[],
    totalCount: 0,
    doneCount: 0,
    pendingCount: 0,
    activeFilter: 'all',
    activeCategory: 'all',
    sortBy: 'time',
    categories: ['旅行', '美食', '体验', '日常', '挑战'],
    showAdd: false,
    formTitle: '',
    formDesc: '',
    formCategory: '日常',
    seededOnce: false,
    editingId: '',
  },

  lifetimes: {
    attached() {
      this.loadTheme()
      this.initLayout()
    },
    ready() {
      this.loadCategories()
      this.loadItems()
    },
  },

  pageLifetimes: {
    show() {
      this.loadTheme()
      this.loadItems()
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

    initLayout() {
      try {
        const sysInfo = wx.getSystemInfoSync()
        const statusBarHeight = sysInfo.statusBarHeight || 44
        const headerContentHeight = 160
        const scrollHeight = sysInfo.windowHeight - statusBarHeight - headerContentHeight
        this.setData({ statusBarHeight, scrollHeight: Math.max(scrollHeight, 300) })
      } catch (_e) {
        this.setData({ statusBarHeight: 44, scrollHeight: 500 })
      }
    },

    loadCategories() {
      const saved = wx.getStorageSync('bucketCategories')
      if (saved && saved.length > 0) {
        this.setData({ categories: saved })
      }
    },

    saveCategories() {
      wx.setStorageSync('bucketCategories', this.data.categories)
    },

    async checkPairStatus() {
      try {
        const app = getApp<IAppOption>()
        if (app.globalData.coupleId) {
          this.setData({ paired: true })
          return true
        }
        const statusRes = await wx.cloud.callFunction({
          name: 'coupleManager',
          data: { action: 'getStatus' },
        })
        const statusResult = statusRes.result as any
        if (statusResult && statusResult.code === 0 && statusResult.data && statusResult.data.paired) {
          app.globalData.coupleId = statusResult.data.coupleId
          this.setData({ paired: true })
          return true
        }
        this.setData({ paired: false })
        return false
      } catch (_e) {
        this.setData({ paired: false })
        return false
      }
    },

    goToPair() {
      wx.navigateTo({ url: '/pages/pair/pair' })
    },

    async loadItems() {
      const isPaired = await this.checkPairStatus()
      if (!isPaired) {
        this.setData({ loading: false, items: [], totalCount: 0, doneCount: 0, pendingCount: 0 })
        return
      }
      this.setData({ loading: true })
      try {
        const res = await wx.cloud.callFunction({
          name: 'coupleManager',
          data: {
            action: 'listBucketItems',
            filter: {
              status: this.data.activeFilter,
              category: this.data.activeCategory,
              sortBy: this.data.sortBy,
            },
          },
        })
        const result = res.result as any
        if (result && result.code === 0) {
          const items: BucketItem[] = (result.data || []).map((item: BucketItem) => ({
            ...item,
            timeText: this.formatTime(item.createdAt),
          }))
          if (items.length === 0 && !this.data.seededOnce
            && this.data.activeFilter === 'all' && this.data.activeCategory === 'all') {
            this.setData({ seededOnce: true })
            try {
              const seedRes = await wx.cloud.callFunction({
                name: 'coupleManager',
                data: { action: 'seedDefaultItems' },
              })
              const seedResult = seedRes.result as any
              console.log('[bucket] seedDefaultItems result:', JSON.stringify(seedResult))
              if (seedResult && seedResult.code === 0 && seedResult.data && seedResult.data.seeded) {
                this.setData({ loading: false })
                setTimeout(() => this.loadItems(), 800)
                return
              }
              if (seedResult && seedResult.code !== 0) {
                console.warn('[bucket] seed failed:', seedResult.message)
              }
            } catch (seedErr) {
              console.error('[bucket] seed error:', seedErr)
            }
          }
          const doneCount = items.filter((i: BucketItem) => i.status === 'done').length
          this.setData({
            items,
            totalCount: items.length,
            doneCount,
            pendingCount: items.length - doneCount,
            loading: false,
          })
        } else {
          this.setData({ loading: false })
        }
      } catch (err) {
        console.error('[bucket] loadItems error:', err)
        this.setData({ loading: false })
      }
    },

    formatTime(dateStr: string): string {
      if (!dateStr) return ''
      const date = new Date(dateStr)
      const now = new Date()
      const diff = now.getTime() - date.getTime()
      if (diff < 60000) return '刚刚'
      if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
      if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
      return `${date.getMonth() + 1}/${date.getDate()}`
    },

    setFilter(e: { currentTarget: { dataset: { filter: string } } }) {
      this.setData({ activeFilter: e.currentTarget.dataset.filter })
      this.loadItems()
    },

    setCategory(e: { currentTarget: { dataset: { category: string } } }) {
      this.setData({ activeCategory: e.currentTarget.dataset.category })
      this.loadItems()
    },

    setSort(e: { currentTarget: { dataset: { sort: string } } }) {
      this.setData({ sortBy: e.currentTarget.dataset.sort })
      this.loadItems()
    },

    showAddModal() {
      this.setData({
        showAdd: true,
        formTitle: '',
        formDesc: '',
        formCategory: '日常',
        editingId: '',
      })
    },

    hideAddModal() {
      this.setData({ showAdd: false })
    },

    preventClose() {},

    onFormTitleInput(e: { detail: { value: string } }) {
      this.setData({ formTitle: e.detail.value })
    },

    onFormDescInput(e: { detail: { value: string } }) {
      this.setData({ formDesc: e.detail.value })
    },

    selectCategory(e: { currentTarget: { dataset: { category: string } } }) {
      this.setData({ formCategory: e.currentTarget.dataset.category })
    },

    showCustomCategory() {
      wx.showModal({
        title: '自定义分类',
        editable: true,
        placeholderText: '输入分类名称',
        success: (res) => {
          if (res.confirm && res.content && res.content.trim()) {
            const newCat = res.content.trim()
            const cats = this.data.categories
            if (cats.indexOf(newCat) === -1) {
              cats.push(newCat)
              this.setData({ categories: cats, formCategory: newCat })
              this.saveCategories()
            } else {
              this.setData({ formCategory: newCat })
            }
          }
        },
      })
    },

    async submitItem() {
      const { formTitle, formDesc, formCategory, editingId } = this.data
      if (!formTitle.trim()) {
        wx.showToast({ title: '请输入心愿内容', icon: 'none' })
        return
      }

      wx.showLoading({ title: '保存中...' })
      try {
        if (editingId) {
          const res = await wx.cloud.callFunction({
            name: 'coupleManager',
            data: {
              action: 'updateBucketItem',
              itemId: editingId,
              data: { title: formTitle, description: formDesc, category: formCategory },
            },
          })
          const result = res.result as any
          if (result && result.code === 0) {
            wx.showToast({ title: '已更新', icon: 'success' })
            this.setData({ showAdd: false })
            this.loadItems()
          } else {
            wx.showToast({ title: result.message || '更新失败', icon: 'none' })
          }
        } else {
          const res = await wx.cloud.callFunction({
            name: 'coupleManager',
            data: {
              action: 'addBucketItem',
              data: { title: formTitle, description: formDesc, category: formCategory },
            },
          })
          const result = res.result as any
          if (result && result.code === 0) {
            wx.showToast({ title: '已添加', icon: 'success' })
            this.setData({ showAdd: false })
            this.loadItems()
          } else {
            wx.showToast({ title: result.message || '添加失败', icon: 'none' })
          }
        }
      } catch (_err) {
        wx.showToast({ title: '网络错误', icon: 'none' })
      }
      wx.hideLoading()
    },

    async toggleComplete(e: { currentTarget: { dataset: { id: string } } }) {
      const itemId = e.currentTarget.dataset.id
      try {
        const res = await wx.cloud.callFunction({
          name: 'coupleManager',
          data: { action: 'completeBucketItem', itemId },
        })
        const result = res.result as any
        if (result && result.code === 0) {
          wx.showToast({ title: result.data.status === 'done' ? '已完成' : '已恢复', icon: 'success' })
          this.loadItems()
        }
      } catch (_err) {
        wx.showToast({ title: '操作失败', icon: 'none' })
      }
    },

    showDetail(e: { currentTarget: { dataset: { id: string } } }) {
      const item = this.data.items.find((i: BucketItem) => i._id === e.currentTarget.dataset.id)
      if (!item) return
      this.setData({
        showAdd: true,
        editingId: item._id,
        formTitle: item.title,
        formDesc: item.description,
        formCategory: item.category,
      })
    },

    async deleteItem(e: { currentTarget: { dataset: { id: string } } }) {
      const itemId = e.currentTarget.dataset.id
      wx.showModal({
        title: '确认删除',
        content: '删除后无法恢复',
        success: async (res) => {
          if (res.confirm) {
            try {
              const cloudRes = await wx.cloud.callFunction({
                name: 'coupleManager',
                data: { action: 'deleteBucketItem', itemId },
              })
              const result = cloudRes.result as any
              if (result && result.code === 0) {
                wx.showToast({ title: '已删除', icon: 'success' })
                this.loadItems()
              }
            } catch (_err) {
              wx.showToast({ title: '删除失败', icon: 'none' })
            }
          }
        },
      })
    },

    createEventFromItem(e: { currentTarget: { dataset: { item: BucketItem } } }) {
      const item = e.currentTarget.dataset.item
      const completedDate = item.completedAt ? new Date(item.completedAt).toISOString().split('T')[0] : ''
      const params = encodeURIComponent(JSON.stringify({
        title: item.title,
        description: item.description,
        date: completedDate,
        bucketItemId: item._id,
      }))
      wx.navigateTo({ url: `/pages/event-edit/event-edit?fromBucket=${params}` })
    },
  },
})
