import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import { salon } from '../../../bookings/components/examples'
import * as customerMergeStories from './customer-merge.stories'

const stories = composeStories(customerMergeStories)

const TITLE = '2 人のお客様を 1 人にまとめますか？'

/** The page of the customer who referred the one registered again */
const REFERRER_HREF = `/salons/${salon.id}/customers/d2a0e5b8-7f9d-4b1e-a3c5-1e8f4a7b9cd6`

/** The rows of the items the two differ in: the item, the kept one, the merged one, and the merge */
const differences = (): (string | null)[][] =>
  within(screen.getByRole('table', { name: '2 人で違う項目' }))
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      [
        ...within(row).getAllByRole('rowheader'),
        ...within(row).getAllByRole('cell'),
      ].map((cell) => cell.textContent),
    )

describe('CustomerMerge', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should keep the customer of the address at first, and show the items the two differ in with what the merge makes of them', async () => {
    // Act
    await stories.KeepingThisOne.run()

    // Assert
    expect(
      screen.getByRole('radio', {
        name: 'このお客様: 山田 花子 様（hanako@example.com）',
      }),
    ).toBeChecked()
    expect(screen.getByRole('radio', { name: '残すお客様の値' })).toBeChecked()
    expect(
      within(screen.getByRole('table', { name: '2 人で違う項目' }))
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual([
      '項目',
      '残す 山田 花子 様',
      'まとめる 山田 花子 様',
      'まとめたあと',
    ])
    expect(differences()).toEqual([
      ['フリガナ', 'ヤマダ ハナコ', '記録なし', 'ヤマダ ハナコ'],
      [
        'メールアドレス',
        'hanako@example.com',
        'hanako.yamada@example.com',
        'hanako@example.com',
      ],
      ['職業', '記録なし', '会社員', '会社員'],
      ['タグ', 'vip', 'なし', 'vip'],
      ['紹介元', 'なし', '紹介したお客様', '紹介したお客様'],
    ])
    expect(
      screen.getByText(
        '予約、売上、施術記録、レビューは、山田 花子 様のものになります。好み設定、カルテ、アレルギーは、2 人のものを合わせます。ポイントは、2 人の残高を合わせて 1,500 ポイントになります。',
      ),
    ).toBeVisible()
  })

  it('should lead to the customer who referred one of them', async () => {
    // Act
    await stories.KeepingThisOne.run()

    // Assert
    expect(
      within(screen.getByRole('table', { name: '2 人で違う項目' }))
        .getAllByRole('link', { name: '紹介したお客様' })
        .map((link) => link.getAttribute('href')),
    ).toEqual([REFERRER_HREF, REFERRER_HREF])
  })

  it('should hand up the customer to keep and the way to merge', async () => {
    // Arrange
    await stories.KeepingThisOne.run()

    // Act
    await userEvent.click(
      screen.getByRole('radio', {
        name: '選んだお客様: 山田 花子 様（hanako.yamada@example.com）',
      }),
    )
    await userEvent.click(
      screen.getByRole('radio', { name: 'あとから台帳を直したほうの値' }),
    )

    // Assert
    expect(stories.KeepingThisOne.args.onKeep).toHaveBeenCalledWith(false)
    expect(stories.KeepingThisOne.args.onWay).toHaveBeenCalledWith(
      'keep_newest',
    )
  })

  it('should take the values of the one changed last when the other is kept', async () => {
    // Act
    await stories.KeepingTheOther.run()

    // Assert
    expect(differences()).toEqual([
      ['フリガナ', '記録なし', 'ヤマダ ハナコ', 'ヤマダ ハナコ'],
      [
        'メールアドレス',
        'hanako.yamada@example.com',
        'hanako@example.com',
        'hanako.yamada@example.com',
      ],
      ['職業', '会社員', '記録なし', '会社員'],
      ['タグ', 'なし', 'vip', 'vip'],
      ['紹介元', '紹介したお客様', 'なし', '紹介したお客様'],
    ])
  })

  it('should say that the two differ in nothing the ledger shows', async () => {
    // Act
    await stories.Alike.run()

    // Assert
    expect(
      screen.getByText('2 人の台帳の項目は、すべて同じです。'),
    ).toBeVisible()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('should say everything that is in the way, and offer no merge', async () => {
    // Act
    await stories.InTheWay.run()

    // Assert
    const said = screen.getByRole('status')
    expect(within(said).getByText('まとめられません')).toBeVisible()
    expect(
      within(said)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      '2 人とも、ご自分のアカウントでサインインしているお客様です。アカウントは 1 つにまとめられないため、まとめられません。',
      '山田 花子 様（hanako@example.com）から、データの削除の依頼を受け付けています。依頼を取り消してから、まとめてください。',
    ])
    expect(screen.queryByRole('button', { name: 'まとめる' })).toBeNull()
  })

  it('should say why the last attempt was refused', async () => {
    // Act
    await stories.Refused.run()

    // Assert
    expect(screen.getByRole('alert').textContent).toBe(
      'その間に 2 人の記録が変わったため、まとめられませんでした。2 人の記録を読み直しました。',
    )
  })

  it('should open the dialog from the button', async () => {
    // Arrange
    await stories.KeepingThisOne.run()

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'まとめる' }))

    // Assert
    expect(stories.KeepingThisOne.args.onOpen).toHaveBeenCalledOnce()
  })

  it('should say who is kept and who leaves the ledger for good before the merge', async () => {
    // Arrange
    await stories.Asking.run()
    const dialog = screen.getByRole('dialog', { name: TITLE })

    // Act
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'まとめる' }),
    )
    await userEvent.click(within(dialog).getByRole('button', { name: '戻る' }))

    // Assert
    expect(dialog).toHaveAccessibleDescription(
      '山田 花子 様（hanako@example.com）を残し、山田 花子 様（hanako.yamada@example.com）を台帳から削除します。削除したお客様は、台帳に戻せません。',
    )
    expect(stories.Asking.args.onMerge).toHaveBeenCalledOnce()
    expect(stories.Asking.args.onClose).toHaveBeenCalledOnce()
  })

  it('should say in the dialog that the merge was not sent', async () => {
    // Act
    await stories.NotSent.run()

    // Assert
    expect(
      within(screen.getByRole('dialog', { name: TITLE })).getByRole('alert')
        .textContent,
    ).toBe(
      'お客様をまとめられませんでした。通信の状態を確かめて、もう一度お試しください。',
    )
  })
})
