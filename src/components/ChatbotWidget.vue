<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../api'

interface HistoryItem {
  role: 'user' | 'assistant'
  content: string
}

const route = useRoute()
const router = useRouter()

const QUICK_SUGGESTIONS = [
  { label: '부산 여행 코스', query: '부산 여행 코스 추천해줘' },
  { label: '제주도 자연 명소', query: '제주도 자연 명소 추천해줘' },
  { label: '서울 당일치기', query: '서울 당일치기 코스 알려줘' },
  { label: '가족여행 1박2일', query: '가족여행 1박2일 코스 추천해줘' },
  { label: '야경 명소', query: '야경 명소 추천해줘' },
]

const GREETING = '안녕하세요! AI 여행 도우미입니다 🗺️\n가고 싶은 지역이나 여행 스타일을 알려주세요. 맞춤 관광지를 추천해드리고, 클릭 한 번으로 경로에 바로 추가할 수 있어요.'

const isOpen = ref(false)
const input = ref('')
const isLoading = ref(false)
const history = ref<HistoryItem[]>([{ role: 'assistant', content: GREETING }])
const messagesEl = ref<HTMLElement>()

const toggle = () => {
  isOpen.value = !isOpen.value
}

const scrollToBottom = async () => {
  await nextTick()
  if (messagesEl.value) {
    messagesEl.value.scrollTop = messagesEl.value.scrollHeight
  }
}

// 마크다운 + 장소 칩을 단일 HTML 문자열로 통합 렌더링
const renderContent = (text: string): string => {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  // JS 문자열 리터럴 안에서 사용할 이스케이프
  const escJs = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")

  // 이미 HTML 이스케이프된 문자열에 인라인 서식 적용
  const fmt = (s: string) =>
    s
      .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>')

  // 한 줄(raw)을 처리: 장소 칩을 인라인 버튼으로 치환 후 서식 적용
  const processLine = (raw: string): string => {
    const chipRe = /\[([^\]]+)\]\(add-route:\/\/([^)]+)\)/g
    const parts: string[] = []
    let last = 0
    let m: RegExpExecArray | null
    while ((m = chipRe.exec(raw)) !== null) {
      if (m.index > last) parts.push(fmt(esc(raw.slice(last, m.index))))
      const label = esc(m[1])
      const jsArg = escJs(m[1])
      parts.push(
        `<button class="cb-place-chip" onclick="window.__cbAddPlace('${jsArg}')">📍 ${label}</button>`
      )
      last = chipRe.lastIndex
    }
    if (last < raw.length) parts.push(fmt(esc(raw.slice(last))))
    return parts.join('')
  }

  const lines = text.split('\n')
  const out: string[] = []
  let inUl = false, inOl = false, inP = false

  const closePara = () => { if (inP) { out.push('</p>'); inP = false } }
  const closeList = () => {
    if (inUl) { out.push('</ul>'); inUl = false }
    if (inOl) { out.push('</ol>'); inOl = false }
  }

  for (const raw of lines) {
    const line = raw.trimEnd()
    if (/^### /.test(line)) {
      closePara(); closeList()
      out.push(`<h3>${processLine(line.slice(4))}</h3>`)
    } else if (/^## /.test(line)) {
      closePara(); closeList()
      out.push(`<h2>${processLine(line.slice(3))}</h2>`)
    } else if (/^# /.test(line)) {
      closePara(); closeList()
      out.push(`<h1>${processLine(line.slice(2))}</h1>`)
    } else if (/^[-*] /.test(line)) {
      closePara()
      if (inOl) { out.push('</ol>'); inOl = false }
      if (!inUl) { out.push('<ul>'); inUl = true }
      out.push(`<li>${processLine(line.slice(2))}</li>`)
    } else if (/^\d+\. /.test(line)) {
      closePara()
      if (inUl) { out.push('</ul>'); inUl = false }
      if (!inOl) { out.push('<ol>'); inOl = true }
      out.push(`<li>${processLine(line.replace(/^\d+\. /, ''))}</li>`)
    } else if (line.trim() === '') {
      closePara(); closeList()
    } else {
      closeList()
      if (inP) out.push('<br>' + processLine(line))
      else { out.push('<p>' + processLine(line)); inP = true }
    }
  }

  closePara(); closeList()
  return out.join('')
}

interface PlaceDetail {
  title: string
  lat: number
  lng: number
  addr1: string
  firstimage: string
}

