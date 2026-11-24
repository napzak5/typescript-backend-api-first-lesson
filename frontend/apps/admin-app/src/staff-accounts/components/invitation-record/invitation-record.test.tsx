import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import * as invitationRecordStories from './invitation-record.stories'

const stories = composeStories(invitationRecordStories)

/** The terms of the invitation with what they say, in their order. */
const terms = (region = '招待'): [string | null, string | null][] =>
  within(screen.getByRole('region', { name: region }))
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

describe('InvitationRecord on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should show an invitation in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Waiting.run()

    // Assert
    expect(terms('Invitation')).toEqual([
      ['Status', 'Waiting to be accepted'],
      ['Sent to', 'misaki.tanaka@example.com'],
      ['Role', 'Staff'],
      ['Expires', 'Thu, November 26, 2026 at 10:00'],
      ['Sent', 'Thu, November 19, 2026 at 10:00'],
    ])
    expect(
      screen.getByText(/^Once the invited staff member chooses a password/),
    ).toBeVisible()
  })

  it.each<[keyof typeof stories, string, RegExp]>([
    ['Expired', 'Expired', /^The invitation expired/],
    [
      'Elsewhere',
      'Cannot be used',
      /^The email address in the staff ledger changed after the invitation \(it is misaki\.tanaka@example\.com now\)/,
    ],
    [
      'OfAnInactiveMember',
      'Cannot be used',
      /^An invitation of an inactive staff member/,
    ],
  ])(
    'should say in English that the invitation of the story %s cannot be taken, and why',
    async (story, state, why) => {
      // Arrange
      languageStore.choose('en')

      // Act
      await stories[story].run()

      // Assert
      expect(terms('Invitation')[0]).toEqual(['Status', state])
      expect(screen.getByText(why)).toBeVisible()
    },
  )
})
