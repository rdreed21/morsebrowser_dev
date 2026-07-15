import { expect, test, type Page } from '@playwright/test'

async function openLessonOptions (page: Page) {
  await page.goto('/')
  await expect(page.locator('#moreSettingsAccordionButton')).toBeVisible()
  await page.locator('#moreSettingsAccordionButton').click()
  await expect(page.locator('#collapselessonoptions')).toHaveClass(/show/)
}

test('no horizontal overflow when speed intervals are enabled', async ({ page }) => {
  await openLessonOptions(page)
  await page.locator('label[for="btncheckspeedinterval"]').click()
  await expect(page.locator('#intervalTimingsText')).toBeVisible()

  const hasOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  })
  expect(hasOverflow).toBe(false)

  const box = await page.locator('#intervalTimingsText').boundingBox()
  expect(box).not.toBeNull()
  if (box) {
    expect(box.width).toBeLessThan(400)
  }
})

test('no horizontal overflow when Speed Racer is enabled', async ({ page }) => {
  await openLessonOptions(page)
  await page.locator('label[for="btncheckspeedracer"]').click()
  await expect(page.locator('button[data-bs-target="#speedRacerAdvanced"]')).toBeVisible()

  const hasOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  })
  expect(hasOverflow).toBe(false)

  await page.locator('button[data-bs-target="#speedRacerAdvanced"]').click()
  await expect(page.locator('#speedRacerMultipliers')).toBeVisible()
  await expect(page.getByLabel('Replay at First Multiplier')).toBeVisible()

  const multipliersBox = await page.locator('#speedRacerMultipliers').boundingBox()
  expect(multipliersBox).not.toBeNull()
  if (multipliersBox) {
    expect(multipliersBox.width).toBeLessThan(400)
  }

  const advancedOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  })
  expect(advancedOverflow).toBe(false)
})

test('override minutes input uses compact numeric width', async ({ page }) => {
  await openLessonOptions(page)
  await page.locator('label[for="btncheck2"]').click()
  const minutes = page.getByLabel('minutes')
  await expect(minutes).toBeVisible()
  const box = await minutes.boundingBox()
  expect(box).not.toBeNull()
  if (box) {
    expect(box.width).toBeLessThan(100)
  }
})

test('long OverLearn preset labels wrap in the PRESETS picker', async ({ page }) => {
  // Narrow enough that "OverLearn Letters Flow Rate 1" must wrap in the column
  // (Pixel 5's flex layout can give PRESETS nearly full width; 320px does not).
  await page.setViewportSize({ width: 320, height: 568 })
  await page.goto('/')
  await expect(page.locator('#accordianItemLessonControls')).toHaveClass(/show/)

  const classToggle = page.getByLabel('CLASS', { exact: true })
  await classToggle.click()
  await page.getByLabel('Class').getByRole('option', { name: 'BC1' }).click()

  const presetsToggle = page.getByLabel('PRESETS', { exact: true })
  await expect(presetsToggle).toBeEnabled()
  await presetsToggle.click()

  const overlearnItem = page.getByLabel('Settings preset').getByRole('option', {
    name: /OverLearn Letters Flow Rate 1/i
  })
  await expect(overlearnItem).toBeVisible()

  await expect(overlearnItem).toHaveCSS('white-space', 'normal')
  const itemBox = await overlearnItem.boundingBox()
  expect(itemBox).not.toBeNull()
  if (itemBox) {
    // Wrapped text is taller than a single Bootstrap dropdown line (~38px)
    expect(itemBox.height).toBeGreaterThan(40)
  }

  await overlearnItem.click()
  await expect(presetsToggle).toContainText(/OverLearn Letters Flow Rate 1/i)
  await expect(presetsToggle).toHaveCSS('white-space', 'normal')

  const hasOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  })
  expect(hasOverflow).toBe(false)
})
