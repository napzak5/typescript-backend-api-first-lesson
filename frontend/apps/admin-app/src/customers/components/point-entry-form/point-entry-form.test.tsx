import { languageStore } from '@beauty-salon-frontend/io'
import {
  itShouldBeAccessibleInEveryStory,
  itShouldBeSentByTheEnterKey,
} from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SALE_GIVEN_FOR } from '../examples'
import * as pointEntryFormStories from './point-entry-form.stories'

const stories = composeStories(pointEntryFormStories)

const kinds = (): string[] =>
  within(screen.getByRole('radiogroup', { name: '記録すること' }))
    .getAllByRole('radio')
    .map((radio) => radio.getAttribute('value') ?? '')

describe('PointEntryForm', () => {
  itShouldBeAccessibleInEveryStory(stories)

  itShouldBeSentByTheEnterKey(stories.Counter, () =>
    screen.getByRole('textbox', { name: 'ポイント数' }),
  )

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
      'アドレスの売上は取り消されています。取り消した売上には、ポイントを付与も利用もできないため、売上に結びつけずに記録します。',
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

describe('PointEntryForm on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should offer what it records, with the balance, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Adjusting.run()

    // Assert
    expect(
      within(screen.getByRole('radiogroup', { name: 'What to record' }))
        .getAllByRole('radio')
        .map((radio) => radio.closest('label')?.textContent),
    ).toEqual([
      'Give points',
      'Record points used',
      'Add by an adjustment',
      'Take away by an adjustment',
    ])
    expect(
      screen.getByRole('textbox', { name: 'Points' }),
    ).toHaveAccessibleDescription(
      'Enter a whole number of 1 or more. To take points away, enter how many to take away. The balance is now 2,700 points.',
    )
    expect(screen.getByLabelText('Expiry date')).toHaveAccessibleDescription(
      'The points given can be used until this day. Leave it empty for no expiry date.',
    )
    expect(
      screen.getByRole('textbox', { name: 'Description' }),
    ).toHaveAccessibleDescription(
      'It is kept in the point history. For an adjustment, write the reason.',
    )
    expect(screen.getByRole('button', { name: 'Record' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Cancel' })).toBeVisible()
  })

  it('should offer the sale of the address in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.ForSale.run()

    // Assert
    expect(
      screen.getByRole('checkbox', {
        name: 'Link to sale SL-2KQM-9F4H (Fri, November 20, 2026 at 11:02, ¥5,500)',
      }),
    ).toHaveAccessibleDescription(
      'For each sale, points can be given once and points used can be recorded once.',
    )
  })

  it('should say in English why the sale is not offered, and what the API refused', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.UnusableSale.run()

    // Assert
    expect(screen.getByRole('status')).toHaveTextContent(
      'The sale in the address was voided. Points cannot be given or used for a voided sale, so they will be recorded without a sale.',
    )

    // Act
    await stories.Refused.run()

    // Assert
    expect(
      screen.getByRole('textbox', { name: 'Points' }),
    ).toHaveAccessibleDescription(
      expect.stringContaining(
        'You cannot take away more than the balance (2,700 points).',
      ),
    )
  })
})
