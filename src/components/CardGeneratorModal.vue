<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toPng } from 'html-to-image'
import type { CardTemplateId, LyricCard, LyricLine, SongInfo } from '../types'
import { useCardsStore } from '../stores/cards'

const props = defineProps<{
  visible: boolean
  songInfo: SongInfo
  lyricLines: LyricLine[]
  coverUrl: string
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const cardsStore = useCardsStore()

const templateId = ref<CardTemplateId>('cover')
const selectedIndices = ref<number[]>([])
const previewRef = ref<HTMLElement | null>(null)
const isDownloading = ref(false)
const isSaving = ref(false)
const savedMessage = ref('')
const coverDataUrl = ref('')

const templates: { id: CardTemplateId; name: string; description: string }[] = [
  { id: 'cover', name: '封面卡片', description: '封面图 + 歌曲信息' },
  { id: 'minimal', name: '极简渐变', description: '大字号歌词 + 渐变背景' },
  { id: 'poster', name: '歌词海报', description: '模糊背景 + 居中排版' },
]

const selectedLyrics = computed(() =>
  selectedIndices.value
    .map((index) => props.lyricLines[index]?.content)
    .filter((content): content is string => Boolean(content)),
)

const previewStyle = computed(() => {
  if (templateId.value === 'minimal') {
    return {
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    }
  }
  if (templateId.value === 'cover') {
    return {
      background: 'linear-gradient(135deg, #1e1b4b 0%, #4c1d95 100%)',
    }
  }
  return {
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
  }
})

watch(
  () => props.visible,
  async (visible) => {
    if (!visible) return
    selectedIndices.value = props.lyricLines
      .map((line, index) => (line.content ? index : -1))
      .filter((index) => index >= 0)
    templateId.value = 'cover'
    savedMessage.value = ''
    coverDataUrl.value = ''
    if (props.coverUrl) {
      coverDataUrl.value = (await objectUrlToDataUrl(props.coverUrl)) ?? ''
    }
  },
)

function toggleSelect(index: number) {
  if (selectedIndices.value.includes(index)) {
    selectedIndices.value = selectedIndices.value.filter((item) => item !== index)
  } else {
    selectedIndices.value = [...selectedIndices.value, index].sort((a, b) => a - b)
  }
}

function selectAllLyrics() {
  selectedIndices.value = props.lyricLines
    .map((line, index) => (line.content ? index : -1))
    .filter((index) => index >= 0)
}

function clearLyrics() {
  selectedIndices.value = []
}

async function objectUrlToDataUrl(url: string): Promise<string | undefined> {
  try {
    const response = await fetch(url)
    const blob = await response.blob()
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return undefined
  }
}

async function saveCard() {
  if (selectedLyrics.value.length === 0) return
  isSaving.value = true
  try {
    let cover: string | undefined
    if (coverDataUrl.value) {
      cover = coverDataUrl.value
    } else if (props.coverUrl) {
      cover = await objectUrlToDataUrl(props.coverUrl)
    }
    const card: LyricCard = {
      id: `card-${Date.now()}`,
      templateId: templateId.value,
      title: props.songInfo.ti || '未命名歌曲',
      artist: props.songInfo.ar || '未知歌手',
      album: props.songInfo.al || '',
      cover,
      lyrics: selectedLyrics.value,
      createdAt: Date.now(),
    }
    cardsStore.addCard(card)
    savedMessage.value = '已收藏到歌词卡片'
    emit('saved')
  } finally {
    isSaving.value = false
  }
}

async function downloadCard() {
  if (!previewRef.value || selectedLyrics.value.length === 0) return
  isDownloading.value = true
  try {
    const dataUrl = await toPng(previewRef.value, {
      pixelRatio: 2,
      cacheBust: true,
    })
    const link = document.createElement('a')
    link.download = `${props.songInfo.ti || 'lyric-card'}.png`
    link.href = dataUrl
    link.click()
  } finally {
    isDownloading.value = false
  }
}
</script>

<template>
  <div v-if="visible" class="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" @click.self="emit('close')">
    <div class="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
      <div class="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
        <h3 class="text-lg font-semibold">生成歌词卡片</h3>
        <button type="button" class="rounded-lg px-2 py-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200" @click="emit('close')">
          ✕
        </button>
      </div>

      <div class="grid flex-1 gap-5 overflow-y-auto p-5 md:grid-cols-[280px_1fr]">
        <!-- 预览 -->
        <div class="flex flex-col items-center gap-3">
          <div
            ref="previewRef"
            class="relative aspect-[3/4] w-full overflow-hidden rounded-2xl shadow-xl"
            :style="previewStyle"
          >
            <img
              v-if="coverDataUrl && templateId !== 'minimal'"
              :src="coverDataUrl"
              alt=""
              class="absolute inset-0 h-full w-full object-cover"
            />
            <div v-if="templateId === 'cover'" class="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/10 p-5 flex flex-col justify-end text-white">
              <div v-if="selectedLyrics.length" class="space-y-1.5">
                <p v-for="(line, index) in selectedLyrics.slice(0, 6)" :key="index" class="text-sm font-medium leading-snug">{{ line }}</p>
              </div>
              <div class="mt-4 border-t border-white/20 pt-3">
                <p class="text-base font-bold">{{ songInfo.ti || '未命名歌曲' }}</p>
                <p class="mt-0.5 text-xs text-white/75">{{ songInfo.ar || '未知歌手' }}</p>
              </div>
            </div>

            <div v-else-if="templateId === 'minimal'" class="absolute inset-0 flex flex-col justify-center p-7 text-white">
              <div class="space-y-2">
                <p v-for="(line, index) in selectedLyrics.slice(0, 8)" :key="index" class="text-lg font-bold leading-snug">{{ line }}</p>
              </div>
              <div class="mt-6">
                <p class="text-sm font-semibold opacity-90">{{ songInfo.ti || '未命名歌曲' }}</p>
                <p class="mt-0.5 text-xs opacity-70">{{ songInfo.ar || '未知歌手' }}</p>
              </div>
            </div>

            <div v-else class="absolute inset-0 bg-black/45 p-6 flex flex-col items-center justify-center text-center text-white">
              <div class="space-y-2">
                <p v-for="(line, index) in selectedLyrics.slice(0, 5)" :key="index" class="text-base font-semibold leading-relaxed">{{ line }}</p>
              </div>
              <div class="mt-5">
                <p class="text-sm font-bold tracking-wide">{{ songInfo.ti || '未命名歌曲' }}</p>
                <p class="mt-1 text-xs text-white/70">{{ songInfo.ar || '未知歌手' }} · {{ songInfo.al || '专辑未知' }}</p>
              </div>
            </div>
          </div>

          <div class="flex gap-2">
            <button
              type="button"
              class="rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
              :disabled="isDownloading || selectedLyrics.length === 0"
              @click="downloadCard"
            >
              {{ isDownloading ? '生成中…' : '⬇️ 下载 PNG' }}
            </button>
            <button
              type="button"
              class="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
              :disabled="isSaving || selectedLyrics.length === 0"
              @click="saveCard"
            >
              {{ isSaving ? '保存中…' : '💾 收藏卡片' }}
            </button>
          </div>
          <p v-if="savedMessage" class="text-xs font-medium text-emerald-600 dark:text-emerald-400">{{ savedMessage }}</p>
        </div>

        <!-- 配置 -->
        <div class="space-y-5">
          <div>
            <h4 class="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">模板</h4>
            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="template in templates"
                :key="template.id"
                type="button"
                class="rounded-xl border p-3 text-left transition"
                :class="templateId === template.id ? 'border-violet-500 bg-violet-50 dark:bg-violet-500/10' : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'"
                @click="templateId = template.id"
              >
                <p class="text-sm font-semibold text-gray-800 dark:text-gray-100">{{ template.name }}</p>
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ template.description }}</p>
              </button>
            </div>
          </div>

          <div>
            <div class="mb-2 flex items-center justify-between">
              <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-200">选择歌词</h4>
              <div class="flex gap-1">
                <button type="button" class="rounded-lg px-2 py-1 text-xs text-violet-600 transition hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-500/10" @click="selectAllLyrics">
                  全选
                </button>
                <button type="button" class="rounded-lg px-2 py-1 text-xs text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800" @click="clearLyrics">
                  取消全选
                </button>
              </div>
            </div>
            <div class="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-gray-200 p-2 dark:border-gray-700">
              <label
                v-for="(line, index) in lyricLines"
                :key="line.id"
                class="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 transition hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <input
                  type="checkbox"
                  class="mt-1 h-3.5 w-3.5 accent-violet-600"
                  :checked="selectedIndices.includes(index)"
                  :disabled="!line.content"
                  @change="toggleSelect(index)"
                />
                <span class="min-w-0 flex-1 text-sm text-gray-700 dark:text-gray-200">
                  <span v-if="line.time" class="mr-1 font-mono text-xs text-gray-400">{{ line.time }}</span>
                  {{ line.content || '（空行）' }}
                </span>
              </label>
              <p v-if="lyricLines.length === 0" class="px-2 py-4 text-center text-sm text-gray-400">暂无歌词可生成</p>
            </div>
            <p class="mt-1 text-xs text-gray-400">已选 {{ selectedLyrics.length }} 行</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
