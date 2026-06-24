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
  <div class="modal fade" id="profileModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" style="color: white; font-weight: 700">내 프로필</h5>
          <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close" />
        </div>
        <div class="modal-body">
          <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 24px">
            현재 이름: <strong>{{ userName }}</strong>
          </p>

          <!-- 이름 변경 -->
          <div style="margin-bottom: 24px">
            <p style="font-weight: 700; font-size: 0.9rem; margin-bottom: 10px">이름 변경</p>
            <div class="mb-3">
              <label class="form-label">새 이름</label>
              <input class="form-control" type="text" placeholder="변경할 이름" v-model="newName" />
            </div>
            <button class="btn-modal-primary" @click="handleUpdateName">이름 변경</button>
          </div>

          <hr style="border-color: #e2e8f0" />

          <!-- 비밀번호 변경 -->
          <div style="margin-top: 24px">
            <p style="font-weight: 700; font-size: 0.9rem; margin-bottom: 10px">비밀번호 변경</p>
            <div class="mb-3">
              <label class="form-label">현재 비밀번호</label>
              <input class="form-control" type="password" placeholder="현재 비밀번호" v-model="currentPw" />
            </div>
            <div class="mb-3">
              <label class="form-label">새 비밀번호</label>
              <input class="form-control" type="password" placeholder="새 비밀번호" v-model="newPw" />
            </div>
            <button class="btn-modal-primary" @click="handleUpdatePw">비밀번호 변경</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
