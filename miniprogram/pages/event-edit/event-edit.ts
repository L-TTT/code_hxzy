interface PhotoItem {
  fileId?: string
  tempFilePath?: string
  description: string
  uploading: boolean
}

interface PageData {
  eventId: string
  isEdit: boolean
  title: string
  date: string
  description: string
  type: string
  photos: PhotoItem[]
  musicTitle: string
  musicArtist: string
  musicUrl: string
  musicFileName: string
  musicUploading: boolean
  musicPlaying: boolean
  locationName: string
  locationLat: number
  locationLng: number
  submitting: boolean
  typeOptions: Array<{ value: string; label: string; emoji: string }>
  statusBarHeight: number
  navBarHeight: number
  scrollHeight: number
}

Component({
  data: {
    themeClass: '',
    customBgStyle: '',
    eventId: '',
    isEdit: false,
    title: '',
    date: '',
    description: '',
    type: 'daily',
    photos: [] as PhotoItem[],
    musicTitle: '',
    musicArtist: '',
    musicUrl: '',
    musicFileName: '',
    musicUploading: false,
    musicPlaying: false,
    locationName: '',
    locationLat: 0,
    locationLng: 0,
    submitting: false,
    typeOptions: [
      { value: 'daily', label: '日常', emoji: '🌿' },
      { value: 'birthday', label: '生日', emoji: '🎂' },
      { value: 'anniversary', label: '纪念日', emoji: '💕' },
      { value: 'special', label: '特别', emoji: '⭐' },
    ],
    statusBarHeight: 0,
    navBarHeight: 0,
    scrollHeight: 600,
  } as PageData,

  lifetimes: {
    attached() {
      this.loadTheme()
      this.initNavBar()
    },
    ready() {
      this.loadEventData()
    },
    detached() {
      const app = getApp<IAppOption>()
      if (app.globalData.innerAudioContext && this.data.musicPlaying) {
        app.globalData.innerAudioContext.stop()
      }
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

    loadEventData() {
      let eventId = ''
      try {
        const pages = getCurrentPages()
        const cur = pages[pages.length - 1] as any
        eventId = (cur && cur.options && cur.options.id) || ''
      } catch (_e) {
        eventId = ''
      }

      if (eventId) {
        this.setData({ isEdit: true, eventId })
        this.fetchEvent(eventId)
      }
    },

    async fetchEvent(eventId: string) {
      wx.showLoading({ title: '加载中...' })
      try {
        const res = await wx.cloud.callFunction({
          name: 'eventManager',
          data: { action: 'get', eventId },
        })
        wx.hideLoading()

        const result = res.result as any
        if (result && result.code === 0) {
          const event = result.data
          this.setData({
            title: event.title || '',
            date: event.date || '',
            description: event.description || '',
            type: event.type || 'daily',
            photos: (event.photos || []).map((p: any) => ({
              fileId: p.fileId,
              description: p.description || '',
              uploading: false,
            })),
            musicTitle: (event.music && event.music.title) || '',
            musicArtist: (event.music && event.music.artist) || '',
            musicUrl: (event.music && event.music.url) || '',
            musicFileName: (event.music && event.music.url) ? '已添加音乐文件' : '',
            locationName: (event.location && event.location.name) || '',
            locationLat: (event.location && event.location.latitude) || 0,
            locationLng: (event.location && event.location.longitude) || 0,
          })
        } else {
          wx.showToast({ title: '加载失败', icon: 'none' })
        }
      } catch (err) {
        wx.hideLoading()
        wx.showToast({ title: '网络错误', icon: 'none' })
      }
    },

    onTitleInput(e: any) {
      this.setData({ title: e.detail.value })
    },

    onDateChange(e: any) {
      this.setData({ date: e.detail.value })
    },

    onTypeSelect(e: any) {
      this.setData({ type: e.currentTarget.dataset.value })
    },

    onDescInput(e: any) {
      this.setData({ description: e.detail.value })
    },

    onMusicTitleInput(e: any) {
      this.setData({ musicTitle: e.detail.value })
    },

    onMusicArtistInput(e: any) {
      this.setData({ musicArtist: e.detail.value })
    },

    onMusicUrlInput(e: any) {
      this.setData({ musicUrl: e.detail.value })
    },

    onLocationInput(e: any) {
      this.setData({ locationName: e.detail.value })
    },

    onPhotoDescInput(e: any) {
      const index = e.currentTarget.dataset.index
      const photos = [...this.data.photos]
      photos[index].description = e.detail.value
      this.setData({ photos })
    },

    chooseLocation() {
      wx.chooseLocation({
        success: (res: any) => {
          this.setData({
            locationName: res.name,
            locationLat: Number(res.latitude),
            locationLng: Number(res.longitude),
          })
        },
        fail: () => {},
      })
    },

    async choosePhoto() {
      const remaining = 9 - this.data.photos.length
      if (remaining <= 0) {
        wx.showToast({ title: '最多9张照片', icon: 'none' })
        return
      }

      try {
        const res = await wx.chooseMedia({
          count: remaining,
          mediaType: ['image'],
          sizeType: ['compressed'],
        })

        const newPhotos: PhotoItem[] = res.tempFiles.map(f => ({
          tempFilePath: f.tempFilePath,
          description: '',
          uploading: true,
        }))

        const startIndex = this.data.photos.length
        this.setData({ photos: [...this.data.photos, ...newPhotos] })

        for (let i = startIndex; i < this.data.photos.length; i++) {
          await this.uploadPhoto(i)
        }
      } catch (err) {
        void 0
      }
    },

    async uploadPhoto(index: number) {
      const photo = this.data.photos[index]
      if (!photo.tempFilePath) return

      try {
        const fileName = photo.tempFilePath.split('/').pop() || 'photo.jpg'

        const urlRes = await wx.cloud.callFunction({
          name: 'uploadManager',
          data: { action: 'getUploadUrl', fileName, eventType: this.data.type },
        })

        const urlResult = urlRes.result as any
        if (!urlResult || urlResult.code !== 0) {
          this.markPhotoDone(index)
          return
        }

        const uploadRes = await wx.cloud.uploadFile({
          cloudPath: urlResult.data.cloudPath,
          filePath: photo.tempFilePath,
        })

        const photos = [...this.data.photos]
        photos[index].fileId = uploadRes.fileID
        photos[index].uploading = false
        this.setData({ photos })
      } catch (err) {
        this.markPhotoDone(index)
      }
    },

    markPhotoDone(index: number) {
      const photos = [...this.data.photos]
      photos[index].uploading = false
      this.setData({ photos })
    },

    deletePhoto(e: any) {
      const index = e.currentTarget.dataset.index
      const photos = [...this.data.photos]
      photos.splice(index, 1)
      this.setData({ photos })
    },

    async chooseMusicFile() {
      if (this.data.musicUploading) return
      try {
        const res = await wx.chooseMessageFile({
          count: 1,
          type: 'file',
          extension: ['mp3', 'wav', 'aac', 'm4a', 'flac', 'ogg', 'wma'],
        })
        const file = res.tempFiles[0]
        const fileName = file.name || 'music.mp3'
        this.setData({ musicUploading: true, musicFileName: fileName })
        const cloudPath = `music/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${fileName}`
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath,
          filePath: file.path,
        })
        this.setData({
          musicUrl: uploadRes.fileID,
          musicUploading: false,
        })
        wx.showToast({ title: '音乐已添加', icon: 'success' })
      } catch (err: any) {
        this.setData({ musicUploading: false })
        if (err && err.errMsg && err.errMsg.indexOf('cancel') === -1) {
          wx.showToast({ title: '选择失败', icon: 'none' })
        }
      }
    },

    previewMusic() {
      if (!this.data.musicUrl) return
      const app = getApp<IAppOption>()
      if (this.data.musicPlaying) {
        if (app.globalData.innerAudioContext) {
          app.globalData.innerAudioContext.pause()
        }
        this.setData({ musicPlaying: false })
        return
      }
      if (!app.globalData.innerAudioContext) {
        app.globalData.innerAudioContext = wx.createInnerAudioContext()
      }
      const audio = app.globalData.innerAudioContext
      audio.src = this.data.musicUrl
      audio.play()
      this.setData({ musicPlaying: true })
      audio.onEnded(() => {
        this.setData({ musicPlaying: false })
      })
      audio.onError(() => {
        this.setData({ musicPlaying: false })
        wx.showToast({ title: '播放失败', icon: 'none' })
      })
    },

    removeMusicFile() {
      const app = getApp<IAppOption>()
      if (app.globalData.innerAudioContext && this.data.musicPlaying) {
        app.globalData.innerAudioContext.stop()
      }
      this.setData({
        musicUrl: '',
        musicFileName: '',
        musicPlaying: false,
      })
    },

    async saveEvent() {
      if (this.data.submitting) return
      if (!this.data.title.trim()) {
        wx.showToast({ title: '请输入标题', icon: 'none' })
        return
      }
      if (!this.data.date) {
        wx.showToast({ title: '请选择日期', icon: 'none' })
        return
      }

      const uploading = this.data.photos.some(p => p.uploading)
      if (uploading) {
        wx.showToast({ title: '照片上传中，请稍候', icon: 'none' })
        return
      }

      this.setData({ submitting: true })

      const eventData: any = {
        title: this.data.title,
        date: this.data.date,
        description: this.data.description,
        type: this.data.type,
        photos: this.data.photos
          .filter(p => p.fileId)
          .map((p, i) => ({
            fileId: p.fileId,
            description: p.description,
            order: i,
          })),
      }

      if (this.data.musicTitle || this.data.musicUrl) {
        eventData.music = {
          title: this.data.musicTitle,
          artist: this.data.musicArtist,
          url: this.data.musicUrl,
        }
      }

      if (this.data.locationName) {
        eventData.location = {
          name: this.data.locationName,
          latitude: this.data.locationLat,
          longitude: this.data.locationLng,
        }
      }

      try {
        const action = this.data.isEdit ? 'update' : 'create'
        const params: any = { action, eventData }
        if (this.data.isEdit) params.eventId = this.data.eventId

        const res = await wx.cloud.callFunction({
          name: 'eventManager',
          data: params,
        })

        this.setData({ submitting: false })

        const result = res.result as any
        if (result && result.code === 0) {
          wx.showToast({ title: '保存成功', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 1500)
        } else {
          wx.showToast({ title: (result && result.message) || '保存失败', icon: 'none' })
        }
      } catch (err) {
        this.setData({ submitting: false })
        wx.showToast({ title: '网络错误', icon: 'none' })
      }
    },
  },
})
