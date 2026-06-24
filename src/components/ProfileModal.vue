<script setup lang="ts">
import { ref } from 'vue'
import api from '../api'

defineProps<{
  userName: string
}>()

const emit = defineEmits<{
  nameChange: [name: string]
}>()

const newName = ref('')
const currentPw = ref('')
const newPw = ref('')

const handleUpdateName = async () => {
  if (!newName.value.trim()) return alert('변경할 이름을 입력해주세요.')
  try {
    const userId = localStorage.getItem('userId')
    await api.put(`/users/${userId}`, { name: newName.value })
    alert('이름이 변경되었습니다.')
    emit('nameChange', newName.value)
    newName.value = ''
  } catch (e: any) {
    alert(e.response?.data?.message || '변경 실패')
  }
}

const handleUpdatePw = async () => {
  if (!newPw.value.trim()) return alert('새 비밀번호를 입력해주세요.')
  try {
    const userId = localStorage.getItem('userId')
    await api.put(`/users/${userId}`, { pw: newPw.value })
    alert('비밀번호가 변경되었습니다.')
    currentPw.value = ''
    newPw.value = ''
  } catch (e: any) {
    alert(e.response?.data?.message || '변경 실패')
  }
}
</script>

<template>
  <div class="modal fade profile-modal" id="profileModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content profile-card">
        <button type="button" class="btn-close profile-close" data-bs-dismiss="modal" aria-label="Close" />

        <div class="profile-kicker">ENJOY TRIP</div>
        <h5 class="profile-title">내 정보를<br />수정할게요</h5>

        <div class="profile-meta">현재 이름 — <strong>{{ userName }}</strong></div>

        <!-- 이름 변경 -->
        <div class="profile-section">
          <div class="section-label">이름 변경</div>
          <div class="profile-fields">
            <input
              class="profile-input"
              type="text"
              v-model="newName"
              placeholder="변경할 이름"
              autocomplete="off"
              @keydown.enter="handleUpdateName"
            />
          </div>
          <button class="profile-primary" @click="handleUpdateName">이름 변경하기</button>
        </div>

        <div class="profile-divider" />

        <!-- 비밀번호 변경 -->
        <div class="profile-section">
          <div class="section-label">비밀번호 변경</div>
          <div class="profile-fields">
            <input
              class="profile-input"
              type="password"
              v-model="currentPw"
              placeholder="현재 비밀번호"
              autocomplete="current-password"
            />
            <input
              class="profile-input"
              type="password"
              v-model="newPw"
              placeholder="새 비밀번호"
              autocomplete="new-password"
              @keydown.enter="handleUpdatePw"
            />
          </div>
          <button class="profile-primary" @click="handleUpdatePw">비밀번호 변경하기</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.profile-modal :deep(.modal-dialog) {
  max-width: 392px;
}

.profile-card {
  position: relative;
  padding: 42px 38px 38px;
  background: #fcfbf7;
  border: 1px solid #d8d1c4;
  border-radius: 1px;
  box-shadow: 0 24px 60px rgba(33, 29, 24, 0.18);
}

.profile-close {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 18px;
  height: 18px;
  padding: 0;
  opacity: 0.45;
}

.profile-kicker {
  margin-bottom: 16px;
  color: #b85c38;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.76rem;
  font-weight: 500;
}

.profile-title {
  margin: 0 0 10px;
  color: #211d18;
  font-family: 'Gowun Batang', serif;
  font-size: 1.85rem;
  font-weight: 400;
  line-height: 1.34;
}

.profile-meta {
  margin-bottom: 28px;
  color: #9a9286;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.78rem;
}

.profile-meta strong {
  color: #211d18;
  font-weight: 700;
}

.profile-section {
  margin-bottom: 4px;
}

.section-label {
  margin-bottom: 10px;
  color: #5c554b;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.profile-fields {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 12px;
}

.profile-input {
  width: 100%;
  height: 48px;
  padding: 0 15px;
  background: #fcfbf7;
  border: 1px solid #d8d1c4;
  border-radius: 0;
  color: #211d18;
  font-size: 0.95rem;
  outline: none;
}

.profile-input::placeholder {
  color: #9a9286;
}

.profile-input:focus {
  border-color: #b85c38;
  box-shadow: 0 0 0 3px rgba(184, 92, 56, 0.12);
}

.profile-primary {
  width: 100%;
  height: 44px;
  background: #211d18;
  border: 1px solid #211d18;
  color: #fcfbf7;
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.profile-primary:hover {
  background: #b85c38;
  border-color: #b85c38;
}

.profile-divider {
  margin: 24px 0;
  border-top: 1px solid #e4ded2;
}
</style>
