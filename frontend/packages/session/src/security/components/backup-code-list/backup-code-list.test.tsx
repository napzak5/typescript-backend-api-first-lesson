import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import { twoFactorSetup } from '../examples'
import * as backupCodeListStories from './backup-code-list.stories'

const stories = composeStories(backupCodeListStories)

describe('BackupCodeList', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should list every code, in the order the API issued them, as code', async () => {
    // Act
    await stories.Issued.run()

    // Assert
    const list = within(
      screen.getByRole('list', { name: 'バックアップコード' }),
    )
    expect(
      list.getAllByRole('listitem').map((code) => code.textContent),
    ).toEqual(twoFactorSetup.backupCodes)
    expect(list.getAllByRole('code').map((code) => code.textContent)).toEqual(
      twoFactorSetup.backupCodes,
    )
  })
})

describe('BackupCodeList on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should name the list in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Issued.run()

    // Assert
    expect(screen.getByRole('list', { name: 'Backup codes' })).toBeVisible()
  })
})
