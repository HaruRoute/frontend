<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import axios from 'axios'
import api from '../api'

declare global {
  interface Window {
    kakao: any
    __addFav: (idx: number) => void
    __removeFav: (id: number) => void
    __moveTo: (lat: number, lng: number, id?: number) => void
  }
}

interface Area {
  code: string
  name: string
}

const props = defineProps<{
  isLoggedIn: boolean
}>()

const mapRef = ref<HTMLDivElement | null>(null)

// Kakao objects are kept outside Vue reactivity.
let kakaoMap: any = null
let clusterer: any = null
let markers: any[] = []
let markerPool: any[] = []
let kakaoPlacesCache: any[] = []
let favMarkers: any[] = []
let favMarkersById = new Map<number, any>()
let sharedInfoWindow: any = null
let spotCache: Array<{ spot: any; marker: any; favId?: number }> = []
let userFavorites: any[] = []

const STAR_IMG = () => new window.kakao.maps.MarkerImage(
  'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png',
  new window.kakao.maps.Size(24, 35)
)

const DEFAULT_IMG = () => new window.kakao.maps.MarkerImage(
  'https://t1.daumcdn.net/mapjsapi/images/2x/marker.png',
  new window.kakao.maps.Size(24, 35)
)

// Build marker popup content.
const buildSpotContent = (spot: any, idx: number, favId?: number) => {
  const imageHtml = spot.firstimage
    ? `<img src="${spot.firstimage}" alt="${spot.title}" class="popup-img">`
    : `<div class="popup-no-img">이미지 없음</div>`

  const btn = favId
    ? `<button onclick="window.__removeFavFromSearch(${favId},${idx})" class="popup-btn btn-danger">즐겨찾기 취소</button>`
    : `<button onclick="window.__addFav(${idx})" class="popup-btn btn-primary-custom">즐겨찾기 추가</button>`

  const routeBtn = `<button onclick="window.__addToRouteFromSearch(${idx})" class="popup-btn btn-success-custom">경로에 추가</button>`

  return `
    <div class="map-info-popup">
      ${imageHtml}
      <div class="popup-title">${spot.title}</div>
      <div class="popup-addr">주소 ${spot.addr1 || ''}</div>
      <div class="popup-btn-group">
        ${btn}
        ${routeBtn}
      </div>
    </div>`
}

const buildKakaoPlaceContent = (place: any, idx: number) => {
  const routeBtn = `<button onclick="window.__addToRouteFromKakao(${idx})" class="popup-btn btn-success-custom">경로에 추가</button>`
  return `
    <div class="map-info-popup">
      <div class="popup-no-img">이미지 없음</div>
      <div class="popup-title">${place.place_name}</div>
      <div class="popup-addr">주소 ${place.road_address_name || place.address_name || ''}</div>
      <div class="popup-btn-group">${routeBtn}</div>
    </div>`
}

;(window as any).__addToRouteFromKakao = (idx: number) => {
  const place = kakaoPlacesCache[idx]
  if (!place) return
  window.dispatchEvent(new CustomEvent('add-to-route', {
    detail: {
      title: place.place_name,
      lat: parseFloat(place.y),
      lng: parseFloat(place.x),
      addr1: place.road_address_name || place.address_name || '',
      firstimage: ''
    }
  }))
}

const areas = ref<Area[]>([])
const sigungus = ref<Area[]>([])
const selectedArea = ref('')
const selectedSigungu = ref('')
const selectedType = ref('')
const spotKeyword = ref('')
const isLoading = ref(false)

const CACHE_TTL = 5 * 60 * 1000
const CACHE_MAX = 30

type CacheEntry<T> = { data: T; ts: number }
const spotSearchCache = new Map<string, CacheEntry<any[]>>()
const sigunguCache = new Map<string, CacheEntry<Area[]>>()

function getCached<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > CACHE_TTL) { cache.delete(key); return null }
  return entry.data
}

function setCached<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!)
  cache.set(key, { data, ts: Date.now() })
}

let searchAbortController: AbortController | null = null

const SERVICE_KEY = import.meta.env.VITE_SERVICE_KEY

