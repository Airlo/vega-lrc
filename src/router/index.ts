import { createRouter, createWebHistory } from 'vue-router'
import EditorPage from '../components/EditorPage.vue'
import CardsPage from '../pages/CardsPage.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'editor',
      component: EditorPage,
    },
    {
      path: '/cards',
      name: 'cards',
      component: CardsPage,
    },
  ],
})

export default router
