<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import api from '../api'

interface RoutePlace {
  title: string
  lat: number
  lng: number
  addr1: string
  firstimage: string
  distanceFromPrevious?: number
  transitFareFromPrevious?: number
  taxiFareFromPrevious?: number
}

interface SavedPlanEditDetail {
  id: number
  title: string
  places: RoutePlace[]
  totalDistance: number
  totalTransitFare: number
  totalTaxiFare: number
}

interface SavedPlanLoadDetail {
  title: string
  places: RoutePlace[]
  totalDistance: number
  totalTransitFare: number
  totalTaxiFare: number
}

type PlannerMode = 'create' | 'view' | 'edit'

const props = defineProps<{ isLoggedIn: boolean }>()

const routePlaces = ref<RoutePlace[]>([])
const totalDistance = ref<number>(0)
const totalTransitFare = ref<number>(0)
const totalTaxiFare = ref<number>(0)
const isOptimizing = ref(false)
const planTitle = ref('')
const isSaving = ref(false)
const editingPlanId = ref<number | null>(null)
const editingPlanTitle = ref('')
const plannerMode = ref<PlannerMode>('create')
const isViewMode = computed(() => plannerMode.value === 'view')
const isEditMode = computed(() => plannerMode.value === 'edit')
const isReadOnly = computed(() => isViewMode.value)
const plannerModeLabel = computed(() => {
  if (isViewMode.value) return '저장된 계획 조회 중'
  if (isEditMode.value) return '기존 계획 수정 중'
  return '새 계획 작성 중'
})
const plannerModeDescription = computed(() => {
  if (isViewMode.value) return `'${planTitle.value}' 계획을 조회하고 있습니다. 경로 수정과 삭제는 사용할 수 없습니다.`
  if (isEditMode.value) return `'${editingPlanTitle.value}' 계획을 수정하고 있습니다.`
  return '새 여행 계획을 만들고 있습니다.'
})
const clearButtonLabel = computed(() => {
  if (isViewMode.value) return '조회 종료'
  if (isEditMode.value) return '수정 취소'
  return '초기화'
})

const travelMode = ref(localStorage.getItem('travel_mode') || 'driving')

const setTravelMode = (mode: string) => {
  if (isViewMode.value) {
    alert('조회 모드에서는 이동 수단을 변경할 수 없습니다.')
    return
  }

  travelMode.value = mode
  localStorage.setItem('travel_mode', mode)
  dispatchRouteChanged()
}

const openLoginModal = () => {
  const loginButton = document.querySelector('[data-bs-target="#loginModal"]') as HTMLElement | null
  if (loginButton) {
    loginButton.click()
    return
  }
  const modalEl = document.getElementById('loginModal')
  const bootstrap = (window as any).bootstrap
  if (modalEl && bootstrap?.Modal) {
    bootstrap.Modal.getOrCreateInstance(modalEl).show()
  }
}

