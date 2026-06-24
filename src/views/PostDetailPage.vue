<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../api'
import { auth } from '../composables/useAuth'

interface Place { title: string; addr1: string; lat: number; lng: number; firstimage?: string }
interface Post {
  id: number
  title: string
  content: string
  authorId: string
  authorName: string
  viewCount: number
  hasRoute: boolean
  category: string | null
  routeData: string | null
  routeName: string | null
  createdAt: string
  updatedAt: string | null
}

const route = useRoute()
const router = useRouter()
const post = ref<Post | null>(null)
const isLoading = ref(true)
const liked = ref(false)

// 라우트 경로로 자유(posts) vs 질문(qnas) 판별
const isQna = computed(() => route.path.startsWith('/board/qna'))
const apiBase = computed(() => isQna.value ? '/qnas' : '/posts')

const routePlaces = computed<Place[]>(() => {
  if (!post.value?.routeData) return []
  try { return JSON.parse(post.value.routeData) } catch { return [] }
})

const paragraphs = computed(() => {
  if (!post.value?.content) return []
  return post.value.content.split(/\n\n+/).filter(Boolean)
})

const fmt = (d: string) => {
  const date = new Date(d)
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
}

const initial = (name: string) => name?.charAt(0) || '?'
const isOwner = computed(() => auth.isLoggedIn && post.value?.authorId === auth.userId)
const isAdmin = computed(() => auth.role === 'ADMIN')
const coverImage = computed(() => routePlaces.value[0]?.firstimage || null)

const category = computed(() => {
  if (isQna.value) return '질문'
  const c = post.value?.category
  if (c === 'FREE') return '자유'
  return '자유'
})

onMounted(async () => {
  try {
    const res = await api.get(`${apiBase.value}/${route.params.id}`)
    post.value = res.data
  } finally {
    isLoading.value = false
  }
})

const importRoute = () => {
  if (!auth.isLoggedIn) {
    alert('로그인 후 이용해주세요.')
    return
  }
  if (!routePlaces.value.length) return
  localStorage.setItem('route_places', JSON.stringify(routePlaces.value))
  window.dispatchEvent(new CustomEvent('load-saved-plan', {
    detail: { places: routePlaces.value }
  }))
  router.push('/')
}

const deletePost = async () => {
  if (!confirm('게시글을 삭제할까요?')) return
  await api.delete(`${apiBase.value}/${route.params.id}`)
  router.push('/board')
}
</script>

<template>
  <div class="article-page">
    <div class="article-shell">

      <!-- 로딩 -->
      <div v-if="isLoading" class="article-loading">
        <div class="spinner-border" role="status">
          <span class="visually-hidden">로딩 중...</span>
        </div>
      </div>

      <template v-else-if="post">
        <!-- 뒤로가기 -->
        <button class="btn-back" @click="router.push('/board')">← 기록 목록</button>

        <div class="article-card">
          <!-- 헤더 (중앙 정렬) -->
          <div class="article-header">
            <div class="article-cat">{{ category }} · {{ post.authorName }}</div>
            <h1 class="article-title">{{ post.title }}</h1>
            <div class="article-meta">
              <span class="article-avatar">{{ initial(post.authorName) }}</span>
              <span class="article-author">{{ post.authorName }}</span>
              <span>·</span>
              <span>{{ fmt(post.createdAt) }}</span>
              <span>·</span>
              <span>읽기 {{ Math.max(1, Math.ceil(post.content.length / 400)) }}분</span>
              <span>·</span>
              <span>조회 {{ post.viewCount }}</span>
            </div>
          </div>

          <!-- 커버 이미지 영역 (자유 게시판만 표시) -->
          <div v-if="!isQna" class="article-cover">
            <img v-if="coverImage" :src="coverImage" class="article-cover-img" alt="" />
          </div>

          <!-- 본문 -->
          <div class="article-body">

            <!-- 본문 단락 -->
            <p v-for="(para, i) in paragraphs" :key="i" class="article-para">{{ para }}</p>

            <!-- 루트 모듈 -->
            <div v-if="routePlaces.length" class="route-module">
              <div class="route-module-header">
                <span>이 글의 동선 · {{ routePlaces.length }} stops</span>
                <span class="route-module-dist">{{ post.routeName || '첨부 동선' }}</span>
              </div>
              <div class="route-module-body">
                <div
                  v-for="(p, i) in routePlaces"
                  :key="i"
                  class="route-stop-row"
                >
                  <span
                    class="route-stop-pin"
                    :style="{ background: i === routePlaces.length - 1 ? '#211d18' : '#b85c38' }"
                  >{{ i + 1 }}</span>
                  <span class="route-stop-name">{{ p.title }}</span>
                  <span class="route-stop-addr">{{ p.addr1 }}</span>
                </div>
              </div>
              <div class="route-module-footer">
                <button class="btn-import-route" @click="importRoute">내 지도로 동선 가져오기</button>
              </div>
            </div>

            <!-- 반응 버튼 -->
            <div class="article-reactions">
              <button class="reaction-btn" :class="{ liked }" @click="liked = !liked">
                {{ liked ? '♥' : '♡' }} 좋아요
              </button>
              <button class="reaction-btn" @click="router.push('/board')">↗ 목록으로</button>
              <template v-if="isOwner || isAdmin">
                <button
                  v-if="isOwner"
                  class="reaction-btn"
                  @click="router.push(isQna ? `/board/qna/edit/${post!.id}` : `/board/edit/${post!.id}`)"
                >✎ 수정</button>
                <button class="reaction-btn danger" @click="deletePost">✕ 삭제</button>
              </template>
            </div>

          </div>
        </div>
      </template>

      <div v-else class="article-loading">
        <p style="color:#9a9286;">게시글을 찾을 수 없습니다.</p>
      </div>

    </div>
  </div>
