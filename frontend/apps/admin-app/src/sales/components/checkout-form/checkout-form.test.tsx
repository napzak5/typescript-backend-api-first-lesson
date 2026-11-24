import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import {
  columnsOf,
  optionsOf,
  rowsOf,
} from '@beauty-salon-frontend/testing/screens'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { services, staff } from '../examples'
import type { OfferedService } from './checkout-form'
import * as checkoutFormStories from './checkout-form.stories'

const stories = composeStories(checkoutFormStories)

const toAdd = (): HTMLElement =>
  screen.getByRole('combobox', { name: '足す施術' })

const cashier = (): HTMLElement =>
  screen.getByRole('combobox', { name: '会計の担当' })

describe('CheckoutForm', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should bill what the booking was booked for, with the amounts and the kinds of payment that take the total at once', async () => {
    // Act
    await stories.AsBooked.run()

    // Assert
    expect(rowsOf('予約の施術')).toEqual([
      ['カット', '田中 美咲', '￥5,500', '￥0'],
    ])
    expect(rowsOf('足した施術')).toEqual([
      ['予約にない施術をしたときは、メニューから足してください'],
    ])
    const amounts = screen
      .getByRole('heading', { name: '金額' })
      .closest('section')
    expect(
      within(amounts ?? document.body)
        .getAllByRole('definition')
        .map((one) => one.textContent),
    ).toEqual([
      '￥5,500',
      '￥0',
      '￥0',
      '￥5,500',
      '現金、クレジットカード、電子マネー',
    ])
    expect(screen.getByRole('button', { name: '会計を入れる' })).toBeEnabled()
  })

  it('should offer every service of the menu with its price, and the staff with nobody', async () => {
    // Act
    await stories.AsBooked.run()

    // Assert
    expect(optionsOf(toAdd())).toEqual([
      'カット（￥5,500）',
      'カラー（￥8,800）',
    ])
    expect(toAdd()).toHaveAccessibleDescription(
      'いまのメニューの料金で数えます。担当は、予約の担当です。',
    )
    expect(optionsOf(cashier())).toEqual(['田中 美咲', '佐藤 健', '記録しない'])
    expect(cashier()).toHaveValue(staff[0]?.id)
  })

  it('should add the service that is chosen', async () => {
    // Arrange
    const onAdd = vi.fn<(service: OfferedService) => void>()
    await stories.AsBooked.run({
      args: { ...stories.AsBooked.args, onAdd },
    })
    await userEvent.selectOptions(toAdd(), 'カラー（￥8,800）')

    // Act
    await userEvent.click(screen.getByRole('button', { name: '施術を足す' }))

    // Assert
    expect(onAdd).toHaveBeenCalledExactlyOnceWith(services[1])
  })

  it('should add nothing where the menu offers nothing', async () => {
    // Arrange
    const onAdd = vi.fn<(service: OfferedService) => void>()
    await stories.NothingOffered.run({
      args: { ...stories.NothingOffered.args, onAdd },
    })
    expect(within(toAdd()).queryAllByRole('option')).toEqual([])

    // Act
    await userEvent.click(screen.getByRole('button', { name: '施術を足す' }))

    // Assert
    expect(onAdd).not.toHaveBeenCalled()
  })

  it('should say that no kind of payment takes the total at once', async () => {
    // Act
    await stories.NoneRecommended.run()

    // Assert
    const amounts = screen
      .getByRole('heading', { name: '金額' })
      .closest('section')
    expect(
      within(amounts ?? document.body)
        .getAllByRole('definition')
        .map((one) => one.textContent)
        .at(-1),
    ).toBe('なし')
  })

  it('should list what was added, say so, and take it off again with the focus on the choice of a service', async () => {
    // Arrange
    const onRemove = vi.fn<(index: number, name: string) => void>()
    await stories.WithAddition.run({
      args: { ...stories.WithAddition.args, onRemove },
    })
    expect(rowsOf('足した施術')).toEqual([
      ['カラー', '佐藤 健', '￥8,800', '￥800', '外す'],
    ])
    expect(screen.getByRole('status').textContent).toBe('カラーを足しました。')

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: 'カラー（1 件目）を外す' }),
    )

    // Assert
    expect(onRemove).toHaveBeenCalledExactlyOnceWith(0, 'カラー')
    expect(toAdd()).toHaveFocus()
  })

  it('should name a service that was removed from the menu as such', async () => {
    // Act
    await stories.WithRemovedService.run()

    // Assert
    expect(rowsOf('予約の施術')).toEqual([
      ['削除されたメニュー', '田中 美咲', '￥5,500', '￥0'],
    ])
  })

  it('should say the amounts are on their way', async () => {
    // Act
    await stories.Calculating.run()

    // Assert
    expect(screen.getByText('金額を計算しています')).toBeVisible()
  })

  it.each<[string, 'Uncalculated' | 'Unread', string, string]>([
    [
      'a bill the API would not calculate',
      'Uncalculated',
      'カラーは、メニューから削除されていました。外してください。',
      '計算し直す',
    ],
    [
      'amounts that could not be asked for',
      'Unread',
      '金額を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
      'もう一度読み込む',
    ],
  ])(
    'should say why there are no amounts for %s, and ask again',
    async (_case, story, why, again) => {
      // Arrange
      const onRecalculate = vi.fn<() => void>()
      await stories[story].run({
        args: { ...stories[story].args, onRecalculate },
      })
      expect(screen.getByText(why)).toBeVisible()

      // Act
      await userEvent.click(screen.getByRole('button', { name: again }))

      // Assert
      expect(onRecalculate).toHaveBeenCalledOnce()
    },
  )

  it('should hand over who took the payment and the note, nobody as such', async () => {
    // Arrange
    const received: [string, FormDataEntryValue][][] = []
    await stories.AsBooked.run({
      args: {
        ...stories.AsBooked.args,
        onSubmit: vi.fn((values: FormData) => {
          received.push(
            Array.from(values.entries()).filter(
              ([name]) => name !== 'serviceToAdd',
            ),
          )
        }),
      },
    })
    await userEvent.selectOptions(cashier(), '記録しない')
    await userEvent.type(screen.getByLabelText('メモ'), '現金とカードで')

    // Act
    await userEvent.click(screen.getByRole('button', { name: '会計を入れる' }))

    // Assert
    expect(received).toEqual([
      [
        ['staffId', 'none'],
        ['notes', '現金とカードで'],
      ],
    ])
  })

  it('should say what the API refused at its control, and take the focus there', async () => {
    // Act
    await stories.WithErrors.run()

    // Assert
    expect(
      screen.getByText('入力した内容を確かめて、もう一度お試しください。'),
    ).toBeVisible()
    expect(cashier()).toHaveAccessibleDescription(
      expect.stringContaining(
        'このスタッフは、もう選べません。選び直してください。',
      ),
    )
    expect(cashier()).toHaveFocus()
    expect(cashier()).toHaveValue('none')
  })
})

