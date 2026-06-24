<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'

const steps = [
  { id: 'tour-chat-btn', title: '💬 AI 채팅', desc: '여행지, 코스, 일정을 AI에게 자유롭게 물어보세요. 채팅 응답에서 바로 루트에 장소를 추가할 수도 있어요.' },
  { id: 'tour-map-search', title: '🔍 관광지 검색', desc: '시도·시군구·관광타입을 선택하고 조회하면 지도에 마커가 표시됩니다.' },
  { id: 'tour-location-search', title: '📍 이 위치에서 검색', desc: '지도를 원하는 곳으로 이동한 뒤 이 버튼을 누르면 현재 화면 안의 관광지를 검색해줘요.' },
  { id: 'tour-planner-btn', title: '🗺️ 경로 플래너', desc: '마음에 드는 장소를 추가해 여행 동선을 짜고 최적 루트로 정렬할 수 있어요.' },
  { id: 'tour-plans-btn', title: '📅 내 보관함', desc: '완성한 여행 계획을 저장하면 내 보관함에서 다시 불러볼 수 있어요. 즐겨찾기 장소도 여기서 관리할 수 있습니다.' },
  { id: 'tour-board-btn', title: '📝 게시판', desc: '다른 여행자들의 후기와 팁을 확인하고, 나만의 여행 이야기를 공유해보세요.' },
]

const emit = defineEmits<{ done: [] }>()

const current = ref(0)
const spotlightStyle = ref<Record<string, string>>({})
const tooltipStyle = ref<Record<string, string>>({})
const above = ref(false)

const TOOLTIP_W = 300
const PAD = 10

const updatePosition = async () => {
  await nextTick()
  const el = document.getElementById(steps[current.value].id)
  if (!el) {
    // Element missing: hide the dark overlay, center the tooltip so user can still navigate
    spotlightStyle.value = { display: 'none' }
    tooltipStyle.value = {
      top: `${Math.round(window.innerHeight / 2 - 100)}px`,
      left: `${Math.max(12, Math.round(window.innerWidth / 2 - TOOLTIP_W / 2))}px`,
    }
    return
  }

  const r = el.getBoundingClientRect()

  spotlightStyle.value = {
    top: `${r.top - PAD}px`,
    left: `${r.left - PAD}px`,
    width: `${r.width + PAD * 2}px`,
    height: `${r.height + PAD * 2}px`,
  }

  const spaceBelow = window.innerHeight - r.bottom
  above.value = spaceBelow < 180 && r.top > 180

  const tooltipTop = above.value
    ? Math.max(12, r.top - PAD - 220)
    : r.bottom + PAD + 12

  let tooltipLeft = r.left + r.width / 2 - TOOLTIP_W / 2
  tooltipLeft = Math.max(12, Math.min(tooltipLeft, window.innerWidth - TOOLTIP_W - 12))

  tooltipStyle.value = {
    top: `${tooltipTop}px`,
    left: `${tooltipLeft}px`,
  }
}

watch(current, updatePosition)
onMounted(() => {
  setTimeout(updatePosition, 400)
  window.addEventListener('resize', updatePosition)
})
onUnmounted(() => window.removeEventListener('resize', updatePosition))

const next = () => {
  if (current.value < steps.length - 1) current.value++
  else emit('done')
}
const prev = () => { if (current.value > 0) current.value-- }
const skip = () => emit('done')
</script>

<template>
  <Teleport to="body">
    <!-- 스포트라이트 -->
    <div class="tour-spotlight" :style="spotlightStyle" />

    <!-- 툴팁 -->
    <div class="tour-tooltip" :style="tooltipStyle">
      <div v-if="!above" class="tour-arrow tour-arrow-top" />
      <div class="tour-body">
        <div class="tour-progress">{{ current + 1 }} / {{ steps.length }}</div>
        <div class="tour-title">{{ steps[current].title }}</div>
        <div class="tour-desc">{{ steps[current].desc }}</div>
        <div class="tour-actions">
          <button v-if="current > 0" class="tour-btn-secondary" @click="prev">이전</button>
          <button class="tour-btn-skip" @click="skip">건너뛰기</button>
          <button class="tour-btn-primary" @click="next">
            {{ current === steps.length - 1 ? '완료 🎉' : '다음' }}
          </button>
        </div>
      </div>
      <div v-if="above" class="tour-arrow tour-arrow-bottom" />
    </div>
  </Teleport>
</template>

<style scoped>
.tour-spotlight {
  position: fixed;
  border-radius: 8px;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.65);
  z-index: 9998;
  pointer-events: none;
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.tour-tooltip {
  position: fixed;
  width: 300px;
  z-index: 9999;
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.tour-arrow {
  width: 0;
  height: 0;
  margin: 0 auto;
  border-left: 10px solid transparent;
  border-right: 10px solid transparent;
}
.tour-arrow-top {
  border-bottom: 10px solid white;
  margin-bottom: -1px;
}
.tour-arrow-bottom {
  border-top: 10px solid white;
  margin-top: -1px;
}

.tour-body {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.tour-progress {
  font-size: 0.75rem;
  color: #6c757d;
  margin-bottom: 8px;
  font-weight: 600;
}

.tour-title {
  font-size: 1rem;
  font-weight: 700;
  color: #1a1a2e;
  margin-bottom: 8px;
}

.tour-desc {
  font-size: 0.875rem;
  color: #495057;
  line-height: 1.5;
  margin-bottom: 16px;
}

.tour-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  align-items: center;
}

.tour-btn-primary {
  background: #0d6efd;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 7px 16px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
}
.tour-btn-primary:hover { background: #0b5ed7; }

.tour-btn-secondary {
  background: #e9ecef;
  color: #495057;
  border: none;
  border-radius: 8px;
  padding: 7px 12px;
  font-size: 0.875rem;
  cursor: pointer;
}
.tour-btn-secondary:hover { background: #dee2e6; }

.tour-btn-skip {
  background: none;
  border: none;
  color: #6c757d;
  font-size: 0.8rem;
  cursor: pointer;
  margin-right: auto;
  padding: 0;
}
.tour-btn-skip:hover { color: #343a40; }
</style>
