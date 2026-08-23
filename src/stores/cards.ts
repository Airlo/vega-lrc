import { defineStore } from 'pinia'
import type { LyricCard } from '../types'

const STORAGE_KEY = 'vega-lrc-cards'

function loadCards(): LyricCard[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as LyricCard[]) : []
  } catch {
    return []
  }
}

export const useCardsStore = defineStore('cards', {
  state: () => ({
    cards: loadCards(),
  }),
  actions: {
    persist() {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this.cards))
      } catch {
        // Session storage can be unavailable; ignore.
      }
    },
    addCard(card: LyricCard) {
      this.cards.unshift(card)
      this.persist()
    },
    removeCard(id: string) {
      this.cards = this.cards.filter((card) => card.id !== id)
      this.persist()
    },
  },
})