const addFavMarker = (fav: { id?: number; placeName: string; placeAddress?: string; memo?: string; lat: number; lng: number }) => {
  if (!kakaoMap) return
  const coords = new window.kakao.maps.LatLng(fav.lat, fav.lng)
  const marker = new window.kakao.maps.Marker({ map: kakaoMap, position: coords, image: STAR_IMG() })
  favMarkers.push(marker)
  if (fav.id) favMarkersById.set(fav.id, marker)

  const routeBtn = fav.id ? `<button onclick="window.__addToRouteFromFav(${fav.id})" class="popup-btn btn-success-custom">경로에 추가</button>` : ''

  const content = `
    <div class="map-fav-popup">
      <div class="popup-title">★ ${fav.placeName}</div>
      ${fav.placeAddress ? `<div class="popup-addr">주소 ${fav.placeAddress}</div>` : ''}
      ${fav.memo ? `<div class="popup-memo">메모 ${fav.memo}</div>` : ''}
      <div class="popup-btn-group">
        ${fav.id ? `<button onclick="window.__removeFav(${fav.id})" class="popup-btn btn-danger">즐겨찾기 취소</button>` : ''}
        ${routeBtn}
      </div>
    </div>`

  window.kakao.maps.event.addListener(marker, 'click', () => {
    sharedInfoWindow.setContent(content)
    sharedInfoWindow.open(kakaoMap, marker)
  })
}

window.__addFav = async (idx: number) => {
  if (!props.isLoggedIn) { alert('로그인 후 이용해주세요.'); return }
  const item = spotCache[idx]
  if (!item) return
  try {
    const res = await api.post(
      '/favorites',
      { placeName: item.spot.title, placeAddress: item.spot.addr1 || '', lat: parseFloat(item.spot.mapy), lng: parseFloat(item.spot.mapx) }
    )
    item.favId = res.data.id
    if (item.marker.customData) {
      item.marker.customData.favId = item.favId
    }
    item.marker.setImage(STAR_IMG())
    const newContent = buildSpotContent(item.spot, idx, item.favId)
    sharedInfoWindow.setContent(newContent)
    sharedInfoWindow.open(kakaoMap, item.marker)
    
    userFavorites.push({
      id: res.data.id,
      placeName: item.spot.title,
      placeAddress: item.spot.addr1 || '',
      lat: parseFloat(item.spot.mapy),
      lng: parseFloat(item.spot.mapx)
    })

    window.dispatchEvent(new CustomEvent('fav-changed'))
  } catch (e: any) {
    alert(e.response?.data?.message || '즐겨찾기 추가에 실패했습니다.')
  }
}

;(window as any).__removeFavFromSearch = async (favId: number, idx: number) => {
  try {
    await api.delete(`/favorites/${favId}`)
    const item = spotCache[idx]
    if (item) {
      item.favId = undefined
      if (item.marker.customData) {
        item.marker.customData.favId = undefined
      }
      item.marker.setImage(DEFAULT_IMG())
      const newContent = buildSpotContent(item.spot, idx)
      sharedInfoWindow.setContent(newContent)
      sharedInfoWindow.open(kakaoMap, item.marker)
    }
    
    userFavorites = userFavorites.filter(f => f.id !== favId)

    window.dispatchEvent(new CustomEvent('fav-changed'))
  } catch (e: any) {
    alert(e.response?.data?.message || '즐겨찾기 취소에 실패했습니다.')
  }
}

window.__removeFav = async (id: number) => {
  try {
    await api.delete(`/favorites/${id}`)
    const favMarker = favMarkersById.get(id)
    if (favMarker) {
      favMarker.setMap(null)
      favMarkers = favMarkers.filter(m => m !== favMarker)
      favMarkersById.delete(id)
    }
    const item = spotCache.find(i => i.favId === id)
    if (item) {
      item.favId = undefined
      if (item.marker.customData) {
        item.marker.customData.favId = undefined
      }
      item.marker.setImage(DEFAULT_IMG())
      sharedInfoWindow.setContent(buildSpotContent(item.spot, spotCache.indexOf(item)))
    }
    sharedInfoWindow.close()
    
    userFavorites = userFavorites.filter(f => f.id !== id)

    window.dispatchEvent(new CustomEvent('fav-changed'))
  } catch (e: any) {
    alert(e.response?.data?.message || '즐겨찾기 취소에 실패했습니다.')
  }
}

window.__addFavMarker = (fav: { id?: number; placeName: string; placeAddress?: string; lat: number; lng: number }) => {
  addFavMarker(fav)
}

window.__moveTo = (lat: number, lng: number, id?: number) => {
  if (!kakaoMap) return
  const coords = new window.kakao.maps.LatLng(lat, lng)
  kakaoMap.setCenter(coords)
  kakaoMap.setLevel(3)
  if (id) {
    const marker = favMarkersById.get(id)
    if (marker) {
      window.kakao.maps.event.trigger(marker, 'click')
    }
  }
}

