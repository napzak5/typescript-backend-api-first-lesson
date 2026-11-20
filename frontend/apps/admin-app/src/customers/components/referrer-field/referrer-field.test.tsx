import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import * as referrerFieldStories from './referrer-field.stories'

const stories = composeStories(referrerFieldStories)

const field = (): HTMLElement => screen.getByRole('textbox', { name: '紹介元' })

/** What the form sends for the referrer */
const sent = (): string | null =>
  document.querySelector<HTMLInputElement>('input[name="referredBy"]')?.value ??
  null

describe('ReferrerField', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say that nobody referred the customer, and offer only to choose one', async () => {
    // Act
    await stories.Nobody.run()

    // Assert
    expect(field()).toHaveValue('なし')
    expect(field()).toHaveAttribute('readonly')
    expect(sent()).toBe('')
    expect(
      screen.getAllByRole('button').map((button) => button.textContent),
    ).toEqual(['紹介元を選ぶ'])
  })

  it('should name the customer who referred them and send their ID', async () => {
    // Act
    await stories.Chosen.run()

    // Assert
    expect(field()).toHaveValue('鈴木 一郎 様')
    expect(sent()).toBe('c19f4d7a-6e8c-4adf-8dbe-ac7e3f6a8bc5')
    expect(
      screen.getAllByRole('button').map((button) => button.textContent),
    ).toEqual(['紹介元を選ぶ', '紹介元を外す'])
  })

  it('should keep the ID of a referrer who was removed, saying they are not in the ledger', async () => {
    // Act
    await stories.Gone.run()

    // Assert
    expect(field()).toHaveValue('台帳にいないお客様')
    expect(sent()).toBe('c19f4d7a-6e8c-4adf-8dbe-ac7e3f6a8bc5')
    expect(
      screen.getAllByRole('button').map((button) => button.textContent),
    ).toEqual(['紹介元を選ぶ', '紹介元を外す'])
  })

  it('should open the choice when it is asked for', async () => {
    // Arrange
    const onChoose = vi.fn()
    await stories.Nobody.run({ args: { ...stories.Nobody.args, onChoose } })

    // Act
    await userEvent.click(screen.getByRole('button', { name: '紹介元を選ぶ' }))

    // Assert
    expect(onChoose).toHaveBeenCalledOnce()
  })

  it('should take the referrer away and leave the focus on the choice', async () => {
    // Arrange
    const onRemove = vi.fn()
    await stories.Chosen.run({ args: { ...stories.Chosen.args, onRemove } })

    // Act
    await userEvent.click(screen.getByRole('button', { name: '紹介元を外す' }))

    // Assert
    expect(onRemove).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: '紹介元を選ぶ' })).toHaveFocus()
  })

  it('should say what is wrong with the referrer at the field', async () => {
    // Act
    await stories.WithError.run()

    // Assert
    expect(field()).toHaveAttribute('aria-invalid', 'true')
    expect(field()).toHaveAccessibleDescription(
      expect.stringContaining(
        '選んだお客様は、台帳にいません。紹介元を選び直すか、外してください。',
      ),
    )
  })
})
