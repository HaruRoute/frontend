import { createRouter, createWebHistory } from 'vue-router'
import HomePage from '../views/HomePage.vue'
import BoardPage from '../views/BoardPage.vue'
import PostDetailPage from '../views/PostDetailPage.vue'
import PostFormPage from '../views/PostFormPage.vue'
import NoticePage from '../views/NoticePage.vue'
import MyLibraryPage from '../views/MyLibraryPage.vue'

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomePage },
    { path: '/library', component: MyLibraryPage },
    { path: '/notices', component: NoticePage },
    { path: '/board', component: BoardPage },
    // 자유 게시판 (posts 테이블)
    { path: '/board/post/:id', component: PostDetailPage },
    { path: '/board/write', component: PostFormPage },
    { path: '/board/edit/:id', component: PostFormPage },
    // 질문 게시판 (qnas 테이블)
    { path: '/board/qna/:id', component: PostDetailPage },
    { path: '/board/qna/write', component: PostFormPage },
    { path: '/board/qna/edit/:id', component: PostFormPage },
  ],
})
