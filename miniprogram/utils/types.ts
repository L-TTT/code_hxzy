export interface ScoreConfig {
  lineColor: string
  lineSpacing: number
  backgroundColor: string
  staffWidth: number
  staffHeight: number
}

export interface NoteData {
  id: string
  eventId: string
  position: number
  type: 'standard' | 'birthday' | 'anniversary' | 'daily'
  timestamp: number
}

export interface CardData {
  id: string
  imageUrl: string
  description: string
  x: number
  y: number
  width: number
  height: number
}

export interface EventData {
  _id: string
  openid: string
  title: string
  date: string
  description: string
  type: 'daily' | 'birthday' | 'anniversary' | 'special'
  photos: Array<{
    url: string
    description: string
    order: number
  }>
  music: {
    title: string
    artist: string
    fileId: string
    url: string
    src?: string
  } | null
  location: {
    name: string
    latitude: number
    longitude: number
  } | null
  sort: number
  createdAt: string
  updatedAt: string
}

export interface UserInfo {
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
