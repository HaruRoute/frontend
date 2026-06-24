import { test, expect } from '@playwright/test'
import { mockApiDefaults, setLoggedIn } from './helpers/mock'

test.describe('홈 - RoutePlanner (비로그인)', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiDefaults(page)
    await page.goto('/')
  })

  test('경로 패널 초기 빈 상태 메시지 표시', async ({ page }) => {
    await expect(page.getByText('추가된 장소가 없습니다.')).toBeVisible()
  })

  test('이동 수단 탭이 기본적으로 보이지 않음 (장소 없을 때)', async ({ page }) => {
    await expect(page.locator('.mode-tab-group')).not.toBeVisible()
  })

  test('비로그인 상태에서 보관함 저장 버튼 클릭 시 로그인 모달 열림', async ({ page }) => {
    // 장소를 강제로 넣어 저장 버튼 활성화
    await page.evaluate(() => {
      localStorage.setItem('route_places', JSON.stringify([{
        title: '경복궁', lat: 37.579, lng: 126.977,
        addr1: '서울 종로구', firstimage: '', distanceFromPrevious: 0
      }]))
    })
    await page.reload()

    await page.locator('.plan-title-input').first().fill('테스트 계획')
    await page.getByRole('button', { name: '보관함에 저장' }).click()
    await expect(page.locator('#loginModal')).toBeVisible()
  })
})

test.describe('홈 - RoutePlanner (로그인)', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiDefaults(page)
    await page.goto('/')
    await setLoggedIn(page)
    await page.reload()
  })

  test('장소 추가 시 경로 카드 렌더링', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('route_places', JSON.stringify([
        { title: '경복궁', lat: 37.579, lng: 126.977, addr1: '서울 종로구', firstimage: '', distanceFromPrevious: 0 },
        { title: '남산타워', lat: 37.551, lng: 126.988, addr1: '서울 용산구', firstimage: '', distanceFromPrevious: 0 },
      ]))
    })
    await page.reload()

    await expect(page.getByText('경복궁')).toBeVisible()
    await expect(page.getByText('남산타워')).toBeVisible()
    await expect(page.locator('.route-badge-num')).toHaveCount(2)
  })

  test('이동 수단 탭 전환 (자동차 → 대중교통)', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('route_places', JSON.stringify([
        { title: '경복궁', lat: 37.579, lng: 126.977, addr1: '서울 종로구', firstimage: '', distanceFromPrevious: 0 },
      ]))
    })
    await page.reload()

    await page.locator('.mode-tab-btn', { hasText: '대중교통' }).click()
    await expect(page.locator('.mode-tab-btn.active')).toHaveText('대중교통')
  })

  test('장소 삭제 시 목록에서 제거', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('route_places', JSON.stringify([
        { title: '경복궁', lat: 37.579, lng: 126.977, addr1: '서울 종로구', firstimage: '', distanceFromPrevious: 0 },
      ]))
    })
    await page.reload()

    await page.locator('.control-btn-delete').first().click()
    await expect(page.getByText('추가된 장소가 없습니다.')).toBeVisible()
  })

  test('장소 2개 이상일 때 동선 최적화 버튼 활성화', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('route_places', JSON.stringify([
        { title: '경복궁', lat: 37.579, lng: 126.977, addr1: '서울 종로구', firstimage: '', distanceFromPrevious: 0 },
        { title: '남산타워', lat: 37.551, lng: 126.988, addr1: '서울 용산구', firstimage: '', distanceFromPrevious: 0 },
      ]))
    })
    await page.reload()

    await expect(page.getByRole('button', { name: '동선 최적화' })).not.toBeDisabled()
  })

  test('장소 1개일 때 동선 최적화 버튼 비활성화', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('route_places', JSON.stringify([
        { title: '경복궁', lat: 37.579, lng: 126.977, addr1: '서울 종로구', firstimage: '', distanceFromPrevious: 0 },
      ]))
    })
    await page.reload()

    await expect(page.getByRole('button', { name: '동선 최적화' })).toBeDisabled()
  })

  test('초기화 버튼으로 경로 전체 삭제', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('route_places', JSON.stringify([
        { title: '경복궁', lat: 37.579, lng: 126.977, addr1: '서울 종로구', firstimage: '', distanceFromPrevious: 0 },
      ]))
    })
    await page.reload()

    page.once('dialog', dialog => dialog.accept())
    await page.getByRole('button', { name: '초기화' }).click()
    await expect(page.getByText('추가된 장소가 없습니다.')).toBeVisible()
  })

  test('계획 저장 - 제목 없으면 버튼 비활성화', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('route_places', JSON.stringify([
        { title: '경복궁', lat: 37.579, lng: 126.977, addr1: '서울 종로구', firstimage: '', distanceFromPrevious: 0 },
      ]))
    })
    await page.reload()

    // 로그인 상태에서 제목이 비어있으면 버튼이 disabled 처리됨
    await expect(page.getByRole('button', { name: '보관함에 저장' })).toBeDisabled()
  })

  test('계획 저장 성공', async ({ page }) => {
    await page.route('**/api/plans', route => {
      if (route.request().method() === 'POST')
        return route.fulfill({ json: { id: 1, title: '서울 여행' } })
      return route.continue()
    })

    await page.evaluate(() => {
      localStorage.setItem('route_places', JSON.stringify([
        { title: '경복궁', lat: 37.579, lng: 126.977, addr1: '서울 종로구', firstimage: '', distanceFromPrevious: 0 },
      ]))
    })
    await page.reload()

    await page.locator('.plan-title-input').first().fill('서울 여행')

    page.once('dialog', dialog => {
      expect(dialog.message()).toContain('저장')
      dialog.accept()
    })
    await page.getByRole('button', { name: '보관함에 저장' }).click()
  })
})

test.describe('홈 - 지도 영역', () => {
  test('지도 캔버스 렌더링', async ({ page }) => {
    await mockApiDefaults(page)
    await page.goto('/')
    await expect(page.locator('#map')).toBeVisible()
  })

  test('관광 타입 미선택 시 검색 alert', async ({ page }) => {
    await mockApiDefaults(page)
    await page.goto('/')

    page.once('dialog', dialog => {
      expect(dialog.message()).toContain('관광 타입')
      dialog.accept()
    })
    await page.locator('.btn-search-trigger').click()
  })
})
