import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as removedRecordStories from './removed-record.stories'

const stories = composeStories(removedRecordStories)

const ledger = (): HTMLElement =>
  screen.getByRole('region', { name: '削除されたときの台帳' })

describe('RemovedRecord', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say when and by whom the customer was removed, show what the ledger held, and bring them back', async () => {
    // Arrange
    await stories.Deleted.run()

    // Assert
    expect(
      screen.getByText(
        '2026年11月18日（水） 14:30 に、あなたが台帳から削除しました。',
      ),
    ).toBeVisible()
    expect(within(ledger()).getByText('山田 花子')).toBeVisible()
    expect(screen.getByRole('link', { name: '変更履歴' })).toHaveAttribute(
      'href',
      stories.Deleted.args.historyHref,
    )

    // Act
    await userEvent.click(screen.getByRole('button', { name: '台帳に戻す' }))

    // Assert
    expect(stories.Deleted.args.onRestore).toHaveBeenCalledTimes(1)
  })

  it('should lead to the customer who referred the one who was removed', async () => {
    // Act
    await stories.Referred.run()

    // Assert
    expect(
      within(ledger()).getByRole('link', { name: '紹介したお客様' }),
    ).toHaveAttribute(
      'href',
      stories.Referred.args.customerHref?.(
        'c19f4d7a-6e8c-4adf-8dbe-ac7e3f6a8bc5',
      ),
    )
  })

  it('should keep the button busy while the customer is brought back', async () => {
    // Act
    await stories.Restoring.run()

    // Assert
    expect(screen.getByRole('button', { name: '台帳に戻す' })).toHaveAttribute(
      'aria-busy',
      'true',
    )
  })

  it('should say why the customer did not come back, and lead to the customer who has their address of mail', async () => {
    // Act
    await stories.EmailTaken.run()
    const alert = screen.getByRole('alert')

    // Assert
    expect(alert).toHaveTextContent(
      'このお客様のメールアドレス（hanako.yamada@example.com）は、削除のあとに登録されたお客様が使っています。',
    )
    expect(
      within(alert).getByRole('link', { name: 'そのお客様を台帳で探す' }),
    ).toHaveAttribute('href', stories.EmailTaken.args.refusal?.link?.href)
  })

  it.each<[string, (typeof stories)['Merged'], string, string]>([
    [
      'merged into another',
      stories.Merged,
      'ほかのアカウントがほかのお客様に統合しました。',
      'ほかのお客様に統合されたため、台帳に戻せません。',
    ],
    [
      'erased at their request',
      stories.Erased,
      'ほかのアカウントが削除の依頼で消去しました。',
      '削除の依頼で消去されたため、台帳に戻せません。',
    ],
  ])(
    'should say that a customer who was %s cannot come back, and offer no way back',
    async (_case, story, done, why) => {
      // Act
      await story.run()

      // Assert
      expect(screen.getByText(done, { exact: false })).toBeVisible()
      expect(screen.getByText(why)).toBeVisible()
      expect(screen.queryByRole('button', { name: '台帳に戻す' })).toBeNull()
      expect(screen.getByRole('link', { name: '変更履歴' })).toBeVisible()
    },
  )
})
