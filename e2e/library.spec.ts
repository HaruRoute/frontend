import { test, expect } from '@playwright/test'
import { mockApiDefaults, setLoggedIn } from './helpers/mock'

const MOCK_PLANS = [
  {
    id: 1,
    title: '서울 여행',
    placesJson: JSON.stringify([
      { title: '경복궁', lat: 37.579, lng: 126.977, addr1: '서울 종로구', firstimage: '' },
    ]),
    totalDistance: 5.2,
    transitFare: 1400,
    taxiFare: 8000,
    createdAt: '2024-01-01T00:00:00',
  },
]

test.describe('내 보관함', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiDefaults(page)
    await page.route('**/api/plans**', route => {
      if (route.request().method() === 'GET')
        return route.fulfill({ json: MOCK_PLANS })
      return route.continue()
    })
    await page.goto('/')
    await setLoggedIn(page)
    await page.goto('/library')
  })

  test('보관함 페이지 로드', async ({ page }) => {
    await expect(page).toHaveURL('/library')
  })

  test('저장된 여행 계획 렌더링', async ({ page }) => {
    await expect(page.getByText('서울 여행')).toBeVisible()
  })

  test('계획 삭제 버튼 동작', async ({ page }) => {
    await page.route('**/api/plans/1', route => {
      if (route.request().method() === 'DELETE')
        return route.fulfill({ status: 200, json: {} })
      return route.continue()
    })

    // 삭제 후 빈 목록 반환
    let deleteCount = 0
    await page.route('**/api/plans**', route => {
      if (route.request().method() === 'GET') {
        deleteCount++
        return route.fulfill({ json: deleteCount > 1 ? [] : MOCK_PLANS })
      }
      return route.continue()
    })

    page.once('dialog', dialog => dialog.accept())
    // 삭제 버튼은 × 텍스트의 .btn-card-x
    await page.locator('.btn-card-x').first().click()
  })
})

test.describe('내 보관함 - 비로그인 접근', () => {
  test('비로그인 시 /library 접근하면 로그인 안내 문구 표시', async ({ page }) => {
    await mockApiDefaults(page)
    await page.goto('/library')
    // 리다이렉트 없이 "로그인이 필요합니다." 안내 문구를 표시
    await expect(page.getByText('로그인이 필요합니다.')).toBeVisible()
  })
})
