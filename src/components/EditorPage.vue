<script setup lang="ts">
import { nextTick, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue'
import WaveSurfer from 'wavesurfer.js'
import { createLine, formatTime, parseLrc, parsePlainLyrics, buildLrc, parseTimeToSeconds } from '../utils/lrc'
import { readAudioMetadata } from '../utils/metadata'
import { downloadTextFile } from '../utils/download'
import CardGeneratorModal from './CardGeneratorModal.vue'
import TranslationModal from './TranslationModal.vue'
import type { LyricLine, SongInfo } from '../types'

const isDark = ref(false)
const audioFile = ref<File | null>(null)
const audioName = ref('')
const audioUrl = ref('')
const coverUrl = ref('')
const audioReady = ref(false)
const isPlaying = ref(false)
const songInfo = ref<SongInfo>({ ti: '', ar: '', al: '', by: '' })
const audioMetaInfo = ref<SongInfo | null>(null)
const lyricLines = ref<LyricLine[]>([])
const currentIndex = ref(0)
const jumpSeconds = ref(0.5)
const jumpTimeInput = ref('')
const duration = ref(0)
const currentPlayTime = ref(0)
const activeLineIndex = ref(-1)
const showGrid = ref(true)
const previewRef = ref<HTMLElement | null>(null)

const lyricsModalVisible = ref(false)
const lyricsText = ref('')
const exportModalVisible = ref(false)
const exportContent = ref('')
const cardModalVisible = ref(false)
const translationModalVisible = ref(false)

const waveContainer = ref<HTMLElement | null>(null)
const lyricListRef = ref<HTMLElement | null>(null)
let wavesurfer: WaveSurfer | null = null

function toggleTheme() {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark', isDark.value)
}

function resetEditing() {
  lyricLines.value.forEach((line) => {
    line.timeReadOnly = true
    line.contentReadOnly = true
    line.translationReadOnly = true
  })
}

function startEditTime(line: LyricLine) {
  resetEditing()
  line.timeReadOnly = false
}

function finishEditTime(line: LyricLine) {
  line.timeReadOnly = true
}

function startEditContent(line: LyricLine) {
  resetEditing()
  line.contentReadOnly = false
}

function finishEditContent(line: LyricLine) {
  line.contentReadOnly = true
}

function startEditTranslation(line: LyricLine) {
  resetEditing()
  line.translationReadOnly = false
}

function finishEditTranslation(line: LyricLine) {
  line.translationReadOnly = true
}

async function handleAudioChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  input.value = ''

  audioFile.value = file
  audioName.value = file.name
  audioReady.value = false
  isPlaying.value = false
  currentPlayTime.value = 0
  activeLineIndex.value = -1
  duration.value = 0

  if (audioUrl.value) URL.revokeObjectURL(audioUrl.value)
  if (coverUrl.value) URL.revokeObjectURL(coverUrl.value)
  coverUrl.value = ''

  const url = URL.createObjectURL(file)
  audioUrl.value = url

  if (wavesurfer) {
    wavesurfer.load(url)
    wavesurfer.once('ready', () => {
      audioReady.value = true
    })
  }

  const meta = await readAudioMetadata(file)
  if (meta.coverUrl) {
    coverUrl.value = meta.coverUrl
  }
  audioMetaInfo.value = meta.info
  if (meta.info.ti || meta.info.ar || meta.info.al) {
    songInfo.value = { ...meta.info }
  }
}

function togglePlay() {
  if (!wavesurfer || !audioReady.value) return
  if (isPlaying.value) {
    wavesurfer.pause()
  } else {
    wavesurfer.play()
  }
}

function jumpBy(seconds: number) {
  if (!wavesurfer || !audioReady.value) return
  const target = Math.min(Math.max(0, wavesurfer.getCurrentTime() + seconds), duration.value || Number.MAX_SAFE_INTEGER)
  wavesurfer.setTime(target)
}

function jumpToInput() {
  if (!wavesurfer || !audioReady.value) return
  const seconds = parseTimeToSeconds(jumpTimeInput.value)
  if (seconds === null) return
  const target = Math.min(Math.max(0, seconds), duration.value || seconds)
  wavesurfer.setTime(target)
}

function updateActiveLine(time: number) {
  let active = -1
  for (let i = 0; i < lyricLines.value.length; i += 1) {
    const lineTime = parseTimeToSeconds(lyricLines.value[i].time)
    if (lineTime !== null && lineTime <= time) {
      active = i
    }
  }
  activeLineIndex.value = active
}

