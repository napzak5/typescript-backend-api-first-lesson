import { languageStore } from '@beauty-salon-frontend/io'
import {
  itShouldBeAccessibleInEveryStory,
  itShouldBeSentByTheEnterKey,
} from '@beauty-salon-frontend/testing'
import { composeStories, composeStory } from '@storybook/react-vite'
import { act, useState } from 'react'
import { screen, userEvent } from 'storybook/test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Period } from '../../utils/period'
import {
  StatisticsPeriod,
  type StatisticsPeriodProps,
} from './statistics-period'
import * as statisticsPeriodStories from './statistics-period.stories'

const stories = composeStories(statisticsPeriodStories)

const from = (): HTMLElement => screen.getByLabelText('集計する期間（から）')
const to = (): HTMLElement => screen.getByLabelText('集計する期間（まで）')

type UnderAnAddressProps = StatisticsPeriodProps & { other: Period }

/** The form on a screen whose address changes under it: the user went back. */
const UnderAnAddress = ({ other, ...props }: UnderAnAddressProps) => {
  const [period, setPeriod] = useState(props.period)

  return (
    <>
      <StatisticsPeriod {...props} period={period} />
      <button type='button' onClick={() => setPeriod(other)}>
        別のアドレスへ
      </button>
    </>
  )
}

describe('StatisticsPeriod', () => {
  itShouldBeAccessibleInEveryStory(stories)

  itShouldBeSentByTheEnterKey(stories.LastYear, () =>
    screen.getByLabelText('集計する期間（から）'),
  )

  it('should show the days of the period, and say how long it may be', async () => {
    // Act
    await stories.LastYear.run()

    // Assert
    expect(
      screen.getByLabelText('集計する期間（から）').closest('search'),
    ).toHaveAttribute('aria-label', '集計する期間')
    expect(from()).toHaveValue('2025-11-20')
    expect(to()).toHaveValue('2026-11-20')
    expect(from()).toHaveAttribute('min', '1900-01-01')
    expect(to()).toHaveAttribute('max', '2999-12-31')
    expect(to()).toHaveAccessibleDescription('366 日まで集計できます。')
  })

  it('should hand over the days that were typed, under the names of the period', async () => {
    // Arrange
    const received: [string, FormDataEntryValue][][] = []
    await stories.LastYear.run({
      args: {
        ...stories.LastYear.args,
        onSubmit: vi.fn((values: FormData) => {
          received.push([...values])
        }),
      },
    })
    await userEvent.clear(from())
    await userEvent.type(from(), '2026-11-01')
    await userEvent.clear(to())
    await userEvent.type(to(), '2026-11-15')

    // Act
    await userEvent.click(screen.getByRole('button', { name: '集計する' }))

    // Assert
    expect(received).toEqual([
      [
        ['from', '2026-11-01'],
        ['to', '2026-11-15'],
      ],
    ])
  })

  it('should hand over a further choice with the days, between them and the button', async () => {
    // Arrange
    const received: [string, FormDataEntryValue][][] = []
    await stories.WithAChoice.run({
      args: {
        ...stories.WithAChoice.args,
        onSubmit: vi.fn((values: FormData) => {
          received.push([...values])
        }),
      },
    })
    await userEvent.click(screen.getByRole('radio', { name: '週' }))

    // Act
    await userEvent.click(screen.getByRole('button', { name: '集計する' }))

    // Assert
    expect(received).toEqual([
      [
        ['from', '2025-11-20'],
        ['to', '2026-11-20'],
        ['period', 'weekly'],
      ],
    ])
    expect(
      screen
        .getByRole('radiogroup', { name: '区切り' })
        .compareDocumentPosition(
          screen.getByRole('button', { name: '集計する' }),
        ),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it('should say what is wrong at the control, and take the focus there', async () => {
    // Act
    await stories.WithErrors.run()

    // Assert
    expect(to()).toHaveFocus()
    expect(to()).toHaveAccessibleDescription(
      '366 日まで集計できます。 期間は 366 日までにしてください。',
    )
  })

  it('should show the days of another address when the address changes under it', async () => {
    // Arrange
    const Moving = composeStory(
      {
        ...statisticsPeriodStories.LastYear,
        render: (args) => (
          <UnderAnAddress
            {...args}
            other={{ from: '2026-01-01', to: '2026-03-31' }}
          />
        ),
      },
      statisticsPeriodStories.default,
    )
    await Moving.run()
    await userEvent.clear(from())

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '別のアドレスへ' }),
    )

    // Assert
    expect(from()).toHaveValue('2026-01-01')
    expect(to()).toHaveValue('2026-03-31')
  })
})

describe('StatisticsPeriod on a page in English', () => {
  /** What an English screen says of the period */
  const UP_TO_366_DAYS = 'Up to 366 days can be counted.'

  afterEach(() => {
    localStorage.clear()
  })

  it('should name the period and its days in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.LastYear.run()

    // Assert
    expect(
      screen.getByLabelText('Period to count (from)').closest('search'),
    ).toHaveAttribute('aria-label', 'Period to count')
    expect(screen.getByLabelText('Period to count (to)')).toHaveValue(
      '2026-11-20',
    )
  })

  it('should say in English what is wrong at the control', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.WithErrors.run({
      args: { ...stories.WithErrors.args, description: UP_TO_366_DAYS },
    })

    // Assert
    expect(
      screen.getByLabelText('Period to count (to)'),
    ).toHaveAccessibleDescription(
      `${UP_TO_366_DAYS} Make the period 366 days or shorter.`,
    )
  })

  it('should say the errors anew when the page turns English, and leave the focus where it is', async () => {
    // Arrange
    await stories.WithErrors.run({
      args: { ...stories.WithErrors.args, description: UP_TO_366_DAYS },
    })
    to().blur()

    // Act
    act(() => {
      languageStore.choose('en')
    })

    // Assert
    expect(
      screen.getByLabelText('Period to count (to)'),
    ).toHaveAccessibleDescription(
      `${UP_TO_366_DAYS} Make the period 366 days or shorter.`,
    )
    expect(screen.getByLabelText('Period to count (to)')).not.toHaveFocus()
  })
})
