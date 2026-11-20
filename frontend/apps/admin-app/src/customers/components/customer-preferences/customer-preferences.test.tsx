import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import { staff } from '../../../bookings/components/examples'
import * as customerPreferencesStories from './customer-preferences.stories'

const stories = composeStories(customerPreferencesStories)

const [misaki, ken] = staff

const items = (): [string | null, string | null][] =>
  screen
    .getAllByRole('term')
    .map((term) => [
      term.textContent,
      term.nextElementSibling?.textContent ?? null,
    ])

describe('CustomerPreferences', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say of every preference that none was set', async () => {
    // Act
    await stories.Unset.run()

    // Assert
    expect(items()).toEqual([
      ['指名したいスタッフ', '指定なし'],
      ['避けたいスタッフ', '指定なし'],
      ['希望する時間帯', '指定なし'],
      ['希望の長さ', '指定なし'],
      ['好きな色', '指定なし'],
      ['避けたいスタイル', '指定なし'],
      ['参考の画像', '指定なし'],
      ['接客の好み', '指定なし'],
      ['特別な要望', '指定なし'],
    ])
  })

  it('should name the members as the salons show them, and say of one who is shown no more that they are not listed', async () => {
    // Act
    await stories.Everything.run()

    // Assert
    expect(items()).toEqual([
      ['指名したいスタッフ', misaki?.displayName ?? ''],
      ['避けたいスタッフ', `${ken?.displayName}、一覧にないスタッフ`],
      ['希望する時間帯', '10:00〜12:00、18:00〜20:00'],
      ['希望の長さ', 'ボブ'],
      ['好きな色', 'アッシュ、ベージュ'],
      ['避けたいスタイル', '刈り上げ'],
      [
        '参考の画像',
        'https://example.com/styles/bob.jpghttps://example.com/styles/ash.jpg',
      ],
      ['接客の好み', '静かに過ごしたい'],
      [
        '特別な要望',
        '香りの強い製品は苦手です。\n首が弱いので、シャンプー台はゆっくり倒してください。',
      ],
    ])
    expect(screen.queryByRole('link')).toBeNull()
  })
})
