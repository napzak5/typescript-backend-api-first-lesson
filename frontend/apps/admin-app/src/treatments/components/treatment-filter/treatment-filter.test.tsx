import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories, composeStory } from '@storybook/react-vite'
import { useState } from 'react'
import { screen, userEvent } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import { aCustomer, salon, staff } from '../../../bookings/components/examples'
import type { TreatmentConditions } from '../../treatments-api'
import { TreatmentFilter, type TreatmentFilterProps } from './treatment-filter'
import * as treatmentFilterStories from './treatment-filter.stories'

const stories = composeStories(treatmentFilterStories)

const member = (): HTMLElement => screen.getByRole('combobox', { name: '担当' })
const from = (): HTMLElement => screen.getByLabelText('書いた日（から）')
const to = (): HTMLElement => screen.getByLabelText('書いた日（まで）')

type UnderAnAddressProps = TreatmentFilterProps & {
  other: TreatmentConditions
}

/** The filter on a screen whose address changes under it: the user went back. */
const UnderAnAddress = ({ other, ...props }: UnderAnAddressProps) => {
  const [conditions, setConditions] = useState(props.conditions)

  return (
    <>
      <TreatmentFilter {...props} conditions={conditions} />
      <button type='button' onClick={() => setConditions(other)}>
        別のアドレスへ
      </button>
    </>
  )
}

describe('TreatmentFilter', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should offer every member of the staff, and narrow nothing at first', async () => {
    // Act
    await stories.Every.run()

    // Assert
    expect(member()).toHaveDisplayValue('すべて')
    expect(
      Array.from(member().querySelectorAll('option')).map(
        (option) => option.textContent,
      ),
    ).toEqual(['すべて', '田中 美咲', '佐藤 健'])
    expect(from()).toHaveValue('')
    expect(to()).toHaveValue('')
    expect(screen.queryByRole('link', { name: '条件をすべて外す' })).toBeNull()
  })

  it('should show the conditions that narrow the list, and the way to every record', async () => {
    // Act
    await stories.Narrowed.run()

    // Assert
    expect(member()).toHaveDisplayValue('佐藤 健')
    expect(from()).toHaveValue('2026-11-01')
    expect(to()).toHaveValue('2026-11-20')
    expect(
      screen.getByRole('link', { name: '条件をすべて外す' }),
    ).toHaveAttribute('href', `/salons/${salon.id}/treatments`)
  })

  it('should name the customer of the list, keep them, and lead to every customer', async () => {
    // Arrange
    const received: [string, FormDataEntryValue][][] = []
    await stories.OfCustomer.run({
      args: {
        ...stories.OfCustomer.args,
        onSubmit: vi.fn((values: FormData) => {
          received.push(Array.from(values.entries()))
        }),
      },
    })

    // Act
    await userEvent.selectOptions(member(), '田中 美咲')
    await userEvent.click(screen.getByRole('button', { name: '表示する' }))

    // Assert
    expect(screen.getByText('お客様：山田 花子 様')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'すべてのお客様にする' }),
    ).toHaveAttribute('href', `/salons/${salon.id}/treatments`)
    expect(received).toEqual([
      [
        ['customer', aCustomer().id],
        ['staff', staff[0]?.id],
        ['from', ''],
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
        ...treatmentFilterStories.Narrowed,
        render: (args) => (
          <UnderAnAddress {...args} other={{ from: '2026-10-01' }} />
        ),
      },
      treatmentFilterStories.default,
    )
    await Moving.run()
    await userEvent.type(to(), '2026-11-30')

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '別のアドレスへ' }),
    )

    // Assert
    expect(member()).toHaveValue('')
    expect(from()).toHaveValue('2026-10-01')
    expect(to()).toHaveValue('')
  })
})
