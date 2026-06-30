import { describe, expect, it, beforeEach, vi } from 'vitest'

/** Mirrors MorseViewModel.collapseSettingsAccordions DOM behavior */
function collapseSettingsAccordions () {
  const area = document.getElementById('accordionArea')
  if (!area) {
    return
  }
  area.querySelectorAll('.accordion-collapse.show').forEach((panel) => {
    panel.classList.remove('show')
  })
  area.querySelectorAll('.accordion-button').forEach((button) => {
    button.classList.add('collapsed')
    button.setAttribute('aria-expanded', 'false')
  })
}

function scrollPlaybackIntoView () {
  document.querySelector('.playback-controls')?.scrollIntoView({ block: 'start', behavior: 'auto' })
}

describe('collapseSettingsAccordions', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="accordionArea">
        <div class="accordion-collapse collapse show" id="panel1"></div>
        <button class="accordion-button" aria-expanded="true">One</button>
        <div class="accordion-collapse collapse" id="panel2"></div>
        <button class="accordion-button collapsed" aria-expanded="false">Two</button>
      </div>
    `
  })

  it('removes show from open panels and collapses buttons', () => {
    collapseSettingsAccordions()
    expect(document.querySelector('#panel1')?.classList.contains('show')).toBe(false)
    const buttons = document.querySelectorAll('#accordionArea .accordion-button')
    buttons.forEach((btn) => {
      expect(btn.classList.contains('collapsed')).toBe(true)
      expect(btn.getAttribute('aria-expanded')).toBe('false')
    })
  })
})

function expandVoiceOptionsAccordion () {
  const panel = document.getElementById('collapsevoiceoptions')
  const button = document.getElementById('voiceOptionsAccordionButton')
  if (!panel || !button) {
    return
  }
  panel.classList.add('show')
  button.classList.remove('collapsed')
  button.setAttribute('aria-expanded', 'true')
}

describe('expandVoiceOptionsAccordion', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="accordionArea">
        <div class="accordion-collapse collapse" id="collapsevoiceoptions"></div>
        <button id="voiceOptionsAccordionButton" class="accordion-button collapsed" aria-expanded="false">Voice</button>
      </div>
    `
  })

  it('expands the Voice Options panel and button', () => {
    expandVoiceOptionsAccordion()
    expect(document.querySelector('#collapsevoiceoptions')?.classList.contains('show')).toBe(true)
    const button = document.getElementById('voiceOptionsAccordionButton')
    expect(button?.classList.contains('collapsed')).toBe(false)
    expect(button?.getAttribute('aria-expanded')).toBe('true')
  })

  it('is a no-op when panel element is missing', () => {
    document.getElementById('collapsevoiceoptions')!.remove()
    // Should not throw; button state should be unchanged
    expect(() => expandVoiceOptionsAccordion()).not.toThrow()
    const button = document.getElementById('voiceOptionsAccordionButton')
    expect(button?.classList.contains('collapsed')).toBe(true)
    expect(button?.getAttribute('aria-expanded')).toBe('false')
  })

  it('is a no-op when button element is missing', () => {
    document.getElementById('voiceOptionsAccordionButton')!.remove()
    // Should not throw; panel state should be unchanged
    expect(() => expandVoiceOptionsAccordion()).not.toThrow()
    const panel = document.getElementById('collapsevoiceoptions')
    expect(panel?.classList.contains('show')).toBe(false)
  })

  it('is idempotent: calling twice leaves panel expanded', () => {
    expandVoiceOptionsAccordion()
    expandVoiceOptionsAccordion()
    expect(document.querySelector('#collapsevoiceoptions')?.classList.contains('show')).toBe(true)
    const button = document.getElementById('voiceOptionsAccordionButton')
    expect(button?.classList.contains('collapsed')).toBe(false)
    expect(button?.getAttribute('aria-expanded')).toBe('true')
  })

  it('is a no-op when both elements are missing', () => {
    document.body.innerHTML = ''
    expect(() => expandVoiceOptionsAccordion()).not.toThrow()
  })
})

/** Mirrors MorseViewModel.onSpeedRacerSpeakBeforeReplayClick behavior */
function onSpeedRacerSpeakBeforeReplayClick (
  voiceEnabled: { value: boolean },
  event: Event
): boolean {
  const input = event.target as HTMLInputElement
  if (input?.checked) {
    voiceEnabled.value = true
    expandVoiceOptionsAccordion()
  }
  return true
}

describe('onSpeedRacerSpeakBeforeReplayClick', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="accordionArea">
        <div class="accordion-collapse collapse" id="collapsevoiceoptions"></div>
        <button id="voiceOptionsAccordionButton" class="accordion-button collapsed" aria-expanded="false">Voice</button>
        <input id="speakCheckbox" type="checkbox" />
      </div>
    `
  })

  it('enables voice and expands accordion when checkbox is checked', () => {
    const checkbox = document.getElementById('speakCheckbox') as HTMLInputElement
    checkbox.checked = true
    const voiceEnabled = { value: false }
    const event = { target: checkbox } as unknown as Event

    const result = onSpeedRacerSpeakBeforeReplayClick(voiceEnabled, event)

    expect(result).toBe(true)
    expect(voiceEnabled.value).toBe(true)
    expect(document.querySelector('#collapsevoiceoptions')?.classList.contains('show')).toBe(true)
    const button = document.getElementById('voiceOptionsAccordionButton')
    expect(button?.classList.contains('collapsed')).toBe(false)
    expect(button?.getAttribute('aria-expanded')).toBe('true')
  })

  it('does not enable voice or expand accordion when checkbox is unchecked', () => {
    const checkbox = document.getElementById('speakCheckbox') as HTMLInputElement
    checkbox.checked = false
    const voiceEnabled = { value: false }
    const event = { target: checkbox } as unknown as Event

    const result = onSpeedRacerSpeakBeforeReplayClick(voiceEnabled, event)

    expect(result).toBe(true)
    expect(voiceEnabled.value).toBe(false)
    expect(document.querySelector('#collapsevoiceoptions')?.classList.contains('show')).toBe(false)
  })

  it('always returns true (allows KO binding to propagate)', () => {
    const checkbox = document.getElementById('speakCheckbox') as HTMLInputElement
    const voiceEnabled = { value: false }

    checkbox.checked = true
    expect(onSpeedRacerSpeakBeforeReplayClick(voiceEnabled, { target: checkbox } as unknown as Event)).toBe(true)

    checkbox.checked = false
    expect(onSpeedRacerSpeakBeforeReplayClick(voiceEnabled, { target: checkbox } as unknown as Event)).toBe(true)
  })

  it('is a no-op (voice unchanged) when event target is null', () => {
    const voiceEnabled = { value: false }
    const event = { target: null } as unknown as Event

    expect(() => onSpeedRacerSpeakBeforeReplayClick(voiceEnabled, event)).not.toThrow()
    expect(voiceEnabled.value).toBe(false)
  })
})

describe('scrollPlaybackIntoView', () => {
  it('scrolls the playback controls into view', () => {
    const el = document.createElement('section')
    el.className = 'playback-controls'
    el.scrollIntoView = vi.fn()
    document.body.appendChild(el)

    scrollPlaybackIntoView()

    expect(el.scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'auto' })
  })
})
