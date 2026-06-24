import { test, expect } from '@playwright/test'
import { mockApiDefaults, setLoggedIn } from './helpers/mock'

test.describe('게시판 - 기본', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiDefaults(page)
    await page.goto('/board')
  })

  test('게시판 페이지 로드', async ({ page }) => {
    await expect(page).toHaveURL('/board')
  })

  test('게시글 목록 렌더링', async ({ page }) => {
    await expect(page.getByText('서울 여행 후기')).toBeVisible()
    await expect(page.getByText('부산 맛집 추천')).toBeVisible()
  })

  test('필터 탭 전체/자유/질문 노출', async ({ page }) => {
    await expect(page.locator('.filter-btn', { hasText: '전체' })).toBeVisible()
    await expect(page.locator('.filter-btn', { hasText: '자유' })).toBeVisible()
    await expect(page.locator('.filter-btn', { hasText: '질문' })).toBeVisible()
  })

  test('질문 탭 클릭 시 QnA API 호출', async ({ page }) => {
    const [req] = await Promise.all([
      page.waitForRequest(req => req.url().includes('/api/qnas')),
      page.getByRole('button', { name: '질문' }).click(),
    ])
    expect(req.url()).toContain('/api/qnas')
  })
})

test.describe('게시판 - 글쓰기', () => {
  test('비로그인 상태에서 글쓰기 버튼 없음', async ({ page }) => {
    await mockApiDefaults(page)
    await page.goto('/board')
    await expect(page.getByRole('link', { name: '글쓰기' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: '글쓰기' })).toHaveCount(0)
  })

  test('로그인 상태에서 자유탭 글쓰기 버튼 노출', async ({ page }) => {
    await mockApiDefaults(page)
    await page.goto('/')
    await setLoggedIn(page)
    await page.goto('/board')

    // 글쓰기 버튼은 자유/질문 탭일 때만 노출
    await page.locator('.filter-btn', { hasText: '자유' }).click()
    await expect(page.locator('.btn-write')).toBeVisible()
  })
})

test.describe('게시판 - 게시글 작성 페이지', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiDefaults(page)
    await page.goto('/')
    await setLoggedIn(page)
    await page.goto('/board/write')
  })

  test('게시글 작성 페이지 폼 렌더링', async ({ page }) => {
    await expect(page.locator('input[type="text"], input[placeholder*="제목"]').first()).toBeVisible()
  })

  test('제목 없이 제출 시 유효성 체크', async ({ page }) => {
    page.once('dialog', dialog => {
      expect(dialog.message()).toMatch(/제목|입력/)
      dialog.accept()
    })
    await page.getByRole('button', { name: '등록' })
      .or(page.getByRole('button', { name: '저장' }))
      .first()
      .click()
  })
})
