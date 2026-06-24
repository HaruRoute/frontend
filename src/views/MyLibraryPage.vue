<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api'
import { auth } from '../composables/useAuth'

const router = useRouter()

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

const plans = ref<SavedPlan[]>([])
const isLoading = ref(false)
const selectedPlan = ref<SavedPlan | null>(null)
const storyMapRef = ref<HTMLElement | null>(null)

const parsePlaces = (json: string): RoutePlace[] => {
  try { return JSON.parse(json) } catch { return [] }
}

const selectedPlaces = computed(() =>
  selectedPlan.value ? parsePlaces(selectedPlan.value.placesJson) : []
)

const formatDate = (dateVal: string | number[]) => {
  if (!dateVal) return ''
  let date: Date
  if (Array.isArray(dateVal)) {
    date = new Date(dateVal[0], dateVal[1] - 1, dateVal[2])
  } else {
    date = new Date(dateVal)
  }
  if (isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const getRegionLabel = (plan: SavedPlan): string => {
  const places = parsePlaces(plan.placesJson)
  if (!places.length) return 'UNTITLED'
  const addr = places[0].addr1 || ''
  const first = addr.trim().split(' ')[0]
  return first || places[0].title
}

const fetchPlans = async () => {
  if (!auth.isLoggedIn) return
  isLoading.value = true
  try {
    const res = await api.get('/plans')
    plans.value = res.data
  } catch (e) {
    console.error('Failed to fetch plans:', e)
  } finally {
    isLoading.value = false
  }
}

const initStoryMap = async (plan: SavedPlan) => {
  await nextTick()
  const places = parsePlaces(plan.placesJson)
  if (!places.length || !storyMapRef.value) return

  const kakao = (window as any).kakao
  if (!kakao?.maps) return

  const center = new kakao.maps.LatLng(places[0].lat, places[0].lng)
  const map = new kakao.maps.Map(storyMapRef.value, { center, level: 7 })

  const bounds = new kakao.maps.LatLngBounds()

  places.forEach((p, idx) => {
    const pos = new kakao.maps.LatLng(p.lat, p.lng)
    bounds.extend(pos)

    const isLast = idx === places.length - 1
    const content = `
      <div style="
        width:28px; height:28px; border-radius:50%;
        background:${isLast ? '#211d18' : '#b85c38'};
        color:#fff; font-family:'IBM Plex Mono',monospace;
        font-size:11px; font-weight:600;
        display:flex; align-items:center; justify-content:center;
        box-shadow:0 2px 6px rgba(0,0,0,.3);
      ">${idx + 1}</div>`

    new kakao.maps.CustomOverlay({
      map,
      position: pos,
      content,
      yAnchor: 0.5,
      xAnchor: 0.5,
    })
  })

  if (places.length > 1) {
    const path = places.map(p => new kakao.maps.LatLng(p.lat, p.lng))
    new kakao.maps.Polyline({
      map,
      path,
      strokeWeight: 2,
      strokeColor: '#b85c38',
      strokeOpacity: 0.85,
      strokeStyle: 'dashed',
    })
  }

  map.setBounds(bounds)
}

const openDetail = (plan: SavedPlan) => {
  selectedPlan.value = plan
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const closeDetail = () => {
  selectedPlan.value = null
}

const deletePlan = async (id: number) => {
  if (!confirm('이 여행 계획을 삭제하시겠습니까?')) return
  try {
    await api.delete(`/plans/${id}`)
    plans.value = plans.value.filter(p => p.id !== id)
    if (selectedPlan.value?.id === id) closeDetail()
  } catch {
    alert('삭제 실패')
  }
}

const loadPlan = (plan: SavedPlan) => {
  try {
    const places = parsePlaces(plan.placesJson)
    // 경로 데이터 저장
    localStorage.setItem('route_places', JSON.stringify(places))
    localStorage.setItem('route_total_distance', (plan.totalDistance || 0).toString())
    localStorage.setItem('route_transit_fare', (plan.transitFare || 0).toString())
    localStorage.setItem('route_taxi_fare', (plan.taxiFare || 0).toString())
    // edit 모드 상태 저장 (홈으로 이동 후 RoutePlanner가 마운트될 때 복원)
    localStorage.setItem('route_planner_mode', 'edit')
    localStorage.setItem('route_editing_plan_id', plan.id.toString())
    localStorage.setItem('route_editing_plan_title', plan.title)
    localStorage.setItem('route_plan_title', plan.title)
    router.push('/')
  } catch {
    alert('계획을 불러오지 못했습니다.')
  }
}

watch(selectedPlan, (plan) => {
  if (plan) initStoryMap(plan)
})

watch(() => auth.isLoggedIn, (val) => {
  if (val) fetchPlans()
  else { plans.value = []; selectedPlan.value = null }
}, { immediate: true })

onMounted(fetchPlans)
</script>

<template>
  <main class="library-page">

    <!-- ── 세부 뷰 (Story Spread) ── -->
    <template v-if="selectedPlan">
      <div class="story-spread">

        <!-- 왼쪽: 텍스트 -->
        <div class="story-left">
          <div class="story-nav-row">
            <div class="story-kicker">Itinerary · {{ getRegionLabel(selectedPlan) }}</div>
            <div class="story-nav-btns">
              <button class="story-nav-btn" @click="closeDetail">← 보관함</button>
              <button class="story-nav-btn" @click="loadPlan(selectedPlan)">동선 불러오기</button>
            </div>
          </div>

          <h1 class="story-title">{{ selectedPlan.title }}</h1>

          <div class="story-rule"></div>

          <div class="story-stops">
            <div
              v-for="(place, idx) in selectedPlaces"
              :key="idx"
              class="story-stop-row"
            >
              <div
                class="story-stop-num"
                :style="{ color: idx === selectedPlaces.length - 1 ? '#211d18' : '#b85c38' }"
              >{{ idx + 1 }}</div>
              <div class="story-stop-body">
                <div class="story-stop-name">{{ place.title }}</div>
                <div class="story-stop-addr">{{ place.addr1 }}</div>
              </div>
            </div>
          </div>

          <div class="story-footer">
            <button class="btn-story-load" @click="loadPlan(selectedPlan)">동선 불러오기</button>
            <span class="story-footer-meta">
              {{ selectedPlan.totalDistance ? `${selectedPlan.totalDistance} km` : '-' }}
            </span>
          </div>
        </div>

        <!-- 구분선 -->
        <div class="story-col-divider"></div>

        <!-- 오른쪽: 커버 사진 + 카카오맵 -->
        <div class="story-right">

          <!-- 커버 (첫 번째 관광지 사진) -->
          <div class="story-cover-panel">
            <img
              v-if="selectedPlaces[0]?.firstimage"
              class="story-cover-img"
              :src="selectedPlaces[0].firstimage"
              :alt="selectedPlaces[0].title"
            />
            <div class="story-cover-overlay"></div>
            <div class="story-cover-info">
              <div class="story-cover-sub">
                {{ getRegionLabel(selectedPlan) }} · {{ formatDate(selectedPlan.createdAt) }}
              </div>
              <div class="story-cover-place-name">
                {{ selectedPlaces[0]?.title || '' }}
              </div>
            </div>
          </div>

          <!-- 카카오맵 -->
          <div ref="storyMapRef" class="story-map-panel"></div>

        </div>
      </div>
    </template>

    <!-- ── 목록 뷰 ── -->
    <template v-else>
      <section class="library-shell">
        <div class="library-heading-row">
          <div>
            <p class="library-kicker">MY ITINERARIES</p>
            <h1 class="library-title">내 동선 기록</h1>
            <p class="library-description">저장한 동선이 한 권의 잡지처럼 쌓입니다. 표지를 눌러 다시 읽어보세요.</p>
          </div>
          <button class="library-new-route-btn" @click="router.push('/')">+ 새 동선 짜기</button>
        </div>

        <div v-if="!auth.isLoggedIn" class="library-empty">
          <p class="empty-title">로그인이 필요합니다.</p>
          <p class="empty-sub">로그인 후 저장한 동선을 확인하세요.</p>
        </div>

        <div v-else-if="isLoading" class="library-loading">
          <div class="spinner-border" role="status">
            <span class="visually-hidden">로딩 중...</span>
          </div>
        </div>

        <div v-else-if="plans.length === 0" class="library-empty">
          <p class="empty-title">저장된 동선이 없습니다.</p>
          <p class="empty-sub">플래너에서 동선을 만들고 '보관함에 저장'을 눌러보세요.</p>
        </div>

        <div v-else class="library-grid">
          <div
            v-for="plan in plans"
            :key="plan.id"
            class="library-card"
            @click="openDetail(plan)"
          >
            <!-- X 삭제 버튼 -->
            <button class="btn-card-x" @click.stop="deletePlan(plan.id)" title="삭제">×</button>

            <!-- 커버 사진 -->
            <div class="card-cover">
              <img
                v-if="parsePlaces(plan.placesJson)[0]?.firstimage"
                class="card-cover-img"
                :src="parsePlaces(plan.placesJson)[0].firstimage"
                :alt="parsePlaces(plan.placesJson)[0].title"
              />
              <div class="card-cover-overlay"></div>
              <div class="card-cover-title">{{ plan.title }}</div>
            </div>

            <!-- 카드 본문 -->
            <div class="card-body">
              <div class="card-meta">
                <span class="card-date">{{ formatDate(plan.createdAt) }}</span>
                <span class="card-dist">{{ plan.totalDistance ? `${plan.totalDistance} km` : '-' }}</span>
              </div>
              <div class="card-route-row">
                {{ parsePlaces(plan.placesJson).map(p => p.title).join(' → ') }}
              </div>
            </div>
          </div>
        </div>
      </section>
    </template>

  </main>
</template>

<style scoped>
.library-page {
  min-height: calc(100vh - 68px);
  background: var(--bg);
  color: var(--text);
}

/* ═══════════════════════════════
   STORY SPREAD (세부 뷰)
═══════════════════════════════ */
.story-spread {
  display: grid;
  grid-template-columns: 1fr 1px 1.05fr;
  min-height: calc(100vh - 68px);
  background: #f4f1ea;
  animation: etFade .45s ease;
  overflow: hidden;
}

@keyframes etFade { from { opacity: 0 } to { opacity: 1 } }
@keyframes etRise { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: none } }

/* 왼쪽 패널 */
.story-left {
  padding: 44px 52px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  animation: etRise .5s cubic-bezier(.4,0,.2,1);
}

.story-nav-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 22px;
}

.story-kicker {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10.5px;
  letter-spacing: .2em;
  text-transform: uppercase;
  color: #b85c38;
}

.story-nav-btns { display: flex; gap: 8px; }

.story-nav-btn {
  border: 1px solid #d8d1c4;
  background: transparent;
  font-size: 12px;
  color: #5c554b;
  padding: 7px 14px;
  border-radius: 1px;
  cursor: pointer;
  transition: border-color .2s, color .2s;
}
.story-nav-btn:hover {
  border-color: #b85c38;
  color: #b85c38;
}

.story-title {
  font-family: 'Newsreader', 'Gowun Batang', serif;
  font-size: 38px;
  line-height: 1.2;
  font-weight: 400;
  letter-spacing: -0.015em;
  color: var(--text);
  margin: 0 0 20px;
}

.story-rule {
  height: 1px;
  background: #e4ded2;
  margin-bottom: 28px;
}

/* 장소 목록 */
.story-stops {
  display: flex;
  flex-direction: column;
  gap: 22px;
  flex: 1;
}

.story-stop-row {
  display: flex;
  gap: 18px;
  align-items: flex-start;
}

.story-stop-num {
  font-family: 'Newsreader', serif;
  font-size: 30px;
  line-height: 1;
  width: 34px;
  flex-shrink: 0;
}

.story-stop-body { flex: 1; }

.story-stop-name {
  font-family: 'Gowun Batang', serif;
  font-size: 18px;
  line-height: 1.4;
  color: var(--text);
}

.story-stop-addr {
  font-size: 12.5px;
  color: #9a9286;
  margin-top: 3px;
  line-height: 1.6;
}

/* 하단 액션 */
.story-footer {
  margin-top: 28px;
  padding-top: 22px;
  border-top: 1px solid #e4ded2;
  display: flex;
  align-items: center;
  gap: 16px;
}

.btn-story-load {
  background: #211d18;
  color: #f4f1ea;
  border: none;
  font-weight: 600;
  font-size: 13.5px;
  padding: 14px 26px;
  border-radius: 1px;
  cursor: pointer;
  transition: background .2s;
}
.btn-story-load:hover { background: var(--terracotta); }

.story-footer-meta {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 11px;
  color: #9a9286;
}

/* 구분선 */
.story-col-divider { background: #e4ded2; }

/* 오른쪽 패널 */
.story-right {
  display: flex;
  flex-direction: column;
  animation: etRise .5s cubic-bezier(.4,0,.2,1);
}

/* 커버 (상단 46%) */
.story-cover-panel {
  height: 46%;
  flex: none;
  position: relative;
  display: flex;
  align-items: flex-end;
  padding: 26px;
  background: #ded6c6;
  background-image: repeating-linear-gradient(
    45deg,
    #d6cdb9 0 12px,
    transparent 12px 24px
  );
  overflow: hidden;
}

.story-cover-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}

.story-cover-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(33,29,24,.6), transparent 55%);
}

