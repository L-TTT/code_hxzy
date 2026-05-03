const backgroundAudioManager = wx.getBackgroundAudioManager()

Component({
  properties: {
    musicList: {
      type: Array,
      value: [],
    },
    currentTrack: {
      type: Number,
      value: 0,
    },
  },

  data: {
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    progress: 0,
    currentTimeStr: '0:00',
    durationStr: '0:00',
  },

  lifetimes: {
    attached() {
      this.setupAudioListeners()
    },
    detached() {
      backgroundAudioManager.stop()
    },
  },

  methods: {
    setupAudioListeners() {
      backgroundAudioManager.onPlay(() => {
        this.setData({ isPlaying: true })
      })
      backgroundAudioManager.onPause(() => {
        this.setData({ isPlaying: false })
      })
      backgroundAudioManager.onStop(() => {
        this.setData({ isPlaying: false, currentTime: 0, progress: 0, currentTimeStr: '0:00' })
      })
      backgroundAudioManager.onTimeUpdate(() => {
        const currentTime = backgroundAudioManager.currentTime || 0
        const duration = backgroundAudioManager.duration || 0
        const progress = duration > 0 ? (currentTime / duration) * 100 : 0
        this.setData({
          currentTime,
          duration,
          progress,
          currentTimeStr: this.formatTime(currentTime),
          durationStr: this.formatTime(duration),
        })
      })
      backgroundAudioManager.onEnded(() => {
        this.nextTrack()
      })
      backgroundAudioManager.onError((err) => {
        console.error('音频播放错误:', err)
        this.setData({ isPlaying: false })
      })
    },

    togglePlay() {
      if (this.data.isPlaying) {
        backgroundAudioManager.pause()
      } else {
        const list = this.properties.musicList
        const track = list[this.properties.currentTrack]
        if (track && track.src) {
          backgroundAudioManager.title = track.title || '未知歌曲'
          backgroundAudioManager.singer = track.artist || '未知艺术家'
          backgroundAudioManager.src = track.src
        } else {
          wx.showToast({ title: '暂无音乐', icon: 'none' })
        }
      }
    },

    nextTrack() {
      const list = this.properties.musicList
      if (list.length === 0) return
      const next = (this.properties.currentTrack + 1) % list.length
      this.triggerEvent('trackchange', { index: next })
      this.playTrack(next)
    },

    prevTrack() {
      const list = this.properties.musicList
      if (list.length === 0) return
      const prev = (this.properties.currentTrack - 1 + list.length) % list.length
      this.triggerEvent('trackchange', { index: prev })
      this.playTrack(prev)
    },

    playTrack(index: number) {
      const track = this.properties.musicList[index]
      if (track && track.src) {
        backgroundAudioManager.title = track.title || '未知歌曲'
        backgroundAudioManager.singer = track.artist || '未知艺术家'
        backgroundAudioManager.src = track.src
      }
    },

    onProgressTap(e: any) {
      const { duration } = this.data
      if (!duration || duration <= 0) return

      const query = this.createSelectorQuery()
      query.select('.progress-bar').boundingClientRect()
      query.exec((res) => {
        if (!res[0]) return
        const rect = res[0]
        const tapX = e.detail.x - rect.left
        const percent = Math.max(0, Math.min(1, tapX / rect.width))
        const seekTime = percent * duration
        backgroundAudioManager.seek(seekTime)
      })
    },

    formatTime(seconds: number): string {
      if (!seconds || seconds < 0) return '0:00'
      const min = Math.floor(seconds / 60)
      const sec = Math.floor(seconds % 60)
      const secStr = sec < 10 ? '0' + sec : '' + sec
      return `${min}:${secStr}`
    },
  },
})
