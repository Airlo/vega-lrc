<script setup lang="ts">
import { ref } from 'vue'
import { toPng } from 'html-to-image'
import { useCardsStore } from '../stores/cards'
import type { LyricCard } from '../types'

const cardsStore = useCardsStore()
const downloadingId = ref('')

function cardStyle(card: LyricCard) {
  if (card.templateId === 'minimal') {
    return { background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }
  }
  if (card.templateId === 'cover') {
    return { background: 'linear-gradient(135deg, #1e1b4b 0%, #4c1d95 100%)' }
  }
  return { background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }
}

async function downloadCard(card: LyricCard, element: HTMLElement) {
  downloadingId.value = card.id
  try {
    const dataUrl = await toPng(element, { pixelRatio: 2, cacheBust: true })
    const link = document.createElement('a')
    link.download = `${card.title || 'lyric-card'}.png`
    link.href = dataUrl
    link.click()
  } finally {
    downloadingId.value = ''
  }
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleString()
}
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
            <p class="text-xs text-gray-500 dark:text-gray-400">歌词卡片收藏</p>
          </div>
        </div>
        <RouterLink
          to="/"
          class="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          ← 返回编辑器
        </RouterLink>
      </div>
    </header>

    <main class="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div class="mb-5 flex items-center justify-between">
        <div>
          <h2 class="text-lg font-semibold">我的歌词卡片</h2>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">当前会话内共 {{ cardsStore.cards.length }} 张，关闭浏览器后自动清空。</p>
        </div>
        <RouterLink
          to="/"
          class="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition hover:bg-violet-500"
        >
          ＋ 去生成卡片
        </RouterLink>
      </div>

      <div v-if="cardsStore.cards.length === 0" class="rounded-2xl border border-dashed border-gray-300 py-24 text-center dark:border-gray-700">
        <p class="text-4xl">🖼️</p>
        <p class="mt-3 text-sm text-gray-400">还没有收藏歌词卡片，去编辑器里生成一张吧</p>
      </div>

      <div v-else class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <article
          v-for="card in cardsStore.cards"
          :key="card.id"
          class="group overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:shadow-lg dark:border-gray-800 dark:bg-gray-900"
        >
          <div
            class="card-preview relative aspect-[3/4] w-full overflow-hidden"
            :style="cardStyle(card)"
          >
            <img
              v-if="card.cover && card.templateId !== 'minimal'"
              :src="card.cover"
              alt=""
              class="absolute inset-0 h-full w-full object-cover"
            />
            <div v-if="card.templateId === 'cover'" class="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/10 p-4 flex flex-col justify-end text-white">
              <div class="space-y-1">
                <p v-for="(line, index) in card.lyrics.slice(0, 6)" :key="index" class="text-xs font-medium leading-snug">{{ line }}</p>
              </div>
              <div class="mt-3 border-t border-white/20 pt-2">
                <p class="text-sm font-bold">{{ card.title }}</p>
                <p class="text-xs text-white/75">{{ card.artist }}</p>
              </div>
            </div>

            <div v-else-if="card.templateId === 'minimal'" class="absolute inset-0 flex flex-col justify-center p-5 text-white">
              <div class="space-y-1.5">
                <p v-for="(line, index) in card.lyrics.slice(0, 8)" :key="index" class="text-sm font-bold leading-snug">{{ line }}</p>
              </div>
              <div class="mt-4">
                <p class="text-xs font-semibold opacity-90">{{ card.title }}</p>
                <p class="text-[10px] opacity-70">{{ card.artist }}</p>
              </div>
            </div>

            <div v-else class="absolute inset-0 bg-black/45 p-5 flex flex-col items-center justify-center text-center text-white">
              <div class="space-y-1.5">
                <p v-for="(line, index) in card.lyrics.slice(0, 5)" :key="index" class="text-xs font-semibold leading-relaxed">{{ line }}</p>
              </div>
              <div class="mt-3">
                <p class="text-xs font-bold">{{ card.title }}</p>
                <p class="mt-0.5 text-[10px] text-white/70">{{ card.artist }} · {{ card.album || '专辑未知' }}</p>
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between gap-2 px-3 py-2.5">
            <div class="min-w-0">
              <p class="truncate text-xs font-medium text-gray-700 dark:text-gray-200">{{ card.title }}</p>
              <p class="text-[10px] text-gray-400">{{ formatDate(card.createdAt) }}</p>
            </div>
            <div class="flex shrink-0 gap-1">
              <button
                type="button"
                class="rounded-lg px-2 py-1 text-xs font-medium text-violet-600 transition hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-500/10"
                :disabled="downloadingId === card.id"
                @click="downloadCard(card, ($event.currentTarget as HTMLElement).closest('article')?.querySelector('.card-preview') as HTMLElement)"
              >
                {{ downloadingId === card.id ? '…' : '⬇️' }}
              </button>
              <button
                type="button"
                class="rounded-lg px-2 py-1 text-xs text-gray-400 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                @click="cardsStore.removeCard(card.id)"
              >
                ✕
              </button>
            </div>
          </div>
        </article>
      </div>
    </main>
  </div>
</template>