.story-cover-info {
  position: relative;
  color: #f4f1ea;
}

.story-cover-sub {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10px;
  letter-spacing: .16em;
  opacity: .85;
  text-transform: uppercase;
  margin-bottom: 6px;
}

.story-cover-place-name {
  font-family: 'Newsreader', 'Gowun Batang', serif;
  font-size: 28px;
  line-height: 1.2;
  letter-spacing: -0.01em;
}

/* 카카오맵 (하단) */
.story-map-panel {
  flex: 1;
  min-height: 0;
}

/* ═══════════════════════════════
   목록 뷰
═══════════════════════════════ */
.library-shell {
  width: min(1100px, calc(100vw - 48px));
  margin: 0 auto;
  padding: 64px 0;
}

.library-heading-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 32px;
  margin-bottom: 48px;
}

.library-kicker {
  margin: 0 0 14px;
  color: var(--terracotta);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.76rem;
  font-weight: 600;
  letter-spacing: 0.18em;
}

.library-title {
  margin: 0;
  color: var(--text);
  font-family: 'Gowun Batang', serif;
  font-size: clamp(2rem, 4vw, 3rem);
  font-weight: 700;
  line-height: 1.12;
}

.library-description {
  margin: 18px 0 0;
  color: var(--text-muted);
  font-size: 0.98rem;
  line-height: 1.7;
}

