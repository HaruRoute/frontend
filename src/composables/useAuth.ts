import { reactive } from 'vue'

export const auth = reactive({
  isLoggedIn: false,
  userName: '',
  userId: '',
  role: '',
})
