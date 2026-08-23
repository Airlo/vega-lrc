<script setup lang="ts">
import { ref, watch } from 'vue'
import { getApiKey, setApiKey, translateLyrics } from '../utils/deepseek'
import type { LyricLine } from '../types'

const props = defineProps<{
  visible: boolean
  lyricLines: LyricLine[]
}>()

const emit = defineEmits<{
  close: []
  updated: []
}>()

const apiKey = ref('')
const targetLanguage = ref('简体中文')
const translating = ref(false)
const message = ref('')

watch(
  () => props.visible,
  (visible) => {
    if (!visible) return
    apiKey.value = getApiKey()
    targetLanguage.value = '简体中文'
    message.value = ''
  },
)

async function handleTranslate() {
  if (!apiKey.value.trim()) {
    message.value = '请先输入 DeepSeek API Key'
    return
  }
  const lines = props.lyricLines.filter((line) => line.content.trim())
  if (lines.length === 0) {
    message.value = '没有可翻译的歌词'
    return
  }

  setApiKey(apiKey.value)
  translating.value = true
  message.value = ''
  try {
    const translations = await translateLyrics(
      lines.map((line) => line.content),
      targetLanguage.value.trim() || '简体中文',
      apiKey.value.trim(),
    )
    let index = 0
    for (const line of props.lyricLines) {
      if (line.content.trim()) {
        line.translation = translations[index] ?? ''
        index += 1
      }
    }
    message.value = '翻译完成，可以关闭弹窗后在歌词列表中手动修改。'
    emit('updated')
  } catch (error) {
    message.value = error instanceof Error ? error.message : '翻译失败，请重试'
  } finally {
    translating.value = false
  }
}

function clearTranslations() {
  props.lyricLines.forEach((line) => {
    line.translation = ''
  })
  message.value = '已清除全部翻译'
  emit('updated')
}
</script>

<template>
  <div v-if="visible" class="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" @click.self="emit('close')">
    <div class="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl dark:border-gray-700 dark:bg-gray-900">
      <div class="mb-4 flex items-center justify-between">
        <h3 class="text-lg font-semibold">DeepSeek 翻译</h3>
        <button type="button" class="rounded-lg px-2 py-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200" @click="emit('close')">
          ✕
        </button>
      </div>

      <label class="block">
        <span class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">DeepSeek API Key</span>
        <input
          v-model="apiKey"
          type="password"
          placeholder="sk-..."
          class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-gray-700 dark:bg-gray-950"
        />
        <span class="mt-1 block text-xs text-gray-400">Key 只保存在你浏览器本地，用于直接请求 DeepSeek。</span>
      </label>

      <label class="mt-3 block">
        <span class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">目标语言</span>
        <input
          v-model="targetLanguage"
          type="text"
          placeholder="简体中文"
          class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-gray-700 dark:bg-gray-950"
        />
      </label>

      <div class="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
          :disabled="translating"
          @click="handleTranslate"
        >
          {{ translating ? '翻译中…' : '🌐 翻译全部' }}
        </button>
        <button
          type="button"
          class="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          @click="clearTranslations"
        >
          清除翻译
        </button>
        <button
          type="button"
          class="ml-auto rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          @click="emit('close')"
        >
          关闭
        </button>
      </div>

      <p v-if="message" class="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-gray-950 dark:text-gray-300">
        {{ message }}
      </p>
    </div>
  </div>
</template>