const loadFavorites = async () => {
  if (!props.isLoggedIn || !kakaoMap) {
    favMarkers.forEach(m => m.setMap(null))
    favMarkers = []
    favMarkersById.clear()
    userFavorites = []
    spotCache.forEach(item => {
      item.favId = undefined
      item.marker.setImage(DEFAULT_IMG())
    })
    return
  }

  try {
    const res = await api.get('/favorites')
    userFavorites = res.data

    favMarkers.forEach(m => m.setMap(null))
    favMarkers = []
    favMarkersById.clear()

    const spotCacheCoords = new Set<string>()
    const spotCacheTitles = new Set<string>()
    spotCache.forEach(item => {
      spotCacheTitles.add(item.spot.title)
      if (item.spot.mapx && item.spot.mapy) {
        const y = parseFloat(item.spot.mapy)
        const x = parseFloat(item.spot.mapx)
        spotCacheCoords.add(`${y.toFixed(4)}_${x.toFixed(4)}`)
      }
    })

    userFavorites.forEach((fav: any) => {
      if (!fav.lat || !fav.lng) return
      const key = `${parseFloat(fav.lat).toFixed(4)}_${parseFloat(fav.lng).toFixed(4)}`
      // Avoid duplicate favorite markers when the same place is already in search results.
      if (spotCacheTitles.has(fav.placeName) || spotCacheCoords.has(key)) {
        return
      }
      addFavMarker(fav)
    })

    // Build lookup maps for fast favorite matching.
    const favByName = new Map<string, any>()
    const favByCoords = new Map<string, any>()

    userFavorites.forEach(fav => {
      if (fav.placeName) {
        favByName.set(fav.placeName, fav)
      }
      if (fav.lat && fav.lng) {
        const key = `${parseFloat(fav.lat).toFixed(4)}_${parseFloat(fav.lng).toFixed(4)}`
        favByCoords.set(key, fav)
      }
    })

    spotCache.forEach((item) => {
      const y = parseFloat(item.spot.mapy)
      const x = parseFloat(item.spot.mapx)
      const coordKey = `${y.toFixed(4)}_${x.toFixed(4)}`
      
      const matchedFav = favByName.get(item.spot.title) || favByCoords.get(coordKey)

      if (matchedFav) {
        item.favId = matchedFav.id
        item.marker.setImage(STAR_IMG())
      } else {
        item.favId = undefined
        item.marker.setImage(DEFAULT_IMG())
      }
      if (item.marker.customData) {
        item.marker.customData.favId = item.favId
      }
    })
  } catch (e) {
    console.error('Failed to load favorites:', e)
  }
}


// Optimized route drawing and overlay management.
const routeLine = ref<any>(null)
const routeMarkers = ref<any[]>([])

const clearRouteDrawings = () => {
  if (routeLine.value) {
    routeLine.value.setMap(null)
    routeLine.value = null
  }
  routeMarkers.value.forEach(overlay => overlay.setMap(null))
  routeMarkers.value = []
}

