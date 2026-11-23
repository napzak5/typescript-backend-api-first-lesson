import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { afterEach, describe, expect, it, vi } from 'vitest'
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

describe('CustomerErasure on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  const erasure = (): HTMLElement =>
    screen.getByRole('region', { name: 'Erasure of the data' })

  it('should say what erasing does, and ask for the reason, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.BlankReason.run()

    // Assert
    expect(erasure()).toHaveTextContent(
      'When a customer asks to have the personal data held of them erased, make sure it is the customer, then take the request.',
    )
    expect(
      within(erasure()).getByRole('button', {
        name: 'Take a request to erase the data',
      }),
    ).toBeVisible()
    const asking = dialog('Take the request to erase the data?')
    expect(asking).toHaveAccessibleDescription(
      'The request to erase the data of 田中 優希 will be taken. It can be cancelled for 14 days after it is taken.',
    )
    expect(
      within(asking).getByRole('textbox', { name: 'Reason for the request' }),
    ).toHaveAccessibleDescription(
      'Write the reason the customer gave, and how the request was received. It is kept with the request. Enter the reason for the request.',
    )
    expect(
      within(asking).getByRole('button', { name: 'Take the request' }),
    ).toBeVisible()
  })

  it('should show a pending request and ask before calling it off, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Cancelling.run()

    // Assert
    expect(
      within(erasure())
        .getAllByRole('term')
        .map((term) => [
          term.textContent,
          term.nextElementSibling?.textContent,
        ]),
    ).toEqual([
      ['Taken', 'Fri, November 20, 2026 at 10:30'],
      ['To be erased', 'On or after Fri, December 4, 2026 at 10:30'],
      [
        'Reason for the request',
        '店頭で、ご本人から口頭でお申し出がありました。',
      ],
    ])
    expect(erasure()).toHaveTextContent(
      'The data is erased after the scheduled time. Until then, the request can be cancelled.',
    )
    const cancelling = dialog('Cancel the request to erase the data?')
    expect(cancelling).toHaveAccessibleDescription(
      'The data of 田中 優希 will not be erased. Cancel a request when the customer withdraws it, or when it was taken by mistake.',
    )
    expect(
      within(cancelling)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Back', 'Cancel it'])
  })

  it('should say in English what became of a request', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Cancelled.run()

    // Assert
    expect(erasure()).toHaveTextContent(
      'The request taken on Fri, November 20, 2026 at 10:30 was cancelled on Sat, November 21, 2026 at 15:00.',
    )

    // Act
    await stories.RemovedWithoutRequest.run()

    // Assert
    expect(erasure()).toHaveTextContent(
      'There is no request to erase the data.',
    )
  })

  it('should say in English what changed meanwhile, and what could not be read', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.TakenMeanwhile.run()

    // Assert
    expect(within(erasure()).getByRole('status')).toHaveTextContent(
      'In the meantime, another account took a request to erase the data of this customer.',
    )

    // Act
    await stories.Unread.run()

    // Assert
    expect(erasure()).toHaveTextContent(
      'Could not load the request to erase the data. Check your connection and try again.',
    )
  })
})
