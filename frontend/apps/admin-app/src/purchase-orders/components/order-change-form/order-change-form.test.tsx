import {
  itShouldBeAccessibleInEveryStory,
  itShouldBeSentByTheEnterKey,
} from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import * as orderChangeFormStories from './order-change-form.stories'

const stories = composeStories(orderChangeFormStories)

const day = (): HTMLElement => screen.getByLabelText('納品予定日')

const box = (name: string): HTMLElement => screen.getByRole('textbox', { name })

describe('OrderChangeForm', () => {
  itShouldBeAccessibleInEveryStory(stories)

  itShouldBeSentByTheEnterKey(stories.Filled, () =>
    screen.getByLabelText('納品予定日'),
  )

  it('should open with the day of the delivery at the salon and the notes the order holds', async () => {
    // Act
    await stories.Filled.run()

    // Assert
    expect(day()).toHaveAttribute('type', 'date')
    expect(day()).toHaveValue('2026-11-27')
    expect(day()).toHaveAccessibleDescription(
      '任意。仕入先が約束した日。空にすると、未定になります。',
    )
    expect(box('納品のメモ')).toHaveValue('')
    expect(box('メモ')).toHaveValue(
      '年末の繁忙期の分。\n届いたら、バックヤードの棚 B-2 へ。',
    )
  })

  it('should open empty for an order with nothing written down yet', async () => {
    // Act
    await stories.Empty.run()

    // Assert
    expect(day()).toHaveValue('')
    expect(box('納品のメモ')).toHaveValue('')
    expect(box('メモ')).toHaveValue('')
  })

  it('should hand over what the controls hold', async () => {
    // Arrange
    await stories.Filled.run()

    // Act
    await userEvent.type(box('納品のメモ'), '午前中に')
    await userEvent.clear(box('メモ'))
    await userEvent.click(
      screen.getByRole('button', { name: '変更を保存する' }),
    )

    // Assert
    const handed = vi
      .mocked(stories.Filled.args.onSubmit ?? (() => undefined))
      .mock.calls.map(([values]) => Object.fromEntries(values.entries()))
    expect(handed).toEqual([
      { expectedDelivery: '2026-11-27', deliveryNotes: '午前中に', notes: '' },
    ])
  })

  it('should say what is wrong with the day at its control', async () => {
    // Act
    await stories.WithErrors.run()

    // Assert
    expect(day()).toHaveAccessibleDescription(
      expect.stringContaining('日付を入力してください。'),
    )
  })

  it('should show that the changes are on their way', async () => {
    // Act
    await stories.Sending.run()

    // Assert
    expect(
      screen.getByRole('button', { name: '変更を保存する' }),
    ).toHaveAttribute('aria-busy', 'true')
  })
})
