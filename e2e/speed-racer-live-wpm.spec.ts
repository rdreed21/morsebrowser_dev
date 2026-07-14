import { expect, test } from '@playwright/test'

test('Speed Racer shows live Character Speed as the ladder steps', async ({ page }) => {
  await page.goto('/')

  await page.locator('#moreSettingsAccordionButton').click()
  await page.locator('label[for="btncheckspeedracer"]').click()
  await expect(page.locator('#btncheckspeedracer')).toBeChecked()

  await page.locator('button[data-bs-target="#speedRacerAdvanced"]').click()
  await page.locator('#speedRacerMultipliers').fill('1.348, 1.174, 1.0')
  if (await page.locator('#speedRacerFinalPlay').isChecked()) {
    await page.locator('label[for="speedRacerFinalPlay"]').click()
  }
  if (await page.locator('#speedRacerSpeakBeforeReplay').isChecked()) {
    await page.locator('label[for="speedRacerSpeakBeforeReplay"]').click()
  }

  await page.getByLabel('Character Speed').fill('23')

  await page.getByRole('button', { name: /Input Options/i }).click()
  if (!(await page.locator('#btncheckshowraw').isChecked())) {
    await page.locator('label[for="btncheckshowraw"]').click()
  }
  await page.getByRole('textbox', { name: 'Working text' }).fill('R')

  // Before play, the editable Character Speed field is shown (not the live readout).
  await expect(page.getByLabel('Playing WPM')).toBeHidden()

  await page.locator('#btnPlayButton').click()

  // While racing, the top speed box switches to the live (disabled) readout and
  // steps through the ladder. Poll until we have seen more than one distinct WPM.
  const seen = new Set<string>()
  await expect.poll(async () => {
    const live = page.getByLabel('Playing WPM')
    if (await live.isVisible()) {
      const val = await live.inputValue()
      if (val) seen.add(val)
    }
    return seen.size
  }, { timeout: 20000 }).toBeGreaterThanOrEqual(2)

  const values = [...seen].map(Number)
  expect(values).toContain(31)
  expect(values).toContain(27)
})