const savePlan = async () => {
  if (!props.isLoggedIn) {
    openLoginModal()
    return
  }

  if (isViewMode.value) {
    alert('조회 모드에서는 저장할 수 없습니다. 저장 계획 목록에서 수정 버튼을 눌러주세요.')
    return
  }
  if (!planTitle.value.trim()) {
    alert('여행 계획 이름을 입력해주세요.')
    return
  }
  if (routePlaces.value.length === 0) {
    alert('저장할 장소가 없습니다.')
    return
  }

  isSaving.value = true
  try {
    const payload = {
      title: planTitle.value,
      placesJson: JSON.stringify(routePlaces.value),
      totalDistance: totalDistance.value,
      transitFare: totalTransitFare.value,
      taxiFare: totalTaxiFare.value
    }

    const wasEditMode = isEditMode.value

    if (wasEditMode) {
      await api.put(`/plans/${editingPlanId.value}`, payload)
    } else {
      await api.post('/plans', payload)
    }

    alert(wasEditMode
      ? `'${planTitle.value}' 계획 수정이 완료되었습니다.`
      : `'${planTitle.value}' 계획이 저장되었습니다.`
    )

    window.dispatchEvent(new CustomEvent('plan-saved'))

    resetPlannerDraft()
  } catch (e) {
    console.error('Failed to save plan:', e)
    alert('계획 저장 중 오류가 발생했습니다.')
  } finally {
    isSaving.value = false
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

const loadFromStorage = () => {
  const saved = localStorage.getItem('route_places')
  const savedDist = localStorage.getItem('route_total_distance')
  const savedTransit = localStorage.getItem('route_transit_fare')
  const savedTaxi = localStorage.getItem('route_taxi_fare')
  if (saved) {
    try {
      routePlaces.value = JSON.parse(saved)
      totalDistance.value = savedDist ? parseFloat(savedDist) : 0
      totalTransitFare.value = savedTransit ? parseInt(savedTransit) : 0
      totalTaxiFare.value = savedTaxi ? parseInt(savedTaxi) : 0
    } catch (e) {
      routePlaces.value = []
      totalDistance.value = 0
      totalTransitFare.value = 0
      totalTaxiFare.value = 0
    }
  } else {
    routePlaces.value = []
    totalDistance.value = 0
    totalTransitFare.value = 0
    totalTaxiFare.value = 0
  }

  const savedMode = localStorage.getItem('route_planner_mode')
  const savedEditId = localStorage.getItem('route_editing_plan_id')
  const savedEditTitle = localStorage.getItem('route_editing_plan_title')
  const savedTitle = localStorage.getItem('route_plan_title')

  // edit 모드는 places가 함께 있을 때만 복원 (login 등으로 places만 지워진 경우 방지)
  if (savedMode === 'edit' && savedEditId && saved) {
    plannerMode.value = 'edit'
    editingPlanId.value = parseInt(savedEditId)
    editingPlanTitle.value = savedEditTitle || ''
  } else {
    plannerMode.value = 'create'
    editingPlanId.value = null
    editingPlanTitle.value = ''
    localStorage.removeItem('route_planner_mode')
    localStorage.removeItem('route_editing_plan_id')
    localStorage.removeItem('route_editing_plan_title')
  }
  planTitle.value = savedTitle || ''
}

const saveToStorage = () => {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    localStorage.setItem('route_places', JSON.stringify(routePlaces.value))
    localStorage.setItem('route_total_distance', totalDistance.value.toString())
    localStorage.setItem('route_transit_fare', totalTransitFare.value.toString())
    localStorage.setItem('route_taxi_fare', totalTaxiFare.value.toString())
    localStorage.setItem('route_plan_title', planTitle.value)
    if (plannerMode.value === 'edit' && editingPlanId.value !== null) {
      localStorage.setItem('route_planner_mode', 'edit')
      localStorage.setItem('route_editing_plan_id', editingPlanId.value.toString())
      localStorage.setItem('route_editing_plan_title', editingPlanTitle.value)
    } else {
      localStorage.removeItem('route_planner_mode')
      localStorage.removeItem('route_editing_plan_id')
      localStorage.removeItem('route_editing_plan_title')
    }
  }, 300)
}

const dispatchRouteChanged = () => {
  window.dispatchEvent(new CustomEvent('route-changed', {
    detail: { places: routePlaces.value }
  }))
}

const handleAddToRoute = (e: CustomEvent<RoutePlace>) => {
  if (isViewMode.value) {
    alert('조회 모드에서는 경로를 수정할 수 없습니다.')
    return
  }

  const place = e.detail
  const isSamePlace = routePlaces.value.some(p =>
    Math.abs(Number(p.lat) - Number(place.lat)) < 0.000001 &&
    Math.abs(Number(p.lng) - Number(place.lng)) < 0.000001
  )

  if (isSamePlace) {
    alert('이미 경로에 추가된 장소입니다.')
    return
  }
  routePlaces.value.push({
    title: place.title,
    lat: place.lat,
    lng: place.lng,
    addr1: place.addr1,
    firstimage: place.firstimage,
    distanceFromPrevious: 0.0,
    transitFareFromPrevious: 0,
    taxiFareFromPrevious: 0
  })
  saveToStorage()
  dispatchRouteChanged()
}

const handleRoadDistancesUpdated = (e: any) => {
  routePlaces.value = e.detail.places
  totalDistance.value = e.detail.totalDistance
  totalTransitFare.value = e.detail.totalTransitFare || 0
  totalTaxiFare.value = e.detail.totalTaxiFare || 0
  console.log('[RoutePlanner.vue] Received Fares -> Transit:', totalTransitFare.value, 'Taxi:', totalTaxiFare.value);
  saveToStorage()
}

