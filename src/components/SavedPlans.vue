<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import api from '../api'

interface RoutePlace {
  title: string
  lat: number
  lng: number
  addr1: string
  firstimage: string
}

interface SavedPlan {
  id: number
  title: string
  placesJson: string
  totalDistance: number
  transitFare: number
  taxiFare: number
  createdAt: string | number[]
}

const props = defineProps<{ isLoggedIn: boolean }>()

const savedPlans = ref<SavedPlan[]>([])
const isLoading = ref(false)
const selectedPlan = ref<SavedPlan | null>(null)

const fetchPlans = async () => {
  if (!props.isLoggedIn) {
    savedPlans.value = []
    return
  }
  isLoading.value = true
  try {
    const res = await api.get('/plans')
    savedPlans.value = res.data
  } catch (e) {
    console.error('Failed to fetch saved plans:', e)
  } finally {
    isLoading.value = false
  }
}

watch(() => props.isLoggedIn, (val) => {
  if (val) fetchPlans()
  else { savedPlans.value = []; selectedPlan.value = null }
}, { immediate: true })

onMounted(() => {
  fetchPlans()
  window.addEventListener('plan-saved', fetchPlans)
})

onUnmounted(() => {
  window.removeEventListener('plan-saved', fetchPlans)
})

const parsePlaces = (placesJson: string): RoutePlace[] => {
  try { return JSON.parse(placesJson) } catch { return [] }
}

const formatDate = (dateVal: string | number[]) => {
  if (!dateVal) return ''
  let date: Date
  if (Array.isArray(dateVal)) {
    date = new Date(dateVal[0], dateVal[1] - 1, dateVal[2])
  } else {
    date = new Date(dateVal)
  }
  if (isNaN(date.getTime())) return ''
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
}

const getRegionLabel = (plan: SavedPlan): string => {
  const places = parsePlaces(plan.placesJson)
  if (!places.length) return 'UNTITLED'
  const addr = places[0].addr1 || ''
  const first = addr.trim().split(' ')[0]
  return first ? first.toUpperCase() : places[0].title.toUpperCase()
}

const openDetail = (plan: SavedPlan) => {
  selectedPlan.value = plan
}

const closeDetail = () => {
  selectedPlan.value = null
}

const loadPlan = (plan: SavedPlan) => {
  try {
    const places = parsePlaces(plan.placesJson)
    localStorage.setItem('route_places', JSON.stringify(places))
    localStorage.setItem('route_total_distance', plan.totalDistance.toString())
    localStorage.setItem('route_transit_fare', (plan.transitFare || 0).toString())
    localStorage.setItem('route_taxi_fare', (plan.taxiFare || 0).toString())
    localStorage.setItem('route_planner_mode', 'edit')
    localStorage.setItem('route_editing_plan_id', plan.id.toString())
    localStorage.setItem('route_editing_plan_title', plan.title)
    localStorage.setItem('route_plan_title', plan.title)

    window.dispatchEvent(new CustomEvent('edit-saved-plan', {
      detail: {
        id: plan.id,
        title: plan.title,
        places,
        totalDistance: plan.totalDistance,
        totalTransitFare: plan.transitFare || 0,
        totalTaxiFare: plan.taxiFare || 0
      }
    }))
    closeDetail()
  } catch {
    alert('계획을 불러오지 못했습니다.')
  }
}

const deletePlan = async (id: number) => {
  if (!confirm('이 여행 계획을 삭제하시겠습니까?')) return
  try {
    await api.delete(`/plans/${id}`)
    savedPlans.value = savedPlans.value.filter(p => p.id !== id)
    if (selectedPlan.value?.id === id) closeDetail()
  } catch {
    alert('삭제 실패')
  }
}
</script>

