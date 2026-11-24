import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { rowsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import { aCustomer, salon } from '../../../bookings/components/examples'
import * as allergyListStories from './allergy-list.stories'

const stories = composeStories(allergyListStories)

const CHART = `/salons/${salon.id}/customers/${aCustomer().id}/chart`

const TITLE = 'パラフェニレンジアミン（PPD）の記録を削除しますか？'

const part = (): HTMLElement =>
  screen.getByRole('region', { name: 'アレルギー' })

const dialog = (): HTMLElement => screen.getByRole('dialog', { name: TITLE })

describe('AllergyList', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should list the allergies as they come, the heaviest first, with their severity in a word', async () => {
    // Act
    await stories.Listed.run()

    // Assert
    expect(rowsOf(part())).toEqual([
      [
        'ラテックス',
        '命に関わる',
        'ラテックス',
        '手袋が触れたところに、じんましんと息苦しさが出た。',
        'ラテックスの手袋は使わない。',
        '不明',
        '直す削除',
      ],
      [
        'パラフェニレンジアミン（PPD）',
        '重い',
        '化学物質',
        'カラー剤で頭皮に赤みとかゆみが出た。',
        'ジアミンを含まないカラー剤を使う。\nパッチテストを先に。',
        '2025年6月10日（火）',
        '直す削除',
      ],
      ['強い香料', '軽い', '香料', '記録なし', '記録なし', '不明', '直す削除'],
    ])
    expect(within(part()).getByRole('status')).toHaveTextContent('3 件')
  })

  it('should lead to the screen that records an allergy, and to the change of each, named by its allergen', async () => {
    // Act
    await stories.Listed.run()

    // Assert
    expect(
      within(part()).getByRole('link', { name: 'アレルギーを記録する' }),
    ).toHaveAttribute('href', `${CHART}/allergies/new`)
    expect(
      within(part()).getByRole('link', { name: '強い香料の記録を直す' }),
    ).toHaveAttribute(
      'href',
      `${CHART}/allergies/c9e1a3b5-7d4f-4a8b-8c2e-4f6b8d0a2c35/edit`,
    )
  })

  it('should open the dialog for the allergy whose button was pressed', async () => {
    // Arrange
    await stories.Listed.run()
    expect(screen.queryByRole('dialog')).toBeNull()

    // Act
    await userEvent.click(
      within(part()).getByRole('button', { name: '強い香料の記録を削除する' }),
    )

    // Assert
    expect(stories.Listed.args.onOpen).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ allergenName: '強い香料' }),
    )
  })

  it('should tell a member of the staff who removes an allergy, and let them change it', async () => {
    // Act
    await stories.ByStaff.run()

    // Assert
    expect(
      screen.getByText(
        '間違えて記録したアレルギーの削除は、オーナーとマネージャーができます。',
      ),
    ).toBeVisible()
    expect(within(part()).queryByRole('button')).toBeNull()
    expect(
      within(part()).getByRole('link', { name: '強い香料の記録を直す' }),
    ).toBeVisible()
  })

  it('should name the allergy, say that a removal is for one recorded by mistake and is not undone, and remove when it is confirmed', async () => {
    // Arrange
    await stories.Asking.run()
    expect(dialog()).toHaveAccessibleDescription(
      '間違えて記録したアレルギーを、カルテから削除します。削除した記録は、元に戻せません。',
    )

    // Act
    await userEvent.click(
      within(dialog()).getByRole('button', { name: '削除する' }),
    )

    // Assert
    expect(stories.Asking.args.onRemove).toHaveBeenCalledTimes(1)
    expect(stories.Asking.args.onClose).not.toHaveBeenCalled()
  })

  it('should remove nothing when the button that changes nothing is pressed', async () => {
    // Arrange
    await stories.Asking.run()

    // Act
    await userEvent.click(
      within(dialog()).getByRole('button', { name: '戻る' }),
    )

    // Assert
    expect(stories.Asking.args.onClose).toHaveBeenCalledTimes(1)
    expect(stories.Asking.args.onRemove).not.toHaveBeenCalled()
  })

  it('should say in the dialog what may be tried again, and keep its button busy while the removal is on its way', async () => {
    // Act
    await stories.RemovalFailed.run()

    // Assert
    expect(within(dialog()).getByRole('alert')).toHaveTextContent(
      'アレルギーの記録を削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
    )

    // Act
    await stories.Removing.run()

    // Assert
    expect(
      within(dialog()).getByRole('button', { name: '削除する' }),
    ).toHaveAttribute('aria-busy', 'true')
  })

  it('should say under the heading what changed meanwhile, when the user is idle', async () => {
    // Act
    await stories.Gone.run()

    // Assert
    expect(
      within(part())
        .getAllByRole('status')
        .map((status) => status.textContent),
    ).toEqual([
      'その間に、ほかのアカウントがこのアレルギーの記録を削除していました。',
      '3 件',
    ])
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('should say that the customer has no allergies, and still lead to the screen that records one', async () => {
    // Act
    await stories.NoAllergies.run()

    // Assert
    expect(
      within(part()).getByText('アレルギーの記録はありません'),
    ).toBeVisible()
    expect(
      within(part()).getByRole('link', { name: 'アレルギーを記録する' }),
    ).toBeVisible()
  })

  it('should say how many are shown, and ask for the next ones', async () => {
    // Arrange
    await stories.More.run()
    expect(within(part()).getByRole('status')).toHaveTextContent(
      '21 件（1 件を表示しています）',
    )

    // Act
    await userEvent.click(
      within(part()).getByRole('button', { name: 'さらに表示' }),
    )

    // Assert
    expect(stories.More.args.onMore).toHaveBeenCalledTimes(1)
  })

  it('should say that the allergies are read, and read them again when they could not be', async () => {
    // Act
    await stories.Reading.run()

    // Assert
    expect(
      within(part()).getByText('アレルギーを読み込んでいます'),
    ).toBeVisible()

    // Act
    await stories.Unread.run()
    await userEvent.click(
      within(part()).getByRole('button', { name: 'もう一度読み込む' }),
    )

    // Assert
    expect(stories.Unread.args.onRetry).toHaveBeenCalledTimes(1)
  })
})