const resetPlannerDraft = () => {
  routePlaces.value = []
  totalDistance.value = 0
  totalTransitFare.value = 0
  totalTaxiFare.value = 0
  planTitle.value = ''
  editingPlanId.value = null
  editingPlanTitle.value = ''
  plannerMode.value = 'create'
  // debounce 없이 즉시 초기화 (navigate 전에 반드시 반영되어야 함)
  if (saveTimer) clearTimeout(saveTimer)
  localStorage.setItem('route_places', '[]')
  localStorage.setItem('route_total_distance', '0')
  localStorage.setItem('route_transit_fare', '0')
  localStorage.setItem('route_taxi_fare', '0')
  localStorage.removeItem('route_plan_title')
  localStorage.removeItem('route_planner_mode')
  localStorage.removeItem('route_editing_plan_id')
  localStorage.removeItem('route_editing_plan_title')
  dispatchRouteChanged()
}

const handleEditSavedPlan = (e: CustomEvent<SavedPlanEditDetail>) => {
  const plan = e.detail
  plannerMode.value = 'edit'
  editingPlanId.value = plan.id
  editingPlanTitle.value = plan.title
  planTitle.value = plan.title
  routePlaces.value = plan.places
  totalDistance.value = plan.totalDistance || 0
  totalTransitFare.value = plan.totalTransitFare || 0
  totalTaxiFare.value = plan.totalTaxiFare || 0
  saveToStorage()
  dispatchRouteChanged()
}

const handleLoadSavedPlan = (e: CustomEvent<SavedPlanLoadDetail>) => {
  const plan = e.detail
  plannerMode.value = 'view'
  editingPlanId.value = null
  editingPlanTitle.value = ''
  planTitle.value = plan.title
  routePlaces.value = plan.places
  totalDistance.value = plan.totalDistance || 0
  totalTransitFare.value = plan.totalTransitFare || 0
  totalTaxiFare.value = plan.totalTaxiFare || 0
  saveToStorage()
  dispatchRouteChanged()
}

watch(() => props.isLoggedIn, (newVal) => {
  if (newVal) {
    loadFromStorage()
  } else {
    // 로그아웃: 플래너 상태와 localStorage edit 정보 모두 초기화
    routePlaces.value = []
    totalDistance.value = 0
    totalTransitFare.value = 0
    totalTaxiFare.value = 0
    planTitle.value = ''
    editingPlanId.value = null
    editingPlanTitle.value = ''
    plannerMode.value = 'create'
    localStorage.removeItem('route_planner_mode')
    localStorage.removeItem('route_editing_plan_id')
    localStorage.removeItem('route_editing_plan_title')
    localStorage.removeItem('route_plan_title')
    dispatchRouteChanged()
  }
})

const handleMapReady = () => dispatchRouteChanged()

onMounted(() => {
  loadFromStorage()
  window.addEventListener('add-to-route', handleAddToRoute as EventListener)
  window.addEventListener('road-distances-updated', handleRoadDistancesUpdated as EventListener)
  window.addEventListener('load-saved-plan', handleLoadSavedPlan as EventListener)
  window.addEventListener('edit-saved-plan', handleEditSavedPlan as EventListener)
  window.addEventListener('map-ready', handleMapReady)

  // Map이 이미 준비된 경우(RoutePlanner가 늦게 마운트된 경우) 즉시 실행
  if ((window as any).__mapReady) {
    dispatchRouteChanged()
  }

  // 챗봇에서 /library → / 이동 시 저장된 장소 추가 처리
  const pending = localStorage.getItem('pending_add_to_route')
  if (pending) {
    localStorage.removeItem('pending_add_to_route')
    try {
      const place = JSON.parse(pending)
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('add-to-route', { detail: place }))
      }, 300)
    } catch {}
  }
})

onUnmounted(() => {
  if (saveTimer) clearTimeout(saveTimer)
  window.removeEventListener('add-to-route', handleAddToRoute as EventListener)
  window.removeEventListener('road-distances-updated', handleRoadDistancesUpdated as EventListener)
  window.removeEventListener('load-saved-plan', handleLoadSavedPlan as EventListener)
  window.removeEventListener('edit-saved-plan', handleEditSavedPlan as EventListener)
  window.removeEventListener('map-ready', handleMapReady)
})

const removePlace = (index: number) => {
  if (isReadOnly.value) return

  routePlaces.value.splice(index, 1)
  routePlaces.value.forEach(p => {
    p.distanceFromPrevious = 0.0
    p.transitFareFromPrevious = 0
    p.taxiFareFromPrevious = 0
  })
  totalDistance.value = 0
  saveToStorage()
  dispatchRouteChanged()
}

