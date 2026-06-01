# Speed Racer (Morse Code Ninja) — Implementation Plan

## Context

Morse Code Ninja popularized a "speed racing" practice technique: each item is sent
multiple times starting *fast* and stepping the speed *down* on each repeat, to
acclimate the learner to higher speeds. This plan adds that capability to the
morsebrowser (MPP) app as a new **Speed Racer** toggle under the existing **Timing**
settings group.

When enabled, Speed Racer **takes precedence** over the other speed mechanisms
(the per-time-interval `speedInterval` feature, the manual WPM/FWPM boxes, and the
manual "Repeats" count). For each *card* (the set of characters in a set — e.g. for a
"bc1 lesson rea" set, each 3-letter group is one card) it:

1. Plays the card's Morse **`step`** times, starting at **Start WPM** and dividing the
   speed by the **multiplier** on each repeat (WPM and FWPM set **equal** each time).
2. **If the "Voice + Recap" switch is on:** speaks the card's answer, then plays the
   Morse once more at the **original (Start) speed** as a recap.
3. Advances to the next card (respecting the existing card-wait spacing).

**No bell** (removed per user). The voice + recap step is **optional**, controlled by a
switch.

Speed formula (geometric divide): `wpm = round(startWpm / multiplier^repeatIndex)`,
min 1, `wpm === fwpm`. Example — Start 30, multiplier 1.5, step 3 → **30, 20, 13**.

Framework: Knockout.js + TypeScript.

---

## Data model — extend `SpeedSettings` (`src/morse/settings/speedSettings.ts`)

Extend the existing class rather than add a new module: `getApplicableSpeed` (the single
speed authority) already lives here, already owns `speedInterval` precedence, already
implements `ICookieHandler`/`handleCookies`, and holds `vm`.

New observables in the constructor (mirror the `syncWpm`/`speedInterval` patterns,
lines ~38-86), each with a `.extend({ saveCookie: '...' })`:

- `speedRacer: ko.Observable<boolean>` = `false` → cookie `speedRacer`
- `speedRacerVoiceRecap: ko.Observable<boolean>` = `true` → cookie `speedRacerVoiceRecap`
- `speedRacerStartWpm: ko.Observable<number>` = `30` → cookie `speedRacerStartWpm`
- `speedRacerMultiplier: ko.Observable<number>` = `1.5` → cookie `speedRacerMultiplier`
- `speedRacerStep: ko.Observable<number>` = `3` → cookie `speedRacerStep`

Dropdown option arrays (scalar lists, used by the `options:` binding — same pattern as the
voice `<select>` at template lines 645-651, but no `optionsText`/`optionsValue` needed):

- `speedRacerMultiplierOptions = ko.observableArray([1.0, 1.25, 1.5, 1.75, 2.0])`
- `speedRacerStepOptions = ko.observableArray([2, 3, 4, 5, 6])`

`<select>` `value` bindings yield strings → downstream uses `parseInt`/`parseFloat`
(already the norm in this code).

## Speed precedence (`getApplicableSpeed`, ~line 89)

Add an early branch **above** the `speedInterval` check so Speed Racer wins:

```
if (this.speedRacer()) {
  const start = parseInt(this.speedRacerStartWpm() as any)
  const mult  = parseFloat(this.speedRacerMultiplier() as any)
  const idx   = this.vm.cardBufferManager.getServedIndex()  // 0-based current repeat
  const wpm   = Math.max(1, Math.round(start / Math.pow(mult, idx)))
  return new ApplicableSpeed(wpm, wpm)   // wpm === fwpm
}
```

The recap pass (§ state machine) re-populates the buffer so `getServedIndex()` is 0 →
recap plays at Start WPM.

## Cookie load (`handleCookies`, ~line 122)

Add five `cookies.find(...)` blocks mirroring the `speedInterval` one (lines 141-144):
`GeneralUtils.booleanize` for `speedRacer` and `speedRacerVoiceRecap`; `parseInt` for
`speedRacerStartWpm` and `speedRacerStep`; `parseFloat` for `speedRacerMultiplier`.

---

## Cookie save (`src/morse/settings/morseSettingsHandler.ts`)

Add five `savedInfos.push(new SavedSettingsInfo('<key>', morseViewModel.settings.speed.<obs>()))`
lines next to the existing `speedInterval` block (~lines 58-67), for export/import parity.
(Writes to cookies are automatic via the `saveCookie` extender in
`src/morse/koextenders/morseExtenders.ts`.)

---

## Repeat-index source (`src/morse/utils/cardBufferManager.ts`)

`getApplicableSpeed` needs to know which repeat is currently playing. Track it explicitly
(robust against the empty spacer subparts that `additionalWordSpaces` can inject):