const drawRouteLine = async (places: any[]) => {
  if (!kakaoMap) return
  clearRouteDrawings()

  if (places.length === 0) return

  if (places.length >= 2) {
    try {
      const coordString = places.map(p => `${p.lng},${p.lat}`).join(';')
      const travelMode = localStorage.getItem('travel_mode') || 'driving'
      const url = travelMode === 'walking'
        ? `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${coordString}?overview=full&geometries=geojson`
        : `https://routing.openstreetmap.de/routed-car/route/v1/driving/${coordString}?overview=full&geometries=geojson`
      const res = await axios.get(url)
      
      if (res.data?.routes?.[0]) {
        const route = res.data.routes[0]
        const coords = route.geometry.coordinates
        const linePath = coords.map((c: any) => new window.kakao.maps.LatLng(c[1], c[0]))
        
        routeLine.value = new window.kakao.maps.Polyline({
          path: linePath,
          strokeWeight: 5,
          strokeColor: '#b85c38',
          strokeOpacity: 0.8,
          strokeStyle: 'solid'
        })
        routeLine.value.setMap(kakaoMap)

        const totalDriveDist = Math.round((route.distance / 1000.0) * 100) / 100
        const updatedPlaces = places.map(p => ({ ...p }))
        updatedPlaces[0].distanceFromPrevious = 0.0
        
        if (route.legs) {
          route.legs.forEach((leg: any, idx: number) => {
            if (updatedPlaces[idx + 1]) {
              updatedPlaces[idx + 1].distanceFromPrevious = Math.round((leg.distance / 1000.0) * 100) / 100
            }
          })
        }

        let totalTransitFare = 0;
        let totalTaxiFare = 0;
        try {
          const payload = { coords: places.map(p => ({ lng: p.lng, lat: p.lat })) }
          const fareRes = await api.post('/route/transit-fares', payload)
          if (fareRes.data && fareRes.data.segments) {
            const segments = fareRes.data.segments;
            segments.forEach((seg: any, idx: number) => {
              if (updatedPlaces[idx + 1]) {
                updatedPlaces[idx + 1].transitFareFromPrevious = seg.transitFare || 0;
                updatedPlaces[idx + 1].taxiFareFromPrevious = seg.taxiFare || 0;
                totalTransitFare += seg.transitFare || 0;
                totalTaxiFare += seg.taxiFare || 0;
              }
            });
          }
        } catch (fareErr) {
          console.warn('Failed to fetch transit fares', fareErr);
        }

        console.log('[Map.vue] Dispatched Fares -> Transit:', totalTransitFare, 'Taxi:', totalTaxiFare);
        window.dispatchEvent(new CustomEvent('road-distances-updated', {
          detail: {
            places: updatedPlaces,
            totalDistance: totalDriveDist,
            totalTransitFare: totalTransitFare,
            totalTaxiFare: totalTaxiFare
          }
        }))
      } else {
        throw new Error('No route found')
      }
    } catch (e) {
      console.warn('OSRM road routing failed, falling back to straight lines:', e)
      const linePath = places.map(p => new window.kakao.maps.LatLng(p.lat, p.lng))
      routeLine.value = new window.kakao.maps.Polyline({
        path: linePath,
        strokeWeight: 5,
        strokeColor: '#b85c38',
        strokeOpacity: 0.8,
        strokeStyle: 'solid'
      })
      routeLine.value.setMap(kakaoMap)
    }
  }

  places.forEach((p, idx) => {
    const content = `
      <div class="route-map-marker ${idx === places.length - 1 ? 'is-last' : ''}">
        <div class="route-map-dot">${idx + 1}</div>
      </div>
    `
    const overlay = new window.kakao.maps.CustomOverlay({
      position: new window.kakao.maps.LatLng(p.lat, p.lng),
      content: content,
      xAnchor: 0.5,
      yAnchor: 0.5
    })
    overlay.setMap(kakaoMap)
    routeMarkers.value.push(overlay)
  })

}

const handleRouteChanged = (e: any) => {
  const { places } = e.detail
  drawRouteLine(places)
}

// Add a place from map popup to the route.
;(window as any).__addToRouteFromSearch = (idx: number) => {
  const item = spotCache[idx]
  if (!item) return
  window.dispatchEvent(new CustomEvent('add-to-route', {
    detail: {
      title: item.spot.title,
      lat: parseFloat(item.spot.mapy),
      lng: parseFloat(item.spot.mapx),
      addr1: item.spot.addr1 || '',
      firstimage: item.spot.firstimage || ''
    }
  }))
}

