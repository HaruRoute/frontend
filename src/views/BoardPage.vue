<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import api from '../api'
import { auth } from '../composables/useAuth'

interface Post {
  id: number
  title: string
  authorName: string
  viewCount: number
  hasRoute: boolean
  category: string       // 'FREE' | 'QUESTION'
  coverImage: string | null
  createdAt: string
}

interface Page {
  posts: Post[]
  totalCount: number
  page: number
  size: number
  totalPages: number
}

interface Notice {
  id: number
  title: string
}

const router = useRouter()
const route = useRoute()
const pageData = ref<Page>({ posts: [], totalCount: 0, page: 0, size: 10, totalPages: 0 })
const currentPage = ref(0)
const isLoading = ref(false)
// UI 표시용 Korean filter, API는 영문 enum 사용
const activeFilter = ref<'전체' | '자유' | '질문'>('전체')

const latestNotice = ref<Notice | null>(null)
const bestPosts = ref<Post[]>([])
const isOverviewLoading = ref(false)

const FILTERS = ['전체', '공지', '자유', '질문']
// Korean → English enum map
const CAT_MAP: Record<string, string> = { '자유': 'FREE', '질문': 'QUESTION' }
// English → Korean label
const CAT_LABEL: Record<string, string> = { FREE: '자유', QUESTION: '질문' }

const fmt = (d: string) => {
  const date = new Date(d)
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
}
const initial = (name: string) => name?.charAt(0) || '?'
const catLabel = (cat: string) => CAT_LABEL[cat] || '자유'

const featured = computed(() => pageData.value.posts[0] ?? null)
const gridPosts = computed(() => pageData.value.posts.slice(1))

const loadPosts = async (p = 0) => {
  isLoading.value = true
  try {
    const params: Record<string, unknown> = { page: p, size: 10 }
    if (activeFilter.value === '질문') {
      // 질문 게시판은 별도 qnas 테이블
      const res = await api.get('/qnas', { params })
      // QnaDto.PageResponse는 'qnas' 키 사용 → posts 형태로 정규화
      pageData.value = { ...res.data, posts: res.data.qnas ?? [] }
    } else {
      // 자유 게시판은 posts 테이블 (FREE 카테고리)
      params.category = 'FREE'
      const res = await api.get('/posts', { params })
      pageData.value = res.data
    }
    currentPage.value = p
  } finally {
    isLoading.value = false
  }
}

const loadOverview = async () => {
  isOverviewLoading.value = true
  try {
    const [nRes, pRes] = await Promise.allSettled([
      api.get('/notices', { params: { page: 0, size: 1 } }),
      api.get('/posts', { params: { category: 'FREE', page: 0, size: 3, best: true } }),
    ])
    if (nRes.status === 'fulfilled') {
      const data = nRes.value.data
      const arr: Notice[] = Array.isArray(data) ? data : (data.content ?? data.notices ?? [])
      latestNotice.value = arr[0] ?? null
    }
    if (pRes.status === 'fulfilled') {
      bestPosts.value = pRes.value.data.posts ?? []
    }
  } finally {
    isOverviewLoading.value = false
  }
}

const handleFilter = (f: string) => {
  if (f === '공지') { router.push('/notices'); return }
  activeFilter.value = f as '전체' | '자유' | '질문'
  if (f === '전체') loadOverview()
  else loadPosts(0)
}

const writeUrl = computed(() => {
  if (activeFilter.value === '질문') return '/board/qna/write'
  return '/board/write?category=FREE'
})

onMounted(() => {
  const f = route.query.filter as string
  if (f === '자유' || f === '질문') {
    activeFilter.value = f
    loadPosts(0)
  } else {
    loadOverview()
  }
})
</script>