- Add field `_servedIndex: number = 0`.
- In `populateBuffer(...)` (lines 34-46): reset `_servedIndex = 0`.
- In `getNextMorse(...)` (lines 52-60): after the `shift()`, set `_servedIndex` to the
  index of the just-served **real** (non-empty) morse play, incrementing only on
  non-empty words so spacer subparts don't advance it.
- Add accessor `getServedIndex = () => this._servedIndex`.

For the Speed Racer path we pass `additionalWordSpaces = 0` (below), so the buffer holds
exactly `step` real plays and the index is simply 0..step-1.

---

## Repeat-count override (`src/morse/morse.ts` `doPlay`, ~line 540-546)

Currently `repeats` is derived from `numberOfRepeats()` (value `2` ⇒ 3 plays via `+1`).
For Speed Racer, "step = N plays", so pass `step` directly to `getNextMorse`, and pass
`additionalWordSpaces = 0`:

```
const sr = this.settings.speed.speedRacer()
const repeats = sr
  ? parseInt(this.settings.speed.speedRacerStep() as any)
  : (parseInt(this.numberOfRepeats() as any) === 0 ? 0 : parseInt(this.numberOfRepeats() as any) + 1)
const addlSpaces = sr ? 0 : parseInt(this.morseVoice.speakFirstAdditionalWordspaces() as any)
const config = this.getMorseStringToWavBufferConfig(
  this.cardBufferManager.getNextMorse(repeats, addlSpaces)
)
```

`appendArrayNTimes` then queues exactly `step` copies of the card.

---

## Per-card sequence / state machine (`src/morse/morse.ts` — riskiest change)

Desired when `speedRacer()`: morse ×`step` at decreasing speed → **(if Voice+Recap on)**
speak answer → one final morse at Start speed → advance. **No bell.**

The existing recursion (`doPlay → play → playEnded → setTimeout → doPlay`) already plays
the buffer `repeats` times then advances, driven by `cardBufferManager.hasMoreMorse()`.
Speed Racer inserts a post-buffer phase that fires after `hasMoreMorse()` becomes false
but **before** `incrementIndex()`.

Add a plain VM field `speedRacerPhase: 'racing' | 'speaking' | 'final'` (default
`'racing'`), reset to `'racing'` in the `freshStart` block (~lines 502-514) and whenever a
new card begins. Weave a `switch` into `playEnded`'s `noDelays` branch at the
`if (!hasMoreMorse)` sub-branch (~line 661), where today it would `incrementIndex()`.

When `speedRacer()` and `!cardBufferManager.hasMoreMorse()`:

- **'racing'**: if `speedRacerVoiceRecap()` is **off** → fall through to the normal advance
  (incrementIndex, reset phase, existing `cardSpaceTimerHandle` setTimeout). If **on** →
  set phase `'speaking'`, build the phrase with the existing
  `getPhraseToSpeakFromBuffer()` + `prepPhraseToSpeakForFinal()` (same calls as lines
  562-564 / 724), call `this.morseVoice.speakPhrase(phrase, onDone)`; in `onDone` set phase
  `'final'` and re-enter the play path for the **same** card, then `return`.
- **'speaking' → 'final'**: re-populate the buffer with a single play
  (`cardBufferManager.populateBuffer(1, 0)` so `getServedIndex()` is 0 → Start WPM) and
  re-enter playback (e.g. `doPlay(true, false)`); the recap morse plays, `playEnded`
  re-enters, and `return`.
- **'final' → advance**: `incrementIndex()` (cardChanged=true), reset phase `'racing'`,
  then the existing `cardSpaceTimerHandle` `setTimeout(doPlay, cardSpace*1000)` advances
  (lines 677-680).

Each sub-phase ends by re-entering the single existing callback chain (speak callback →
player `onEnded`), so no new timers compete with `cardSpaceTimerHandle`/`doPlayTimeout`.

### Edge cases
- **speakFirst / trailReveal**: make Speed Racer mutually exclusive — when `speedRacer()`
  is on, bypass the `speakFirst` pre-speak path in `doPlay` (lines 557-571, treat as
  `!speakFirst()`) and the trail logic, so the new code is the only speaker. (Optionally
  disable those controls in the UI when Speed Racer is on — low priority.)
- **Voice unavailable**: `speakPhrase` has a try/catch that still calls its done callback
  (MorseVoice ~lines 271-278), so the `'speaking' → 'final'` transition won't stall.
- **Last card**: the speak + recap phases must still run on the last card *before*
  pausing. Run the phase machine on the last card too; only after `'final'` completes take
  the "nothing more to play" path (`doPause(true,false,false)`, lines 682-690).
- **Pause/stop mid-sequence**: `playEnded` already early-returns when `!playerPlaying()`
  (lines 606-612); the speak callback and the `'final'` re-entry must also check
  `this.playerPlaying()` before continuing, so a stop during the spoken answer or recap
  doesn't fire stray playback.
