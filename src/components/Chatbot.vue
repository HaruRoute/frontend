<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import api from '../api'

interface Message {
  text: string
  isBot: boolean
  source?: string
}

const props = defineProps<{
  isLoggedIn: boolean
  userName?: string
}>()

const emit = defineEmits<{ close: [] }>()

const QUICK_QUESTIONS = [
  '서울 주말 데이트 코스',
  '부산 당일치기 동선',
  '가족여행 1박2일 코스',
  '비오는 날 추천',
  '예산 5만원 코스',
  '야경 명소 추천',
]

const messages = ref<Message[]>([
  { text: '안녕하세요! 여행 플래너 AI입니다 ✈️\n궁금한 여행지나 일정을 물어보세요.', isBot: true },
])
const input = ref('')
const isLoading = ref(false)
const bottomRef = ref<HTMLDivElement | null>(null)

const scrollToBottom = async () => {
  await nextTick()
  bottomRef.value?.scrollIntoView({ behavior: 'smooth' })
}

watch(messages, scrollToBottom, { deep: true })
watch(isLoading, scrollToBottom)

watch(() => props.isLoggedIn, async (val) => {
  if (!val) {
    messages.value = [{ text: '안녕하세요! 여행 플래너 AI입니다 ✈️\n궁금한 여행지나 일정을 물어보세요.', isBot: true }]
    return
  }
  const token = localStorage.getItem('token')
  if (!token) return
  try {
    const res = await api.get('/chat/history')
    const welcome: Message = { text: '안녕하세요! 여행 플래너 AI입니다 ✈️\n궁금한 여행지나 일정을 물어보세요.', isBot: true }
    const history: Message[] = res.data.flatMap((h: any) => [
      { text: h.message, isBot: false },
      { text: h.response, isBot: true },
    ])
    messages.value = [welcome, ...history]
  } catch {}
})

const clearHistory = async () => {
  if (!confirm('채팅 이력을 모두 삭제할까요?')) return
  try {
    await api.delete('/chat/history')
    messages.value = [{ text: '채팅 이력이 초기화되었습니다.', isBot: true }]
  } catch {
    alert('초기화에 실패했습니다.')
  }
}

const sendMessage = async (text: string) => {
  if (!text.trim()) return
  if (!props.isLoggedIn) {
    alert('로그인 후 이용해주세요.')
    return
  }

  messages.value.push({ text, isBot: false })
  input.value = ''
  isLoading.value = true

  try {
    const res = await api.post('/chatbot/ask', { message: text })
    messages.value.push({
      text: res.data.answer || '응답을 받지 못했습니다.',
      isBot: true,
      source: res.data.source,
    })
  } catch {
    messages.value.push({ text: '서버와 통신 중 오류가 발생했습니다.', isBot: true })
  } finally {
    isLoading.value = false
  }
}

const parseMessageText = (text: string) => {
  const regex = /\[([^\]]+)\]\(add-route:\/\/([^\)]+)\)/g
  const segments = []
  let lastIndex = 0
  let match

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: text.slice(lastIndex, match.index)
      })
    }
    segments.push({
      type: 'route-btn',
      title: match[1],
      query: match[2]
    })
    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.slice(lastIndex)
    })
  }

  return segments.length > 0 ? segments : [{ type: 'text', content: text }]
}

const addRouteFromChat = (title: string, query: string) => {
  const kakao = (window as any).kakao
  if (!kakao?.maps?.services) {
    alert('지도 서비스를 불러오는 중입니다. 잠시 후 다시 시도해주세요.')
    return
  }
  const ps = new kakao.maps.services.Places()
  ps.keywordSearch(query, (result: any[], status: string) => {
    if (status === kakao.maps.services.Status.OK && result.length > 0) {
      const place = result[0]
      window.dispatchEvent(new CustomEvent('add-to-route', {
        detail: {
          title: place.place_name,
          lat: parseFloat(place.y),
          lng: parseFloat(place.x),
          addr1: place.road_address_name || place.address_name,
          firstimage: ''
        }
      }))
      alert(`'${place.place_name}'(이)가 경로에 추가되었습니다.`)
    } else {
      if (query !== title) {
        ps.keywordSearch(title, (res: any[], stat: string) => {
          if (stat === kakao.maps.services.Status.OK && res.length > 0) {
            const place = res[0]
            window.dispatchEvent(new CustomEvent('add-to-route', {
              detail: {
                title: place.place_name,
                lat: parseFloat(place.y),
                lng: parseFloat(place.x),
                addr1: place.road_address_name || place.address_name,
                firstimage: ''
              }
            }))
            alert(`'${place.place_name}'(이)가 경로에 추가되었습니다.`)
          } else {
            alert(`'${title}'의 좌표 정보를 찾을 수 없습니다.`)
          }
        })
      } else {
        alert(`'${title}'의 좌표 정보를 찾을 수 없습니다.`)
      }
    }
  })
}
</script>