const clearAll = () => {
  if (isEditMode.value) {
    if (confirm('계획 수정을 취소하시겠습니까? 변경사항은 저장되지 않습니다.')) {
      resetPlannerDraft()
    }
    return
  }

  if (isViewMode.value) {
    resetPlannerDraft()
    return
  }

  if (confirm('모든 경로를 초기화하시겠습니까?')) {
    resetPlannerDraft()
  }
}

const addAsNewPlan = async () => {
  if (!isEditMode.value) return
  if (!planTitle.value.trim()) {
    alert('여행 계획 이름을 입력해주세요.')
    return
  }
  if (routePlaces.value.length === 0) {
    alert('저장할 장소가 없습니다.')
    return
  }

  isSaving.value = true
  try {
    await api.post('/plans', {
      title: planTitle.value,
      placesJson: JSON.stringify(routePlaces.value),
      totalDistance: totalDistance.value,
      transitFare: totalTransitFare.value,
      taxiFare: totalTaxiFare.value
    })

    alert(`'${planTitle.value}' 계획이 새로 추가되었습니다.`)
    window.dispatchEvent(new CustomEvent('plan-saved'))
    resetPlannerDraft()
  } catch (e) {
    console.error('Failed to add plan as new:', e)
    alert('새로운 계획 추가 중 오류가 발생했습니다.')
  } finally {
    isSaving.value = false
  }
}

const moveUp = (index: number) => {
  if (isReadOnly.value) return
  if (index === 0) return
  const temp = routePlaces.value[index]
  routePlaces.value[index] = routePlaces.value[index - 1]
  routePlaces.value[index - 1] = temp
  routePlaces.value.forEach(p => {
    p.distanceFromPrevious = 0.0
    p.transitFareFromPrevious = 0
    p.taxiFareFromPrevious = 0
  })
  totalDistance.value = 0
  saveToStorage()
  dispatchRouteChanged()
}

const moveDown = (index: number) => {
  if (isReadOnly.value) return
  if (index === routePlaces.value.length - 1) return
  const temp = routePlaces.value[index]
  routePlaces.value[index] = routePlaces.value[index + 1]
  routePlaces.value[index + 1] = temp
  routePlaces.value.forEach(p => {
    p.distanceFromPrevious = 0.0
    p.transitFareFromPrevious = 0
    p.taxiFareFromPrevious = 0
  })
  totalDistance.value = 0
  saveToStorage()
  dispatchRouteChanged()
}

const optimizeRoute = async () => {
  if (isReadOnly.value) {
    alert('조회 모드에서는 동선을 최적화할 수 없습니다.')
    return
  }

  if (routePlaces.value.length < 2) {
    alert('최적 동선을 계산하려면 최소 2개 이상의 장소를 추가해주세요.')
    return
  }

  isOptimizing.value = true
  try {
    const payload = routePlaces.value.map(p => ({
      title: p.title,
      lat: p.lat,
      lng: p.lng,
      addr1: p.addr1,
      firstimage: p.firstimage
    }))

    const res = await api.post('/route/optimize', payload)
    routePlaces.value = res.data.route
    totalDistance.value = res.data.totalDistance
    saveToStorage()
    dispatchRouteChanged()
  } catch (e) {
    console.error('Failed to optimize route:', e)
    alert('동선 최적화 중 오류가 발생했습니다.')
  } finally {
    isOptimizing.value = false
  }
}
</script>