- **`voiceBuffer` accounting**: ensure `getPhraseToSpeakFromBuffer()` yields the current
  card's answer; clear the buffer after speaking each card (mirroring the speakFirst clear
  at line 664) so the next card speaks correctly.
- **cardSpace timing**: keep using the existing `cardSpaceTimerHandle` advance so card-wait
  spacing is unchanged.

---

## UI markup (`src/template.html`, Timing fieldset, lines 374-459)

Add a new `input-group flex-wrap` block after the speed-interval group (ends ~line 418),
near the Repeats group (lines 420-443). All controls gated `visible/enable:
settings.speed.speedRacer()` except the two toggles.

- **Speed Racer toggle** — copy the Speed Intervals `input.btn-check` + `label.btn`
  pattern (lines 381-392): id `btncheckspeedracer`, `checked: settings.speed.speedRacer`,
  label "Speed Racer", check/circle icon bound to `settings.speed.speedRacer()` (reuse an
  existing `morseLoadImages()` icon, e.g. `rocketTakeoffImage`).
- **Voice + Recap toggle** — same `btn-check` pattern: id `btncheckspeedracervoicerecap`,
  `checked: settings.speed.speedRacerVoiceRecap`, label "Voice + Recap", gated
  `visible: settings.speed.speedRacer()`.
- **Start WPM** — copy the Repeats number input (lines 424-430): `type="number"` min 1
  step 1, `textInput: settings.speed.speedRacerStartWpm`.
- **Multiplier dropdown** — voice `<select>` pattern (645-651):
  `options: settings.speed.speedRacerMultiplierOptions, value: settings.speed.speedRacerMultiplier`.
- **Step dropdown** — same, bound to `speedRacerStepOptions` / `speedRacerStep`.
- Add `label.input-group-text` captions ("Start WPM", "Multiplier", "Step"), each gated
  `visible: settings.speed.speedRacer()`, like the interval labels (396-412).

---

## Files to modify

| File | Role |
|------|------|
| `src/morse/settings/speedSettings.ts` | New observables + option arrays + cookie extenders; precedence branch in `getApplicableSpeed`; load in `handleCookies`. |
| `src/morse/morse.ts` | `doPlay` repeat-count + `additionalWordSpaces` override; the Speed Racer phase state machine in `playEnded`'s `!hasMoreMorse` branch; phase reset in `freshStart`; pause/stop guards. |
| `src/morse/utils/cardBufferManager.ts` | `_servedIndex` tracking + `getServedIndex()`. |
| `src/morse/settings/morseSettingsHandler.ts` | Five `SavedSettingsInfo` entries for settings export/import parity. |
| `src/template.html` | Timing-fieldset UI: two toggles + Start WPM + two dropdowns, gated on `speedRacer()`. |

No new bell file. Reuse existing speak primitives verbatim
(`getPhraseToSpeakFromBuffer`, `prepPhraseToSpeakForFinal`, `speakPhrase`).

## Risk note
The `playEnded` state machine is the riskiest area (interleaved `setTimeout`/callback
recursion with pause/stop/speakFirst/trail guards — the code even notes it is "getting a
little nasty"). Mitigations: gate **all** new logic strictly behind `speedRacer()` so the
existing path is byte-for-byte unchanged when off; make Speed Racer mutually exclusive with
speakFirst/trailReveal; drive sub-phases off the existing single callback chain (no new
competing timers).

---

## Verification

**Build/run:** `npm run dev` (webpack-dev-server) for manual testing; `npm run build` for a
production check; `npm run test` (vitest) for units; `npm run test:e2e` (playwright).

**Manual test recipe:**
1. `npm run dev`; load a lesson with multi-char cards (e.g. "bc1 lesson rea").
2. Settings → Timing → enable **Speed Racer**; Start WPM 30, Multiplier 1.5, Step 3,
   **Voice + Recap on**.
3. Play. Per card confirm: three morse plays at 30 → 20 → 13 WPM (audibly slowing), then
   the answer is spoken, then one fast (30 WPM) recap morse, then advance after card-wait.
   **No bell.**
4. Turn **Voice + Recap off**; confirm only the three decreasing-speed plays happen, then
   advance (no speech, no recap).
5. Override check: with Speed Racer on, enable Speed Intervals and set Repeats — confirm
   Speed Racer's speeds and step count win (intervals + Repeats ignored).
6. Reload the page — confirm both toggles, Start WPM, Multiplier, Step persist (cookies).
7. Pause/stop mid-sequence (during a slow play and during the spoken answer) — confirm no
   stray morse/speech fires after stop and no stuck timers.
8. Last card — confirm speak + recap run before playback stops.

## Branch / delivery
Develop on `claude/morse-ninja-speed-racing-PXnlm`, commit with a descriptive message, and
push with `git push -u origin claude/morse-ninja-speed-racing-PXnlm`. No PR unless
requested.
