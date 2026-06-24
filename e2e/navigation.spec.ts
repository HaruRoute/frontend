import { test, expect } from '@playwright/test'
import { mockApiDefaults } from './helpers/mock'

test.describe('네비게이션', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiDefaults(page)
  })

  test('브랜드 클릭 시 홈으로 이동', async ({ page }) => {
    await page.goto('/board')
    await page.getByRole('button', { name: 'Enjoy Trip' }).click()
    await expect(page).toHaveURL('/')
  })

  test('"동선 짜기" 클릭 시 홈으로 이동', async ({ page }) => {
    await page.goto('/board')
    await page.getByRole('button', { name: '동선 짜기' }).first().click()
    await expect(page).toHaveURL('/')
  })

  test('"게시판" 클릭 시 /board로 이동', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: '게시판' }).first().click()
    await expect(page).toHaveURL('/board')
  })

  test('로그인 상태에서 "내 보관함" 메뉴 노출', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.setItem('token', 'mock-token')
      localStorage.setItem('userName', '테스트유저')
      localStorage.setItem('userId', 'testuser')
      localStorage.setItem('role', 'USER')
    })
    await page.reload()
    await expect(page.getByRole('button', { name: '내 보관함' }).first()).toBeVisible()
  })

  test('비로그인 상태에서 "내 보관함" 메뉴 미노출', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: '내 보관함' })).toHaveCount(0)
  })

  test('비로그인 상태에서 로그인/회원가입 버튼 노출', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: '로그인' }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: '회원가입' }).first()).toBeVisible()
  })
})