const dispatchPlace = (detail: PlaceDetail) => {
  if (route.path === '/') {
    window.dispatchEvent(new CustomEvent('add-to-route', { detail }))
  } else {
    localStorage.setItem('pending_add_to_route', JSON.stringify(detail))
    router.push('/')
  }
}

// 카카오 Places API로 검색 (내부 DB 실패 시 fallback)
const searchKakaoPlace = (name: string): Promise<PlaceDetail | null> =>
  new Promise((resolve) => {
    if (!window.kakao?.maps?.services) { resolve(null); return }
    const ps = new window.kakao.maps.services.Places()
    ps.keywordSearch(name, (data: any[], status: any) => {
      if (status === window.kakao.maps.services.Status.OK && data.length > 0) {
        const p = data[0]
        resolve({
          title: p.place_name,
          lat: parseFloat(p.y),
          lng: parseFloat(p.x),
          addr1: p.road_address_name || p.address_name || '',
          firstimage: ''
        })
      } else {
        resolve(null)
      }
    })
  })

const addPlaceToRoute = async (name: string) => {
  try {
    // 1차: 내부 DB 키워드 검색
    const res = await api.get('/spots', { params: { keyword: name, limit: 1 } })
    if (res.data.length) {
      const spot = res.data[0]
      dispatchPlace({
        title: spot.title,
        lat: parseFloat(spot.mapy),
        lng: parseFloat(spot.mapx),
        addr1: spot.addr1 || '',
        firstimage: spot.firstimage || ''
      })
      return
    }

    // 2차: 카카오맵 키워드 검색으로 fallback
    const kakaoResult = await searchKakaoPlace(name)
    if (kakaoResult) {
      dispatchPlace(kakaoResult)
      return
    }

    alert(`'${name}'에 해당하는 장소를 찾을 수 없습니다.`)
  } catch {
    alert('장소 추가 중 오류가 발생했습니다.')
  }
}