<template>
  <div class="planner-container">
    <div class="planner-body">
      <div id="tour-planner-btn" class="route-panel-heading">
        <div class="route-panel-kicker">TODAY'S ROUTE</div>
        <div class="plan-title-wrapper">
          <input
            v-model="planTitle"
            class="plan-title-input"
            :placeholder="isEditMode || isViewMode ? '저장된 여행 계획 이름' : '제목'"
            :disabled="isSaving || isViewMode"
          >
        </div>
        <div class="route-panel-stats">
          <span class="route-panel-stat">{{ routePlaces.length }} 장소</span>
          <span class="route-panel-stat">{{ totalDistance > 0 ? `${totalDistance} km` : '0 km' }}</span>
          <span v-if="travelMode === 'driving'" class="route-panel-stat">택시 {{ totalTaxiFare > 0 ? `${totalTaxiFare.toLocaleString()}원` : '-' }}</span>
          <span v-else-if="travelMode === 'transit'" class="route-panel-stat">교통 {{ totalTransitFare.toLocaleString() }}원</span>
          <span v-else class="route-panel-stat">도보</span>
        </div>
      </div>

      <div v-if="routePlaces.length === 0" class="planner-empty">
        <div class="empty-icon">＋</div>
        <p class="empty-main">추가된 장소가 없습니다.</p>
        <p class="empty-sub">지도 팝업이나 즐겨찾기 목록에서<br><strong>경로에 추가</strong>를 눌러보세요.</p>
      </div>
      
      <div v-else class="planner-content">
        <div class="planner-mode-banner" :class="{ editing: isEditMode, viewing: isViewMode }">
          <button 
            v-if="isEditMode || isViewMode"
            type="button"
            class="planner-back-btn"
            :title="isEditMode ? '수정 취소' : '조회 종료'"
            :aria-label="isEditMode ? '수정 취소' : '조회 종료'"
            @click="clearAll"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" class="planner-back-icon">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div>
            <span class="planner-mode-label">{{ plannerModeLabel }}</span>
            <p>{{ plannerModeDescription }}</p>
          </div>
        </div>

        <!-- Plan title input -->
        <div v-if="isLoggedIn" class="plan-title-wrapper">
          <input
            v-model="planTitle"
            class="plan-title-input"
            :placeholder="isEditMode || isViewMode ? '저장된 여행 계획 이름' : '새 여행 계획 이름 입력...'"
            :disabled="isSaving || isViewMode"
          >
        </div>

        <!-- Travel mode selector -->
        <div class="mode-select-row">
          <span class="mode-label">이동 수단</span>
          <div class="mode-tab-group">
            <button 
              type="button" 
              class="mode-tab-btn" 
              :class="{ active: travelMode === 'driving' }"
              :disabled="isReadOnly"
              @click="setTravelMode('driving')"
            >
              자동차
            </button>
            <button 
              type="button" 
              class="mode-tab-btn" 
              :class="{ active: travelMode === 'transit' }"
              :disabled="isReadOnly"
              @click="setTravelMode('transit')"
            >
              대중교통
            </button>
            <button 
              type="button" 
              class="mode-tab-btn" 
              :class="{ active: travelMode === 'walking' }"
              :disabled="isReadOnly"
              @click="setTravelMode('walking')"
            >
              도보
            </button>
          </div>
        </div>

        <!-- Cost summary -->
        <div v-if="travelMode === 'transit' || travelMode === 'driving'" class="tab-cost-summary">
          <div v-if="travelMode === 'transit'" class="summary-item transit inline-cost">
            <span class="summary-label">총 대중교통 비용</span>
            <span class="summary-value" v-if="totalTransitFare > 0">{{ totalTransitFare.toLocaleString() }}원</span>
            <span class="summary-value" v-else>0원<small style="font-weight:normal; font-size:0.85em; color:var(--text-muted);">(도보 이동)</small></span>
          </div>
          <div v-else-if="travelMode === 'driving'" class="summary-item taxi inline-cost">
            <span class="summary-label">총 예상 택시비</span>
            <span class="summary-value">{{ totalTaxiFare > 0 ? `${totalTaxiFare.toLocaleString()}원` : '-' }}</span>
          </div>
        </div>

        <!-- Route timeline -->
        <div class="route-timeline">
          <div v-for="(place, idx) in routePlaces" :key="place.title" class="timeline-step">
            <!-- Distance and fare between places -->
            <div v-if="idx > 0 && place.distanceFromPrevious !== undefined && place.distanceFromPrevious > 0" class="timeline-connector">
              <div class="connector-line"></div>
              <div class="connector-info">
                <span class="dist-badge">
                  {{ travelMode === 'driving' ? '자동차' : (travelMode === 'transit' ? '대중교통' : '도보') }} +{{ place.distanceFromPrevious }} km
                </span>
                <div v-if="travelMode === 'transit' && place.transitFareFromPrevious !== undefined" class="fare-badges">
                  <span v-if="place.transitFareFromPrevious > 0" class="fare-badge transit">대중교통 {{ place.transitFareFromPrevious.toLocaleString() }}원</span>
                  <span v-else-if="place.transitFareFromPrevious === 0" class="fare-badge transit none">도보 이동</span>
                </div>
                <div v-else-if="travelMode === 'driving' && place.taxiFareFromPrevious !== undefined && place.taxiFareFromPrevious > 0" class="fare-badges">
                  <span class="fare-badge taxi">택시 {{ place.taxiFareFromPrevious.toLocaleString() }}원</span>
                </div>
              </div>
            </div>
            
            <!-- 寃쎈줈 移대뱶 -->
            <div class="route-item-card">
              <!-- Sequence number -->
              <div class="route-badge-num">{{ idx + 1 }}</div>
              
              <!-- Place thumbnail -->
              <img 
                v-if="place.firstimage" 
                :src="place.firstimage" 
                class="route-thumb" 
                alt="장소 이미지"
              >
              <div v-else class="route-thumb no-img">
                이미지
              </div>
              
              <!-- Place detail -->
              <div class="route-info">
                <h6 class="place-name">{{ place.title }}</h6>
                <span class="place-addr">{{ place.addr1 }}</span>
              </div>
              
              <!-- Reorder and delete controls -->
              <div v-if="!isReadOnly" class="route-controls">
                <button 
                  class="control-btn" 
                  :disabled="idx === 0"
                  @click="moveUp(idx)"
                  title="위로 이동"
                >
                  ↑
                </button>
                <button 
                  class="control-btn" 
                  :disabled="idx === routePlaces.length - 1"
                  @click="moveDown(idx)"
                  title="아래로 이동"
                >
                  ↓
                </button>
                <button 
                  class="control-btn-delete" 
                  @click="removePlace(idx)"
                  title="삭제"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Summary and actions -->
        <div class="planner-footer">
          <div class="summary-grid single">
            <div class="summary-item dist">
              <span class="summary-label">총 이동 거리</span>
              <span class="summary-value">{{ totalDistance > 0 ? `${totalDistance} km` : '-' }}</span>
            </div>
          </div>
          
          <div class="action-buttons">
            <button 
              v-if="!isEditMode && !isViewMode" 
              class="btn-clear-all"
              :disabled="routePlaces.length === 0"
              @click="clearAll"
            >
              {{ clearButtonLabel }}
            </button>
            <button 
              v-if="!isReadOnly"
              class="btn-optimize"
              :disabled="routePlaces.length < 2 || isOptimizing"
              @click="optimizeRoute"
            >
              <span v-if="isOptimizing" class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
              <span>동선 최적화</span>
            </button>
            <button 
              v-if="isLoggedIn && isEditMode"
              class="btn-add-as-new"
              :disabled="routePlaces.length === 0 || isSaving"
              @click="addAsNewPlan"
            >
              <span v-if="isSaving" class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
              <span>새로운 계획으로 추가</span>
            </button>
            <button
              v-if="!isViewMode"
              class="btn-save-plan"
              :disabled="isLoggedIn && (!planTitle.trim() || routePlaces.length === 0 || isSaving)"
              @click="savePlan()"
            >
              <span v-if="isSaving" class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
              <span>{{ isEditMode ? '수정 완료' : '보관함에 저장' }}</span>
            </button>
          </div>
        </div>
        
        <div class="notice-tip">
          * 목록의 <strong>첫 번째 장소</strong>가 출발지로 고정되고, 나머지 목적지를 효율적인 동선으로 정렬합니다.
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.planner-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.planner-body {
  padding: 16px;
  overflow-y: auto;
  flex: 1;
}

