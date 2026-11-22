import {
  itShouldBeAccessibleInEveryStory,
  itShouldBeSentByTheEnterKey,
  setWindowWidth,
} from '@beauty-salon-frontend/testing'
import { composeStories, composeStory } from '@storybook/react-vite'
import { useState } from 'react'
import { screen, userEvent, within } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import type { CustomerConditions } from '../../customer-ledger'
import { CustomerFilter, type CustomerFilterProps } from './customer-filter'
import * as customerFilterStories from './customer-filter.stories'

const stories = composeStories(customerFilterStories)

const keyword = (): HTMLElement =>
  screen.getByRole('searchbox', { name: 'キーワード' })
const tags = (): HTMLElement => screen.getByRole('textbox', { name: 'タグ' })
const from = (): HTMLElement => screen.getByLabelText('登録日（から）')
const to = (): HTMLElement => screen.getByLabelText('登録日（まで）')
const status = (): HTMLElement =>
  screen.getByRole('combobox', { name: 'ステータス' })
const tier = (): HTMLElement =>
  screen.getByRole('combobox', { name: '会員ランク' })

const optionsOf = (select: HTMLElement): (string | null)[] =>
  within(select)
    .getAllByRole('option')
    .map((option) => option.textContent)

type UnderAnAddressProps = CustomerFilterProps & { other: CustomerConditions }

/** The filter on a screen whose address changes under it: the user went back. */
const UnderAnAddress = ({ other, ...props }: UnderAnAddressProps) => {
  const [conditions, setConditions] = useState(props.conditions)

  return (
    <>
      <CustomerFilter {...props} conditions={conditions} />
      <button type='button' onClick={() => setConditions(other)}>
        別のアドレスへ
      </button>
    </>
  )
}

describe('CustomerFilter', () => {
  itShouldBeAccessibleInEveryStory(stories)

  itShouldBeSentByTheEnterKey(stories.Everyone, () =>
    screen.getByRole('textbox', { name: 'タグ' }),
  )

  it('should offer every condition the API narrows the ledger by, with nothing chosen', async () => {
    // Act
    await stories.Everyone.run()

    // Assert
    // The element `search`: the testing library does not know its role yet
    expect(keyword().closest('search')).toHaveAttribute(
      'aria-label',
      'お客様を探す',
    )
    expect(keyword()).toHaveValue('')
    expect(keyword()).toHaveAccessibleDescription(
      'お名前（カナでも）、メールアドレス、電話番号の一部。',
    )
    expect(tags()).toHaveAccessibleDescription(
      '「、」か「,」で区切ると、すべてのタグを持つお客様を探します。',
    )
    for (const day of [from(), to()]) {
      expect(day).toHaveAttribute('type', 'date')
      expect(day).toHaveAttribute('min', '1900-01-01')
      expect(day).toHaveAttribute('max', '2999-12-31')
    }
    expect(optionsOf(status())).toEqual([
      'すべて',
      '通常',
      '休眠',
      'VIP',
      '利用停止',
    ])
    expect(optionsOf(tier())).toEqual([
      'すべて',
      'レギュラー',
      'シルバー',
      'ゴールド',
      'プラチナ',
      'VIP',
    ])
    expect(screen.queryByRole('link', { name: '条件を外す' })).toBeNull()
  })

  it('should show the conditions that narrow the ledger, and the way back to all of it', async () => {
    // Act
    await stories.Narrowed.run()

    // Assert
    expect(keyword()).toHaveValue('山田')
    expect(tags()).toHaveValue('VIP、常連')
    expect(from()).toHaveValue('2026-11-01')
    expect(to()).toHaveValue('2026-11-20')
    expect(status()).toHaveValue('vip')
    expect(tier()).toHaveValue('gold')
    expect(screen.getByRole('link', { name: '条件を外す' })).toHaveAttribute(
      'href',
      '?',
    )
  })

  it('should hand over what its controls hold, under the names of the conditions', async () => {
    // Arrange
    const received: [string, FormDataEntryValue][][] = []
    await stories.Everyone.run({
      args: {
        ...stories.Everyone.args,
        onSubmit: vi.fn((values: FormData) => {
          received.push(Array.from(values.entries()))
        }),
      },
    })
    await userEvent.type(keyword(), 'ヤマダ')
    await userEvent.type(tags(), 'VIP、常連')
    await userEvent.type(from(), '2026-11-01')
    await userEvent.selectOptions(status(), '休眠')
    await userEvent.selectOptions(tier(), 'シルバー')

    // Act
    await userEvent.click(screen.getByRole('button', { name: '探す' }))

    // Assert
    expect(received).toEqual([
      [
        ['search', 'ヤマダ'],
        ['tags', 'VIP、常連'],
        ['from', '2026-11-01'],
        ['to', ''],
        ['customerStatus', 'inactive'],
        ['membershipTier', 'silver'],
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
        ...customerFilterStories.Narrowed,
        render: (args) => (
          <UnderAnAddress
            {...args}
            other={{ tags: ['紹介'], to: '2026-11-22' }}
          />
        ),
      },
      customerFilterStories.default,
    )
    await Moving.run()
    await userEvent.type(keyword(), 'さん')

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '別のアドレスへ' }),
    )

    // Assert
    expect(keyword()).toHaveValue('')
    expect(tags()).toHaveValue('紹介')
    expect(from()).toHaveValue('')
    expect(to()).toHaveValue('2026-11-22')
    expect(status()).toHaveValue('')
    expect(tier()).toHaveValue('')
  })

  it('should count on its button the conditions of the sheet that narrow the ledger, on a narrow screen', async () => {
    // Arrange
    setWindowWidth(390)

    // Act
    await stories.Narrowed.run()

    // Assert
    expect(screen.getByRole('button', { name: '条件（5）' })).toHaveAttribute(
      'aria-haspopup',
      'dialog',
    )
  })
})
