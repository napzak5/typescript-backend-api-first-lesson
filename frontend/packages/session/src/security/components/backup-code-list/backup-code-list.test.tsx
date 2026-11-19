import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
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
