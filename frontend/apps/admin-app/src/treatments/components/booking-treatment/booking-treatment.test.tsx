import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { aBooking, salon } from '../../../bookings/components/examples'
import { aTreatment } from '../examples'
import * as bookingTreatmentStories from './booking-treatment.stories'

const stories = composeStories(bookingTreatmentStories)

const part = (): HTMLElement => screen.getByRole('region', { name: '施術記録' })

describe('BookingTreatment', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it.each<[string, keyof typeof stories]>([
    ['was done', 'Unwritten'],
    ['is under treatment', 'UnderTreatment'],
  ])(
    'should lead to the writing of the record of a booking that %s',
    async (_case, story) => {
      // Act
      await stories[story].run()

      // Assert
      expect(
        within(part()).getByText('まだ施術記録を書いていません。'),
      ).toBeInTheDocument()
      expect(
        within(part()).getByRole('link', { name: '施術記録を書く' }),
      ).toHaveAttribute(
        'href',
        `/salons/${salon.id}/bookings/${aBooking().id}/treatment/new`,
      )
    },
  )

  it('should lead to the record that was written, and say when', async () => {
    // Act
    await stories.Written.run()

    // Assert
    expect(
      within(part()).getByText(
        '2026年11月20日（金） 12:30に書いた施術記録があります。',
      ),
    ).toBeInTheDocument()
    expect(
      within(part()).getByRole('link', { name: '施術記録を見る' }),
    ).toHaveAttribute(
      'href',
      `/salons/${salon.id}/treatments/${aTreatment().id}`,
    )
    expect(
      within(part()).queryByRole('link', { name: '施術記録を書く' }),
    ).toBeNull()
  })

  it.each<[string, keyof typeof stories, string]>([
    ['has not begun', 'Upcoming', '施術を始めると、施術記録を書けます。'],
    [
      'was cancelled',
      'Cancelled',
      '施術をしなかった予約には、施術記録はありません。',
    ],
  ])(
    'should say why a booking that %s has no record, and offer none',
    async (_case, story, said) => {
      // Act
      await stories[story].run()

      // Assert
      expect(within(part()).getByText(said)).toBeInTheDocument()
      expect(within(part()).queryByRole('link')).toBeNull()
    },
  )

  it('should say the record is on its way', async () => {
    // Act
    await stories.Loading.run()

    // Assert
    expect(
      within(part()).getByText('施術記録を読み込んでいます'),
    ).toBeInTheDocument()
  })

  it('should ask for the record again when it could not be read', async () => {
    // Arrange
    const onRetry = vi.fn()
    await stories.Unread.run({ args: { ...stories.Unread.args, onRetry } })

    // Act
    await userEvent.click(
      within(part()).getByRole('button', { name: /もう一度/ }),
    )

    // Assert
    expect(onRetry).toHaveBeenCalledOnce()
  })
})

describe('BookingTreatment on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should say a record was written and lead to it, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Written.run()

    // Assert
    expect(
      screen.getByText(
        'A treatment record was written on Fri, November 20, 2026 at 12:30.',
      ),
    ).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'View the treatment record' }),
    ).toBeVisible()
    expect(
      screen.getByRole('region', { name: 'Treatment record' }),
    ).toBeVisible()
  })

  it('should lead to the form of a record not written yet, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Unwritten.run()

    // Assert
    expect(
      screen.getByText('No treatment record has been written yet.'),
    ).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Write a treatment record' }),
    ).toBeVisible()
  })

  it('should say when a record can be written, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Upcoming.run()

    // Assert
    expect(
      screen.getByText(
        'A treatment record can be written once the treatment starts.',
      ),
    ).toBeVisible()
  })

  it('should say that a booking not treated has no record, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Cancelled.run()

    // Assert
    expect(
      screen.getByText(
        'A booking whose treatment did not take place has no treatment record.',
      ),
    ).toBeVisible()
  })
})