.planner-empty {
  text-align: center;
  padding: 48px 16px;
  color: var(--text-muted);
}

.empty-icon {
  font-size: 2.5rem;
  margin-bottom: 12px;
}

.empty-main {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 6px;
}

.empty-sub {
  font-size: 0.8rem;
  line-height: 1.6;
}

.planner-mode-banner {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  background: #f8fafc;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 14px;
}

.planner-mode-banner.editing {
  background: #eef2ff;
  border-color: #c7d2fe;
}

.planner-mode-banner.viewing {
  background: #f8fafc;
  border-color: #cbd5e1;
}

.planner-back-btn {
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  border: 1.5px solid #c7d2fe;
  border-radius: 8px;
  background: white;
  color: var(--primary-dark);
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.planner-back-btn:hover {
  background: #e0e7ff;
  border-color: var(--primary-light);
}

.planner-back-icon {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.planner-mode-label {
  display: inline-flex;
  align-items: center;
  color: var(--primary-dark);
  font-size: 0.82rem;
  font-weight: 800;
  margin-bottom: 4px;
}

.planner-mode-banner p {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.76rem;
  line-height: 1.45;
}

.plan-title-wrapper {
  margin-bottom: 16px;
}

.plan-title-input {
  width: 100%;
  border: 1.5px solid var(--border);
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 0.88rem;
  font-weight: 600;
  outline: none;
  background: white;
  transition: all 0.2s;
}

.plan-title-input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
}

.plan-title-input:disabled {
  background: #f8fafc;
  color: var(--text-muted);
  cursor: not-allowed;
}

.mode-select-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  background: #f8fafc;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--border);
}

