import type { LyricLine, ParsedLrc, SongInfo } from '../types'

let idSeed = 0

export function createLine(content = '', time = ''): LyricLine {
  idSeed += 1
  return {
    id: `line-${idSeed}-${Date.now()}`,
    time,
    content,
    timeReadOnly: true,
    contentReadOnly: true,
    translationReadOnly: true,
  }
}

export function formatTime(seconds: number): string {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0
  const totalSeconds = Math.floor(safeSeconds)
  const centiseconds = Math.floor((safeSeconds - totalSeconds) * 100)
  const minutes = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`)
  return `${pad(minutes)}:${pad(secs)}.${pad(centiseconds)}`
}

export function parseTimeToSeconds(text: string): number | null {
  const value = text.trim()
  if (!value) return null
  const match = value.match(/^(?:(\d{1,3}):)?(\d{1,2}(?:[.:]\d{1,3})?)$/)
  if (!match) return null
  const minutes = match[1] ? Number(match[1]) : 0
  const secondsPart = match[2]
  const parts = secondsPart.split(/[.:]/)
  const seconds = Number(parts[0] || 0)
  const fractionText = parts[1] || ''
  const fraction = fractionText ? Number(`0.${fractionText}`) : 0
  const total = minutes * 60 + seconds + fraction
  return Number.isFinite(total) ? total : null
}

export function parseLrc(text: string): ParsedLrc {
  const lines = text.split(/\r?\n/)
  const info: SongInfo = { ti: '', ar: '', al: '', by: '' }
  const lyricLines: LyricLine[] = []
  const timeTagPattern = /\[(\d{1,2}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    const metaMatch = line.match(/^\[(ti|ar|al|by|offset|length|re|ve):(.*)\]$/i)
    if (metaMatch) {
      const key = metaMatch[1].toLowerCase()
      const value = metaMatch[2].trim()
      if (key in info) {
        info[key as keyof SongInfo] = value
      }
      continue
    }

    const timeTags = [...line.matchAll(timeTagPattern)]
    const content = line.replace(timeTagPattern, '').trim()
    if (timeTags.length === 0) {
      if (content) lyricLines.push(createLine(content))
      continue
    }

    for (const match of timeTags) {
      const minutes = Number(match[1])
      const rawSeconds = match[2].replace(':', '.')
      const parts = rawSeconds.split('.')
      const seconds = Number(parts[0] || 0)
      const fractionRaw = parts[1] || '0'
      const fraction = Number(`0.${fractionRaw}`)
      const total = minutes * 60 + seconds + fraction
      lyricLines.push(createLine(content, formatTime(total)))
    }
  }

  return { info, lines: lyricLines }
}

export function parsePlainLyrics(text: string): LyricLine[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => createLine(line))
}

export function buildLrc(info: SongInfo, lines: LyricLine[]): string {
  const infoLines = [
    `[ti:${info.ti}]`,
    `[ar:${info.ar}]`,
    `[al:${info.al}]`,
    `[by:${info.by}]`,
  ].join('\n')

  const lyricLines = lines
    .filter((line) => line.time)
    .map((line) => {
      const translation = line.translation ? ` / ${line.translation}` : ''
      return `[${line.time}]${line.content}${translation}`
    })

  return `${infoLines}\n${lyricLines.join('\n')}\n`
}