<template>
  <div v-if="isLoggedIn" class="saved-plans-container">

    <!-- 로딩 -->
    <div v-if="isLoading" class="sp-loading">
      <div class="spinner-border" role="status">
        <span class="visually-hidden">로딩 중...</span>
      </div>
    </div>

    <!-- 세부 화면 -->
    <template v-else-if="selectedPlan">
      <div class="sp-detail">
        <button class="sp-back-btn" @click="closeDetail">
          ← 목록으로
        </button>

        <div class="sp-detail-cover">
          <div class="sp-cover-overlay"></div>
          <div class="sp-cover-label">발행 · {{ formatDate(selectedPlan.createdAt) }}</div>
        </div>

        <div class="sp-detail-body">
          <div class="sp-region">{{ getRegionLabel(selectedPlan) }}</div>
          <div class="sp-detail-title">{{ selectedPlan.title }}</div>
          <div class="sp-detail-meta">
            <span>{{ parsePlaces(selectedPlan.placesJson).length }}곳</span>
            <span class="sp-dot">·</span>
            <span>{{ selectedPlan.totalDistance ? `${selectedPlan.totalDistance} km` : '-' }}</span>
          </div>

          <div class="sp-places-list">
            <div
              v-for="(place, idx) in parsePlaces(selectedPlan.placesJson)"
              :key="idx"
              class="sp-place-row"
            >
              <span class="sp-place-num">{{ idx + 1 }}</span>
              <div class="sp-place-info">
                <span class="sp-place-name">{{ place.title }}</span>
                <span class="sp-place-addr">{{ place.addr1 }}</span>
              </div>
            </div>
          </div>

          <div class="sp-detail-actions">
            <button class="sp-btn-load" @click="loadPlan(selectedPlan)">동선 불러오기</button>
          </div>
        </div>
      </div>
    </template>

    <!-- 카드 목록 -->
    <template v-else>
      <div v-if="savedPlans.length === 0" class="sp-empty">
        <div class="sp-empty-label">LIB</div>
        <div class="sp-empty-title">저장된 여행 계획이 없습니다.</div>
        <div class="sp-empty-sub">플래너에서 나만의 동선을 만들고 저장해보세요.</div>
      </div>

      <div v-else class="sp-list">
        <div
          v-for="plan in savedPlans"
          :key="plan.id"
          class="sp-card"
          @click="openDetail(plan)"
        >
          <!-- X 삭제 버튼 -->
          <button class="sp-btn-x" @click.stop="deletePlan(plan.id)" title="삭제">×</button>

          <!-- 커버 -->
          <div class="sp-cover">
            <div class="sp-cover-overlay"></div>
            <div class="sp-cover-label">발행 · {{ formatDate(plan.createdAt) }}</div>
          </div>

          <!-- 카드 본문 -->
          <div class="sp-body">
            <div class="sp-region">{{ getRegionLabel(plan) }}</div>
            <div class="sp-title">{{ plan.title }}</div>
            <div class="sp-meta">
              <span>{{ parsePlaces(plan.placesJson).length }}곳</span>
              <span class="sp-dot">·</span>
              <span>{{ plan.totalDistance ? `${plan.totalDistance} km` : '-' }}</span>
              <span class="sp-meta-date">{{ formatDate(plan.createdAt) }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>

  </div>
</template>

<style scoped>
.saved-plans-container {
  padding: 4px 0;
}

/* 로딩 */
.sp-loading {
  display: flex;
  justify-content: center;
  padding: 48px 0;
}
.sp-loading .spinner-border {
  width: 2rem;
  height: 2rem;
  color: var(--terracotta);
}

/* 빈 상태 */
.sp-empty {
  text-align: center;
  padding: 48px 16px;
  border: 1px dashed var(--border);
  border-radius: 2px;
  background: #f7f2e8;
}
.sp-empty-label {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 1.4rem;
  color: var(--terracotta);
  margin-bottom: 12px;
  opacity: 0.5;
}
.sp-empty-title {
  font-family: 'Gowun Batang', serif;
  font-size: 0.95rem;
  color: var(--text);
  margin-bottom: 6px;
}
.sp-empty-sub {
  font-size: 0.78rem;
  color: var(--text-muted);
  line-height: 1.6;
}

/* ── 카드 목록 ── */
.sp-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.sp-card {
  position: relative;
  background: #fcfbf7;
  border: 1px solid #e4ded2;
  border-radius: 2px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1),
              box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.sp-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 20px 40px -22px rgba(33, 29, 24, 0.3);
}

