import {
  itShouldBeAccessibleInEveryStory,
  itShouldBeSentByTheEnterKey,
  setWindowWidth,
} from '@beauty-salon-frontend/testing'
import { optionsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories, composeStory } from '@storybook/react-vite'
import { useState } from 'react'
import { screen, userEvent } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import type { LedgerConditions } from '../../sales-ledger'
import { LedgerFilter, type LedgerFilterProps } from './ledger-filter'
import * as ledgerFilterStories from './ledger-filter.stories'

const stories = composeStories(ledgerFilterStories)

const from = (): HTMLElement => screen.getByLabelText('会計日（から）')
const to = (): HTMLElement => screen.getByLabelText('会計日（まで）')
const status = (): HTMLElement =>
  screen.getByRole('combobox', { name: '支払い' })

type UnderAnAddressProps = LedgerFilterProps & { other: LedgerConditions }

/** The filter on a screen whose address changes under it: the user went back. */
const UnderAnAddress = ({ other, ...props }: UnderAnAddressProps) => {
  const [conditions, setConditions] = useState(props.conditions)

  return (
    <>
      <LedgerFilter {...props} conditions={conditions} />
      <button type='button' onClick={() => setConditions(other)}>
        別のアドレスへ
      </button>
    </>
  )
}

describe('LedgerFilter', () => {
  itShouldBeAccessibleInEveryStory(stories)

  itShouldBeSentByTheEnterKey(stories.Today, () =>
    screen.getByLabelText('会計日（から）'),
  )

  it('should show the days and every state of payment the API writes', async () => {
    // Act
    await stories.Today.run()

    // Assert
    // The element `search`: the testing library does not know its role yet
    expect(from().closest('search')).toHaveAttribute(
      'aria-label',
      '売上を絞り込む',
    )
    expect(from()).toHaveValue('2026-11-20')
    expect(to()).toHaveValue('2026-11-20')
    for (const day of [from(), to()]) {
      expect(day).toHaveAttribute('type', 'date')
      expect(day).toHaveAttribute('min', '1900-01-01')
      expect(day).toHaveAttribute('max', '2999-12-31')
    }
    expect(status()).toHaveValue('')
    expect(optionsOf(status())).toEqual([
      'すべて',
      '未払い',
      '一部受け取り',
      '支払い済み',
      '一部返金',
      '返金済み',
    ])
    expect(screen.queryByRole('link', { name: '条件を外す' })).toBeNull()
  })

  it('should show the conditions that narrow the ledger, and the way back to today', async () => {
    // Act
    await stories.Narrowed.run()

    // Assert
    expect(from()).toHaveValue('2026-11-01')
    expect(to()).toHaveValue('2026-11-30')
    expect(status()).toHaveValue('processing')
    expect(screen.getByRole('link', { name: '条件を外す' })).toHaveAttribute(
      'href',
      '?',
    )
  })

  it('should hand over what its controls hold, under the names of the conditions', async () => {
    // Arrange
    const received: [string, FormDataEntryValue][][] = []
    await stories.Today.run({
      args: {
        ...stories.Today.args,
        onSubmit: vi.fn((values: FormData) => {
          received.push(Array.from(values.entries()))
        }),
      },
    })
    await userEvent.clear(from())
    await userEvent.type(from(), '2026-11-01')
    await userEvent.selectOptions(status(), '支払い済み')

    // Act
    await userEvent.click(screen.getByRole('button', { name: '表示する' }))

    // Assert
    expect(received).toEqual([
      [
        ['from', '2026-11-01'],
        ['to', '2026-11-20'],
        ['paymentStatus', 'completed'],
      ],
    ])
  })

  it('should say what is wrong at the control, and take the focus there', async () => {
    // Act
    await stories.WithErrors.run()

    // Assert
    expect(to()).toHaveAccessibleDescription(
      '終わりの日は、始まりの日と同じか、その後にしてください。',
    )
    expect(to()).toHaveAttribute('aria-invalid', 'true')
    expect(to()).toHaveFocus()
  })

  it('should show the conditions of another address when the address changes under it', async () => {
    // Arrange
    const Moving = composeStory(
      {
        ...ledgerFilterStories.Narrowed,
        render: (args) => (
          <UnderAnAddress
            {...args}
            other={{ from: '2026-11-21', to: '2026-11-22' }}
          />
        ),
      },
      ledgerFilterStories.default,
    )
    await Moving.run()
    await userEvent.selectOptions(status(), '返金済み')

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '別のアドレスへ' }),
    )

    // Assert
    expect(from()).toHaveValue('2026-11-21')
    expect(to()).toHaveValue('2026-11-22')
    expect(status()).toHaveValue('')
  })

  it('should count on its button the conditions of the sheet that narrow the sales, on a narrow screen', async () => {
    // Arrange
    setWindowWidth(390)

    // Act
    await stories.Narrowed.run()

    // Assert
    expect(screen.getByRole('button', { name: '条件（1）' })).toHaveAttribute(
      'aria-haspopup',
      'dialog',
    )
  })
})
