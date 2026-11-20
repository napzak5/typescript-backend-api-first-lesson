import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as invitationRecordStories from './invitation-record.stories'

const stories = composeStories(invitationRecordStories)

/** The terms of the invitation with what they say, in their order. */
const terms = (): [string | null, string | null][] =>
  within(screen.getByRole('region', { name: '招待' }))
    .getAllByRole('term')
    .map((term) => [
      term.textContent,
      term.nextElementSibling?.textContent ?? null,
    ])

describe('InvitationRecord', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should show where an invitation went, the role it gives and until when it can be taken', async () => {
    // Act
    await stories.Waiting.run()

    // Assert
    expect(terms()).toEqual([
      ['状態', '受け入れ待ち'],
      ['宛先', 'misaki.tanaka@example.com'],
      ['ロール', 'スタッフ'],
      ['期限', '2026年11月26日（木） 10:00'],
      ['送った日時', '2026年11月19日（木） 10:00'],
    ])
    expect(
      screen.getByText(/メールのリンクからパスワードを決めると/),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: '招待を取り消す' })).toBeVisible()
  })

  it.each<[string, keyof typeof stories, string, RegExp]>([
    [
      'that expired',
      'Expired',
      '期限切れ',
      /期限が切れたので、この招待のリンクは使えません/,
    ],
    [
      'that went to an address the ledger no longer has',
      'Elsewhere',
      '使えません',
      /台帳のメールアドレスが変わりました/,
    ],
    [
      'of a member who is inactive',
      'OfAnInactiveMember',
      '使えません',
      /スタッフ情報を有効に戻すまで使えません/,
    ],
  ])(
    'should say that an invitation %s cannot be taken, and why',
    async (_, story, state, why) => {
      // Act
      await stories[story].run()

      // Assert
      expect(terms()[0]).toEqual(['状態', state])
      expect(screen.getByText(why)).toBeVisible()
    },
  )

  it('should name the address the ledger has now, which an invitation mailed again goes to', async () => {
    // Act
    await stories.Elsewhere.run()

    // Assert
    expect(terms()[1]).toEqual(['宛先', 'misaki.typo@example.com'])
    expect(
      screen.getByText(/台帳のメールアドレスが変わりました/),
    ).toHaveTextContent('（いまはmisaki.tanaka@example.com）')
  })
})
