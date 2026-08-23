export interface LyricLine {
  id: string
  time: string
  content: string
  timeReadOnly: boolean
  contentReadOnly: boolean
  translation?: string
  translationReadOnly?: boolean
}

export interface SongInfo {
  ti: string
  ar: string
  al: string
  by: string
}

export interface ParsedLrc {
  info: SongInfo
  lines: LyricLine[]
}

export type CardTemplateId = 'cover' | 'minimal' | 'poster'

export interface LyricCard {
  id: string
  templateId: CardTemplateId
  title: string
  artist: string
  album: string
  cover?: string
  lyrics: string[]
  createdAt: number
}
