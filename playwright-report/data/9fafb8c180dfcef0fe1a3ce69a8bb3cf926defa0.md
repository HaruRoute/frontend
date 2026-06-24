# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: library.spec.ts >> 내 보관함 >> 계획 삭제 버튼 동작
- Location: e2e\library.spec.ts:39:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: '삭제' }).first()

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - navigation [ref=e3]:
    - button "Enjoy Trip" [ref=e5] [cursor=pointer]
    - generic [ref=e6]:
      - button "동선 짜기" [ref=e7] [cursor=pointer]
      - button "내 보관함" [ref=e8] [cursor=pointer]
      - button "게시판" [ref=e9] [cursor=pointer]
    - generic [ref=e10]:
      - generic [ref=e11]: SEOUL · 12°
      - generic [ref=e12]: 테스트유저님
      - button "로그아웃" [ref=e13] [cursor=pointer]
  - main [ref=e15]:
    - generic [ref=e16]:
      - generic [ref=e17]:
        - generic [ref=e18]:
          - paragraph [ref=e19]: MY ITINERARIES
          - heading "내 동선 기록" [level=1] [ref=e20]
          - paragraph [ref=e21]: 저장한 동선이 한 권의 잡지처럼 쌓입니다. 표지를 눌러 다시 읽어보세요.
        - button "+ 새 동선 짜기" [ref=e22] [cursor=pointer]
      - generic [ref=e24] [cursor=pointer]:
        - button "×" [ref=e25]
        - generic [ref=e28]: 서울 여행
        - generic [ref=e29]:
          - generic [ref=e30]:
            - generic [ref=e31]: 2024-01-01
            - generic [ref=e32]: 5.2 km
          - generic [ref=e33]: 경복궁
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test'
  2  | import { mockApiDefaults, setLoggedIn } from './helpers/mock'
  3  | 
  4  | const MOCK_PLANS = [
  5  |   {
  6  |     id: 1,
  7  |     title: '서울 여행',
  8  |     placesJson: JSON.stringify([
  9  |       { title: '경복궁', lat: 37.579, lng: 126.977, addr1: '서울 종로구', firstimage: '' },
  10 |     ]),
  11 |     totalDistance: 5.2,
  12 |     transitFare: 1400,
  13 |     taxiFare: 8000,
  14 |     createdAt: '2024-01-01T00:00:00',
  15 |   },
  16 | ]
  17 | 
  18 | test.describe('내 보관함', () => {
  19 |   test.beforeEach(async ({ page }) => {
  20 |     await mockApiDefaults(page)
  21 |     await page.route('**/api/plans**', route => {
  22 |       if (route.request().method() === 'GET')
  23 |         return route.fulfill({ json: MOCK_PLANS })
  24 |       return route.continue()
  25 |     })
  26 |     await page.goto('/')
  27 |     await setLoggedIn(page)
  28 |     await page.goto('/library')
  29 |   })
  30 | 
  31 |   test('보관함 페이지 로드', async ({ page }) => {
  32 |     await expect(page).toHaveURL('/library')
  33 |   })
  34 | 
  35 |   test('저장된 여행 계획 렌더링', async ({ page }) => {
  36 |     await expect(page.getByText('서울 여행')).toBeVisible()
  37 |   })
  38 | 
  39 |   test('계획 삭제 버튼 동작', async ({ page }) => {
  40 |     await page.route('**/api/plans/1', route => {
  41 |       if (route.request().method() === 'DELETE')
  42 |         return route.fulfill({ status: 200, json: {} })
  43 |       return route.continue()
  44 |     })
  45 | 
  46 |     // 삭제 후 빈 목록 반환
  47 |     let deleteCount = 0
  48 |     await page.route('**/api/plans**', route => {
  49 |       if (route.request().method() === 'GET') {
  50 |         deleteCount++
  51 |         return route.fulfill({ json: deleteCount > 1 ? [] : MOCK_PLANS })
  52 |       }
  53 |       return route.continue()
  54 |     })
  55 | 
  56 |     page.once('dialog', dialog => dialog.accept())
> 57 |     await page.getByRole('button', { name: '삭제' }).first().click()
     |                                                            ^ Error: locator.click: Test timeout of 30000ms exceeded.
  58 |   })
  59 | })
  60 | 
  61 | test.describe('내 보관함 - 비로그인 접근', () => {
  62 |   test('비로그인 시 /library 접근하면 홈 또는 로그인 유도', async ({ page }) => {
  63 |     await mockApiDefaults(page)
  64 |     await page.goto('/library')
  65 |     // 로그인 모달이 뜨거나 홈으로 리다이렉트됨
  66 |     const isHome = page.url().endsWith('/')
  67 |     const hasLoginModal = await page.locator('#loginModal').isVisible()
  68 |     expect(isHome || hasLoginModal).toBeTruthy()
  69 |   })
  70 | })
  71 | 
```