function tagLyc() {
  if (!wavesurfer || !audioReady.value) return
  const line = lyricLines.value[currentIndex.value]
  if (!line) return
  line.time = formatTime(wavesurfer.getCurrentTime())
  if (currentIndex.value < lyricLines.value.length - 1) {
    currentIndex.value += 1
    scrollToCurrent()
  }
}

function selectRow(index: number) {
  currentIndex.value = index
}

function scrollToCurrent() {
  nextTick(() => {
    const el = lyricListRef.value?.querySelector(`[data-index="${currentIndex.value}"]`)
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  })
}

function openLyricsModal() {
  lyricsText.value = ''
  lyricsModalVisible.value = true
}

function confirmLyrics() {
  lyricLines.value = parsePlainLyrics(lyricsText.value)
  currentIndex.value = 0
  activeLineIndex.value = -1
  updateActiveLine(currentPlayTime.value)
  lyricsModalVisible.value = false
}

function addLine() {
  lyricLines.value.push(createLine())
}

function removeLine(index: number) {
  lyricLines.value.splice(index, 1)
  if (currentIndex.value >= lyricLines.value.length) {
    currentIndex.value = Math.max(0, lyricLines.value.length - 1)
  }
}

async function readTextFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    return new TextDecoder('gbk').decode(buffer)
  }
}

async function handleLrcImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  input.value = ''

  const text = await readTextFile(file)
  const parsed = parseLrc(text)
  songInfo.value = parsed.info
  lyricLines.value = parsed.lines.length ? parsed.lines : [createLine()]
  currentIndex.value = 0
  activeLineIndex.value = -1
  updateActiveLine(currentPlayTime.value)

  if (audioMetaInfo.value && (audioMetaInfo.value.ti || audioMetaInfo.value.ar || audioMetaInfo.value.al)) {
    const useAudioMeta = window.confirm('检测到当前音频文件已有元数据。是否用音频元数据覆盖 LRC 文件中的歌曲信息？')
    if (useAudioMeta) {
      songInfo.value = { ...audioMetaInfo.value }
    }
  }
}

function openExport() {
  exportContent.value = buildLrc(songInfo.value, lyricLines.value)
  exportModalVisible.value = true
}

function downloadLrc() {
  downloadTextFile(`${getDefaultFileName()}.lrc`, exportContent.value)
}

function getDefaultFileName() {
  return audioName.value.replace(/\.[^.]+$/, '') || songInfo.value.ti || 'lyrics'
}

onMounted(() => {
  if (!waveContainer.value) return
  wavesurfer = WaveSurfer.create({
    container: waveContainer.value,
    waveColor: '#a78bfa',
    progressColor: '#6366f1',
    cursorColor: '#a855f7',
    height: 72,
    barWidth: 2,
    barGap: 1,
    barRadius: 2,
  })
  wavesurfer.on('play', () => {
    isPlaying.value = true
  })
  wavesurfer.on('pause', () => {
    isPlaying.value = false
  })
  wavesurfer.on('finish', () => {
    isPlaying.value = false
  })
  wavesurfer.on('ready', () => {
    audioReady.value = true
    duration.value = wavesurfer?.getDuration() ?? 0
  })
  wavesurfer.on('timeupdate', (time: number) => {
    currentPlayTime.value = time
    updateActiveLine(time)
  })
})

watch(activeLineIndex, (index) => {
  if (index < 0) return
  nextTick(() => {
    const el = previewRef.value?.querySelector(`[data-preview-index="${index}"]`)
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  })
})

onDeactivated(() => {
  if (wavesurfer && isPlaying.value) {
    wavesurfer.pause()
  }
})

onBeforeUnmount(() => {
  wavesurfer?.destroy()
  wavesurfer = null
})
</script>

