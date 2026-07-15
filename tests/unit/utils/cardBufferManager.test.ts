import { describe, expect, it } from 'vitest'
import { CardBufferManager } from '../../../src/morse/utils/cardBufferManager'

function createBufferManager (displayWord = 'A') {
  return new CardBufferManager(
    () => 0,
    () => [{ displayWord, speakText: () => displayWord } as never]
  )
}

function shiftAudiblePlays (mgr:CardBufferManager, repeats:number, wordSpaces:number) {
  const indices:number[] = []
  // Mirrors doPlay: getNextMorse populates the buffer on first call.
  let next = mgr.getNextMorse(repeats, wordSpaces)
  while (next !== undefined) {
    if (next.length > 0) {
      indices.push(mgr.getRepeatState().index)
    }
    if (!mgr.hasMoreMorse()) {
      break
    }
    next = mgr.getNextMorse(repeats, wordSpaces)
  }
  return indices
}

describe('CardBufferManager Speed Racer repeat spacing', () => {
  it('does not leave a trailing wordspace after the last audible play', () => {
    const mgr = createBufferManager()
    shiftAudiblePlays(mgr, 5, 1)
    expect(mgr.hasMoreMorse()).toBe(false)
  })

  it('emits exactly one audible play index per Speed Racer slot', () => {
    const mgr = createBufferManager()
    const indices = shiftAudiblePlays(mgr, 5, 1)
    expect(indices).toEqual([0, 1, 2, 3, 4])
  })

  it('interleaves silent wordspace gaps between repeats only', () => {
    const mgr = createBufferManager()
    const words:string[] = []
    let next = mgr.getNextMorse(3, 1)
    while (next !== undefined) {
      words.push(next)
      if (!mgr.hasMoreMorse()) {
        break
      }
      next = mgr.getNextMorse(3, 1)
    }
    expect(words).toEqual(['A', '', 'A', '', 'A'])
  })

  it('treats a Keep Lines multi-word card as one audible unit per Speed Racer step', () => {
    const mgr = createBufferManager('THE QUICK BROWN FOX JUMPS')
    const plays:Array<{ word:string, index:number }> = []
    let next = mgr.getNextMorse(4, 1)
    while (next !== undefined) {
      if (next.length > 0) {
        plays.push({ word: next, index: mgr.getRepeatState().index })
      }
      if (!mgr.hasMoreMorse()) {
        break
      }
      next = mgr.getNextMorse(4, 1)
    }
    expect(plays).toEqual([
      { word: 'THE QUICK BROWN FOX JUMPS', index: 0 },
      { word: 'THE QUICK BROWN FOX JUMPS', index: 1 },
      { word: 'THE QUICK BROWN FOX JUMPS', index: 2 },
      { word: 'THE QUICK BROWN FOX JUMPS', index: 3 }
    ])
  })

  it('does not advance Speed Racer multipliers per word inside a Keep Lines phrase', () => {
    const mgr = createBufferManager('ONE TWO THREE FOUR FIVE')
    const indices = shiftAudiblePlays(mgr, 4, 0)
    // Bug was [0,1,2,3,4] (one index per word of the first pass). Correct is
    // one index per full-phrase ladder step.
    expect(indices).toEqual([0, 1, 2, 3])
  })
})
