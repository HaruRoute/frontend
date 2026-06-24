<script setup lang="ts">
import { ref } from 'vue'
import api from '../api'

const emit = defineEmits<{
  login: [name: string, id: string, token: string, role: string]
}>()

const loginId = ref('')
const loginPw = ref('')
const joinId = ref('')
const joinPw = ref('')
const joinName = ref('')

const handleLogin = async () => {
  try {
    const res = await api.post('/users/login', { id: loginId.value, pw: loginPw.value })
    if (res.data.token) {
      emit('login', res.data.name, res.data.id, res.data.token, res.data.role)
      const closeBtn = document.querySelector('#loginModal .btn-close') as HTMLElement
      closeBtn?.click()
    }
  } catch (error: any) {
    alert(error.response?.data?.message || '로그인 실패')
  }
}

const handleJoin = async () => {
  try {
    const res = await api.post('/users', { id: joinId.value, pw: joinPw.value, name: joinName.value })
    alert(res.data.message)
    const closeBtn = document.querySelector('#joinModal .btn-close') as HTMLElement
    closeBtn?.click()
  } catch (error: any) {
    alert(error.response?.data?.message || '회원가입 실패')
  }
}
</script>

<template>
  <div class="modal fade auth-modal" id="loginModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content auth-card">
        <button type="button" class="btn-close auth-close" data-bs-dismiss="modal" aria-label="Close"></button>
        <div class="auth-kicker">ENJOY TRIP</div>
        <h5 class="auth-title">다시, 여행을<br />이어가볼까요</h5>

        <div class="auth-fields">
          <input
            type="text"
            class="auth-input"
            v-model="loginId"
            placeholder="이름 또는 이메일"
            autocomplete="username"
          />
          <input
            type="password"
            class="auth-input"
            v-model="loginPw"
            placeholder="비밀번호"
            autocomplete="current-password"
            @keydown.enter="handleLogin"
          />
        </div>

        <button type="button" class="auth-primary" @click="handleLogin">로그인하고 계속하기</button>

        <p class="auth-switch">
          아직 계정이 없나요?
          <button type="button" data-bs-toggle="modal" data-bs-target="#joinModal">회원가입</button>
        </p>
      </div>
    </div>
  </div>

  <div class="modal fade auth-modal" id="joinModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content auth-card">
        <button type="button" class="btn-close auth-close" data-bs-dismiss="modal" aria-label="Close"></button>
        <div class="auth-kicker">ENJOY TRIP</div>
        <h5 class="auth-title">새로운 여행을<br />시작해볼까요</h5>

        <div class="auth-fields">
          <input
            type="text"
            class="auth-input"
            v-model="joinName"
            placeholder="이름"
            autocomplete="name"
          />
          <input
            type="text"
            class="auth-input"
            v-model="joinId"
            placeholder="아이디 또는 이메일"
            autocomplete="username"
          />
          <input
            type="password"
            class="auth-input"
            v-model="joinPw"
            placeholder="비밀번호"
            autocomplete="new-password"
            @keydown.enter="handleJoin"
          />
        </div>

        <button type="button" class="auth-primary" @click="handleJoin">회원가입하고 시작하기</button>

        <p class="auth-switch">
          이미 계정이 있나요?
          <button type="button" data-bs-toggle="modal" data-bs-target="#loginModal">로그인</button>
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-modal :deep(.modal-dialog) {
  max-width: 392px;
}

.auth-card {
  position: relative;
  padding: 42px 38px 34px;
  background: #fcfbf7;
  border: 1px solid #d8d1c4;
  border-radius: 1px;
  box-shadow: 0 24px 60px rgba(33, 29, 24, 0.18);
}

.auth-close {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 18px;
  height: 18px;
  padding: 0;
  opacity: 0.45;
}

.auth-kicker {
  margin-bottom: 16px;
  color: #b85c38;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.76rem;
  font-weight: 500;
}

.auth-title {
  margin: 0 0 36px;
  color: #211d18;
  font-family: 'Gowun Batang', serif;
  font-size: 1.85rem;
  font-weight: 400;
  line-height: 1.34;
}

.auth-fields {
  display: flex;
  flex-direction: column;
  gap: 13px;
  margin-bottom: 18px;
}

.auth-input {
  width: 100%;
  height: 48px;
  padding: 0 15px;
  background: #fcfbf7;
  border: 1px solid #d8d1c4;
  border-radius: 0;
  color: #211d18;
  font-size: 0.98rem;
  outline: none;
}

.auth-input::placeholder {
  color: #9a9286;
}

.auth-input:focus {
  border-color: #b85c38;
  box-shadow: 0 0 0 3px rgba(184, 92, 56, 0.12);
}

.auth-primary {
  width: 100%;
  height: 48px;
  margin-top: 1px;
  background: #b85c38;
  border: 1px solid #b85c38;
  color: #fcfbf7;
  font-size: 0.98rem;
  font-weight: 800;
}

.auth-primary:hover {
  background: #a04e2d;
  border-color: #a04e2d;
}

.auth-switch {
  margin: 24px 0 0;
  color: #9a9286;
  font-size: 0.88rem;
  text-align: center;
}

.auth-switch button {
  padding: 0;
  background: transparent;
  border: 0;
  color: #b85c38;
  font: inherit;
  text-decoration: underline;
  text-underline-offset: 3px;
}
</style>