.mode-label {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text-muted);
}

.mode-tab-group {
  display: flex;
  background: #e2e8f0;
  padding: 2px;
  border-radius: 8px;
}

.mode-tab-btn {
  background: transparent;
  border: none;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text-muted);
  padding: 6px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.mode-tab-btn.active {
  background: white;
  color: var(--primary-dark);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
}

.mode-tab-btn:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.route-timeline {
  display: flex;
  flex-direction: column;
  margin-bottom: 20px;
}

.timeline-step {
  position: relative;
}

.timeline-connector {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  margin: 6px 0;
  padding-left: 25px;
}

.connector-line {
  position: absolute;
  left: 25px;
  top: -12px;
  bottom: -12px;
  width: 2px;
  background: repeating-linear-gradient(to bottom, var(--primary-light), var(--primary-light) 4px, transparent 4px, transparent 8px);
  z-index: 1;
}

.connector-info {
  display: flex;
  align-items: center;
  gap: 6px;
  z-index: 2;
  margin-left: 10px;
}

.dist-badge {
  background: #f8fafc;
  border: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 0.72rem;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 6px;
}

.fare-badges {
  display: flex;
  gap: 4px;
}

.fare-badge {
  font-size: 0.68rem;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 6px;
}

.fare-badge.transit {
  background: #ecfdf5;
  color: #10b981;
  border: 1px solid #a7f3d0;
}

.fare-badge.transit.none {
  background: #f3f4f6;
  color: #6b7280;
  border: 1px solid #e5e7eb;
}

.fare-badge.taxi {
  background: #fffbeb;
  color: #d97706;
  border: 1px solid #fde68a;
}

.route-item-card {
  background: white;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px 14px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  z-index: 5;
}

.route-item-card:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow);
  border-color: var(--primary-light);
}

.route-badge-num {
  background: var(--primary-gradient);
  color: white;
  font-size: 0.72rem;
  font-weight: 800;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(99, 102, 241, 0.3);
  flex-shrink: 0;
}

.route-thumb {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  object-fit: cover;
  flex-shrink: 0;
}

.route-thumb.no-img {
  background: #f1f5f9;
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  font-size: 0.85rem;
}

.route-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
}

.place-name {
  font-size: 0.85rem;
  font-weight: 750;
  color: var(--text);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.place-addr {
  font-size: 0.74rem;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.route-controls {
  display: flex;
  align-items: center;
  gap: 2px;
}

.control-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 0.65rem;
  padding: 4px;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.15s;
}

.control-btn:hover:not(:disabled) {
  background: #f1f5f9;
  color: var(--text);
}

.control-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.control-btn-delete {
  background: transparent;
  border: none;
  color: #fca5a5;
  font-size: 0.82rem;
  padding: 4px 6px;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.15s;
  font-weight: bold;
}

.control-btn-delete:hover {
  background: #fef2f2;
  color: #ef4444;
}

.planner-footer {
  border-top: 1px solid var(--border);
  padding-top: 16px;
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.summary-grid.single {
  grid-template-columns: 1fr;
}

.tab-cost-summary {
  margin-bottom: 16px;
  margin-top: 16px;
}

.inline-cost {
  flex-direction: row;
  justify-content: space-between;
  padding: 12px 16px;
}

.inline-cost .summary-label {
  margin-bottom: 0;
  font-size: 0.95rem;
}

.inline-cost .summary-value {
  font-size: 1.1rem;
}

.summary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  background: #f8fafc;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 8px;
  text-align: center;
}

.summary-item.dist {
  background: #eef2ff;
  border-color: #c7d2fe;
}
.summary-item.dist .summary-label, .summary-item.dist .summary-value {
  color: var(--primary-dark);
}

.summary-item.transit {
  background: #ecfdf5;
  border-color: #a7f3d0;
}
.summary-item.transit .summary-label, .summary-item.transit .summary-value {
  color: #065f46;
}

.summary-item.taxi {
  background: #fffbeb;
  border-color: #fde68a;
}
.summary-item.taxi .summary-label, .summary-item.taxi .summary-value {
  color: #92400e;
}

.summary-label {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--text-muted);
}

.summary-value {
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--text);
}