describe('CheckoutForm on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should bill what the booking was booked for, with the amounts, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.AsBooked.run()

    // Assert
    expect(columnsOf('Booked services')).toEqual([
      'Service',
      'Staff',
      'Price',
      'Discount',
    ])
    expect(rowsOf('Booked services')).toEqual([
      ['カット', '田中 美咲', '¥5,500', '¥0'],
    ])
    expect(rowsOf('Added services')).toEqual([
      ['Add the services that were done beyond the booking from the menu'],
    ])
    const amounts = screen
      .getByRole('heading', { name: 'Amounts' })
      .closest('section')
    expect(
      within(amounts ?? document.body)
        .getAllByRole('term')
        .map((term) => [
          term.textContent,
          term.nextElementSibling?.textContent,
        ]),
    ).toEqual([
      ['Subtotal', '¥5,500'],
      ['Discount', '¥0'],
      ['Tax', '¥0'],
      ['Total', '¥5,500'],
      [
        'Payment methods that take the total at once',
        'Cash, Credit card, E-money',
      ],
    ])
    expect(
      screen.getByRole('combobox', { name: 'Service to add' }),
    ).toHaveAccessibleDescription(
      'Counted at the price of the menu now, done by the staff member of the booking.',
    )
    expect(
      optionsOf(screen.getByRole('combobox', { name: 'Service to add' })),
    ).toEqual(['カット (¥5,500)', 'カラー (¥8,800)'])
    expect(
      optionsOf(screen.getByRole('combobox', { name: 'Cashier' })),
    ).toEqual(['田中 美咲', '佐藤 健', 'Not recorded'])
    expect(screen.getByRole('button', { name: 'Check out' })).toBeEnabled()
  })

  it('should list what was added, say so, and name its button in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.WithAddition.run()

    // Assert
    expect(rowsOf('Added services')).toEqual([
      ['カラー', '佐藤 健', '¥8,800', '¥800', 'Remove'],
    ])
    expect(screen.getByRole('status').textContent).toBe('Added カラー.')
    expect(
      screen.getByRole('button', { name: 'Remove カラー (line 1)' }),
    ).toBeVisible()
  })

  it('should name a service that was removed from the menu as such in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.WithRemovedService.run()

    // Assert
    expect(rowsOf('Booked services')).toEqual([
      ['Removed service', '田中 美咲', '¥5,500', '¥0'],
    ])
  })

  it('should say why there are no amounts, and ask again, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Uncalculated.run()

    // Assert
    expect(
      screen.getByText('カラー was removed from the menu. Take it off.'),
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Calculate again' }),
    ).toBeVisible()
  })

  it('should say what the API refused at its control in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.WithErrors.run()

    // Assert
    expect(
      screen.getByText('Check what you entered and try again.'),
    ).toBeVisible()
    expect(
      screen.getByRole('combobox', { name: 'Cashier' }),
    ).toHaveAccessibleDescription(
      expect.stringContaining(
        'This staff member can no longer be chosen. Choose again.',
      ),
    )
  })
})