describe('AllergyList on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should list the allergies with their severity and kind, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Listed.run()

    // Assert
    const allergiesPart = screen.getByRole('region', { name: 'Allergies' })
    expect(rowsOf(allergiesPart)[1]).toEqual([
      'パラフェニレンジアミン（PPD）',
      'Severe',
      'Chemical',
      'カラー剤で頭皮に赤みとかゆみが出た。',
      'ジアミンを含まないカラー剤を使う。\nパッチテストを先に。',
      'Tue, June 10, 2025',
      'EditRemove',
    ])
    expect(rowsOf(allergiesPart)[0]?.slice(1, 3)).toEqual([
      'Life-threatening',
      'Latex',
    ])
    expect(rowsOf(allergiesPart)[0]?.[5]).toBe('Unknown')
    expect(within(allergiesPart).getByRole('status')).toHaveTextContent(
      '3 items',
    )
    expect(
      within(allergiesPart).getByRole('link', {
        name: 'Edit the record of パラフェニレンジアミン（PPD）',
      }),
    ).toBeVisible()
  })

  it('should ask before removing an allergy, and say what went wrong, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.RemovalFailed.run()

    // Assert
    const asking = screen.getByRole('dialog', {
      name: 'Remove the record of パラフェニレンジアミン（PPD）?',
    })
    expect(asking).toHaveAccessibleDescription(
      'Removes an allergy recorded by mistake from the chart. A removed record cannot be restored.',
    )
    expect(within(asking).getByRole('alert')).toHaveTextContent(
      'Could not remove the allergy record. Check your connection and try again.',
    )
    expect(within(asking).getByRole('button', { name: 'Back' })).toBeVisible()
  })

  it('should tell a member of the staff who removes an allergy, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.ByStaff.run()

    // Assert
    expect(
      screen.getByText(
        'Owners and managers can remove an allergy recorded by mistake.',
      ),
    ).toBeVisible()
  })
})