.action-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.btn-clear-all {
  flex: 0 0 112px;
  background: white;
  border: 1.5px solid var(--border);
  color: var(--text-muted);
  font-size: 0.82rem;
  font-weight: 600;
  padding: 9px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-clear-all:hover {
  background: #fef2f2;
  border-color: #fca5a5;
  color: #ef4444;
}

.btn-optimize {
  flex: 0 0 132px;
  background: var(--primary-gradient);
  border: none;
  color: white;
  font-size: 0.82rem;
  font-weight: 750;
  padding: 10px 16px;
  border-radius: 8px;
  cursor: pointer;
  box-shadow: 0 4px 10px rgba(99, 102, 241, 0.15);
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-optimize:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 14px rgba(99, 102, 241, 0.25);
}

.btn-optimize:disabled {
  background: #e2e8f0;
  box-shadow: none;
  color: #94a3b8;
  cursor: not-allowed;
}

.btn-save-plan,
.btn-add-as-new {
  flex: 0 0 132px;
  background: linear-gradient(135deg, #10b981, #059669);
  border: none;
  color: white;
  font-size: 0.82rem;
  font-weight: 750;
  padding: 10px 16px;
  border-radius: 8px;
  cursor: pointer;
  box-shadow: 0 4px 10px rgba(16, 185, 129, 0.15);
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
}

.btn-save-plan:hover:not(:disabled),
.btn-add-as-new:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 14px rgba(16, 185, 129, 0.25);
}

.btn-save-plan:disabled,
.btn-add-as-new:disabled {
  background: #e2e8f0;
  box-shadow: none;
  color: #94a3b8;
  cursor: not-allowed;
}

.btn-add-as-new {
  flex-basis: 172px;
  background: white;
  border: 1.5px solid #86efac;
  color: #047857;
  box-shadow: none;
}

.btn-add-as-new:hover:not(:disabled) {
  background: #ecfdf5;
  box-shadow: none;
}

.notice-tip {
  font-size: 0.72rem;
  color: var(--text-muted);
  line-height: 1.5;
  margin-top: 10px;
}

@media (max-width: 576px) {
  .action-buttons {
    width: 100%;
  }
  
  .btn-clear-all {
    text-align: center;
  }
}

.planner-body {
  padding: 6px;
}

.planner-mode-banner,
.mode-select-row,
.route-item-card,
.summary-item,
.plan-title-input,
.btn-clear-all,
.btn-optimize,
.btn-save-plan,
.btn-add-as-new,
.planner-back-btn {
  border-radius: 2px;
}

.planner-mode-banner,
.mode-select-row,
.summary-item {
  background: #f7f2e8;
}

.planner-mode-banner.editing,
.summary-item.dist {
  background: #f7eadf;
  border-color: #ead0c2;
}

.planner-mode-banner.viewing {
  background: #eee8dc;
  border-color: #d8d1c4;
}

.planner-mode-label,
.mode-label {
  color: var(--terracotta-dark);
  font-family: 'IBM Plex Mono', monospace;
}

.planner-back-btn,
.plan-title-input,
.route-item-card,
.btn-clear-all,
.btn-add-as-new {
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: none;
}

.planner-back-btn:hover,
.btn-add-as-new:hover:not(:disabled) {
  background: #f7f2e8;
  border-color: var(--terracotta);
}

.plan-title-input:focus {
  border-color: var(--terracotta);
  box-shadow: 0 0 0 3px rgba(184, 92, 56, 0.12);
}

.mode-tab-group {
  background: #eae4d8;
  border-radius: 999px;
}

.mode-tab-btn {
  border-radius: 999px;
}

.mode-tab-btn.active {
  background: var(--text);
  color: var(--surface);
}

.route-item-card:hover {
  border-color: var(--terracotta);
  box-shadow: 0 8px 18px rgba(33, 29, 24, 0.10);
}

.route-badge-num,
.btn-save-plan {
  background: var(--terracotta);
  box-shadow: none;
}

.route-thumb {
  border-radius: 1px;
}

.route-thumb.no-img {
  background: repeating-linear-gradient(135deg, #ded6c6 0 8px, #d6cdb9 8px 16px);
}

.place-name {
  font-family: 'Gowun Batang', serif;
  font-weight: 700;
}

.btn-optimize {
  background: var(--text);
  border: 1px solid var(--text);
  box-shadow: none;
}

.btn-optimize:hover:not(:disabled),
.btn-save-plan:hover:not(:disabled) {
  background: var(--terracotta-dark);
  border-color: var(--terracotta-dark);
  box-shadow: none;
}

.btn-add-as-new {
  color: var(--text);
}
</style>