<template>
  <div class="chat-container">
    <!-- 헤더 -->
    <div class="chat-header">
      <div class="chat-header-title">
        <span class="chat-header-dot" />
        <span>여행 플래너 AI</span>
      </div>
      <div class="chat-header-actions">
        <button
          v-if="isLoggedIn"
          class="btn-reset"
          @click="clearHistory">
          이력 초기화
        </button>
        <button class="btn-close-chat" @click="emit('close')" aria-label="닫기">✕</button>
      </div>
    </div>

    <!-- 바디 -->
    <div class="chat-body">
      <!-- 메시지 창 -->
      <div class="chat-window">
        <div v-for="(msg, idx) in messages" :key="idx" v-memo="[msg.text, msg.source]" class="msg-wrapper">
          <div :class="`msg-row ${msg.isBot ? 'bot' : 'user'}`">
            <div :class="`msg-avatar ${msg.isBot ? 'bot' : 'user'}`">
              {{ msg.isBot ? '🤖' : '👤' }}
            </div>
            <div :class="`msg-bubble ${msg.isBot ? 'bot' : 'user'}`">
              <template v-for="(seg, sIdx) in parseMessageText(msg.text)" :key="sIdx">
                <span v-if="seg.type === 'text'">{{ seg.content }}</span>
                <button
                  v-else-if="seg.type === 'route-btn'"
                  class="route-add-badge"
                  @click="addRouteFromChat(seg.title || '', seg.query || '')"
                >
                  📍 {{ seg.title }} 추가
                </button>
              </template>
            </div>
          </div>
          <div v-if="msg.source" class="msg-source">📌 추천 출처: {{ msg.source }}</div>
        </div>

        <div v-if="isLoading" class="msg-row bot">
          <div class="msg-avatar bot">🤖</div>
          <div class="msg-bubble bot typing-bubble">
            <div class="typing-dots">
              <span /><span /><span />
            </div>
          </div>
        </div>
        <div ref="bottomRef" />
      </div>

      <!-- 빠른 질문 (가로 스크롤 캡슐형) -->
      <div class="quick-questions-container">
        <div class="quick-btns">
          <button
            v-for="(q, idx) in QUICK_QUESTIONS"
            :key="idx"
            class="quick-btn"
            :disabled="isLoading || !isLoggedIn"
            @click="sendMessage(`${q} 추천해줘`)">
            # {{ q }}
          </button>
        </div>
      </div>

      <!-- 입력창 영역 -->
      <div class="chat-input-row">
        <input
          class="chat-input"
          type="text"
          :placeholder="isLoggedIn ? '궁금한 일정을 입력해보세요...' : '로그인 후 이용 가능합니다.'"
          v-model="input"
          :disabled="isLoading || !isLoggedIn"
          @keydown.enter="sendMessage(input)"
        />
        <button
          class="chat-send-btn"
          :disabled="isLoading || !isLoggedIn || !input.trim()"
          @click="sendMessage(input)">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: transparent;
}

.chat-header {
  background: var(--primary-gradient);
  padding: 16px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.chat-header-title {
  font-size: 1.05rem;
  font-weight: 800;
  color: white;
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'Outfit', sans-serif;
  letter-spacing: 0;
}

.chat-header-dot {
  width: 8px;
  height: 8px;
  background: #10b981;
  border-radius: 50%;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.4);
  animation: pulse 2s infinite;
}

.chat-header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.btn-reset {
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.25);
  color: white;
  font-size: 0.76rem;
  font-weight: 600;
  padding: 5px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-reset:hover {
  background: rgba(255, 255, 255, 0.25);
  transform: translateY(-1px);
}

.btn-close-chat {
  background: rgba(255, 255, 255, 0.12);
  border: none;
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.85rem;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.btn-close-chat:hover {
  background: rgba(255, 255, 255, 0.25);
  color: white;
  transform: scale(1.05);
}

.chat-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 16px;
  background: rgba(248, 250, 252, 0.3);
}

.chat-window {
  flex: 1;
  overflow-y: auto;
  padding-right: 4px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 12px;
  /* 스크롤바 커스텀 */
  scrollbar-width: thin;
  scrollbar-color: rgba(99, 102, 241, 0.2) transparent;
}

.chat-window::-webkit-scrollbar {
  width: 4px;
}

.chat-window::-webkit-scrollbar-thumb {
  background: rgba(99, 102, 241, 0.2);
  border-radius: 10px;
}

.msg-wrapper {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.msg-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.msg-row.user {
  flex-direction: row-reverse;
}

.msg-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.95rem;
  flex-shrink: 0;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
}

.msg-avatar.bot {
  background: var(--primary-gradient);
  color: white;
}

.msg-avatar.user {
  background: #f1f5f9;
  border: 1px solid var(--border);
}