<template>
  <div class="board-page">
    <div class="board-shell">

      <!-- Masthead -->
      <div class="board-masthead">
        <div>
          <div class="masthead-kicker">The Journal</div>
          <div class="masthead-title">여행자들의 기록</div>
        </div>
        <button v-if="auth.isLoggedIn" class="btn-write" @click="router.push(writeUrl)">
          + 기록 쓰기
        </button>
      </div>

      <!-- Filters -->
      <div class="filter-row">
        <button
          v-for="f in FILTERS"
          :key="f"
          class="filter-btn"
          :class="{ active: f !== '공지' && activeFilter === f }"
          @click="handleFilter(f)"
        >{{ f }}</button>
      </div>

      <!-- ── 전체 탭 ── -->
      <template v-if="activeFilter === '전체'">
        <div v-if="isOverviewLoading" class="board-loading">
          <div class="spinner-border" role="status"><span class="visually-hidden">로딩 중...</span></div>
        </div>
        <template v-else>
          <div v-if="latestNotice" class="notice-bar" @click="router.push('/notices')">
            <span class="notice-bar-badge">공지</span>
            <span class="notice-bar-title">{{ latestNotice.title }}</span>
            <span class="notice-bar-arrow">›</span>
          </div>

          <div class="section-label">
            <span class="section-label-text">자유 게시판 인기글</span>
            <button class="section-label-more" @click="handleFilter('자유')">전체보기 →</button>
          </div>

          <div v-if="bestPosts.length" class="board-grid overview-grid">
            <div
              v-for="post in bestPosts"
              :key="post.id"
              class="grid-card"
              @click="router.push(`/board/post/${post.id}`)"
            >
              <div class="grid-cover">
                <img v-if="post.coverImage" :src="post.coverImage" class="grid-cover-img" alt="" />
              </div>
              <div class="grid-body">
                <div class="grid-cat">{{ catLabel(post.category) }}</div>
                <div class="grid-title">{{ post.title }}</div>
                <div class="grid-meta">
                  <span>{{ post.authorName }}</span>
                  <span class="grid-meta-right">조회 {{ post.viewCount }}</span>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="board-empty">
            <p class="empty-title">아직 자유 게시글이 없습니다.</p>
          </div>
        </template>
      </template>

      <!-- ── 자유 탭 (featured + grid) ── -->
      <template v-else-if="activeFilter === '자유'">
        <div v-if="isLoading" class="board-loading">
          <div class="spinner-border" role="status"><span class="visually-hidden">로딩 중...</span></div>
        </div>
        <div v-else-if="pageData.posts.length === 0" class="board-empty">
          <p class="empty-title">아직 자유 게시글이 없습니다.</p>
          <p class="empty-sub">첫 번째 기록을 남겨보세요.</p>
        </div>
        <template v-else>
          <!-- Featured 카드 -->
          <div class="featured-card" @click="router.push(`/board/post/${featured!.id}`)">
            <div class="featured-cover">
              <img v-if="featured!.coverImage" :src="featured!.coverImage" class="cover-img" alt="" />
            </div>
            <div class="featured-body">
              <div class="feat-kicker">Featured · {{ catLabel(featured!.category) }}</div>
              <div class="feat-title">{{ featured!.title }}</div>
              <div class="feat-meta">
                <span class="feat-avatar">{{ initial(featured!.authorName) }}</span>
                <span class="feat-author">{{ featured!.authorName }}</span>
                <span>·</span>
                <span>{{ fmt(featured!.createdAt) }}</span>
                <span>·</span>
                <span>조회 {{ featured!.viewCount }}</span>
              </div>
            </div>
          </div>

          <!-- 그리드 -->
          <div v-if="gridPosts.length" class="board-grid">
            <div
              v-for="post in gridPosts"
              :key="post.id"
              class="grid-card"
              @click="router.push(`/board/post/${post.id}`)"
            >
              <div class="grid-cover">
                <img v-if="post.coverImage" :src="post.coverImage" class="grid-cover-img" alt="" />
              </div>
              <div class="grid-body">
                <div class="grid-cat">{{ catLabel(post.category) }}</div>
                <div class="grid-title">{{ post.title }}</div>
                <div class="grid-meta">
                  <span>{{ post.authorName }}</span>
                  <span class="grid-meta-right">{{ fmt(post.createdAt) }} · 조회 {{ post.viewCount }}</span>
                </div>
              </div>
            </div>
          </div>

          <div v-if="pageData.totalPages > 1" class="board-pagination">
            <button
              v-for="p in pageData.totalPages" :key="p"
              class="page-btn" :class="{ active: p - 1 === currentPage }"
              @click="loadPosts(p - 1)"
            >{{ p }}</button>
          </div>
        </template>
      </template>

      <!-- ── 질문 탭 (텍스트 리스트) ── -->
      <template v-else-if="activeFilter === '질문'">
        <div v-if="isLoading" class="board-loading">
          <div class="spinner-border" role="status"><span class="visually-hidden">로딩 중...</span></div>
        </div>
        <div v-else-if="pageData.posts.length === 0" class="board-empty">
          <p class="empty-title">아직 질문 게시글이 없습니다.</p>
          <p class="empty-sub">첫 번째 질문을 남겨보세요.</p>
        </div>
        <template v-else>
          <div class="q-list">
            <div
              v-for="post in pageData.posts"
              :key="post.id"
              class="q-row"
              @click="router.push(`/board/qna/${post.id}`)"
            >
              <div class="q-row-main">
                <span class="q-title">{{ post.title }}</span>
                <span class="q-meta">{{ post.authorName }} · {{ fmt(post.createdAt) }} · 조회 {{ post.viewCount }}</span>
              </div>
              <span class="q-arrow">›</span>
            </div>
          </div>

          <div v-if="pageData.totalPages > 1" class="board-pagination">
            <button
              v-for="p in pageData.totalPages" :key="p"
              class="page-btn" :class="{ active: p - 1 === currentPage }"
              @click="loadPosts(p - 1)"
            >{{ p }}</button>
          </div>
        </template>
      </template>

    </div>
  </div>
