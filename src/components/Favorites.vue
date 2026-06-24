<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import api from '../api'

declare global {
  interface Window {
    __removeFav: (id: number) => void
    __addFavMarker: (fav: { id?: number; placeName: string; placeAddress?: string; lat: number; lng: number }) => void
    __moveTo: (lat: number, lng: number, id?: number) => void
  }
}

interface Favorite {
  id: number
  placeName: string
  placeAddress?: string
  lat?: number
  lng?: number
  createdAt: string
}

interface PlaceResult {
  place_name: string
  address_name: string
  road_address_name: string
  x: string
  y: string
}

const props = defineProps<{ isLoggedIn: boolean }>()

const favorites = ref<Favorite[]>([])
const isAdding = ref(false)
const searchKeyword = ref('')
const searchResults = ref<PlaceResult[]>([])
let searchTimer: ReturnType<typeof setTimeout> | null = null


const fetchFavorites = async () => {
  try {
    const res = await api.get('/favorites')
    favorites.value = res.data
  } catch {}
}

watch(() => props.isLoggedIn, (val) => {
  if (val) fetchFavorites()
  else favorites.value = []
}, { immediate: true })

onMounted(() => window.addEventListener('fav-changed', fetchFavorites))
onUnmounted(() => window.removeEventListener('fav-changed', fetchFavorites))

const onKeywordInput = () => {
  if (searchTimer) clearTimeout(searchTimer)
  if (!searchKeyword.value.trim()) { searchResults.value = []; return }
  searchTimer = setTimeout(() => {
    if (!window.kakao?.maps?.services) return
    const ps = new window.kakao.maps.services.Places()
    ps.keywordSearch(searchKeyword.value, (result: PlaceResult[], status: string) => {
      searchResults.value = status === window.kakao.maps.services.Status.OK
        ? result.slice(0, 5)
        : []
    })
  }, 300)
}

const selectPlace = async (place: PlaceResult) => {
  try {
    const res = await api.post(
      '/favorites',
      {
        placeName: place.place_name,
        placeAddress: place.road_address_name || place.address_name,
        lat: parseFloat(place.y),
        lng: parseFloat(place.x),
      }
    )
    searchKeyword.value = ''
    searchResults.value = []
    isAdding.value = false
    if (window.__addFavMarker) {
      window.__addFavMarker({
        id: res.data.id,
        placeName: place.place_name,
        placeAddress: place.road_address_name || place.address_name,
        lat: parseFloat(place.y),
        lng: parseFloat(place.x),
      })
    }
    window.dispatchEvent(new CustomEvent('fav-changed'))
  } catch (e: any) {
    alert(e.response?.data?.message || '추가 실패')
  }
}

const handleDelete = async (id: number) => {
  if (!confirm('즐겨찾기를 삭제할까요?')) return
  if (window.__removeFav) {
    await window.__removeFav(id)
  } else {
    try {
      await api.delete(`/favorites/${id}`)
      favorites.value = favorites.value.filter(f => f.id !== id)
    } catch {}
  }
}

