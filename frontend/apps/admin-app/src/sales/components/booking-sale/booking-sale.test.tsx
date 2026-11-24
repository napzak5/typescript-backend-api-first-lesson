import type { ModelsBookingStatusType } from '@beauty-salon-frontend/api-client'
import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { aSale, salon } from '../examples'
import * as bookingSaleStories from './booking-sale.stories'

const stories = composeStories(bookingSaleStories)

const part = (title = '会計'): HTMLElement => {
  const section = screen
    .getByRole('heading', { name: title })
    .closest('section')

  return section ?? document.body
}

describe('BookingSale', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it.each<[ModelsBookingStatusType]>([['in_progress'], ['completed']])(
    'should lead a visit that is %s to its checkout',
    async (status) => {
      // Act
      await stories.Unbilled.run({
        args: { ...stories.Unbilled.args, booking: { status } },
      })

      // Assert
      expect(
        within(part()).getByText('まだ会計を入れていません。'),
      ).toBeVisible()
      expect(
        within(part()).getByRole('link', { name: '会計を入れる' }),
      ).toHaveAttribute(
        'href',
        `/salons/${salon.id}/bookings/${aSale().bookingId}/checkout`,
      )
    },
  )

  it('should show the sale that bills the visit, and not the one that was voided', async () => {
    // Act
    await stories.Billed.run()

    // Assert
    expect(
      within(part())
        .getAllByRole('definition')
        .map((one) => one.textContent),
    ).toEqual(['SL-2KQM-9F4H', '￥5,500', '一部受け取り'])
    expect(
      within(part()).getByRole('link', { name: 'SL-2KQM-9F4H' }),
    ).toHaveAttribute('href', `/salons/${salon.id}/sales/${aSale().id}`)
    expect(
      within(part()).queryByRole('link', { name: '会計を入れる' }),
    ).toBeNull()
  })

  it.each<['Upcoming' | 'Cancelled', string]>([
    ['Upcoming', '会計は、施術を始めると入れられます。'],
    ['Cancelled', 'キャンセルした予約には、会計を入れません。'],
  ])(
    'should say why a booking that is %s takes no checkout',
    async (story, why) => {
      // Act
      await stories[story].run()

      // Assert
      expect(within(part()).getByText(why)).toBeVisible()
      expect(
        within(part()).queryByRole('link', { name: '会計を入れる' }),
      ).toBeNull()
    },
  )

  it('should say the sales are on their way', async () => {
    // Act
    await stories.Loading.run()

    // Assert
    expect(within(part()).getByText('会計を読み込んでいます')).toBeVisible()
  })

  it('should say the sales could not be read, and read them again', async () => {
    // Arrange
    const onRetry = vi.fn<() => void>()
    await stories.Unread.run({ args: { ...stories.Unread.args, onRetry } })

    // Act
    await userEvent.click(
      within(part()).getByRole('button', { name: 'もう一度読み込む' }),
    )

    // Assert
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('should say that the checkout of the booking is not for this account when its sales were refused', async () => {
    // Act
    await stories.Refused.run()

    // Assert
    expect(
      within(part()).getByText('この予約の会計は、見られません。'),
    ).toBeVisible()
    expect(within(part()).queryByRole('link')).toBeNull()
  })
})

describe('BookingSale on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should lead a visit to its checkout in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Unbilled.run()

    // Assert
    expect(
      within(part('Checkout')).getByText('Not checked out yet.'),
    ).toBeVisible()
    expect(
      within(part('Checkout')).getByRole('link', { name: 'Check out' }),
    ).toBeVisible()
  })

  it('should show the sale that bills the visit in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Billed.run()

    // Assert
    expect(
      within(part('Checkout'))
        .getAllByRole('term')
        .map((term) => [
          term.textContent,
          term.nextElementSibling?.textContent,
        ]),
    ).toEqual([
      ['Sale number', 'SL-2KQM-9F4H'],
      ['Total', '¥5,500'],
      ['Payment', 'Partly paid'],
    ])
  })

  it.each<['Upcoming' | 'Cancelled', string]>([
    ['Upcoming', 'A booking can be checked out once its treatment has begun.'],
    [
      'Cancelled',
      'A cancelled booking, or one whose customer did not come, is not checked out.',
    ],
  ])(
    'should say in English why a booking that is %s takes no checkout',
    async (story, why) => {
      // Arrange
      languageStore.choose('en')

      // Act
      await stories[story].run()

      // Assert
      expect(within(part('Checkout')).getByText(why)).toBeVisible()
    },
  )

  it('should say in English that the sales are on their way', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Loading.run()

    // Assert
    expect(
      within(part('Checkout')).getByText('Loading the checkout'),
    ).toBeVisible()
  })

  it('should say in English that the sales could not be read', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Unread.run()

    // Assert
    expect(
      within(part('Checkout')).getByText(
        'Could not load the checkout. Check your connection and try again.',
      ),
    ).toBeVisible()
    expect(
      within(part('Checkout')).getByRole('button', { name: 'Load again' }),
    ).toBeVisible()
  })
})
