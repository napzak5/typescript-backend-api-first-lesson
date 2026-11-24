import { fieldMessages } from '@beauty-salon-shared/i18n/messages/ui'
import { describe, expect, it } from 'vitest'
import {
  aboutTheAttempt,
  errorAt,
  formValuesOf,
  NO_ERRORS,
  NOTHING_TO_SAY,
  same,
  textOf,
  textOrNull,
  textsOf,
} from './form-values'

describe('formValuesOf', () => {
  it('should give the values of the form a part is in, as it would be sent now', () => {
    // Arrange
    const form = document.createElement('form')
    const part = document.createElement('fieldset')
    const name = document.createElement('input')
    name.name = 'name'
    name.value = '山田'
    part.append(name)
    form.append(part)

    // Act
    const values = formValuesOf(part)

    // Assert
    expect([...values.entries()]).toEqual([['name', '山田']])
  })

  it('should give no values for a control that is in no form', () => {
    // Arrange
    const button = document.createElement('button')

    // Act
    const values = formValuesOf(button)

    // Assert
    expect([...values.entries()]).toEqual([])
  })
})

describe('textOf', () => {
  it('should give the text of a control', () => {
    const values = new FormData()
    values.set('name', ' 山田 ')

    expect(textOf(values, 'name')).toBe(' 山田 ')
  })

  it('should give nothing for a control that is not there', () => {
    expect(textOf(new FormData(), 'name')).toBe('')
  })

  it('should give nothing for a control that holds a file', () => {
    const values = new FormData()
    values.set('photo', new File(['png'], 'photo.png', { type: 'image/png' }))

    expect(textOf(values, 'photo')).toBe('')
  })
})

describe('textsOf', () => {
  it('should give the texts of the controls of a name in their order, and no file', () => {
    // Arrange
    const values = new FormData()
    values.append('services', 'cut')
    values.append(
      'services',
      new File(['png'], 'photo.png', { type: 'image/png' }),
    )
    values.append('services', 'color')
    values.set('notes', '前髪は短め')

    // Act
    const texts = textsOf(values, 'services')

    // Assert
    expect(texts).toEqual(['cut', 'color'])
  })

  it('should give none for a name that no control has', () => {
    // Act, Assert
    expect(textsOf(new FormData(), 'services')).toEqual([])
  })
})

describe('textOrNull', () => {
  it.each<[string | null, string | null]>([
    [' 前髪は短め ', '前髪は短め'],
    ['前髪は短め', '前髪は短め'],
    ['', null],
    ['  \n ', null],
    [null, null],
  ])('should make %j %j', (text, expected) => {
    expect(textOrNull(text)).toBe(expected)
  })
})

describe('errorAt', () => {
  it('should name the control with what is wrong with it', () => {
    expect(errorAt('lines.0.date', '日付を入力してください。')).toEqual([
      ['lines.0.date', '日付を入力してください。'],
    ])
  })

  it('should name no control when nothing is wrong', () => {
    expect(errorAt('lines.0.date', undefined)).toEqual([])
  })

  it('should name the control with a message, as a form whose texts are messages says it', () => {
    expect(errorAt('email', fieldMessages.emailMissing)).toEqual([
      ['email', fieldMessages.emailMissing],
    ])
  })
})

describe('same', () => {
  it('should find values with the same properties the same', () => {
    expect(
      same(
        { name: 'カット', options: [{ name: 'シャンプー', price: 500 }] },
        { name: 'カット', options: [{ name: 'シャンプー', price: 500 }] },
      ),
    ).toBe(true)
  })

  it.each<[unknown, unknown]>([
    [{ name: 'カット' }, { name: 'カラー' }],
    [{ name: 'カット', notes: null }, { name: 'カット' }],
    [
      [1, 2],
      [2, 1],
    ],
    [null, {}],
  ])('should find %j and %j different', (one, other) => {
    expect(same(one, other)).toBe(false)
  })
})

describe('what a form says', () => {
  it('should say nothing before an attempt', () => {
    expect(NOTHING_TO_SAY).toEqual({ message: undefined, errors: {} })
  })

  it('should give one object for no errors, the one it says before an attempt', () => {
    expect(NO_ERRORS).toEqual({})
    expect(NOTHING_TO_SAY.errors).toBe(NO_ERRORS)
  })

  it('should say something about the attempt, and nothing at its controls', () => {
    expect(aboutTheAttempt('保存できませんでした。')).toEqual({
      message: '保存できませんでした。',
      errors: {},
    })
  })

  it('should say a message about the attempt as it is, for a form whose texts are messages', () => {
    expect(aboutTheAttempt(fieldMessages.emailMissing)).toEqual({
      message: fieldMessages.emailMissing,
      errors: {},
    })
  })
})
