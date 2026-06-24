<script setup lang="ts">
import { ref, computed, defineAsyncComponent, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'

import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import Navbar from './components/Navbar.vue'
import TutorialTour from './components/TutorialTour.vue'
import ChatbotWidget from './components/ChatbotWidget.vue'
import { auth } from './composables/useAuth'

const AuthModal = defineAsyncComponent(() => import('./components/AuthModal.vue'))
const ProfileModal = defineAsyncComponent(() => import('./components/ProfileModal.vue'))
import './index.css'

const showTour = ref(false)
const router = useRouter()
const route = useRoute()
const isHomeRoute = computed(() => route.path === '/')
const showChatbot = computed(() => route.path === '/' || route.path.startsWith('/library'))

const handleLogin = (name: string, id: string, token: string, role: string) => {
  auth.isLoggedIn = true
  auth.userName = name
  auth.userId = id
  auth.role = role
  localStorage.setItem('token', token)
  localStorage.setItem('userId', id)
  localStorage.setItem('role', role)
  localStorage.setItem('userName', name)
  localStorage.removeItem('route_places')
  localStorage.removeItem('route_total_distance')

  const tourKey = `tour_seen_${id}`
  if (!localStorage.getItem(tourKey)) {
    localStorage.setItem(tourKey, '1')
    showTour.value = true
  }
}

const handleLogout = () => {
  auth.isLoggedIn = false
  auth.userName = ''
  auth.userId = ''
  auth.role = ''
  localStorage.removeItem('token')
  localStorage.removeItem('userId')
  localStorage.removeItem('role')
  localStorage.removeItem('userName')
  localStorage.removeItem('route_places')
  localStorage.removeItem('route_total_distance')
}

const handleNameChange = (name: string) => {
  auth.userName = name
  localStorage.setItem('userName', name)
}

onMounted(() => {
  const token = localStorage.getItem('token')
  if (token) {
    auth.isLoggedIn = true
    auth.userName = localStorage.getItem('userName') || ''
    auth.userId = localStorage.getItem('userId') || ''
    auth.role = localStorage.getItem('role') || ''
  }
})
</script>

<template>
  <Navbar :is-logged-in="auth.isLoggedIn" :user-name="auth.userName" @logout="handleLogout" />

  <div class="main-layout-container">
    <RouterView />
  </div>

  <div class="mobile-bottom-nav d-md-none">
    <button
      class="nav-item-btn"
      :class="{ active: isHomeRoute }"
      @click="router.push('/')"
    >
      <span class="nav-icon">＋</span>
      <span class="nav-label">동선</span>
    </button>
  </div>

  <TutorialTour v-if="showTour" @done="showTour = false" />
  <AuthModal @login="handleLogin" />
  <ProfileModal :user-name="auth.userName" @name-change="handleNameChange" />
  <ChatbotWidget v-if="showChatbot" />
</template>
