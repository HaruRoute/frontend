import axios from 'axios'
import { auth } from '../composables/useAuth'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8080/api',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
}, (error) => {
  return Promise.reject(error)
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('userId')
      localStorage.removeItem('userName')
      localStorage.removeItem('role')
      auth.isLoggedIn = false
      auth.userName = ''
      auth.userId = ''
      auth.role = ''
      alert('세션이 만료되었습니다. 다시 로그인해주세요.')
      window.location.href = '/'
      return new Promise(() => {})
    }
    return Promise.reject(error)
  }
)

export default api
