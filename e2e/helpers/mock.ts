import { Page } from '@playwright/test'

export const MOCK_TOKEN = 'mock-jwt-token'
export const MOCK_USER = { id: 'testuser', name: '테스트유저', token: MOCK_TOKEN, role: 'USER' }

/** 공통 API 응답 모킹 */
export async function mockApiDefaults(page: Page) {
  // 로그인
  await page.route('**/api/users/login', route =>
    route.fulfill({ json: MOCK_USER })
  )

  // 회원가입
  await page.route('**/api/users', route => {
    if (route.request().method() === 'POST')
      return route.fulfill({ json: { message: '회원가입이 완료되었습니다.' } })
    return route.continue()
  })

  // 즐겨찾기 목록
  await page.route('**/api/favorites', route => {
    if (route.request().method() === 'GET')
      return route.fulfill({ json: [] })
    return route.continue()
  })

  // 관광지 검색
  await page.route('**/api/spots**', route =>
    route.fulfill({ json: MOCK_SPOTS })
  )

  // 게시글 목록
  await page.route('**/api/posts**', route =>
    route.fulfill({ json: MOCK_PAGE })
  )

  // QnA 목록
  await page.route('**/api/qnas**', route =>
    route.fulfill({ json: { ...MOCK_PAGE, qnas: MOCK_PAGE.posts } })
  )

  // 공지사항 목록
  await page.route('**/api/notices**', route =>
    route.fulfill({ json: { notices: [], totalCount: 0, page: 0, size: 10, totalPages: 0 } })
  )

  // 여행 계획 목록
  await page.route('**/api/plans**', route => {
    if (route.request().method() === 'GET')
      return route.fulfill({ json: [] })
    return route.continue()
  })

  // KTO 지역코드 (카카오맵 앱 외부 API)
  await page.route('**/apis.data.go.kr/**', route =>
    route.fulfill({ json: { response: { body: { items: { item: [] } } } } })
  )
}

/** 로그인 상태로 세팅 (localStorage) */
export async function setLoggedIn(page: Page) {
  await page.evaluate((user) => {
    localStorage.setItem('token', user.token)
    localStorage.setItem('userId', user.id)
    localStorage.setItem('userName', user.name)
    localStorage.setItem('role', user.role)
  }, MOCK_USER)
}

const MOCK_SPOTS = [
  {
    contentid: '126508',
    title: '경복궁',
    addr1: '서울특별시 종로구 사직로 161',
    addr2: '',
    firstimage: '',
    firstimage2: '',
    mapx: '126.9769930',
    mapy: '37.5796212',
    areacode: '1',
    sigungucode: '11',
    contenttypeid: '12',
  },
]

const MOCK_PAGE = {
  posts: [
    {
      id: 1,
      title: '서울 여행 후기',
      authorName: '여행자',
      viewCount: 42,
      hasRoute: false,
      category: 'FREE',
      coverImage: null,
      createdAt: '2024-01-01T00:00:00',
    },
    {
      id: 2,
      title: '부산 맛집 추천',
      authorName: '맛집탐방',
      viewCount: 100,
      hasRoute: false,
      category: 'FREE',
      coverImage: null,
      createdAt: '2024-01-02T00:00:00',
    },
  ],
  totalCount: 2,
  page: 0,
  size: 10,
  totalPages: 1,
}