.library-new-route-btn {
  flex: 0 0 auto;
  min-width: 128px;
  height: 45px;
  padding: 0 20px;
  background: #211d18;
  border: 1px solid #211d18;
  border-radius: 1px;
  color: #fcfbf7;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 800;
  white-space: nowrap;
}
.library-new-route-btn:hover {
  background: var(--terracotta-dark);
  border-color: var(--terracotta-dark);
}

.library-loading {
  display: flex;
  justify-content: center;
  padding: 80px 0;
}
.library-loading .spinner-border {
  width: 2.2rem;
  height: 2.2rem;
  color: var(--terracotta);
}

.library-empty {
  padding: 80px 0;
  text-align: center;
  border: 1px dashed var(--border);
  border-radius: 2px;
  background: #f7f2e8;
}
.empty-title {
  font-family: 'Gowun Batang', serif;
  font-size: 1.2rem;
  color: var(--text);
  margin: 0 0 8px;
}
.empty-sub {
  font-size: 0.88rem;
  color: var(--text-muted);
  margin: 0;
}

.library-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 24px;
}

.library-card {
  position: relative;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 2px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}
.library-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 24px rgba(33,29,24,.12);
  border-color: var(--terracotta);
}

/* X 삭제 버튼 */
.btn-card-x {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 10;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(33,29,24,.45);
  border: none;
  border-radius: 50%;
  color: #f4f1ea;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  transition: background .15s;
}
.btn-card-x:hover {
  background: rgba(184,92,56,.9);
}

