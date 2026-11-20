import type { ModelsBookingStatusType } from '@beauty-salon-frontend/api-client'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import { aSale, salon } from '../examples'
import * as bookingSaleStories from './booking-sale.stories'

const stories = composeStories(bookingSaleStories)

const part = (): HTMLElement => {
  const section = screen
    .getByRole('heading', { name: '会計' })
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
})