.msg-bubble {
  max-width: 75%;
  padding: 12px 16px;
  border-radius: 18px;
  font-size: 0.92rem;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
}

.msg-bubble.bot {
  background: #f5f3ff; /* 연한 라벤더 틴트 */
  color: var(--text);
  border: 1px solid #ddd6fe;
  border-top-left-radius: 4px;
}

.msg-bubble.user {
  background: var(--primary-gradient);
  color: white;
  border-top-right-radius: 4px;
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.15);
}

.route-add-badge {
  background: #10b981;
  color: white;
  border: none;
  font-size: 0.78rem;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 8px;
  cursor: pointer;
  margin: 4px 2px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  box-shadow: 0 2px 6px rgba(16, 185, 129, 0.3);
  transition: all 0.2s;
  vertical-align: middle;
}

.route-add-badge:hover {
  background: #059669;
  transform: translateY(-1px);
  box-shadow: 0 4px 10px rgba(16, 185, 129, 0.4);
}

.msg-source {
  font-size: 0.74rem;
  color: var(--text-muted);
  margin-left: 42px;
  background: rgba(226, 232, 240, 0.5);
  align-self: flex-start;
  padding: 3px 8px;
  border-radius: 6px;
  border: 1px solid var(--border);
}

.typing-bubble {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 20px;
  min-height: 44px;
}

.typing-dots {
  display: flex;
  align-items: center;
  gap: 5px;
}

.typing-dots span {
  width: 6px;
  height: 6px;
  background: var(--primary);
  border-radius: 50%;
  display: inline-block;
  animation: typing 1.4s infinite ease-in-out both;
}

.typing-dots span:nth-child(1) {
  animation-delay: -0.32s;
}

.typing-dots span:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes typing {
  0%, 80%, 100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1.0);
  }
}

.quick-questions-container {
  overflow: hidden;
  margin-bottom: 12px;
  position: relative;
}

.quick-btns {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 6px;
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none;  /* IE/Edge */
  -webkit-overflow-scrolling: touch;
}

.quick-btns::-webkit-scrollbar {
  display: none; /* Chrome/Safari */
}

.quick-btn {
  background: white;
  border: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 0.8rem;
  font-weight: 600;
  padding: 6px 14px;
  border-radius: 999px;
  white-space: nowrap;
  flex-shrink: 0;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
}

.quick-btn:hover:not(:disabled) {
  border-color: var(--primary-light);
  color: var(--primary-dark);
  background: #f5f7ff;
  transform: translateY(-1px);
}

.quick-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.chat-input-row {
  display: flex;
  gap: 8px;
  align-items: center;
  background: white;
  border: 1.5px solid var(--border);
  border-radius: 16px;
  padding: 6px 6px 6px 14px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.02);
  transition: all 0.2s;
}

.chat-input-row:focus-within {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12), 0 4px 15px rgba(99, 102, 241, 0.05);
}

.chat-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 0.9rem;
  background: transparent;
  color: var(--text);
}

.chat-input::placeholder {
  color: #94a3b8;
}

.chat-send-btn {
  background: var(--primary-gradient);
  border: none;
  color: white;
  width: 36px;
  height: 36px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 10px rgba(99, 102, 241, 0.2);
}

.chat-send-btn:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: 0 6px 14px rgba(99, 102, 241, 0.35);
}

.chat-send-btn:disabled {
  background: #e2e8f0;
  color: #94a3b8;
  box-shadow: none;
  cursor: not-allowed;
}

.chat-header {
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}

.chat-header-title {
  color: var(--text);
  font-family: 'Gowun Batang', serif;
}

.chat-header-dot {
  background: var(--terracotta);
  box-shadow: none;
}

.btn-reset,
.btn-close-chat {
  background: #f7f2e8;
  border: 1px solid var(--border);
  border-radius: 2px;
  color: var(--text-muted);
}

.chat-body {
  background: var(--surface);
}

.msg-avatar {
  border-radius: 2px;
  box-shadow: none;
}

.msg-avatar.bot {
  background: var(--text);
}

.msg-bubble,
.quick-btn,
.chat-input-row,
.route-add-badge,
.msg-source {
  border-radius: 2px;
}

.msg-bubble.bot {
  background: #f7f2e8;
  border-color: var(--border);
}

.msg-bubble.user,
.chat-send-btn,
.route-add-badge {
  background: var(--terracotta);
  box-shadow: none;
}

.quick-btn {
  background: var(--surface);
  border-color: var(--border);
}

.quick-btn:hover:not(:disabled) {
  background: #f7f2e8;
  border-color: var(--terracotta);
  color: var(--terracotta-dark);
}

.chat-input-row {
  background: #fffaf2;
  border-color: var(--border);
  box-shadow: none;
}

.chat-input-row:focus-within {
  border-color: var(--terracotta);
  box-shadow: 0 0 0 3px rgba(184, 92, 56, 0.12);
}
</style>