</template>

<style scoped>
.board-page {
  min-height: calc(100vh - 68px);
  background: #f4f1ea;
  color: #211d18;
}
.board-shell {
  max-width: 1180px;
  margin: 0 auto;
  padding: 52px 40px 72px;
  animation: etFade .4s ease;
}
@keyframes etFade { from { opacity: 0 } to { opacity: 1 } }

/* Masthead */
.board-masthead {
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
  flex-shrink: 0;
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
.filter-btn.active { background: #211d18; border-color: #211d18; color: #f4f1ea; }

/* 로딩/빈 상태 */
.board-loading { display: flex; justify-content: center; padding: 80px 0; }
.board-loading .spinner-border { color: #b85c38; width: 2rem; height: 2rem; }
.board-empty {
  text-align: center;
  padding: 60px 0;
  border: 1px dashed #d8d1c4;
  border-radius: 2px;
  background: #fcfbf7;
}
.empty-title { font-family: 'Gowun Batang', serif; font-size: 1.1rem; margin: 0 0 6px; }
.empty-sub { font-size: .85rem; color: #9a9286; margin: 0; }

/* ── 전체 탭 ── */
.notice-bar {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 20px;
  background: #fcfbf7;
  border: 1px solid #e4ded2;
  border-radius: 2px;
  margin-bottom: 36px;
  cursor: pointer;
  transition: background .15s;
}
.notice-bar:hover { background: #f7f2e8; }
.notice-bar-badge {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10px;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: #fff;
  background: #b85c38;
  padding: 3px 10px;
  border-radius: 999px;
  flex-shrink: 0;
}
.notice-bar-title {
  flex: 1;
  font-family: 'Gowun Batang', serif;
  font-size: 15px;
  color: #211d18;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.notice-bar-arrow { font-size: 18px; color: #9a9286; flex-shrink: 0; }

.section-label {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 20px;
}
.section-label-text {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 11px;
  letter-spacing: .18em;
  text-transform: uppercase;
  color: #5c554b;
}
.section-label-more {
  background: transparent;
  border: none;
  cursor: pointer;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 11px;
  color: #9a9286;
  padding: 0;
  transition: color .2s;
}
.section-label-more:hover { color: #b85c38; }

/* Featured 카드 */
.featured-card {
  display: grid;
  grid-template-columns: 1.45fr 1fr;
  border: 1px solid #e4ded2;
  border-radius: 2px;
  overflow: hidden;
  cursor: pointer;
  margin-bottom: 36px;
  background: #fcfbf7;
  transition: box-shadow .25s;
}
.featured-card:hover { box-shadow: 0 22px 44px -26px rgba(33,29,24,.3); }

.featured-cover {
  position: relative;
  height: 380px;
  background: #ded6c6;
  background-image: repeating-linear-gradient(45deg, #d6cdb9 0 12px, transparent 12px 24px);
  overflow: hidden;
}
.featured-body {
  padding: 44px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.feat-kicker {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10.5px;
  letter-spacing: .16em;
  text-transform: uppercase;
  color: #b85c38;
  margin-bottom: 16px;
}
.feat-title {
  font-family: 'Newsreader', 'Gowun Batang', serif;
  font-size: 29px;
  line-height: 1.32;
  letter-spacing: -0.01em;
}
.feat-meta {
  margin-top: 24px;
  display: flex;
  align-items: center;
  gap: 11px;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 11px;
  color: #9a9286;
}
.feat-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #e7e0d2;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #5c554b;
  font-family: 'Gowun Batang', serif;
  font-size: 13px;
  flex-shrink: 0;
}
.feat-author { color: #5c554b; }

/* 그리드 */
.board-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 28px;
  margin-bottom: 40px;
}
.overview-grid { grid-template-columns: repeat(3, 1fr); }

.grid-card {
  cursor: pointer;
  background: #fcfbf7;
  border: 1px solid #e4ded2;
  border-radius: 2px;
  overflow: hidden;
  transition: transform .25s cubic-bezier(.4,0,.2,1), box-shadow .25s;
}
.grid-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 20px 40px -24px rgba(33,29,24,.3);
}

/* 커버 이미지 — 사진 있으면 사진, 없으면 해치 패턴 */
.grid-cover {
  position: relative;
  height: 172px;
  background: #e7e0d2;
  background-image: repeating-linear-gradient(45deg, #ded6c6 0 10px, transparent 10px 20px);
  overflow: hidden;
}
.grid-cover-img,
.cover-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.grid-body { padding: 24px 24px 26px; }
.grid-cat {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10px;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: #b85c38;
  margin-bottom: 11px;
}
.grid-title {
  font-family: 'Newsreader', 'Gowun Batang', serif;
  font-size: 19px;
  line-height: 1.36;
  color: #211d18;
}
.grid-meta {
  margin-top: 18px;
  display: flex;
  align-items: center;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10.5px;
  color: #9a9286;
}
.grid-meta-right { margin-left: auto; }

/* ── 질문 탭 리스트 ── */
.q-list {
  border: 1px solid #e4ded2;
  border-radius: 2px;
  background: #fcfbf7;
  overflow: hidden;
  margin-bottom: 36px;
}
.q-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px 26px;
  border-bottom: 1px solid #e4ded2;
  cursor: pointer;
  transition: background .15s;
}
.q-row:last-child { border-bottom: none; }
.q-row:hover { background: #f7f2e8; }
.q-row-main {
  flex: 1;
  display: flex;
  align-items: baseline;
  gap: 20px;
  min-width: 0;
}
.q-title {
  font-family: 'Gowun Batang', serif;
  font-size: 15.5px;
  color: #211d18;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 1;
}
.q-meta {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10.5px;
  color: #9a9286;
  white-space: nowrap;
  flex-shrink: 0;
}
.q-arrow { font-size: 18px; color: #c8beaf; flex-shrink: 0; }

/* 페이지네이션 */
.board-pagination { display: flex; justify-content: center; gap: 4px; }
.page-btn {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid #d8d1c4;
  border-radius: 1px;
  color: #5c554b;
  font-size: 13px;
  cursor: pointer;
  transition: all .2s;
}
.page-btn:hover { border-color: #b85c38; color: #b85c38; }
.page-btn.active { background: #211d18; border-color: #211d18; color: #f4f1ea; }

/* 반응형 */
@media (max-width: 900px) {
  .board-shell { padding: 36px 24px 48px; }
  .featured-card { grid-template-columns: 1fr; }
  .featured-cover { height: 240px; }
  .board-grid, .overview-grid { grid-template-columns: repeat(2, 1fr); }
  .masthead-title { font-size: 30px; }
}
@media (max-width: 600px) {
  .board-grid, .overview-grid { grid-template-columns: 1fr; }
  .q-row-main { flex-direction: column; gap: 4px; }
}
</style>
