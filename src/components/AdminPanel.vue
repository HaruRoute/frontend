<script setup lang="ts">
import { ref, watch } from 'vue'
import api from '../api'

const props = defineProps<{
  isLoggedIn: boolean
}>()

const documents = ref<string[]>([])
const isOpen = ref(false)
const uploading = ref(false)
const fileRef = ref<HTMLInputElement | null>(null)


const fetchDocuments = async () => {
  try {
    const res = await api.get('/documents')
    documents.value = res.data.documents || []
  } catch {}
}

watch([() => props.isLoggedIn, isOpen], ([loggedIn, open]) => {
  if (loggedIn && open) fetchDocuments()
})

const handleUpload = async () => {
  const file = fileRef.value?.files?.[0]
  if (!file) return alert('파일을 선택해주세요.')

  const formData = new FormData()
  formData.append('file', file)
  uploading.value = true
  try {
    const res = await api.post('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    alert(res.data.message || '업로드 완료')
    if (fileRef.value) fileRef.value.value = ''
    fetchDocuments()
  } catch (e: any) {
    alert(e.response?.data?.message || '업로드 실패')
  } finally {
    uploading.value = false
  }
}

const handleDelete = async (filename: string) => {
  if (!confirm(`'${filename}' 문서를 삭제할까요?`)) return
  try {
    await api.delete(`/documents/${filename}`)
    documents.value = documents.value.filter(d => d !== filename)
  } catch {
    alert('삭제 실패')
  }
}

const isAdmin = () => localStorage.getItem('role') === 'ADMIN'
</script>

<template>
  <div v-if="isLoggedIn && isAdmin()" class="app-card mb-5">
    <div class="fav-header" @click="isOpen = !isOpen">
      <div class="fav-header-left">
        <span class="fav-icon">📂</span>
        <span class="fav-title">AI 학습 문서 관리</span>
        <span class="fav-count">{{ documents.length }}</span>
      </div>
      <span class="fav-toggle">{{ isOpen ? '▲' : '▼' }}</span>
    </div>

    <div v-if="isOpen" class="fav-body">
      <!-- 업로드 폼 -->
      <div class="fav-form">
        <p style="font-size: 0.82rem; font-weight: 600; color: #475569; margin-bottom: 4px">
          문서 업로드 (.txt / .md / .pdf)
        </p>
        <div style="display: flex; gap: 8px; align-items: center">
          <input ref="fileRef" type="file" accept=".txt,.md,.pdf" class="form-control" style="flex: 1" />
          <button class="btn-primary" :disabled="uploading" style="white-space: nowrap" @click="handleUpload">
            {{ uploading ? '업로드 중...' : '업로드' }}
          </button>
        </div>
      </div>

      <!-- 문서 목록 -->
      <div v-if="documents.length === 0" class="fav-empty">
        업로드된 문서가 없습니다.<br />
        AI가 참고할 문서를 추가해보세요!
      </div>
      <ul v-else class="fav-list">
        <li v-for="doc in documents" :key="doc" class="fav-item">
          <div class="fav-item-info">
            <span class="fav-place-name">📄 {{ doc }}</span>
          </div>
          <button class="fav-delete-btn" @click="handleDelete(doc)">삭제</button>
        </li>
      </ul>
    </div>
  </div>
</template>
