import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import { SALE_GIVEN_FOR } from '../examples'
import * as pointEntryFormStories from './point-entry-form.stories'

const stories = composeStories(pointEntryFormStories)

const kinds = (): string[] =>
  within(screen.getByRole('radiogroup', { name: '記録すること' }))
    .getAllByRole('radio')
    .map((radio) => radio.getAttribute('value') ?? '')

describe('PointEntryForm', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should offer the counter what it records, with the balance and the day of expiry of points given', async () => {
    // Act
    await stories.Counter.run()

    // Assert
    expect(kinds()).toEqual(['earned', 'used'])
    expect(
      screen.getByRole('radio', { name: 'ポイントを付与する' }),
    ).toBeChecked()
    expect(
      screen.getByRole('textbox', { name: 'ポイント数' }),
    ).toHaveAccessibleDescription(
      '1 以上の整数で入れます。減らすときも、減らす数を入れます。いまの残高は 2,700 ポイントです。',
    )
    const expiry = screen.getByLabelText('有効期限')
    expect(expiry).toHaveAttribute('type', 'date')
    expect(expiry).toHaveAttribute('min', '2026-11-20')
    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  it('should offer an owner or a manager the adjustments too', async () => {
    // Act
    await stories.Adjusting.run()

    // Assert
    expect(
      within(screen.getByRole('radiogroup', { name: '記録すること' }))
        .getAllByRole('radio')
        .map((radio) => radio.closest('label')?.textContent),
    ).toEqual([
      'ポイントを付与する',
      '使ったポイントを記録する',
      '調整で増やす',
      '調整で減らす',
    ])
  })

  it('should take the day of expiry away while points are not given', async () => {
    // Arrange
    await stories.Adjusting.run()

    // Act
    await userEvent.click(screen.getByRole('radio', { name: '調整で増やす' }))

    // Assert
    expect(screen.queryByLabelText('有効期限')).toBeNull()

    // Act
    await userEvent.click(
      screen.getByRole('radio', { name: 'ポイントを付与する' }),
    )

    // Assert
    expect(screen.getByLabelText('有効期限')).toBeVisible()
  })

  it('should open on what the sale asks for, and send the sale while its box is checked', async () => {
    // Arrange
    const received: [string, FormDataEntryValue][][] = []
    await stories.ForSale.run({
      args: {
        ...stories.ForSale.args,
        onSubmit: vi.fn((values: FormData) => {
          received.push(Array.from(values.entries()))
        }),
      },
    })
    const box = screen.getByRole('checkbox', {
      name: '売上番号 SL-2KQM-9F4H（2026年11月20日（金） 11:02、￥5,500）に結びつける',
    })
    expect(
      screen.getByRole('radio', { name: '使ったポイントを記録する' }),
    ).toBeChecked()
    expect(box).toBeChecked()
    await userEvent.type(
      screen.getByRole('textbox', { name: 'ポイント数' }),
      '300',
    )

    // Act
    await userEvent.click(screen.getByRole('button', { name: '記録する' }))

    // Assert
    expect(received).toEqual([
      [
        ['kind', 'used'],
        ['points', '300'],
        ['description', ''],
        ['saleId', SALE_GIVEN_FOR],
      ],
    ])
  })

  it('should send no sale once its box is unchecked', async () => {
    // Arrange
    const received: [string, FormDataEntryValue][][] = []
    await stories.ForSale.run({
      args: {
        ...stories.ForSale.args,
        onSubmit: vi.fn((values: FormData) => {
          received.push(Array.from(values.entries()))
        }),
      },
    })
    await userEvent.type(
      screen.getByRole('textbox', { name: 'ポイント数' }),
      '300',
    )

    // Act
    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(screen.getByRole('button', { name: '記録する' }))

    // Assert
    expect(received).toEqual([
      [
        ['kind', 'used'],
        ['points', '300'],
        ['description', ''],
      ],
    ])
  })

  it('should say why the sale of the address is not offered', async () => {
    // Act
    await stories.UnusableSale.run()

    // Assert
    expect(screen.getByRole('status')).toHaveTextContent(
      'この売上は取り消されているため、ポイントを結びつけません。',
    )
    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  it('should say at the count what the API refused of it', async () => {
    // Act
    await stories.Refused.run()

    // Assert
    expect(
      screen.getByRole('textbox', { name: 'ポイント数' }),
    ).toHaveAccessibleDescription(
      expect.stringContaining('残高（2,700 ポイント）より多くは減らせません。'),
    )
    expect(screen.getByRole('textbox', { name: 'ポイント数' })).toBeInvalid()
  })
})