;(window as any).__addToRouteFromFav = (favId: number) => {
  const fav = userFavorites.find(f => f.id === favId)
  if (!fav) return
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
const handleRelayout = () => {
  if (kakaoMap) {
    kakaoMap.relayout()
  }
}

onUnmounted(() => {
  clearRouteDrawings()
  if (searchAbortController) searchAbortController.abort()
  delete (window as any).__mapReady
  delete (window as any).__addFav
  delete (window as any).__removeFav
  delete (window as any).__removeFavFromSearch
  delete (window as any).__addFavMarker
  delete (window as any).__moveTo
  delete (window as any).__addToRouteFromSearch
  delete (window as any).__addToRouteFromFav
  delete (window as any).__addToRouteFromKakao
  window.removeEventListener('fav-changed', loadFavorites)
  window.removeEventListener('route-changed', handleRouteChanged as EventListener)
  window.removeEventListener('map-relayout', handleRelayout)
})

onMounted(async () => {
  window.addEventListener('route-changed', handleRouteChanged as EventListener)
  window.addEventListener('map-relayout', handleRelayout)
  if (window.kakao?.maps && mapRef.value && !kakaoMap) {
    kakaoMap = new window.kakao.maps.Map(mapRef.value, {
      center: new window.kakao.maps.LatLng(37.566826, 126.9786567),
      level: 5,
    })
    
    clusterer = new window.kakao.maps.MarkerClusterer({
      map: kakaoMap,
      averageCenter: true,
      minLevel: 6,
      disableClickZoom: false
    })

    sharedInfoWindow = new window.kakao.maps.InfoWindow({ removable: false })

    // Close the popup when clicking an empty map area.
    window.kakao.maps.event.addListener(kakaoMap, 'click', () => {
      sharedInfoWindow.close()
    })

    ;(window as any).__mapReady = true
    window.dispatchEvent(new CustomEvent('map-ready'))
  }

  loadFavorites()
  window.addEventListener('fav-changed', loadFavorites)

  try {
    const res = await axios.get('https://apis.data.go.kr/B551011/KorService2/areaCode2', {
      params: { serviceKey: SERVICE_KEY, numOfRows: 120, pageNo: 1, MobileOS: 'ETC', MobileApp: 'Test', _type: 'json' },
    })
    const items = res.data?.response?.body?.items?.item || []
    areas.value = items.map((item: any) => ({ code: item.code, name: item.name }))
  } catch (e) {
    console.error('Failed to fetch areas:', e)
  }
})

// Refresh favorite markers when login state changes.
watch(() => props.isLoggedIn, () => {
  loadFavorites()
})

// Load sigungu list when area changes.
watch(selectedArea, async (val) => {
  if (!val) {
    sigungus.value = []
    selectedSigungu.value = ''
    return
  }

  const cached = getCached(sigunguCache, val)
  if (cached) {
    sigungus.value = cached
    selectedSigungu.value = ''
    return
  }

  try {
    const res = await axios.get('https://apis.data.go.kr/B551011/KorService2/areaCode2', {
      params: { serviceKey: SERVICE_KEY, numOfRows: 120, pageNo: 1, MobileOS: 'ETC', MobileApp: 'Test', areaCode: val, _type: 'json' },
    })
    const items = res.data?.response?.body?.items?.item || []
    const newSigungus = items.map((item: any) => ({ code: item.code, name: item.name }))

    sigungus.value = newSigungus
    setCached(sigunguCache, val, newSigungus)
    selectedSigungu.value = ''
  } catch (e) {
    console.error('Failed to fetch sigungus:', e)
  }
})

const updateMapWithKakaoPlaces = (places: any[]) => {
  if (!kakaoMap) return

  sharedInfoWindow.close()
  if (clusterer) clusterer.clear()

  markers.forEach(m => {
    m.setMap(null)
    markerPool.push(m)
  })
  markers = []
  spotCache = []
  kakaoPlacesCache = places

  const bounds = new window.kakao.maps.LatLngBounds()
  let currentIndex = 0
  const CHUNK_SIZE = 200

  const processChunk = () => {
    if (!kakaoMap) return
    const end = Math.min(currentIndex + CHUNK_SIZE, places.length)
    const chunkMarkers: any[] = []

    for (let i = currentIndex; i < end; i++) {
      const place = places[i]
      const x = parseFloat(place.x)
      const y = parseFloat(place.y)
      if (!x || !y) continue

      const coords = new window.kakao.maps.LatLng(y, x)
      bounds.extend(coords)

      let marker: any
      if (markerPool.length > 0) {
        marker = markerPool.pop()
        marker.setPosition(coords)
        marker.setImage(DEFAULT_IMG())
      } else {
        marker = new window.kakao.maps.Marker({ position: coords, image: DEFAULT_IMG() })
        window.kakao.maps.event.addListener(marker, 'click', () => {
          if (!marker.customData) return
          if (marker.customData.mode === 'kakao') {
            const { kakaoIdx } = marker.customData
            sharedInfoWindow.setContent(buildKakaoPlaceContent(kakaoPlacesCache[kakaoIdx], kakaoIdx))
          } else {
            const { spot: cSpot, idx: cIdx, favId: cFavId } = marker.customData
            sharedInfoWindow.setContent(buildSpotContent(cSpot, cIdx, cFavId))
          }
          sharedInfoWindow.open(kakaoMap, marker)
        })
      }

      marker.customData = { mode: 'kakao', kakaoIdx: i }
      chunkMarkers.push(marker)
      markers.push(marker)
    }

    if (clusterer && chunkMarkers.length > 0) clusterer.addMarkers(chunkMarkers)
    currentIndex = end

    if (currentIndex < places.length) {
      requestAnimationFrame(processChunk)
    } else {
      if (places.length > 0) kakaoMap.setBounds(bounds)
    }
  }

  requestAnimationFrame(processChunk)
}

const searchByKeyword = (keyword: string) => {
  if (!kakaoMap || !window.kakao?.maps?.services) {
    alert('카카오맵 검색 서비스를 사용할 수 없습니다.')
    return
  }

  isLoading.value = true
  const ps = new window.kakao.maps.services.Places()
  ps.keywordSearch(keyword, (data: any[], status: any) => {
    isLoading.value = false
    if (status === window.kakao.maps.services.Status.OK) {
      updateMapWithKakaoPlaces(data)
    } else if (status === window.kakao.maps.services.Status.ZERO_RESULT) {
      alert(`'${keyword}'에 대한 검색 결과가 없습니다.`)
    } else {
      alert('카카오맵 검색 중 오류가 발생했습니다.')
    }
  })
}

const searchSpots = async () => {
  // 관광지명만 입력된 경우 → 카카오 키워드 검색
  if (spotKeyword.value.trim() && !selectedType.value) {
    searchByKeyword(spotKeyword.value.trim())
    return
  }

  if (!selectedType.value) {
    alert('관광 타입을 선택하거나 관광지명을 입력해주세요.')
    return
  }

  const cacheKey = `${selectedArea.value || ''}-${selectedSigungu.value || ''}-${selectedType.value || ''}`
  const cached = getCached(spotSearchCache, cacheKey)
  if (cached) {
    updateMap(cached)
    return
  }

  isLoading.value = true

  try {
    const res = await api.get('/spots', {
      params: {
        areaCode: selectedArea.value || undefined,
        sigunguCode: selectedSigungu.value || undefined,
        contentTypeId: selectedType.value || undefined
      },
    })
    const items = res.data || []
    setCached(spotSearchCache, cacheKey, items)
    updateMap(items)
  } catch (e) {
    console.error('Failed to search spots:', e)
  } finally {
    isLoading.value = false
  }
}

const searchSpotsAtCurrentLocation = async () => {
  if (!kakaoMap) return

  if (searchAbortController) searchAbortController.abort()
  searchAbortController = new AbortController()

  isLoading.value = true
  try {
    const bounds = kakaoMap.getBounds()
    const sw = bounds.getSouthWest()
    const ne = bounds.getNorthEast()
    const res = await api.get('/spots', {
      params: {
        contentTypeId: selectedType.value || undefined,
        minX: sw.getLng(),
        maxX: ne.getLng(),
        minY: sw.getLat(),
        maxY: ne.getLat(),
        limit: 200
      },
      signal: searchAbortController.signal
    })
    updateMap(res.data || [], false)
  } catch (e: any) {
    if (e.code === 'ERR_CANCELED') return
    console.error('Failed to search spots at current location:', e)
  } finally {
    isLoading.value = false
  }
}

const updateMap = (spots: any[], autoBounds = true) => {
  if (!kakaoMap) return

  // Close existing popup and clear clusters.
  sharedInfoWindow.close()
  if (clusterer) {
    clusterer.clear()
  }
  
  // Reuse removed markers through a marker pool.
  markers.forEach(m => {
    m.setMap(null)
    markerPool.push(m)
  })
  markers = []
  spotCache = []

  const bounds = new window.kakao.maps.LatLngBounds()
  let validCount = 0

  // Build lookup maps for fast favorite matching.
  const favByName = new Map<string, any>()
  const favByCoords = new Map<string, any>()
  userFavorites.forEach(fav => {
    if (fav.placeName) {
      favByName.set(fav.placeName, fav)
    }
    if (fav.lat && fav.lng) {
      const key = `${parseFloat(fav.lat).toFixed(4)}_${parseFloat(fav.lng).toFixed(4)}`
      favByCoords.set(key, fav)
    }
  })

  // Render markers in chunks to keep the browser responsive.
  const CHUNK_SIZE = 500
  let currentIndex = 0

  const processChunk = () => {
    if (!kakaoMap) return
    const end = Math.min(currentIndex + CHUNK_SIZE, spots.length)
    const chunkMarkers: any[] = []

    for (let i = currentIndex; i < end; i++) {
      const spot = spots[i]
      if (!spot.mapx || !spot.mapy) continue
      const x = parseFloat(spot.mapx)
      const y = parseFloat(spot.mapy)
      if (!(124.5 <= x && x <= 132 && 33.0 <= y && y <= 38.6)) continue

      validCount++
      const coords = new window.kakao.maps.LatLng(y, x)
      bounds.extend(coords)

      const coordKey = `${y.toFixed(4)}_${x.toFixed(4)}`
      const matchedFav = favByName.get(spot.title) || favByCoords.get(coordKey)

      const favId = matchedFav ? matchedFav.id : undefined
      const markerImage = favId ? STAR_IMG() : DEFAULT_IMG()

      let marker: any;
      if (markerPool.length > 0) {
        marker = markerPool.pop()
        marker.setPosition(coords)
        marker.setImage(markerImage)
      } else {
        marker = new window.kakao.maps.Marker({ position: coords, image: markerImage })
        // Single handler supporting both API spots and Kakao Places results.
        window.kakao.maps.event.addListener(marker, 'click', () => {
          if (!marker.customData) return
          if (marker.customData.mode === 'kakao') {
            const { kakaoIdx } = marker.customData
            sharedInfoWindow.setContent(buildKakaoPlaceContent(kakaoPlacesCache[kakaoIdx], kakaoIdx))
          } else {
            const { spot: cSpot, idx: cIdx, favId: cFavId } = marker.customData
            sharedInfoWindow.setContent(buildSpotContent(cSpot, cIdx, cFavId))
          }
          sharedInfoWindow.open(kakaoMap, marker)
        })
      }

      const idx = spotCache.length
      // Keep latest spot data on the marker.
      marker.customData = { mode: 'api', spot, idx, favId }

      chunkMarkers.push(marker)
      markers.push(marker)

      spotCache.push({ spot, marker, favId })
    }

    if (clusterer && chunkMarkers.length > 0) {
      clusterer.addMarkers(chunkMarkers)
    }

    currentIndex = end

    if (currentIndex < spots.length) {
      // Process the next chunk on the next frame.
      requestAnimationFrame(processChunk)
    } else {
      // All markers rendered.
      if (validCount > 0 && autoBounds) kakaoMap.setBounds(bounds)
    }
  }

  // Start marker rendering.
  requestAnimationFrame(processChunk)
}
</script>

<template>
  <div class="map-stage">
    <div id="tour-map-search" class="search-panel-card">
      <div class="search-panel-body">
        <div class="search-grid">
          <div class="search-col">
            <select class="search-select" v-model="selectedArea" :disabled="isLoading">
              <option value="">시도 전체</option>
              <option v-for="a in areas" :key="a.code" :value="a.code">{{ a.name }}</option>
            </select>
          </div>
          <div class="search-col">
            <select class="search-select" v-model="selectedSigungu" :disabled="!selectedArea || isLoading">
              <option value="">시군구 전체</option>
              <option v-for="s in sigungus" :key="s.code" :value="s.code">{{ s.name }}</option>
            </select>
          </div>
          <div class="search-col">
            <select class="search-select" v-model="selectedType" :disabled="isLoading">
              <option value="" disabled>관광 타입 선택</option>
              <option value="12">관광지</option>
              <option value="14">문화시설</option>
              <option value="15">축제/공연/행사</option>
              <option value="25">여행코스</option>
              <option value="28">레포츠</option>
              <option value="32">숙박</option>
              <option value="38">쇼핑</option>
              <option value="39">음식점</option>
            </select>
          </div>
          <div class="search-col search-col-keyword">
            <input
              class="search-keyword-input"
              type="text"
              v-model="spotKeyword"
              placeholder="관광지명 검색"
              :disabled="isLoading"
              @keydown.enter="searchSpots"
            />
          </div>
          <div class="search-col-btn">
            <button class="btn-search-trigger" @click="searchSpots" :disabled="isLoading">
              <span v-if="isLoading" class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
              <span v-else>⌕</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="map-card-wrapper position-relative">
    <div class="map-container-body p-0">
      <div id="map" ref="mapRef" class="map-canvas"></div>
      
      <!-- Search inside the current map bounds. -->
      <div class="position-absolute" style="top: 16px; right: 16px; z-index: 15;">
        <button
          id="tour-location-search"
          class="btn-location-search d-flex align-items-center gap-2 px-3 py-2"
          @click="searchSpotsAtCurrentLocation"
          :disabled="isLoading"
        >
          <span v-if="isLoading" class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
          <span v-else>⌖</span>
          <span>현재 위치에서 검색</span>
        </button>
      </div>

      <!-- Loading overlay -->
      <div
        v-if="isLoading"
        class="map-loading-overlay d-flex justify-content-center align-items-center"
      >
        <div class="spinner-border" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
      </div>
    </div>
  </div>
  </div>
</template>

<style scoped>
.map-stage {
  position: relative;
  width: 100%;
  height: calc(100vh - 68px);
  overflow: hidden;
}

.map-card-wrapper {
  width: 100%;
  height: 100%;
  background:
    linear-gradient(rgba(224, 217, 203, 0.42) 1px, transparent 1px),
    linear-gradient(90deg, rgba(224, 217, 203, 0.42) 1px, transparent 1px),
    var(--paper-deep);
  background-size: 34px 34px;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  overflow: hidden;
  padding: 0;
}

.map-container-body {
  height: 100%;
}

.map-canvas {
  width: 100%;
  height: 100%;
  min-height: 100%;
  border: 0;
}

.btn-location-search {
  font-size: 13px;
  font-weight: 700;
  border-radius: 999px;
  background: rgba(252, 251, 247, 0.92);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: var(--text);
  border: 1px solid #e4ded2;
  transition: all 0.2s ease;
  box-shadow: 0 8px 20px rgba(33, 29, 24, 0.12);
  cursor: pointer;
}
.btn-location-search:hover:not(:disabled) {
  background: #fffaf2;
  border-color: var(--primary);
  color: var(--primary-dark);
  transform: translateY(-1px);
  box-shadow: 0 12px 24px rgba(33, 29, 24, 0.14);
}
.btn-location-search:active:not(:disabled) {
  transform: translateY(0);
}

.map-loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 10;
  background-color: rgba(244, 241, 234, 0.78);
  backdrop-filter: blur(3px);
}

