<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'

defineProps<{
  isLoggedIn: boolean
  userName: string
}>()

defineEmits<{
  logout: []
}>()

const router = useRouter()
const route = useRoute()
const mobileMenuOpen = ref(false)

const closeMobileMenu = () => {
  mobileMenuOpen.value = false
}

const handleNav = (path: string) => {
  router.push(path)
  closeMobileMenu()
}
</script>

<template>
  <nav class="app-navbar">
    <div class="navbar-left">
      <span class="brand" role="button" tabindex="0" @click="handleNav('/')" @keydown.enter="handleNav('/')">Enjoy Trip</span>
    </div>

    <div class="navbar-mode-group d-none d-lg-flex" :class="{ segmented: true }">
      <button class="navbar-mode-btn" :class="{ active: route.path === '/' }" @click="handleNav('/')">동선 짜기</button>
      <button v-if="isLoggedIn" class="navbar-mode-btn" :class="{ active: route.path.startsWith('/library') }" @click="handleNav('/library')">내 보관함</button>
      <button class="navbar-mode-btn" :class="{ active: route.path.startsWith('/board') || route.path.startsWith('/notices') }" @click="handleNav('/board')">게시판</button>
    </div>

    <div class="d-none d-md-flex nav-actions">
      <span class="navbar-weather d-none d-xl-inline-flex">SEOUL · 12°</span>
      <template v-if="!isLoggedIn">
        <button class="btn-outline" data-bs-toggle="modal" data-bs-target="#loginModal">로그인</button>
        <button class="btn-filled" data-bs-toggle="modal" data-bs-target="#joinModal">회원가입</button>
      </template>
      <template v-else>
        <span class="user-greeting">{{ userName }}님</span>
        <button class="btn-outline" @click="$emit('logout')">로그아웃</button>
      </template>
    </div>

    <button class="navbar-mobile-toggle d-md-none" @click="mobileMenuOpen = !mobileMenuOpen" :aria-label="mobileMenuOpen ? '메뉴 닫기' : '메뉴 열기'">
      <span class="toggle-icon">{{ mobileMenuOpen ? '×' : '☰' }}</span>
    </button>

    <div class="navbar-mobile-menu d-md-none" :class="{ open: mobileMenuOpen }">
      <button class="mobile-nav-link" :class="{ active: route.path === '/' }" @click="handleNav('/')">동선 짜기</button>
      <button v-if="isLoggedIn" class="mobile-nav-link" :class="{ active: route.path.startsWith('/library') }" @click="handleNav('/library')">내 보관함</button>
      <button class="mobile-nav-link" :class="{ active: route.path.startsWith('/board') || route.path.startsWith('/notices') }" @click="handleNav('/board')">게시판</button>
      <hr class="mobile-divider" />
      <template v-if="!isLoggedIn">
        <button class="mobile-nav-link btn-action" data-bs-toggle="modal" data-bs-target="#loginModal" @click="closeMobileMenu">로그인</button>
        <button class="mobile-nav-link btn-action" data-bs-toggle="modal" data-bs-target="#joinModal" @click="closeMobileMenu">회원가입</button>
      </template>
      <template v-else>
        <div class="mobile-user-greeting">{{ userName }}님</div>
        <button class="mobile-nav-link btn-action text-danger" @click="$emit('logout'); closeMobileMenu()">로그아웃</button>
      </template>
    </div>
  </nav>
</template>

<style scoped>
.navbar-left {
  display: flex;
  align-items: center;
}

.brand {
  cursor: pointer;
  outline: none;
}

.navbar-mode-group {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 42px;
  padding: 4px;
  background: #fcfbf7;
  border: 1px solid #d8d1c4;
  border-radius: 999px;
}

.navbar-mode-group.segmented {
  box-shadow: 0 8px 18px rgba(33, 29, 24, 0.08);
}

.navbar-mode-btn {
  align-items: center;
  justify-content: center;
  height: 38px;
  padding: 0 18px;
  background: transparent;
  border: 0;
  border-radius: 999px;
  color: #5c554b;
  cursor: pointer;
  font-size: 0.84rem;
  font-weight: 700;
}

.navbar-mode-btn.active,
.navbar-mode-btn:hover {
  background: #211d18;
  color: #fcfbf7;
}

.navbar-weather {
  align-items: center;
  color: var(--text-soft);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.72rem;
  font-weight: 500;
  margin-right: 12px;
}

.navbar-mobile-toggle {
  width: 38px;
  height: 38px;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 2px;
  color: var(--text);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  padding: 4px;
  z-index: 1001;
}

.navbar-mobile-menu {
  position: absolute;
  top: 68px;
  right: 0;
  left: 0;
  z-index: 99;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  box-shadow: 0 18px 32px rgba(33, 29, 24, 0.14);
  transform: translateY(-150%);
  transition: transform 0.3s ease;
}

.navbar-mobile-menu.open {
  transform: translateY(0);
}

.mobile-nav-link {
  background: transparent;
  border: 0;
  border-radius: 2px;
  color: var(--text);
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 600;
  padding: 10px 12px;
  text-align: left;
}

.mobile-nav-link:hover,
.mobile-nav-link.active {
  background: var(--surface-muted);
  color: var(--terracotta-dark);
}

.mobile-divider {
  margin: 4px 0;
  border-top: 1px solid var(--border);
  opacity: 1;
}

.mobile-user-greeting {
  color: var(--text-muted);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.78rem;
  padding: 6px 12px;
}
</style>
