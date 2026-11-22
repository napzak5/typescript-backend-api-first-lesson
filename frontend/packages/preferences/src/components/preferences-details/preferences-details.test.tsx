import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as preferencesDetailsStories from './preferences-details.stories'

const stories = composeStories(preferencesDetailsStories)

/** The value that stands beside a name. */
const shownAs = (term: string): Element | null =>
  screen.getByText(term, { selector: 'dt' }).nextElementSibling

/** The names and the values, as the list shows them. */
const details = (): Record<string, string | null> =>
  Object.fromEntries(
    screen
      .getAllByRole('term')
      .map((term) => [
        term.textContent,
        term.nextElementSibling?.textContent ?? null,
      ]),
  )

describe('PreferencesDetails', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say whom the customer wishes for and avoids, when they like to come, and what they like', async () => {
    // Act
    await stories.Complete.run()

    // Assert
    expect(details()).toEqual({
      指名したいスタッフ: '田中 美咲（Beauty Salon Tokyo）',
      避けたいスタッフ:
        '佐藤 健太（Beauty Salon Tokyo）、鈴木 結衣（Hair Studio Osaka）',
      希望する時間帯: '10:00〜12:00、18:00〜20:30',
      希望の長さ: '肩にかかるくらい',
      好きな色: 'アッシュブラウン、ベージュ',
      避けたいスタイル: '前髪を短くすること、強いパーマ',
      参考の画像:
        'https://images.example.com/styles/bob-ash-brown.jpg' +
        'https://images.example.com/styles/layered-medium.jpg',
      接客の好み: '静かに過ごしたい',
      特別な要望:
        '首が疲れやすいので、シャンプーのときにタオルを入れてもらえると助かります。',
    })
  })

  it('should say of every preference that there is none, for somebody who has said nothing', async () => {
    // Act
    await stories.Nothing.run()

    // Assert
    expect(details()).toEqual({
      指名したいスタッフ: '指定なし',
      避けたいスタッフ: '指定なし',
      希望する時間帯: '指定なし',
      希望の長さ: '指定なし',
      好きな色: '指定なし',
      避けたいスタイル: '指定なし',
      参考の画像: '指定なし',
      接客の好み: '指定なし',
      特別な要望: '指定なし',
    })
  })

  it('should link every picture to its address, and load none of them', async () => {
    // Act
    await stories.Complete.run()

    // Assert
    const links = screen.getAllByRole('link')
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      'https://images.example.com/styles/bob-ash-brown.jpg',
      'https://images.example.com/styles/layered-medium.jpg',
    ])
    expect(links.map((link) => link.getAttribute('rel'))).toEqual([
      'noreferrer',
      'noreferrer',
    ])
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('should show a stored value that is no address of the web as text', async () => {
    // Act
    await stories.ImageThatIsNoAddress.run()

    // Assert
    expect(shownAs('参考の画像')).toHaveTextContent(
      '雑誌の切り抜きを持っていきます',
    )
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('should leave out a member of the staff whose salon no longer shows them, and name the others', async () => {
    // Act
    await stories.StaffThatLeft.run()

    // Assert
    expect(details()).toMatchObject({
      指名したいスタッフ: '指定なし',
      避けたいスタッフ: '鈴木 結衣（Hair Studio Osaka）',
    })
  })

  it('should name a member nobody shows any more as the screen names them, in the place of their ID', async () => {
    // Act
    await stories.StaffThatLeftSaidSo.run()

    // Assert
    expect(details()).toMatchObject({
      指名したいスタッフ: '一覧にないスタッフ',
      避けたいスタッフ: '一覧にないスタッフ、鈴木 結衣（Hair Studio Osaka）',
    })
  })

  it('should keep the line breaks of what was written in several lines', async () => {
    // Act
    await stories.Wordy.run()

    // Assert
    expect(shownAs('特別な要望')?.firstElementChild).toHaveClass('writtenText')
    expect(shownAs('特別な要望')?.textContent).toContain('\n\n')
  })
})