const sendMessage = async () => {
  const text = input.value.trim()
  if (!text || isLoading.value) return

  history.value.push({ role: 'user', content: text })
  input.value = ''
  isLoading.value = true
  await scrollToBottom()

  try {
    const res = await api.post('/chatbot/ask', {
      message: text,
      history: history.value.slice(0, -1)
    })
    history.value.push({ role: 'assistant', content: res.data.answer })
  } catch {
    history.value.push({ role: 'assistant', content: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' })
  } finally {
    isLoading.value = false
    await scrollToBottom()
  }
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}

const clearHistory = () => {
  history.value = [{ role: 'assistant', content: GREETING }]
}

// v-html 내 onclick에서 호출할 전역 함수 등록
onMounted(() => { (window as any).__cbAddPlace = (name: string) => addPlaceToRoute(name) })
onUnmounted(() => { delete (window as any).__cbAddPlace })
</script>

<template>
  <!-- 챗봇 팝업 -->
  <div v-if="isOpen" class="cb-popup">
    <div class="cb-header">
      <div class="cb-header-left">
        <span class="cb-header-icon">✦</span>
        <span class="cb-header-title">AI 여행 도우미</span>
      </div>
      <div class="cb-header-right">
        <button class="cb-btn-clear" @click="clearHistory" title="대화 초기화">↺</button>
        <button class="cb-btn-close" @click="toggle">×</button>
      </div>
    </div>

    <div ref="messagesEl" class="cb-messages">
      <!-- 메시지 목록 -->
      <template v-for="(msg, _idx) in history" :key="_idx">
        <div :class="['cb-msg', msg.role === 'user' ? 'cb-msg-user' : 'cb-msg-ai']">
          <div v-if="msg.role === 'assistant'" class="cb-msg-avatar">✦</div>
          <div class="cb-msg-bubble">
            <template v-if="msg.role === 'user'">{{ msg.content }}</template>
            <div v-else class="cb-md" v-html="renderContent(msg.content)"></div>
          </div>
        </div>
      </template>

      <!-- 로딩 -->
      <div v-if="isLoading" class="cb-msg cb-msg-ai">
        <div class="cb-msg-avatar">✦</div>
        <div class="cb-msg-bubble cb-loading">
          <span></span><span></span><span></span>
        </div>
      </div>
    </div>

    <!-- 빠른 질문 버튼 (항상 표시) -->
    <div class="cb-quick-area">
      <div class="cb-quick-list">
        <button
          v-for="s in QUICK_SUGGESTIONS"
          :key="s.label"
          class="cb-quick-btn"
          :disabled="isLoading"
          @click="input = s.query; sendMessage()"
        >{{ s.label }}</button>
      </div>
    </div>

    <div class="cb-input-area">
      <textarea
        v-model="input"
        class="cb-input"
        placeholder="여행지나 코스를 물어보세요..."
        rows="1"
        @keydown="handleKeydown"
      />
      <button class="cb-btn-send" :disabled="!input.trim() || isLoading" @click="sendMessage">
        ↑
      </button>
    </div>
  </div>

  <!-- FAB 버튼 -->
  <button id="tour-chat-btn" class="cb-fab" :class="{ open: isOpen }" @click="toggle" aria-label="AI 여행 도우미">
    <span v-if="!isOpen" class="cb-fab-icon">✦</span>
    <span v-else class="cb-fab-icon">×</span>
  </button>
</template>

<style scoped>
/* ── FAB ─────────────────────────────── */
.cb-fab {
  position: fixed;
  bottom: 28px;
  right: 28px;
  width: 54px;
  height: 54px;
  border-radius: 50%;
  background: #211d18;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(33, 29, 24, 0.32);
  transition: background 0.2s, transform 0.2s, box-shadow 0.2s;
  z-index: 1100;
}
.cb-fab:hover { background: #b85c38; transform: scale(1.08); box-shadow: 0 6px 20px rgba(184, 92, 56, 0.4); }
.cb-fab.open { background: #b85c38; }
.cb-fab-icon { color: #f4f1ea; font-size: 22px; line-height: 1; user-select: none; }

/* ── 팝업 컨테이너 ────────────────────── */
.cb-popup {
  position: fixed;
  bottom: 94px;
  right: 28px;
  width: 360px;
  height: 500px;
  background: #f4f1ea;
  border: 1px solid #d8d1c4;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 40px rgba(33, 29, 24, 0.18);
  z-index: 1099;
  overflow: hidden;
  animation: cbSlideUp 0.22s ease;
}

@keyframes cbSlideUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── 헤더 ──────────────────────────────── */
.cb-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: #211d18;
  flex-shrink: 0;
}
.cb-header-left { display: flex; align-items: center; gap: 8px; }
.cb-header-icon { color: #b85c38; font-size: 14px; }
.cb-header-title {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #f4f1ea;
}
.cb-header-right { display: flex; gap: 4px; }
.cb-btn-clear, .cb-btn-close {
  background: transparent;
  border: none;
  color: #9a9286;
  font-size: 16px;
  cursor: pointer;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 2px;
  transition: color 0.15s, background 0.15s;
}
.cb-btn-clear:hover, .cb-btn-close:hover { color: #f4f1ea; background: rgba(244, 241, 234, 0.12); }

/* ── 메시지 영역 ──────────────────────── */
.cb-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  scrollbar-width: thin;
  scrollbar-color: #d8d1c4 transparent;
}
.cb-messages::-webkit-scrollbar { width: 4px; }
.cb-messages::-webkit-scrollbar-thumb { background: #d8d1c4; border-radius: 2px; }

/* ── 빠른 질문 ─────────────────────────── */
.cb-quick-area {
  padding: 8px 12px 0;
  flex-shrink: 0;
}
.cb-quick-list {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;
  padding-bottom: 6px;
}
.cb-quick-list::-webkit-scrollbar { display: none; }
.cb-quick-btn {
  background: transparent;
  border: 1px solid #d8d1c4;
  border-radius: 999px;
  color: #5c554b;
  font-size: 11.5px;
  padding: 4px 11px;
  white-space: nowrap;
  flex-shrink: 0;
  cursor: pointer;
  transition: all 0.15s;
}
.cb-quick-btn:hover:not(:disabled) { border-color: #b85c38; color: #b85c38; }
.cb-quick-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* ── 메시지 버블 ──────────────────────── */
.cb-msg { display: flex; align-items: flex-start; gap: 8px; }
.cb-msg-user { flex-direction: row-reverse; }

.cb-msg-avatar {
  width: 28px;
  height: 28px;
  background: #211d18;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #b85c38;
  font-size: 12px;
  flex-shrink: 0;
  margin-top: 2px;
}

.cb-msg-bubble {
  max-width: 78%;
  padding: 10px 13px;
  border-radius: 4px;
  font-size: 13.5px;
  line-height: 1.7;
  word-break: break-word;
}
.cb-msg-user .cb-msg-bubble {
  background: #211d18;
  color: #f4f1ea;
  border-radius: 4px 4px 0 4px;
  white-space: pre-wrap;
}
.cb-msg-ai .cb-msg-bubble {
  background: #fff;
  color: #211d18;
  border: 1px solid #e4ded2;
  border-radius: 4px 4px 4px 0;
}

/* ── AI 메시지 마크다운 래퍼 ──────────── */
.cb-md {
  width: 100%;
}

/* ── AI 메시지 마크다운 스타일 ─────────── */
.cb-msg-ai .cb-msg-bubble :deep(h1),
.cb-msg-ai .cb-msg-bubble :deep(h2),
.cb-msg-ai .cb-msg-bubble :deep(h3) {
  font-family: 'Gowun Batang', serif;
  font-weight: 700;
  color: #211d18;
  line-height: 1.35;
  margin: 10px 0 4px;
}
.cb-msg-ai .cb-msg-bubble :deep(h1) { font-size: 1.05em; }
.cb-msg-ai .cb-msg-bubble :deep(h2) { font-size: 1em; border-bottom: 1px solid #e4ded2; padding-bottom: 3px; }
.cb-msg-ai .cb-msg-bubble :deep(h3) { font-size: 0.96em; }
.cb-msg-ai .cb-msg-bubble :deep(p) {
  margin: 0 0 6px;
}
.cb-msg-ai .cb-msg-bubble :deep(p:last-child) { margin-bottom: 0; }
.cb-msg-ai .cb-msg-bubble :deep(ul),
.cb-msg-ai .cb-msg-bubble :deep(ol) {
  margin: 4px 0 6px;
  padding-left: 18px;
}
.cb-msg-ai .cb-msg-bubble :deep(li) { margin: 2px 0; }
.cb-msg-ai .cb-msg-bubble :deep(strong) { font-weight: 700; color: #211d18; }
.cb-msg-ai .cb-msg-bubble :deep(em) { font-style: italic; color: #5c554b; }
.cb-msg-ai .cb-msg-bubble :deep(code) {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.85em;
  background: #f1ece1;
  color: #b85c38;
  padding: 1px 5px;
  border-radius: 3px;
}

/* ── 장소 칩 (v-html 내 인라인 버튼, :deep 필요) ─── */
.cb-msg-bubble :deep(.cb-place-chip) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #b85c38;
  color: #fff;
  border: none;
  border-radius: 3px;
  font-size: 12px;
  font-weight: 600;
  padding: 2px 8px;
  margin: 0 2px;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;
  vertical-align: middle;
  line-height: 1.6;
}
.cb-msg-bubble :deep(.cb-place-chip:hover) { background: #9e4e30; transform: translateY(-1px); }

/* ── 로딩 애니메이션 ────────────────── */
.cb-loading {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 12px 14px !important;
}
.cb-loading span {
  width: 7px;
  height: 7px;
  background: #b85c38;
  border-radius: 50%;
  animation: cbBounce 1.2s infinite ease-in-out;
}
.cb-loading span:nth-child(2) { animation-delay: 0.18s; }
.cb-loading span:nth-child(3) { animation-delay: 0.36s; }
@keyframes cbBounce {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
  30% { transform: translateY(-6px); opacity: 1; }
}

/* ── 입력 영역 ──────────────────────── */
.cb-input-area {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid #e4ded2;
  background: #fff;
  flex-shrink: 0;
}
.cb-input {
  flex: 1;
  border: 1px solid #d8d1c4;
  border-radius: 3px;
  padding: 8px 10px;
  font-size: 13px;
  font-family: inherit;
  resize: none;
  outline: none;
  background: #f4f1ea;
  color: #211d18;
  line-height: 1.5;
  max-height: 96px;
  overflow-y: auto;
  transition: border-color 0.15s;
}
.cb-input::placeholder { color: #9a9286; }
.cb-input:focus { border-color: #b85c38; }
.cb-btn-send {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #211d18;
  border: none;
  color: #f4f1ea;
  font-size: 17px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s;
}
.cb-btn-send:hover:not(:disabled) { background: #b85c38; }
.cb-btn-send:disabled { background: #d8d1c4; cursor: not-allowed; }

/* ── 반응형 ──────────────────────────── */
@media (max-width: 480px) {
  .cb-popup {
    right: 12px;
    bottom: 80px;
    width: calc(100vw - 24px);
    height: 420px;
  }
  .cb-fab { bottom: 20px; right: 16px; }
}
</style>
