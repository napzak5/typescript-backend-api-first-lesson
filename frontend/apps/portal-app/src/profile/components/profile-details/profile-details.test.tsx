import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import * as profileDetailsStories from './profile-details.stories'

const stories = composeStories(profileDetailsStories)

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

describe('ProfileDetails', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say who the customer is, how to reach them, where they live, and what they like', async () => {
    // Act
    await stories.Complete.run()

    // Assert
    expect(details()).toEqual({
      お名前: '山田 花子',
      フリガナ: 'ヤマダ ハナコ',
      メールアドレス: 'hanako.yamada@example.com',
      電話番号: '090-5550-0199',
      予備の電話番号: '03-5550-0142',
      住所: '〒150-0001東京都 渋谷区 神宮前 1-2-3こもれびハイツ 302',
      生年月日: '1990年5月15日',
      性別: '女性',
      職業: 'デザイナー',
      好みのメニュー: 'カット、カラー',
      サロンに伝えておきたいこと: 'オーガニックの製品を使ってほしいです。',
      受け取る連絡: 'メールでの連絡、SMS での連絡',
    })
  })

  it('should write the address a line for each of its parts, as on a letter', async () => {
    // Act
    await stories.Complete.run()

    // Assert
    expect(
      Array.from(shownAs('住所')?.children ?? [], (line) => [
        line.textContent,
        line.className,
      ]),
    ).toEqual([
      ['〒150-0001', 'line'],
      ['東京都 渋谷区 神宮前 1-2-3', 'line'],
      ['こもれびハイツ 302', 'line'],
    ])
  })

  it('should say that a value is missing for everything that was not said, and that no contact is received', async () => {
    // Act
    await stories.OnlyWhoTheyAre.run()

    // Assert
    expect(details()).toEqual({
      お名前: '佐藤 健',
      フリガナ: '記録なし',
      メールアドレス: 'ken.sato@example.com',
      電話番号: '080-5550-0117',
      予備の電話番号: '記録なし',
      住所: '記録なし',
      生年月日: '記録なし',
      性別: '記録なし',
      職業: '記録なし',
      好みのメニュー: 'なし',
      サロンに伝えておきたいこと: '記録なし',
      受け取る連絡: 'なし',
    })
  })

  it('should keep the line breaks of what the customer wrote for the salons', async () => {
    // Act
    await stories.Wordy.run()

    // Assert
    const notes = screen.getByText(/^頭皮が敏感なので/)
    expect(notes).toHaveClass('writtenText')
    expect(notes.textContent).toContain('\n\n香りの強い製品は苦手です。')
  })

  it('should name every kind of service the customer likes, in the order the form offers them', async () => {
    // Act
    await stories.Wordy.run()

    // Assert
    expect(shownAs('好みのメニュー')).toHaveTextContent(
      'カット、カラー、パーマ、トリートメント、スパ、スタイリング、エクステンション、その他',
    )
  })
})

describe('ProfileDetails on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should name what it shows in English, and write the day and the choices so; what the customer wrote stays as written', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Complete.run()

    // Assert
    expect(details()).toEqual({
      Name: '山田 花子',
      'Phonetic name': 'ヤマダ ハナコ',
      'Email address': 'hanako.yamada@example.com',
      'Phone number': '090-5550-0199',
      'Alternative phone number': '03-5550-0142',
      Address: '150-0001東京都 渋谷区 神宮前 1-2-3こもれびハイツ 302',
      'Date of birth': 'May 15, 1990',
      Gender: 'Female',
      Occupation: 'デザイナー',
      'Favorite services': 'Cut, Color',
      'Notes for the salon': 'オーガニックの製品を使ってほしいです。',
      'Messages you receive': 'Messages by email, Messages by SMS',
    })
  })

  it('should say in English that a value is missing, and that no contact is received', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.OnlyWhoTheyAre.run()

    // Assert
    expect(details()).toMatchObject({
      'Phonetic name': 'Not recorded',
      Address: 'Not recorded',
      'Date of birth': 'Not recorded',
      'Favorite services': 'None',
      'Messages you receive': 'None',
    })
  })
})
