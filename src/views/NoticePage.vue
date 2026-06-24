<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api'
import { auth } from '../composables/useAuth'

interface Notice {
  id: number
  title: string
  content: string
  authorName: string
  isPinned: boolean
  createdAt: string
}

const router = useRouter()
const notices = ref<Notice[]>([])
const expanded = ref<number | null>(null)
const isLoading = ref(true)

const fmt = (d: string) => {
  const date = new Date(d)
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
}

onMounted(async () => {
  try {
    const res = await api.get('/notices')
    notices.value = res.data
  } finally {
    isLoading.value = false
  }
})

const editNotice = (n: Notice) => {
  router.push({
    path: `/board/edit/${n.id}`,
    query: { type: 'notice' },
    state: { noticeTitle: n.title, noticeContent: n.content, noticePinned: n.isPinned },
  })
}

const deleteNotice = async (id: number) => {
  if (!confirm('공지사항을 삭제할까요?')) return
  await api.delete(`/notices/${id}`)
  notices.value = notices.value.filter(n => n.id !== id)
}
</script>

<template>
  <div class="notice-page">
    <div class="notice-shell">

      <!-- Masthead -->
      <div class="notice-masthead">
        <div>
          <div class="masthead-kicker">The Journal</div>
          <div class="masthead-title">공지사항</div>
        </div>
        <div class="masthead-actions">
          <button class="btn-back-board" @click="router.push('/board')">← 게시판으로</button>
          <button
            v-if="auth.role === 'ADMIN'"
            class="btn-write"
            @click="router.push('/board/write?type=notice')"
          >+ 공지 작성</button>
        </div>
      </div>

      <!-- 필터 탭 (공지 active) -->
      <div class="filter-row">
        <button class="filter-btn" @click="router.push('/board')">전체</button>
        <button class="filter-btn active">공지</button>
        <button class="filter-btn" @click="router.push('/board?filter=자유')">자유</button>
        <button class="filter-btn" @click="router.push('/board?filter=질문')">질문</button>
      </div>

      <!-- 로딩 -->
      <div v-if="isLoading" class="notice-loading">
        <div class="spinner-border" role="status">
          <span class="visually-hidden">로딩 중...</span>
        </div>
      </div>

      <!-- 빈 상태 -->
      <div v-else-if="notices.length === 0" class="notice-empty">
        <p class="empty-title">등록된 공지사항이 없습니다.</p>
      </div>

      <!-- 공지 목록 -->
      <div v-else class="notice-list">
        <div
          v-for="n in notices"
          :key="n.id"
          class="notice-item"
          :class="{ expanded: expanded === n.id }"
        >
          <div class="notice-row" @click="expanded = expanded === n.id ? null : n.id">
            <span v-if="n.isPinned" class="pin-badge">📌</span>
            <div class="notice-row-main">
              <span class="notice-title">{{ n.title }}</span>
              <span class="notice-meta">{{ n.authorName }} · {{ fmt(n.createdAt) }}</span>
            </div>
            <div class="notice-row-actions" @click.stop>
              <template v-if="auth.role === 'ADMIN'">
                <button class="action-btn" @click="editNotice(n)">수정</button>
                <button class="action-btn danger" @click="deleteNotice(n.id)">삭제</button>
              </template>
              <span class="chevron">{{ expanded === n.id ? '▲' : '▼' }}</span>
            </div>
          </div>
          <div v-if="expanded === n.id" class="notice-content">
            {{ n.content }}
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.notice-page {
  min-height: calc(100vh - 68px);
  background: #f4f1ea;
  color: #211d18;
}

.notice-shell {
  max-width: 1180px;
  margin: 0 auto;
  padding: 52px 40px 72px;
  animation: etFade .4s ease;
}

@keyframes etFade { from { opacity: 0 } to { opacity: 1 } }

/* Masthead */
.notice-masthead {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 30px;
}

.masthead-kicker {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 11px;
  letter-spacing: .2em;
  text-transform: uppercase;
  color: #b85c38;
  margin-bottom: 12px;
}

