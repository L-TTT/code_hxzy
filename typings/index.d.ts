/// <reference path="./types/index.d.ts" />

interface IAppOption {
  globalData: {
    userInfo?: {
      _id: string
      openid: string
      nickName: string
      avatarUrl: string
      role: 'male' | 'female'
      points: number
      adWatchCount: number
      createdAt: string
      lastLoginTime: string
    }
    isLoggedIn: boolean
    theme: string
    coupleId: string
    startDate: string
    coupleInfo: {
      male: { name: string; nickname: string }
      female: { name: string; nickname: string }
    }
    adEnabled: boolean
    adUnitId: string
    innerAudioContext?: WechatMiniprogram.InnerAudioContext
    bgAudioContext?: WechatMiniprogram.InnerAudioContext
  }
  checkLoginStatus(): void
  userInfoReadyCallback?: WechatMiniprogram.GetUserInfoSuccessCallback
}
