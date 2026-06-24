<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../api'
import { auth } from '../composables/useAuth'

interface RoutePlace { title: string; addr1: string; lat: number; lng: number; firstimage?: string }
interface Plan { id: number; title: string; placesJson: string; totalDistance: number; createdAt: string }

const route = useRoute()
const router = useRouter()

const isNotice = computed(() => route.query.type === 'notice')
const isQna = computed(() => route.path.startsWith('/board/qna'))
const isEdit = computed(() => !!route.params.id && !isNotice.value)
const isNoticeEdit = computed(() => !!route.params.id && isNotice.value)
const apiBase = computed(() => isQna.value ? '/qnas' : '/posts')

const title = ref('')
const content = ref('')
const isPinned = ref(false)
const isSubmitting = ref(false)
const category = ref<'FREE' | 'QUESTION'>('FREE')

const savedPlans = ref<Plan[]>([])
const selectedPlanId = ref<number | null>(null)
const selectedPlan = computed(() => savedPlans.value.find(p => p.id === selectedPlanId.value) || null)
const selectedPlaces = computed<RoutePlace[]>(() => {
  if (!selectedPlan.value) return []
  try { return JSON.parse(selectedPlan.value.placesJson) } catch { return [] }
})

const boardBack = computed(() => {
  if (isNotice.value || isNoticeEdit.value) return '/board'
  return isQna.value ? '/board?filter=질문' : '/board?filter=자유'
})

// 수정 시 기존 첨부 루트
const editRouteData = ref<string | null>(null)
const editRouteName = ref<string | null>(null)
const editPlaces = computed<RoutePlace[]>(() => {
  if (!editRouteData.value) return []
  try { return JSON.parse(editRouteData.value) } catch { return []  }
})

onMounted(async () => {
  if (!auth.isLoggedIn) { router.push('/board'); return }

  // qna 경로면 QUESTION 고정, 아니면 쿼리 파라미터 기반
  if (isQna.value) {
    category.value = 'QUESTION'
  } else {
    const qCategory = route.query.category as string
    category.value = qCategory === 'QUESTION' ? 'QUESTION' : 'FREE'
  }

  // 저장 계획 목록 로드
  if (!isNotice.value && !isNoticeEdit.value) {
    try {
      const res = await api.get('/plans')
      savedPlans.value = res.data
    } catch {}
  }

  const id = route.params.id
  if (!id) return

  try {
    if (isNoticeEdit.value) {
      const state = window.history.state
      if (state?.noticeTitle !== undefined) {
        title.value = state.noticeTitle || ''
        content.value = state.noticeContent || ''
        isPinned.value = !!state.noticePinned
      } else {
        const res = await api.get(`/notices/${id}`)
        title.value = res.data.title
        content.value = res.data.content
        isPinned.value = res.data.isPinned ?? res.data.pinned ?? false
      }
    } else if (isEdit.value) {
      const res = await api.get(`${apiBase.value}/${id}`)
      title.value = res.data.title
      content.value = res.data.content
      if (res.data.routeData) {
        editRouteData.value = res.data.routeData
        editRouteName.value = res.data.routeName
      }
    }
  } catch (e) {
    alert('게시글 정보를 불러오는 데 실패했습니다.')
    router.push(boardBack.value)
  }
})

const clearRoute = () => {
  selectedPlanId.value = null
  editRouteData.value = null
  editRouteName.value = null
}

const routeData = computed(() => {
  if (selectedPlan.value) return selectedPlan.value.placesJson
  if (editRouteData.value) return editRouteData.value
  return null
})
const routeName = computed(() => {
  if (selectedPlan.value) return selectedPlan.value.title
  if (editRouteName.value) return editRouteName.value
  return null
})
const attachedPlaces = computed(() => selectedPlaces.value.length ? selectedPlaces.value : editPlaces.value)

