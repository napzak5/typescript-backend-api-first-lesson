import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as fileColumnsStories from './file-columns.stories'

const stories = composeStories(fileColumnsStories)

describe('FileColumns', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should list every column of a registration by the name the file gives it, in the order of the export', async () => {
    // Act
    await stories.Columns.run()

    // Assert
    const table = screen.getByRole('table', { name: 'ファイルの列' })
    expect(
      within(table)
        .getAllByRole('rowheader')
        .map((header) => header.textContent),
    ).toEqual([
      'firstName',
      'lastName',
      'firstNameKana',
      'lastNameKana',
      'email',
      'phoneNumber',
      'alternativePhone',
      'postalCode',
      'prefecture',
      'city',
      'address',
      'building',
      'birthDate',
      'gender',
      'occupation',
      'membershipTier',
      'preferences',
      'notes',
      'internalNotes',
      'tags',
      'referredBy',
      'referralCode',
      'allowMarketing',
      'allowSms',
      'allowEmail',
      'isActive',
      'hairType',
      'hairThickness',
      'scalpCondition',
      'customerStatus',
    ])
  })

  it('should say what a column holds and how it is written', async () => {
    // Act
    await stories.Columns.run()

    // Assert
    expect(
      within(screen.getByRole('row', { name: /^membershipTier/ }))
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual([
      '会員ランク',
      'regular、silver、gold、platinum、vip のどれか。列がなければ regular',
    ])
    expect(
      within(screen.getByRole('row', { name: /^email/ }))
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual([
      'メールアドレス',
      '必ず書く。ファイルの中でも台帳でも、ほかのお客様と重ならないもの',
    ])
  })
})