</template>

<style scoped>
.article-page {
  min-height: calc(100vh - 68px);
  background: #f4f1ea;
  color: #211d18;
}

.article-shell {
  max-width: 1080px;
  margin: 0 auto;
  padding: 32px 40px 72px;
  animation: etFade .4s ease;
}

@keyframes etFade { from { opacity: 0 } to { opacity: 1 } }

.article-loading {
  display: flex;
  justify-content: center;
  padding: 80px 0;
}
.article-loading .spinner-border {
  color: #b85c38;
  width: 2rem;
  height: 2rem;
}

/* 뒤로가기 */
.btn-back {
  border: 1px solid #d8d1c4;
  background: transparent;
  font-size: 12.5px;
  color: #5c554b;
  padding: 8px 16px;
  border-radius: 1px;
  cursor: pointer;
  margin-bottom: 28px;
  transition: border-color .2s, color .2s;
}
.btn-back:hover { border-color: #b85c38; color: #b85c38; }

/* 아티클 카드 */
.article-card {
  background: #fcfbf7;
  border: 1px solid #e9e3d7;
  border-radius: 2px;
  overflow: hidden;
}

/* 헤더 */
.article-header {
  padding: 56px 96px 34px;
  text-align: center;
  border-bottom: 1px solid #e4ded2;
}

.article-cat {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 11px;
  letter-spacing: .2em;
  text-transform: uppercase;
  color: #b85c38;
  margin-bottom: 22px;
}

.article-title {
  font-family: 'Newsreader', 'Gowun Batang', serif;
  font-size: 36px;
  line-height: 1.3;
  letter-spacing: -0.01em;
  font-weight: 400;
  margin: 0;
}

.article-meta {
  margin-top: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 11px;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 11.5px;
  color: #9a9286;
}

.article-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: #e7e0d2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #5c554b;
  font-family: 'Gowun Batang', serif;
  font-size: 13px;
}

.article-author { color: #5c554b; }

/* 커버 */
.article-cover {
  height: 330px;
  max-width: 540px;
  margin: 0 auto;
  background: #ded6c6;
  background-image: repeating-linear-gradient(
    45deg, #d6cdb9 0 12px, transparent 12px 24px
  );
  position: relative;
  overflow: hidden;
}

.article-cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* 본문 */
.article-body {
  padding: 52px 0;
  max-width: 660px;
  margin: 0 auto;
}

.article-para {
  font-size: 15px;
  line-height: 1.95;
  color: #4a443b;
  margin: 0 0 28px;
}


/* 루트 모듈 */
.route-module {
  border: 1px solid #e4ded2;
  border-radius: 2px;
  overflow: hidden;
  margin: 0 0 32px;
}

.route-module-header {
  padding: 16px 22px;
  background: #f4f1ea;
  border-bottom: 1px solid #e4ded2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10.5px;
  letter-spacing: .16em;
  text-transform: uppercase;
  color: #5c554b;
}

.route-module-dist {
  color: #9a9286;
  text-transform: none;
  letter-spacing: 0;
}

.route-module-body {
  padding: 6px 22px;
}

.route-stop-row {
  display: flex;
  gap: 14px;
  padding: 12px 0;
  align-items: center;
  border-top: 1px dashed #ece5d8;
}
.route-stop-row:first-child { border-top: none; }

.route-stop-pin {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  color: #fff;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.route-stop-name {
  font-family: 'Gowun Batang', serif;
  font-size: 15px;
  color: #211d18;
}

.route-stop-addr {
  margin-left: auto;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 11px;
  color: #9a9286;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 180px;
}

.route-module-footer {
  padding: 14px 22px;
  border-top: 1px solid #e4ded2;
}

.btn-import-route {
  width: 100%;
  background: #b85c38;
  color: #fff;
  border: none;
  font-weight: 600;
  font-size: 13px;
  padding: 12px;
  border-radius: 1px;
  cursor: pointer;
  transition: background .2s;
}
.btn-import-route:hover { background: #a04e2d; }

/* 반응 버튼 */
.article-reactions {
  margin-top: 40px;
  padding-top: 26px;
  border-top: 1px solid #e4ded2;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.reaction-btn {
  border: 1px solid #d8d1c4;
  background: transparent;
  font-size: 13px;
  color: #211d18;
  padding: 10px 18px;
  border-radius: 999px;
  cursor: pointer;
  transition: border-color .2s, color .2s;
}
.reaction-btn:hover { border-color: #b85c38; color: #b85c38; }
.reaction-btn.liked { border-color: #b85c38; color: #b85c38; background: #fdf3ee; }
.reaction-btn.danger:hover { border-color: #dc2626; color: #dc2626; }

/* 반응형 */
@media (max-width: 768px) {
  .article-shell { padding: 20px 16px 48px; }
  .article-header { padding: 36px 24px 24px; }
  .article-title { font-size: 24px; }
  .article-cover { height: 180px; max-width: 100%; }
  .article-body { padding: 32px 24px; }
}
</style>