.map-loading-overlay .spinner-border {
  width: 3.2rem;
  height: 3.2rem;
  color: var(--primary);
}

.search-panel-card {
  position: absolute;
  top: 30px;
  left: 430px;
  z-index: 35;
  width: min(700px, calc(100vw - 460px));
  background: rgba(252, 251, 247, 0.94);
  border: 1px solid #e4ded2;
  border-radius: 999px;
  box-shadow: 0 10px 22px rgba(33, 29, 24, 0.12);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.search-panel-body {
  padding: 8px 10px 8px 16px;
}

.search-grid {
  display: grid;
  grid-template-columns: minmax(60px, 0.65fr) minmax(72px, 0.65fr) minmax(84px, 0.8fr) minmax(108px, 1.3fr) 34px;
  gap: 6px;
  align-items: center;
}

.search-col {
  min-width: 0;
}

.search-col-keyword {
  min-width: 0;
}

.search-col-btn {
  min-width: 34px;
}

.search-select {
  width: 100%;
  background-color: transparent;
  border: 0;
  border-right: 1px solid #e4ded2;
  border-radius: 0;
  padding: 7px 24px 7px 0;
  font-size: 0.82rem;
  font-weight: 500;
  color: #5c554b;
  outline: none;
  cursor: pointer;
  transition: all 0.2s;
  appearance: none;
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath fill='none' stroke='%2364748b' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='m2 5 6 6 6-6'/%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 8px center;
  background-size: 12px;
}

.search-select:focus {
  box-shadow: none;
}

.search-select:disabled {
  background-color: #eee8dc;
  cursor: not-allowed;
  opacity: 0.6;
}

.search-keyword-input {
  width: 100%;
  background-color: transparent;
  border: 0;
  border-left: 1px solid #e4ded2;
  border-radius: 0;
  padding: 7px 12px 7px 12px;
  font-size: 0.82rem;
  font-weight: 400;
  color: #5c554b;
  outline: none;
  transition: color 0.2s;
}

.search-keyword-input::placeholder {
  color: #b0a898;
}

.search-keyword-input:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.btn-search-trigger {
  width: 34px;
  height: 34px;
  background: #211d18;
  border: 1px solid #211d18;
  color: white;
  font-weight: 700;
  font-size: 0.88rem;
  padding: 0;
  border-radius: 999px;
  cursor: pointer;
  box-shadow: none;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-search-trigger:hover:not(:disabled) {
  transform: translateY(-1px);
  background: #b85c38;
  border-color: #b85c38;
  box-shadow: none;
}

.btn-search-trigger:disabled {
  background: #cbd5e1;
  box-shadow: none;
  color: #94a3b8;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .map-stage {
    height: 52vh;
    min-height: 420px;
  }

  .map-canvas {
    height: 100%;
    min-height: 100%;
  }

  .search-panel-card {
    top: 14px;
    left: 14px;
    right: 14px;
    width: auto;
    border-radius: 2px;
  }
  
  .search-grid {
    grid-template-columns: 1fr;
  }

  .search-col, .search-col-keyword, .search-col-btn {
    width: 100%;
  }

  .search-select {
    border-right: 0;
    border-bottom: 1px solid #e4ded2;
  }

  .search-keyword-input {
    border-left: 0;
    border-bottom: 1px solid #e4ded2;
    padding-left: 0;
  }

  .btn-search-trigger {
    width: 100%;
    border-radius: 2px;
  }
}
</style>