.masthead-title {
  font-family: 'Newsreader', 'Gowun Batang', serif;
  font-size: 42px;
  letter-spacing: -0.01em;
}

.masthead-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.btn-back-board {
  border: 1px solid #d8d1c4;
  background: transparent;
  font-size: 12.5px;
  color: #5c554b;
  padding: 10px 18px;
  border-radius: 1px;
  cursor: pointer;
  transition: border-color .2s, color .2s;
}
.btn-back-board:hover { border-color: #b85c38; color: #b85c38; }

.btn-write {
  background: #211d18;
  color: #f4f1ea;
  border: none;
  font-weight: 600;
  font-size: 13px;
  padding: 13px 22px;
  border-radius: 1px;
  cursor: pointer;
  white-space: nowrap;
  transition: background .2s;
}
.btn-write:hover { background: #b85c38; }

/* Filters */
.filter-row {
  display: flex;
  gap: 6px;
  border-bottom: 1px solid #e4ded2;
  padding-bottom: 18px;
  margin-bottom: 36px;
}

.filter-btn {
  background: transparent;
  border: 1px solid #d8d1c4;
  border-radius: 999px;
  color: #5c554b;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  padding: 7px 18px;
  transition: all .2s;
}
.filter-btn:hover { border-color: #b85c38; color: #b85c38; }
.filter-btn.active {
  background: #211d18;
  border-color: #211d18;
  color: #f4f1ea;
}

/* 로딩/빈 */
.notice-loading {
  display: flex;
  justify-content: center;
  padding: 80px 0;
}
.notice-loading .spinner-border { color: #b85c38; width: 2rem; height: 2rem; }

.notice-empty {
  text-align: center;
  padding: 80px 0;
  border: 1px dashed #d8d1c4;
  border-radius: 2px;
  background: #fcfbf7;
}
.empty-title {
  font-family: 'Gowun Batang', serif;
  font-size: 1.1rem;
  margin: 0;
  color: #5c554b;
}

/* 공지 목록 */
.notice-list {
  display: flex;
  flex-direction: column;
  gap: 0;
  border: 1px solid #e4ded2;
  border-radius: 2px;
  background: #fcfbf7;
  overflow: hidden;
}

.notice-item {
  border-bottom: 1px solid #e4ded2;
}
.notice-item:last-child { border-bottom: none; }

.notice-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 20px 24px;
  cursor: pointer;
  transition: background .15s;
}
.notice-row:hover { background: #f7f2e8; }
.notice-item.expanded .notice-row { background: #f7f2e8; }

.pin-badge {
  font-size: 14px;
  flex-shrink: 0;
}

.notice-row-main {
  flex: 1;
  display: flex;
  align-items: baseline;
  gap: 16px;
  min-width: 0;
}

.notice-title {
  font-family: 'Gowun Batang', serif;
  font-size: 16px;
  color: #211d18;
  line-height: 1.4;
}

.notice-meta {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10.5px;
  color: #9a9286;
  white-space: nowrap;
  flex-shrink: 0;
}

.notice-row-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.chevron {
  font-size: 11px;
  color: #9a9286;
  margin-left: 4px;
}

.action-btn {
  background: transparent;
  border: 1px solid #d8d1c4;
  border-radius: 1px;
  color: #5c554b;
  font-size: 11px;
  padding: 4px 10px;
  cursor: pointer;
  transition: all .15s;
}
.action-btn:hover { border-color: #b85c38; color: #b85c38; }
.action-btn.danger:hover { border-color: #dc2626; color: #dc2626; }

.notice-content {
  padding: 20px 24px 24px;
  background: #f4f1ea;
  border-top: 1px solid #e4ded2;
  font-size: 14.5px;
  line-height: 1.85;
  color: #4a443b;
  white-space: pre-wrap;
}

/* 반응형 */
@media (max-width: 768px) {
  .notice-shell { padding: 36px 16px 48px; }
  .masthead-title { font-size: 28px; }
  .notice-masthead { flex-direction: column; align-items: flex-start; gap: 16px; }
  .notice-row-main { flex-direction: column; gap: 4px; }
}
</style>
