import { describe, expect, it } from 'vitest'
import { choiceOf, UNLISTED_MESSAGE } from './choices'

const SIZES: readonly ('small' | 'large')[] = ['small', 'large']

describe('choiceOf', () => {
  it.each<[string, string, 'small' | 'large' | null | undefined]>([
    ['one of the values', 'large', 'large'],
    ['nothing for a control left empty', '', null],
    ['no value for a text that is none of them', 'medium', undefined],
    ['no value for a value written in other letters', 'Large', undefined],
  ])('should give %s', (_case, text, value) => {
    expect(choiceOf(SIZES, text)).toBe(value)
  })
})

describe('UNLISTED_MESSAGE', () => {
  it('should ask for one of the choices', () => {
    expect(UNLISTED_MESSAGE).toEqual({
      en: 'Choose one of the options.',
      ja: '選択肢から選んでください。',
    })
  })
})
