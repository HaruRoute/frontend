import { test, expect } from '@playwright/test'
import { mockApiDefaults, MOCK_USER } from './helpers/mock'

test.describe('인증 - 로그인', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiDefaults(page)
    await page.goto('/')
  })

  test('로그인 버튼 클릭 시 모달 열림', async ({ page }) => {
    await page.getByRole('button', { name: '로그인' }).first().click()
    await expect(page.locator('#loginModal')).toBeVisible()
  })

  test('올바른 아이디/비밀번호로 로그인 성공', async ({ page }) => {
    await page.getByRole('button', { name: '로그인' }).first().click()
    await page.locator('#loginModal .auth-input').nth(0).fill('testuser')
    await page.locator('#loginModal .auth-input').nth(1).fill('password123')
    await page.locator('#loginModal .auth-primary').click()

    // 로그인 후 사용자 이름 표시, 로그인 버튼 사라짐
    await expect(page.getByText(`${MOCK_USER.name}님`).first()).toBeVisible()
    await expect(page.getByRole('button', { name: '로그인' })).toHaveCount(0)
  })

  test('로그인 실패 시 alert 표시', async ({ page }) => {
    await page.route('**/api/users/login', route =>
      route.fulfill({ status: 401, json: { message: '아이디 또는 비밀번호가 올바르지 않습니다.' } })
    )

    page.once('dialog', dialog => dialog.accept())
    await page.getByRole('button', { name: '로그인' }).first().click()
    await page.locator('#loginModal .auth-input').nth(0).fill('wrong')
    await page.locator('#loginModal .auth-input').nth(1).fill('wrong')
    await page.locator('#loginModal .auth-primary').click()

    // 여전히 로그인 버튼이 있어야 함
    await expect(page.getByRole('button', { name: '로그인' }).first()).toBeVisible()
  })

  test('비밀번호 입력 후 Enter 키로 로그인', async ({ page }) => {
    await page.getByRole('button', { name: '로그인' }).first().click()
    await page.locator('#loginModal .auth-input').nth(0).fill('testuser')
    await page.locator('#loginModal .auth-input').nth(1).fill('password123')
    await page.locator('#loginModal .auth-input').nth(1).press('Enter')

    await expect(page.getByText(`${MOCK_USER.name}님`).first()).toBeVisible()
  })
})

test.describe('인증 - 회원가입', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiDefaults(page)
    await page.goto('/')
  })

  test('회원가입 버튼 클릭 시 모달 열림', async ({ page }) => {
    await page.getByRole('button', { name: '회원가입' }).first().click()
    await expect(page.locator('#joinModal')).toBeVisible()
  })

  test('필드 입력 후 회원가입 성공 시 alert 표시', async ({ page }) => {
    page.once('dialog', dialog => {
      expect(dialog.message()).toContain('완료')
      dialog.accept()
    })
    await page.getByRole('button', { name: '회원가입' }).first().click()
    await page.locator('#joinModal').waitFor({ state: 'visible' })

    const inputs = page.locator('#joinModal .auth-input')
    await inputs.nth(0).fill('newuser')
    await inputs.nth(1).fill('password123')
    await inputs.nth(2).fill('새유저')
    await page.locator('#joinModal .auth-primary').click()
  })

  test('로그인 모달에서 회원가입 링크로 전환', async ({ page }) => {
    await page.getByRole('button', { name: '로그인' }).first().click()
    await page.locator('#loginModal').waitFor({ state: 'visible' })
    await page.locator('#loginModal').getByRole('button', { name: '회원가입' }).click()
    await expect(page.locator('#joinModal')).toBeVisible()
  })
})

test.describe('인증 - 로그아웃', () => {
  test('로그아웃 시 사용자 정보 초기화', async ({ page }) => {
    await mockApiDefaults(page)
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.setItem('token', 'mock-token')
      localStorage.setItem('userName', '테스트유저')
      localStorage.setItem('userId', 'testuser')
      localStorage.setItem('role', 'USER')
    })
    await page.reload()

    await page.getByRole('button', { name: '로그아웃' }).click()

    await expect(page.getByRole('button', { name: '로그인' }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: '로그아웃' })).toHaveCount(0)
  })
})