<template>
  <div class="min-h-screen bg-gray-50 text-gray-900 transition-colors dark:bg-gray-950 dark:text-gray-100">
    <header class="sticky top-0 z-40 border-b border-gray-200/80 bg-white/80 backdrop-blur dark:border-gray-800 dark:bg-gray-950/80">
      <div class="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <div class="flex items-center gap-2">
          <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-lg text-white shadow-lg shadow-violet-500/20">
            ✦
          </div>
          <div>
            <h1 class="text-base font-semibold leading-tight">Vega LRC</h1>
            <p class="text-xs text-gray-500 dark:text-gray-400">歌词在线编辑器</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <RouterLink
            to="/cards"
            class="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            🗂 歌词卡片
          </RouterLink>
          <button
            type="button"
            class="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            @click="toggleTheme"
          >
            {{ isDark ? '☀️ 浅色' : '🌙 深色' }}
          </button>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div class="space-y-6">
      <!-- 工具栏 -->
      <div class="mb-5 space-y-3">
        <div class="flex flex-wrap items-center gap-2">
          <label class="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition hover:bg-violet-500">
            <span>📤 上传歌曲</span>
            <input type="file" accept="audio/*" class="hidden" @change="handleAudioChange" />
          </label>

          <button
            type="button"
            class="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium transition hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
            @click="openLyricsModal"
          >
            📋 粘贴歌词
          </button>

          <label class="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium transition hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800">
            <span>📂 导入 LRC</span>
            <input type="file" accept=".lrc,.txt" class="hidden" @change="handleLrcImport" />
          </label>

          <div class="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              class="rounded-xl border border-sky-600/30 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700 transition hover:bg-sky-100 dark:bg-sky-500/10 dark:text-sky-300 dark:hover:bg-sky-500/20"
              @click="translationModalVisible = true"
            >
              🌐 翻译
            </button>
            <button
              type="button"
              class="rounded-xl border border-violet-600/30 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-100 dark:bg-violet-500/10 dark:text-violet-300 dark:hover:bg-violet-500/20"
              @click="cardModalVisible = true"
            >
              🖼 生成卡片
            </button>
            <button
              type="button"
              class="rounded-xl border border-emerald-600/30 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
              @click="openExport"
            >
              ⬇️ 导出歌词
            </button>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <button
            type="button"
            class="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
            :disabled="!audioReady"
            @click="togglePlay"
          >
            {{ isPlaying ? '⏸ 暂停' : '▶️ 播放' }}
          </button>

          <button
            type="button"
            class="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            :disabled="!audioReady"
            @click="jumpBy(-jumpSeconds)"
          >
            ⏪ 快退 {{ jumpSeconds }}s
          </button>
          <input
            v-model.number="jumpSeconds"
            type="number"
            min="0.1"
            step="0.1"
            class="w-20 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-700 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
          />
          <button
            type="button"
            class="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            :disabled="!audioReady"
            @click="jumpBy(jumpSeconds)"
          >
            快进 {{ jumpSeconds }}s ⏩
          </button>
          <button
            type="button"
            class="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="!audioReady"
            @click="tagLyc"
          >
            🎯 打时间戳
          </button>

          <span class="mx-1 text-gray-300 dark:text-gray-600">|</span>

          <input
            v-model="jumpTimeInput"
            type="text"
            placeholder="00:00.00"
            class="w-28 rounded-lg border border-gray-300 bg-white px-2 py-1.5 font-mono text-xs text-gray-700 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
            @keyup.enter="jumpToInput"
          />
          <button
            type="button"
            class="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
            :disabled="!audioReady"
            @click="jumpToInput"
          >
            跳转
          </button>

          <label class="ml-auto flex cursor-pointer items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <input v-model="showGrid" type="checkbox" class="h-3.5 w-3.5 accent-violet-600" />
            6 段辅助线
          </label>
        </div>
      </div>
          <!-- 音频信息 + 波形 -->
          <section class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div class="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
          <div class="flex items-center gap-4">
            <div class="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800">
              <img v-if="coverUrl" :src="coverUrl" alt="封面" class="h-full w-full object-cover" />
              <div v-else class="flex h-full w-full items-center justify-center text-2xl text-gray-400">
                🎵
              </div>
            </div>
            <div class="min-w-0">
              <p class="truncate text-sm font-medium">{{ audioName || '尚未上传音频' }}</p>
              <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {{ songInfo.ti || '未读取到标题' }} · {{ songInfo.ar || '未知歌手' }}
              </p>
              <p v-if="audioReady" class="mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                ● 音频已就绪
              </p>
            </div>
          </div>

          <div class="min-w-0 flex-1">
            <div v-if="showGrid && duration > 0" class="relative mb-1 h-5">
              <span
                v-for="i in 7"
                :key="`label-${i}`"
                class="absolute -translate-x-1/2 font-mono text-[10px] text-gray-400 dark:text-gray-500"
                :style="{ left: `${((i - 1) / 6) * 100}%` }"
              >{{ formatTime((duration * (i - 1)) / 6) }}</span>
            </div>
            <div class="relative">
              <div ref="waveContainer" class="w-full"></div>
              <div v-if="showGrid && duration > 0" class="pointer-events-none absolute inset-0 z-10">
                <div
                  v-for="i in 7"
                  :key="i"
                  class="absolute top-0 h-full w-px bg-gray-300/60 dark:bg-gray-600/40"
                  :style="{ left: `${((i - 1) / 6) * 100}%` }"
                ></div>
              </div>
            </div>
          </div>
        </div>

        <!-- 歌曲信息 -->
        <div class="grid grid-cols-1 gap-3 border-t border-gray-100 p-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-gray-800">
          <label class="block">
            <span class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">歌曲名</span>
            <input
              v-model="songInfo.ti"
              type="text"
              placeholder="请输入歌曲名"
              class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-gray-700 dark:bg-gray-950"
            />
          </label>
          <label class="block">
            <span class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">歌手名</span>
            <input
              v-model="songInfo.ar"
              type="text"
              placeholder="请输入歌手名"
              class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-gray-700 dark:bg-gray-950"
            />
          </label>
          <label class="block">
            <span class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">专辑名</span>
            <input
              v-model="songInfo.al"
              type="text"
              placeholder="请输入专辑名"
              class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-gray-700 dark:bg-gray-950"
            />
          </label>
          <label class="block">
            <span class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">制作者</span>
            <input
              v-model="songInfo.by"
              type="text"
              placeholder="请输入制作者"
              class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-gray-700 dark:bg-gray-950"
            />
          </label>
        </div>
      </section>

      <!-- 歌词 + 播放预览 -->
      <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <!-- 歌词列表 -->
      <section class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div class="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-200">
            歌词列表 <span class="ml-1 text-xs font-normal text-gray-400">{{ lyricLines.length }} 行</span>
          </h2>
          <button
            type="button"
            class="rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:border-violet-400 hover:text-violet-600 dark:border-gray-700 dark:text-gray-300 dark:hover:text-violet-300"
            @click="addLine"
          >
            ＋ 添加一行
          </button>
        </div>

        <div ref="lyricListRef" class="max-h-[520px] overflow-y-auto">
          <div class="grid grid-cols-[48px_100px_1fr_1fr_110px] border-b border-gray-50 bg-gray-50/60 px-3 py-2 text-xs font-semibold text-gray-500 dark:border-gray-800/60 dark:bg-gray-950/40 dark:text-gray-400">
            <span>行数</span>
            <span>时间</span>
            <span>歌词</span>
            <span>翻译</span>
            <span class="text-right">操作</span>
          </div>

          <div
            v-for="(line, index) in lyricLines"
            :key="line.id"
            :data-index="index"
            class="grid grid-cols-[48px_100px_1fr_1fr_110px] items-center gap-2 border-b border-gray-50 px-3 py-2 transition-colors last:border-b-0 dark:border-gray-800/60"
            :class="index === currentIndex ? 'bg-violet-50 dark:bg-violet-500/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/40'"
          >
            <span class="text-sm text-gray-400" :class="{ 'font-bold text-violet-600 dark:text-violet-300': index === currentIndex }">
              {{ index + 1 }}
            </span>

            <div class="rounded-lg px-2 py-1" :title="'可双击修改'" @dblclick="startEditTime(line)">
              <input
                v-if="!line.timeReadOnly"
                v-model="line.time"
                class="w-full rounded-md border border-violet-300 bg-white px-2 py-1 font-mono text-xs text-gray-800 outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-violet-700 dark:bg-gray-950 dark:text-gray-100"
                @blur="finishEditTime(line)"
              />
              <span v-else class="block cursor-text font-mono text-xs text-gray-700 dark:text-gray-200">
                {{ line.time || '--:--.--' }}
              </span>
            </div>

            <div class="rounded-lg px-2 py-1" :title="'可双击修改'" @dblclick="startEditContent(line)">
              <input
                v-if="!line.contentReadOnly"
                v-model="line.content"
                class="w-full rounded-md border border-violet-300 bg-white px-2 py-1 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-violet-700 dark:bg-gray-950 dark:text-gray-100"
                @blur="finishEditContent(line)"
              />
              <span v-else class="block cursor-text text-sm text-gray-800 dark:text-gray-100">
                {{ line.content || '（空）' }}
              </span>
            </div>

            <div class="rounded-lg px-2 py-1" :title="'可双击修改'" @dblclick="startEditTranslation(line)">
              <input
                v-if="!line.translationReadOnly"
                v-model="line.translation"
                class="w-full rounded-md border border-sky-300 bg-white px-2 py-1 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-sky-700 dark:bg-gray-950 dark:text-gray-100"
                @blur="finishEditTranslation(line)"
              />
              <span v-else class="block cursor-text text-sm text-gray-500 dark:text-gray-400">
                {{ line.translation || '（无翻译）' }}
              </span>
            </div>

            <div class="flex items-center justify-end gap-1">
              <button
                type="button"
                class="rounded-lg px-2 py-1 text-xs font-medium text-violet-600 transition hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-500/10"
                :class="{ 'bg-violet-100 dark:bg-violet-500/20': index === currentIndex }"
                @click="selectRow(index)"
              >
                {{ index === currentIndex ? '✓ 当前行' : '选中此行' }}
              </button>
              <button
                type="button"
                class="rounded-lg px-2 py-1 text-xs text-gray-400 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                title="删除此行"
                @click="removeLine(index)"
              >
                ✕
              </button>
            </div>
          </div>

          <div v-if="lyricLines.length === 0" class="px-6 py-16 text-center">
            <p class="text-3xl">🎼</p>
            <p class="mt-3 text-sm text-gray-400">还没有歌词，先“粘贴歌词”或“导入 LRC”吧</p>
          </div>
        </div>
        </section>

        <aside class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div class="border-b border-gray-100 px-4 py-3 dark:border-gray-800">
            <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-200">
              播放预览
              <span class="ml-1 text-xs font-normal text-gray-400">{{ currentPlayTime.toFixed(2) }}s</span>
            </h2>
          </div>
          <div ref="previewRef" class="max-h-[520px] space-y-1 overflow-y-auto p-3">
            <div v-if="lyricLines.length === 0" class="px-4 py-16 text-center text-sm text-gray-400">
              暂无歌词
            </div>
            <div
              v-for="(line, index) in lyricLines"
              :key="`preview-${line.id}`"
              :data-preview-index="index"
              class="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200"
              :class="index === activeLineIndex ? 'scale-110 bg-violet-100 text-violet-900 shadow-lg dark:bg-violet-500/20 dark:text-violet-100' : 'text-gray-600 dark:text-gray-300'"
            >
              <span class="w-14 shrink-0 text-right font-mono text-[11px] text-gray-400 dark:text-gray-500">
                {{ line.time || '--:--.--' }}
              </span>
              <span
                class="flex-1 text-center leading-snug transition-all duration-200"
                :class="index === activeLineIndex ? 'text-base font-bold' : 'text-sm'"
              >
                {{ line.content || '（空）' }}
              </span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  </main>

    <!-- 粘贴歌词弹窗 -->
    <div v-if="lyricsModalVisible" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" @click.self="lyricsModalVisible = false">
      <div class="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl dark:border-gray-700 dark:bg-gray-900">
        <h3 class="mb-3 text-lg font-semibold">粘贴歌词</h3>
        <textarea
          v-model="lyricsText"
          rows="12"
          placeholder="把歌词粘贴到这里，建议一句一行。程序会自动忽略空行。"
          class="w-full resize-y rounded-xl border border-gray-300 bg-white p-3 text-sm leading-relaxed outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-gray-700 dark:bg-gray-950"
        ></textarea>
        <div class="mt-4 flex justify-end gap-2">
          <button type="button" class="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800" @click="lyricsModalVisible = false">
            取消
          </button>
          <button type="button" class="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500" @click="confirmLyrics">
            确定
          </button>
        </div>
      </div>
    </div>

    <!-- 导出预览弹窗 -->
    <div v-if="exportModalVisible" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" @click.self="exportModalVisible = false">
      <div class="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl dark:border-gray-700 dark:bg-gray-900">
        <div class="mb-3 flex items-center justify-between">
          <h3 class="text-lg font-semibold">导出预览</h3>
          <span class="text-xs text-gray-400">文件名：{{ getDefaultFileName() }}.lrc</span>
        </div>
        <pre class="flex-1 overflow-auto whitespace-pre-wrap rounded-xl bg-gray-50 p-4 font-mono text-xs leading-relaxed text-gray-700 dark:bg-gray-950 dark:text-gray-300">{{ exportContent }}</pre>
        <div class="mt-4 flex justify-end gap-2">
          <button type="button" class="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800" @click="exportModalVisible = false">
            关闭
          </button>
          <button type="button" class="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500" @click="downloadLrc">
            ⬇️ 下载 LRC
          </button>
        </div>
      </div>
    </div>

    <TranslationModal
      :visible="translationModalVisible"
      :lyric-lines="lyricLines"
      @close="translationModalVisible = false"
    />

    <CardGeneratorModal
      :visible="cardModalVisible"
      :song-info="songInfo"
      :lyric-lines="lyricLines"
      :cover-url="coverUrl"
      @close="cardModalVisible = false"
      @saved="cardModalVisible = false"
    />
  </div>
</template>