const moveToMap = (fav: Favorite) => {
  if (fav.lat && fav.lng && window.__moveTo) {
    window.__moveTo(fav.lat, fav.lng, fav.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

const addToRoute = (fav: Favorite) => {
  if (!fav.lat || !fav.lng) return
  window.dispatchEvent(new CustomEvent('add-to-route', {
    detail: {
      title: fav.placeName,
      lat: fav.lat,
      lng: fav.lng,
      addr1: fav.placeAddress || '',
      firstimage: ''
    }
  }))
}
</script>

<template>
  <div v-if="isLoggedIn" class="favorites-container">
    <div class="fav-body">
      <!-- 검색 추가 폼 -->
      <div v-if="isAdding" class="fav-form-wrapper">
        <div class="fav-search-container">
          <input
            class="fav-search-input"
            placeholder="추가할 장소를 검색하세요"
            v-model="searchKeyword"
            @input="onKeywordInput"
            autocomplete="off"
          />
          <ul v-if="searchResults.length > 0" class="fav-search-dropdown">
            <li
              v-for="(place, idx) in searchResults"
              :key="idx"
              class="fav-search-item"
              @click="selectPlace(place)">
              <span class="fav-search-name">{{ place.place_name }}</span>
              <span class="fav-search-addr">{{ place.road_address_name || place.address_name }}</span>
            </li>
          </ul>
        </div>
        <button class="btn-cancel" @click="isAdding = false; searchKeyword = ''; searchResults = []">취소</button>
      </div>
      <button v-else class="fav-add-btn" @click="isAdding = true">+ 즐겨찾기 추가</button>

      <!-- 목록 -->
      <div v-if="favorites.length === 0" class="fav-empty">
        <div class="empty-icon">⭐</div>
        <div>아직 즐겨찾기한 관광지가 없습니다.</div>
        <div class="empty-sub">지도의 별표나 검색을 통해 추가해보세요!</div>
      </div>
      <ul v-else class="fav-list">
        <li v-for="fav in favorites" :key="fav.id" class="fav-item-card">
          <div class="fav-item-info" @click="moveToMap(fav)">
            <span class="fav-place-name">
              {{ fav.placeName }}
            </span>
            <span v-if="fav.placeAddress" class="fav-place-addr">📍 {{ fav.placeAddress }}</span>
          </div>
          <div class="fav-item-actions">
            <button
              v-if="fav.lat && fav.lng"
              class="btn-route-add"
              @click="addToRoute(fav)">
              📍 추가
            </button>
            <button class="fav-delete-btn" @click="handleDelete(fav.id)" aria-label="삭제">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </button>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.favorites-container {
  margin-bottom: 24px;
}

.fav-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.fav-add-btn {
  background: #eef2ff;
  border: 1.5px dashed var(--primary-light);
  color: var(--primary-dark);
  font-size: 0.85rem;
  font-weight: 700;
  padding: 12px;
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  text-align: center;
  width: 100%;
}

.fav-add-btn:hover {
  background: #e0e7ff;
  border-color: var(--primary);
  transform: translateY(-1px);
}

.fav-form-wrapper {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.fav-search-container {
  flex: 1;
  position: relative;
}

.fav-search-input {
  width: 100%;
  border: 1.5px solid var(--border);
  border-radius: 12px;
  padding: 10px 14px;
  font-size: 0.88rem;
  outline: none;
  background: white;
  transition: all 0.2s;
}

.fav-search-input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
}

.fav-search-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  background: white;
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: var(--shadow-lg);
  z-index: 100;
  padding: 6px 0;
  list-style: none;
  margin: 0;
  max-height: 220px;
  overflow-y: auto;
}

.fav-search-item {
  padding: 10px 14px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 2px;
  transition: background 0.15s;
}

.fav-search-item:hover {
  background: #f8fafc;
}

.fav-search-name {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text);
}

.fav-search-addr {
  font-size: 0.74rem;
  color: var(--text-muted);
}

.btn-cancel {
  background: white;
  border: 1.5px solid var(--border);
  color: var(--text-muted);
  font-size: 0.82rem;
  font-weight: 600;
  padding: 10px 14px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel:hover {
  background: #f8fafc;
  color: var(--text);
  border-color: #cbd5e1;
}

.fav-empty {
  text-align: center;
  padding: 36px 16px;
  border: 1.5px dashed var(--border);
  border-radius: 16px;
  color: var(--text-muted);
  font-size: 0.85rem;
  line-height: 1.6;
  background: rgba(255, 255, 255, 0.2);
}

.empty-icon {
  font-size: 1.8rem;
  margin-bottom: 8px;
}

.empty-sub {
  font-size: 0.76rem;
  margin-top: 4px;
  opacity: 0.8;
}

.fav-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0;
  margin: 0;
  list-style: none;
}

.fav-item-card {
  background: white;
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 12px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.01);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.fav-item-card:hover {
  transform: translateY(-1.5px);
  box-shadow: var(--shadow);
  border-color: var(--primary-light);
}

.fav-item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  cursor: pointer;
}

.fav-place-name {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--text);
  line-height: 1.4;
  transition: color 0.15s;
}

.fav-item-card:hover .fav-place-name {
  color: var(--primary-dark);
}

.fav-place-addr {
  font-size: 0.74rem;
  color: var(--text-muted);
  word-break: break-all;
}

.fav-item-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-route-add {
  background: #ecfdf5;
  color: #10b981;
  border: 1px solid #a7f3d0;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 6px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-route-add:hover {
  background: #d1fae5;
  border-color: #34d399;
  transform: translateY(-1px);
}

.fav-delete-btn {
  background: #fef2f2;
  border: 1px solid #fca5a5;
  color: #ef4444;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.fav-delete-btn:hover {
  background: #fee2e2;
  border-color: #f87171;
  transform: scale(1.03);
}

@media (max-width: 576px) {
  .fav-item-card {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }
  
  .fav-item-actions {
    justify-content: flex-end;
    width: 100%;
  }
}

.fav-body {
  padding: 4px;
}

.fav-add-btn,
.fav-search-input,
.fav-search-dropdown,
.btn-cancel,
.fav-empty,
.fav-item-card,
.btn-route-add,
.fav-delete-btn {
  border-radius: 2px;
}

.fav-add-btn {
  background: #f7f2e8;
  border: 1px dashed var(--border);
  color: var(--terracotta-dark);
}

.fav-add-btn:hover {
  background: #f7eadf;
  border-color: var(--terracotta);
}

.fav-search-input,
.fav-search-dropdown,
.btn-cancel,
.fav-item-card {
  background: var(--surface);
  border-color: var(--border);
  box-shadow: none;
}

.fav-search-input:focus {
  border-color: var(--terracotta);
  box-shadow: 0 0 0 3px rgba(184, 92, 56, 0.12);
}

.fav-empty {
  background: #f7f2e8;
  border: 1px dashed var(--border);
}

.fav-item-card:hover {
  border-color: var(--terracotta);
  box-shadow: 0 8px 18px rgba(33, 29, 24, 0.10);
}

.fav-place-name {
  font-family: 'Gowun Batang', serif;
  font-weight: 700;
}

.fav-item-card:hover .fav-place-name {
  color: var(--terracotta-dark);
}

.btn-route-add {
  background: #f7eadf;
  border-color: #ead0c2;
  color: var(--terracotta-dark);
}
</style>