const submit = async () => {
  if (!title.value.trim() || !content.value.trim()) {
    alert('제목과 내용을 입력해주세요.')
    return
  }
  isSubmitting.value = true
  try {
    if (isNotice.value || isNoticeEdit.value) {
      const body = { title: title.value, content: content.value, isPinned: isPinned.value }
      isNoticeEdit.value
        ? await api.put(`/notices/${route.params.id}`, body)
        : await api.post('/notices', body)
    } else {
      const body = { title: title.value, content: content.value, routeData: routeData.value, routeName: routeName.value,
                     ...(isQna.value ? {} : { category: category.value }) }
      isEdit.value
        ? await api.put(`${apiBase.value}/${route.params.id}`, body)
        : await api.post(apiBase.value, body)
    }
    router.push(boardBack.value)
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="container py-4" style="max-width: 800px; padding: 0 20px">
    <button class="btn btn-sm btn-outline-secondary mb-4" @click="router.push(boardBack)">← 목록으로</button>

    <div class="form-card">
      <h5 class="fw-bold mb-4">
        {{ isNotice || isNoticeEdit ? '📢 공지사항' : '📝 게시글' }}
        {{ isEdit || isNoticeEdit ? '수정' : '작성' }}
      </h5>

      <div class="mb-3">
        <label class="form-label fw-semibold">제목</label>
        <input v-model="title" type="text" class="form-control" placeholder="제목을 입력하세요" />
      </div>

      <div class="mb-3">
        <label class="form-label fw-semibold">내용</label>
        <textarea v-model="content" class="form-control" rows="12" placeholder="내용을 입력하세요" style="resize: vertical" />
      </div>


      <!-- 공지 핀 설정 -->
      <div v-if="isNotice || isNoticeEdit" class="mb-3 form-check">
        <input v-model="isPinned" type="checkbox" class="form-check-input" id="pinCheck" />
        <label class="form-check-label" for="pinCheck">상단 고정</label>
      </div>

      <!-- 경로 첨부 (일반 게시글) -->
      <div v-if="!isNotice && !isNoticeEdit && !isQna" class="route-attach-section mb-4">
        <div class="d-flex align-items-center justify-content-between mb-3">
          <span class="fw-semibold">🗺️ 저장 계획 첨부</span>
          <button v-if="attachedPlaces.length" class="btn btn-sm btn-outline-secondary" @click="clearRoute">첨부 취소</button>
        </div>

        <!-- 저장된 계획 없음 -->
        <div v-if="savedPlans.length === 0" class="text-muted" style="font-size: 0.85rem">
          저장된 여행 계획이 없어요. 경로 플래너에서 계획을 저장한 뒤 첨부할 수 있어요.
        </div>

        <!-- 계획 선택 드롭다운 -->
        <div v-else-if="!attachedPlaces.length">
          <select v-model="selectedPlanId" class="form-select">
            <option :value="null">— 첨부할 계획 선택 —</option>
            <option v-for="p in savedPlans" :key="p.id" :value="p.id">{{ p.title }}</option>
          </select>
        </div>

        <!-- 선택된 루트 미리보기 -->
        <div v-if="attachedPlaces.length" class="route-preview mt-2">
          <div class="route-preview-title mb-2">📍 {{ routeName }}</div>
          <div v-for="(p, i) in attachedPlaces" :key="i" class="route-preview-item">
            <span class="place-num">{{ i + 1 }}</span>
            <div>
              <div class="fw-semibold" style="font-size:0.88rem">{{ p.title }}</div>
              <div class="text-muted" style="font-size:0.78rem">{{ p.addr1 }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="d-flex gap-2 justify-content-end">
        <button class="btn btn-outline-secondary" @click="router.push(boardBack)">취소</button>
        <button class="btn btn-primary" @click="submit" :disabled="isSubmitting">
          <span v-if="isSubmitting" class="spinner-border spinner-border-sm me-1" />
          저장
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.form-card { background: var(--surface-solid); border-radius: 24px; padding: 40px; box-shadow: var(--shadow-lg); border: 1px solid var(--border); }

.category-btn-group { display: flex; gap: 8px; }
.cat-btn {
  border: 1px solid #d8d1c4;
  background: transparent;
  border-radius: 999px;
  color: #5c554b;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  padding: 8px 22px;
  transition: all .2s;
}
.cat-btn:hover { border-color: #b85c38; color: #b85c38; }
.cat-btn.active { background: #211d18; border-color: #211d18; color: #f4f1ea; }
.route-attach-section { border: 1px solid var(--border); border-radius: 16px; padding: 20px; background: #f8fafc; }
.route-preview { display: flex; flex-direction: column; gap: 8px; }
.route-preview-title { font-weight: 700; font-size: 0.92rem; color: var(--primary); }
.route-preview-item { display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; background: white; border-radius: 10px; border: 1px solid var(--border); }
.place-num { background: var(--primary-gradient); color: white; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; font-size: 0.72rem; font-weight: 800; flex-shrink: 0; margin-top: 2px; }
</style>
