import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { rowsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as operationRunStories from './operation-run.stories'

const stories = composeStories(operationRunStories)

const part = (name = 'ポイントの失効') => screen.getByRole('region', { name })

describe('OperationRun', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say what the operation does, and open the dialog when its button is pressed', async () => {
    // Arrange
    const onAsk = vi.fn()
    await stories.Offered.run({ args: { ...stories.Offered.args, onAsk } })

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: 'ポイントを失効させる' }),
    )

    // Assert
    expect(part()).toHaveTextContent(
      '有効期限の過ぎたポイントを、すべてのお客様について失効させ、残高から引きます。',
    )
    expect(screen.queryByRole('alert')).toBeNull()
    expect(onAsk).toHaveBeenCalledOnce()
  })

  it('should ask, saying what cannot be undone, and run or change nothing as its buttons say', async () => {
    // Arrange
    const onRun = vi.fn()
    const onClose = vi.fn()
    await stories.Asking.run({
      args: { ...stories.Asking.args, onRun, onClose },
    })
    const dialog = screen.getByRole('dialog', {
      name: '有効期限の過ぎたポイントを失効させますか？',
    })
    expect(dialog).toHaveAccessibleDescription(
      '失効させたポイントは、もう使えません。取り消せません。ポイントを失効させたお客様ごとに、失効の取引を 1 件記録します。',
    )

    // Act
    await userEvent.click(
      within(dialog).getByRole('button', { name: '失効させる' }),
    )
    await userEvent.click(within(dialog).getByRole('button', { name: '戻る' }))

    // Assert
    expect(onRun).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('should not run twice while a run is on its way', async () => {
    // Arrange
    const onRun = vi.fn()
    await stories.Pending.run({ args: { ...stories.Pending.args, onRun } })

    // Act
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: '失効させる',
      }),
    )

    // Assert
    expect(onRun).not.toHaveBeenCalled()
  })

  it('should say in the dialog that the last attempt may have stopped halfway', async () => {
    // Act
    await stories.Failed.run()

    // Assert
    expect(
      within(screen.getByRole('dialog')).getByRole('alert'),
    ).toHaveTextContent(
      'ポイントの失効を終えられませんでした。途中で止まったときも、それまでの分は失効させてあります。',
    )
  })

  it('should say why the account runs nothing', async () => {
    // Act
    await stories.Forbidden.run()

    // Assert
    expect(within(part()).getByRole('alert')).toHaveTextContent(
      'このアカウントでは、運用の操作を行えません。',
    )
  })

  it('should say when the operation ran, and what it did', async () => {
    // Act
    await stories.Expired.run()

    // Assert
    expect(part()).toHaveTextContent(
      '2026年11月20日（金） 12:00に実行しました。3 人のお客様の、合わせて 1,250 ポイントを失効させました。',
    )
  })

  it('should list what a run did below what it said', async () => {
    // Act
    await stories.Erased.run()

    // Assert
    const erasure = part('データの消去の依頼の実行')
    expect(erasure).toHaveTextContent(
      '2 件の依頼を実行して、お客様のデータを消去しました。',
    )
    expect(
      within(erasure)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['受け付けた日時', '消去の予定日時', '依頼の理由'])
    expect(rowsOf(erasure)).toEqual([
      [
        '2026年11月5日（木） 10:30',
        '2026年11月19日（木） 10:30',
        '本人から、来店の記録も含めて消してほしいと電話で依頼があった',
      ],
      [
        '2026年11月6日（金） 14:10',
        '2026年11月20日（金） 14:10',
        'アカウントを削除したので、台帳からも消してほしいとメールで依頼があった',
      ],
    ])
  })
})

describe('OperationRun on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should say what the operation does, and ask before it runs, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Asking.run()

    // Assert
    expect(part('Expiring points')).toHaveTextContent(
      /^Expiring pointsExpires the points past their date of expiry for every customer/,
    )
    const dialog = screen.getByRole('dialog', {
      name: 'Expire the points past their date of expiry?',
    })
    expect(dialog).toHaveAccessibleDescription(
      'Expired points can no longer be used. This cannot be undone. One expiry transaction is recorded for each customer whose points expire.',
    )
    expect(within(dialog).getByRole('button', { name: 'Expire' })).toBeVisible()
    expect(within(dialog).getByRole('button', { name: 'Back' })).toBeVisible()
  })

  it('should say in English when the operation ran, and what it did', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Expired.run()

    // Assert
    expect(part('Expiring points')).toHaveTextContent(
      'Ran on Fri, November 20, 2026 at 12:00. Expired 1,250 points of 3 customers in all.',
    )
  })

  it('should list in English what a run did below what it said', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Erased.run()

    // Assert
    const erasure = part('Carrying out the requests to erase data')
    expect(erasure).toHaveTextContent(
      'Carried out 2 requests, and erased the data of the customers.',
    )
    expect(
      within(erasure)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Taken', 'Scheduled erasure', 'Reason for the request'])
    expect(rowsOf(erasure)[0]?.slice(0, 2)).toEqual([
      'Thu, November 5, 2026 at 10:30',
      'Thu, November 19, 2026 at 10:30',
    ])
  })

  it('should say in English why the account runs nothing', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Forbidden.run()

    // Assert
    expect(
      within(part('Expiring points')).getByRole('alert'),
    ).toHaveTextContent(/^This account cannot run the operations\./)
  })
})
