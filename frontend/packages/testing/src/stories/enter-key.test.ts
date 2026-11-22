import { screen } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import { itShouldBeSentByTheEnterKey, sendingsOnEnter } from './enter-key'

/** A form of the controls given, put on the page */
const showForm = (controls: string): void => {
  document.body.innerHTML = `<form>${controls}</form>`
}

const NAME = '<label>お名前 <input type="text" name="name"></label>'
const PHONE = '<label>電話番号 <input type="tel" name="phone"></label>'
const NOTES = '<label>メモ <textarea name="notes"></textarea></label>'
const SEND = '<button type="submit">送る</button>'

afterEach(() => {
  document.body.replaceChildren()
})

describe('sendingsOnEnter', () => {
  it('should count one sending in a form that has a button that sends it', async () => {
    // Arrange
    showForm(NAME + PHONE + SEND)

    // Act
    const sendings = await sendingsOnEnter(
      screen.getByRole('textbox', { name: 'お名前' }),
    )

    // Assert
    expect(sendings).toBe(1)
  })

  it('should count one sending in a form whose only one-line control it is', async () => {
    // Arrange
    showForm(NAME + NOTES)

    // Act
    const sendings = await sendingsOnEnter(
      screen.getByRole('textbox', { name: 'お名前' }),
    )

    // Assert
    expect(sendings).toBe(1)
  })

  it('should count none in a form of two one-line controls and no button', async () => {
    // Arrange
    showForm(NAME + PHONE)

    // Act
    const sendings = await sendingsOnEnter(
      screen.getByRole('textbox', { name: 'お名前' }),
    )

    // Assert
    expect(sendings).toBe(0)
  })

  it('should count none in a text area, which takes a line', async () => {
    // Arrange
    showForm(NOTES + SEND)

    // Act
    const sendings = await sendingsOnEnter(
      screen.getByRole('textbox', { name: 'メモ' }),
    )

    // Assert
    expect(sendings).toBe(0)
  })
})

describe('itShouldBeSentByTheEnterKey', () => {
  itShouldBeSentByTheEnterKey(
    {
      run: async () => {
        showForm(NAME + PHONE + SEND)
      },
    },
    () => screen.getByRole('textbox', { name: '電話番号' }),
  )
})