/* X 삭제 버튼 */
.sp-btn-x {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 10;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(33, 29, 24, 0.45);
  border: none;
  border-radius: 50%;
  color: #f4f1ea;
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.15s;
}
.sp-btn-x:hover {
  background: rgba(184, 92, 56, 0.85);
}

/* 커버 */
.sp-cover {
  height: 140px;
  background: #ded6c6;
  background-image: repeating-linear-gradient(
    45deg,
    #d6cdb9 0 11px,
    transparent 11px 22px
  );
  position: relative;
  display: flex;
  align-items: flex-end;
  padding: 14px 16px;
}
.sp-cover-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(33, 29, 24, 0.4), transparent 60%);
}
.sp-cover-label {
  position: relative;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 9.5px;
  letter-spacing: 0.14em;
  color: #f4f1ea;
  opacity: 0.9;
}

/* 카드 본문 */
.sp-body {
  padding: 18px 18px 20px;
}
.sp-region {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--terracotta);
  margin-bottom: 8px;
}
.sp-title {
  font-family: 'Newsreader', 'Gowun Batang', serif;
  font-size: 18px;
  line-height: 1.35;
  letter-spacing: -0.01em;
  color: var(--text);
  margin-bottom: 14px;
}
.sp-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10.5px;
  color: #9a9286;
}
.sp-dot { opacity: 0.6; }
.sp-meta-date { margin-left: auto; }

/* ── 세부 화면 ── */
.sp-detail {
  display: flex;
  flex-direction: column;
}

.sp-back-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 16px;
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.06em;
  cursor: pointer;
  padding: 4px 0;
  transition: color 0.15s;
}
.sp-back-btn:hover {
  color: var(--terracotta);
}

.sp-detail-cover {
  height: 160px;
  background: #ded6c6;
  background-image: repeating-linear-gradient(
    45deg,
    #d6cdb9 0 11px,
    transparent 11px 22px
  );
  position: relative;
  display: flex;
  align-items: flex-end;
  padding: 16px 20px;
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 20px;
}

.sp-detail-body {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.sp-detail-title {
  font-family: 'Newsreader', 'Gowun Batang', serif;
  font-size: 22px;
  line-height: 1.3;
  letter-spacing: -0.01em;
  color: var(--text);
  margin-bottom: 10px;
}

.sp-detail-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10.5px;
  color: #9a9286;
  margin-bottom: 20px;
  padding-bottom: 18px;
  border-bottom: 1px solid #efe9dd;
}

/* 장소 목록 */
.sp-places-list {
  display: flex;
  flex-direction: column;
  gap: 0;
  margin-bottom: 24px;
}

.sp-place-row {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 11px 0;
  border-bottom: 1px solid #f2ece2;
}
.sp-place-row:last-child {
  border-bottom: none;
}

.sp-place-num {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 11px;
  color: var(--terracotta);
  width: 16px;
  flex-shrink: 0;
  padding-top: 2px;
}

.sp-place-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.sp-place-name {
  font-family: 'Gowun Batang', serif;
  font-size: 14px;
  color: var(--text);
  line-height: 1.4;
}

.sp-place-addr {
  font-size: 11px;
  color: #9a9286;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 세부 화면 액션 버튼 */
.sp-detail-actions {
  display: flex;
  gap: 8px;
}

.sp-btn-load {
  flex: 1;
  background: var(--terracotta);
  border: 1px solid var(--terracotta);
  color: #fcfbf7;
  font-size: 13px;
  font-weight: 700;
  padding: 12px 10px;
  border-radius: 1px;
  cursor: pointer;
  transition: background 0.2s;
}
.sp-btn-load:hover {
  background: var(--terracotta-dark);
  border-color: var(--terracotta-dark);
}

.sp-btn-edit {
  background: transparent;
  border: 1px solid #d8d1c4;
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
  padding: 12px 16px;
  border-radius: 1px;
  cursor: pointer;
  transition: all 0.2s;
}
.sp-btn-edit:hover {
  border-color: var(--terracotta);
  color: var(--terracotta);
}
</style>
