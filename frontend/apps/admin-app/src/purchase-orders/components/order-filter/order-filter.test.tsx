import {
  itShouldBeAccessibleInEveryStory,
  setWindowWidth,
} from '@beauty-salon-frontend/testing'
import { composeStories, composeStory } from '@storybook/react-vite'
import { useState } from 'react'
import { screen, userEvent } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import { salon } from '../../../bookings/components/examples'
import type { OrderConditions } from '../../order-search'
import { OrderFilter, type OrderFilterProps } from './order-filter'
import * as orderFilterStories from './order-filter.stories'

const stories = composeStories(orderFilterStories)

const status = (): HTMLElement =>
  screen.getByRole('combobox', { name: 'ステータス' })
const supplier = (): HTMLElement =>
  screen.getByRole('textbox', { name: '仕入先' })
const from = (): HTMLElement => screen.getByLabelText('発注日（から）')
const to = (): HTMLElement => screen.getByLabelText('発注日（まで）')

type UnderAnAddressProps = OrderFilterProps & { other: OrderConditions }

/** The filter on a screen whose address changes under it: the user went back. */
const UnderAnAddress = ({ other, ...props }: UnderAnAddressProps) => {
  const [conditions, setConditions] = useState(props.conditions)

  return (
    <>
      <OrderFilter {...props} conditions={conditions} />
      <button type='button' onClick={() => setConditions(other)}>
        別のアドレスへ
      </button>
    </>
  )
}

describe('OrderFilter', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should offer every status in the order an order goes through them, and narrow nothing at first', async () => {
    // Act
    await stories.Every.run()

    // Assert
    expect(status()).toHaveDisplayValue('すべて')
    expect(
      Array.from(status().querySelectorAll('option')).map(
        (option) => option.textContent,
      ),
    ).toEqual([
      'すべて',
      '下書き',
      '承認待ち',
      '承認済み',
      '発注済み',
      '出荷済み',
      '納品済み',
      '取り消し',
    ])
    expect(supplier()).toHaveValue('')
    expect(supplier()).toHaveAccessibleDescription(
      '仕入先の名前のすべて。発注に書いたとおりに入力します。',
    )
    expect(from()).toHaveValue('')
    expect(to()).toHaveValue('')
    expect(screen.queryByRole('link', { name: '条件を外す' })).toBeNull()
  })

  it('should show the conditions that narrow the list, and the way to every order', async () => {
    // Act
    await stories.Narrowed.run()

    // Assert
    expect(status()).toHaveDisplayValue('承認待ち')
    expect(supplier()).toHaveValue('Beauty Supply Tokyo')
    expect(from()).toHaveValue('2026-11-01')
    expect(to()).toHaveValue('2026-11-20')
    expect(screen.getByRole('link', { name: '条件を外す' })).toHaveAttribute(
      'href',
      `/salons/${salon.id}/purchase-orders`,
    )
  })

  it('should send the conditions that were chosen', async () => {
    // Arrange
    const received: [string, FormDataEntryValue][][] = []
    await stories.Every.run({
      args: {
        ...stories.Every.args,
        onSubmit: vi.fn((values: FormData) => {
          received.push(Array.from(values.entries()))
        }),
      },
    })

    // Act
    await userEvent.selectOptions(status(), '発注済み')
    await userEvent.type(supplier(), 'ヘアケア商事')
    await userEvent.type(from(), '2026-11-01')
    await userEvent.click(screen.getByRole('button', { name: '表示する' }))

    // Assert
    expect(received).toEqual([
      [
        ['status', 'ordered'],
        ['supplier', 'ヘアケア商事'],
        ['from', '2026-11-01'],
        ['to', ''],
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
    expect(to()).toHaveFocus()
  })

  it('should show the conditions of another address when the address changes under it', async () => {
    // Arrange
    const Moving = composeStory(
      {
        ...orderFilterStories.Narrowed,
        render: (args) => (
          <UnderAnAddress {...args} other={{ status: 'delivered' }} />
        ),
      },
      orderFilterStories.default,
    )
    await Moving.run()
    await userEvent.clear(supplier())
    await userEvent.type(supplier(), '別の仕入先')

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '別のアドレスへ' }),
    )

    // Assert
    expect(status()).toHaveDisplayValue('納品済み')
    expect(supplier()).toHaveValue('')
    expect(from()).toHaveValue('')
    expect(to()).toHaveValue('')
  })

  it('should count on its button the conditions of the sheet that narrow the orders, on a narrow screen', async () => {
    // Arrange
    setWindowWidth(390)

    // Act
    await stories.Narrowed.run()

    // Assert
    expect(screen.getByRole('button', { name: '条件（4）' })).toHaveAttribute(
      'aria-haspopup',
      'dialog',
    )
  })
})