/* 커버 사진 */
.card-cover {
  position: relative;
  height: 200px;
  background: #ded6c6;
  background-image: repeating-linear-gradient(
    45deg,
    #d6cdb9 0 11px,
    transparent 11px 22px
  );
  overflow: hidden;
  flex-shrink: 0;
}

.card-cover-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}

.card-cover-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(33,29,24,.65) 0%, transparent 55%);
}

.card-cover-title {
  position: absolute;
  bottom: 14px;
  left: 16px;
  right: 48px;
  font-family: 'Gowun Batang', serif;
  font-size: 1.2rem;
  font-weight: 900;
  color: #f4f1ea;
  line-height: 1.4;
  text-shadow: 0 2px 6px rgba(33,29,24,.5);
}

/* 카드 본문 */
.card-body {
  padding: 16px 18px 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.card-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.card-date {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.72rem;
  color: var(--text-muted);
}
.card-dist {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.72rem;
  color: var(--terracotta-dark);
  background: #f7eadf;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid #ead0c2;
}

/* 경로 한 줄 표시 */
.card-route-row {
  margin-top: 4px;
  font-size: 0.78rem;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: 'IBM Plex Mono', monospace;
  letter-spacing: 0.02em;
}

/* ── 모바일 ── */
@media (max-width: 768px) {
  .story-spread {
    grid-template-columns: 1fr;
    grid-template-rows: auto 0 auto;
  }
  .story-col-divider { display: none; }
  .story-left { padding: 28px 24px; }
  .story-cover-panel { height: 260px; }
  .story-map-panel { min-height: 320px; }
  .story-title { font-size: 28px; }

  .library-shell {
    width: min(100% - 32px, 1100px);
    padding: 42px 0;
  }
  .library-heading-row {
    align-items: flex-start;
    flex-direction: column;
  }
  .library-new-route-btn { width: 100%; }
  .library-grid { grid-template-columns: 1fr; }
}
</style>
