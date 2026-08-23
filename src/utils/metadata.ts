import { parseBlob } from 'music-metadata'
import type { SongInfo } from '../types'

export interface AudioMetadata {
  info: SongInfo
  coverUrl?: string
}

export async function readAudioMetadata(file: File): Promise<AudioMetadata> {
  try {
    const metadata = await parseBlob(file)
    const common = metadata.common
    const picture = common.picture?.[0]
    let coverUrl: string | undefined

    if (picture) {
      const blob = new Blob([picture.data as BlobPart], { type: picture.format })
      coverUrl = URL.createObjectURL(blob)
    }

    return {
      info: {
        ti: common.title ?? '',
        ar: common.artist ?? (common.artists ?? []).join(' / '),
        al: common.album ?? '',
        by: '',
      },
      coverUrl,
    }
  } catch (error) {
    console.warn('Failed to read audio metadata', error)
    return {
      info: { ti: '', ar: '', al: '', by: '' },
      coverUrl: undefined,
    }
  }
}
