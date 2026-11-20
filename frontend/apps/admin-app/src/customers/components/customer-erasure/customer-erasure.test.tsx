import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import * as customerErasureStories from './customer-erasure.stories'

const stories = composeStories(customerErasureStories)

const ASK = '消去の依頼を受け付けますか？'

const CANCEL = '消去の依頼を取り消しますか？'

const dialog = (name: string): HTMLElement =>
  screen.getByRole('dialog', { name })

const part = (): HTMLElement =>
  screen.getByRole('region', { name: 'データの消去' })

describe('CustomerErasure', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say what erasing does, and open the dialog of a request when asked', async () => {
    // Arrange
    await stories.NoRequest.run()
    expect(part()).toHaveTextContent(
      '受け付けてから 14 日のあいだは取り消せ、そのあとで消去します。',
    )
    expect(part()).toHaveTextContent(
      '売上と、売上のもとになった予約は、帳簿の保存のために残し、お客様を特定できる情報を消します。',
    )
    expect(screen.queryByRole('dialog')).toBeNull()

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '消去の依頼を受け付ける' }),
    )

    // Assert
    expect(stories.NoRequest.args.onOpen).toHaveBeenCalledWith('ask')
  })

  it('should ask for the reason in the dialog, and send the form', async () => {
    // Arrange
    const received: [string, FormDataEntryValue][][] = []
    await stories.Asking.run({
      args: {
        ...stories.Asking.args,
        onAsk: vi.fn((values: FormData) => {
          received.push(Array.from(values.entries()))
        }),
      },
    })
    expect(dialog(ASK)).toHaveAccessibleDescription(
      '田中 優希 様のデータの消去の依頼を受け付けます。受け付けてから 14 日のあいだは、取り消せます。',
    )
    const reason = within(dialog(ASK)).getByRole('textbox', {
      name: '依頼の理由',
    })
    expect(reason).toBeRequired()

    // Act
    await userEvent.type(reason, 'お電話でお申し出')
    await userEvent.click(
      within(dialog(ASK)).getByRole('button', { name: '受け付ける' }),
    )

    // Assert
    expect(received).toEqual([[['reason', 'お電話でお申し出']]])
  })

  it('should close the dialog of a request from its button that changes nothing', async () => {
    // Arrange
    await stories.Asking.run()

    // Act
    await userEvent.click(
      within(dialog(ASK)).getByRole('button', { name: '戻る' }),
    )

    // Assert
    expect(stories.Asking.args.onClose).toHaveBeenCalled()
    expect(stories.Asking.args.onAsk).not.toHaveBeenCalled()
  })

  it('should say under the reason what is wrong with it, with the focus on it', async () => {
    // Act
    await stories.BlankReason.run()

    // Assert
    const reason = within(dialog(ASK)).getByRole('textbox', {
      name: '依頼の理由',
    })
    expect(reason).toBeInvalid()
    expect(reason).toHaveAccessibleDescription(
      expect.stringContaining('依頼の理由を入力してください。'),
    )
    expect(reason).toHaveFocus()
  })

  it('should say in the dialog what may be tried again', async () => {
    // Act
    await stories.NotAsked.run()

    // Assert
    expect(within(dialog(ASK)).getByRole('alert')).toHaveTextContent(
      '消去の依頼を受け付けられませんでした。通信の状態を確かめて、もう一度お試しください。',
    )
  })

  it('should show a pending request with its moments at the salon and its reason, and offer to call it off', async () => {
    // Arrange
    await stories.Pending.run()
    expect(
      within(part())
        .getAllByRole('term')
        .map((term) => [
          term.textContent,
          term.nextElementSibling?.textContent,
        ]),
    ).toEqual([
      ['受け付けた日時', '2026年11月20日（金） 10:30'],
      ['消去の予定', '2026年12月4日（金） 10:30 以降'],
      ['依頼の理由', '店頭で、ご本人から口頭でお申し出がありました。'],
    ])
    expect(
      screen.queryByRole('button', { name: '消去の依頼を受け付ける' }),
    ).toBeNull()

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '依頼を取り消す' }),
    )

    // Assert
    expect(stories.Pending.args.onOpen).toHaveBeenCalledWith('cancel')
  })

  it('should ask before calling a request off', async () => {
    // Arrange
    await stories.Cancelling.run()
    expect(dialog(CANCEL)).toHaveAccessibleDescription(
      '田中 優希 様のデータは消去されません。ご本人が依頼を撤回したときや、誤って受け付けたときに取り消します。',
    )

    // Act
    await userEvent.click(
      within(dialog(CANCEL)).getByRole('button', { name: '取り消す' }),
    )

    // Assert
    expect(stories.Cancelling.args.onCancel).toHaveBeenCalledTimes(1)
  })

  it('should not call the request off again while the calling off is on its way', async () => {
    // Arrange
    await stories.CallingOff.run()

    // Act
    await userEvent.click(
      within(dialog(CANCEL)).getByRole('button', { name: '取り消す' }),
    )

    // Assert
    expect(stories.CallingOff.args.onCancel).not.toHaveBeenCalled()
  })

  it('should say when a request was called off, and take a new one', async () => {
    // Act
    await stories.Cancelled.run()

    // Assert
    expect(part()).toHaveTextContent(
      '2026年11月20日（金） 10:30 に受け付けた依頼は、2026年11月21日（土） 15:00 に取り消しました。',
    )
    expect(
      screen.getByRole('button', { name: '消去の依頼を受け付ける' }),
    ).toBeVisible()
  })

  it('should say when the data was erased, and that the customer is to be told', async () => {
    // Act
    await stories.Completed.run()

    // Assert
    expect(part()).toHaveTextContent(
      '2026年11月20日（金） 10:30 に受け付けた依頼により、2026年12月5日（土） 09:00 にデータを消去しました。消去したことを、ご本人にお知らせください。',
    )
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('should take no request of a customer who left the ledger', async () => {
    // Act
    await stories.RemovedWithoutRequest.run()

    // Assert
    expect(part()).toHaveTextContent('消去の依頼はありません。')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('should say under the heading what changed meanwhile', async () => {
    // Act
    await stories.TakenMeanwhile.run()

    // Assert
    expect(within(part()).getByRole('status')).toHaveTextContent(
      'その間に、ほかのアカウントがこのお客様の消去の依頼を受け付けていました。',
    )
  })

  it('should read again what could not be read when asked', async () => {
    // Arrange
    await stories.Unread.run()

    // Act
    await userEvent.click(
      within(part()).getByRole('button', { name: 'もう一度読み込む' }),
    )

    // Assert
    expect(stories.Unread.args.onRetry).toHaveBeenCalledTimes(1)
  })
})
