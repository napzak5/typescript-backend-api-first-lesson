import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories, composeStory } from '@storybook/react-vite'
import { useState } from 'react'
import { fireEvent, screen, userEvent, within } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import { phone, sessions, thisDevice, unrecorded } from '../examples'
import { SessionList, type SessionListProps } from './session-list'
import * as sessionListStories from './session-list.stories'

const stories = composeStories(sessionListStories)

/** The devices of the list, which is named in the language of the page */
const listed = (name = 'サインインしている端末'): HTMLElement[] =>
  within(screen.getByRole('list', { name })).getAllByRole('listitem')

const deviceAt = (index: number, list?: string): HTMLElement => {
  const device = listed(list).at(index)
  if (device === undefined) {
    throw new Error(`The list has no device at ${index}`)
  }

  return device
}

const nameOf = (device: HTMLElement): HTMLElement =>
  within(device).getByRole('heading', { level: 3 })

/** What a row says of its device, as the pairs of a description list. */
const detailsOf = (device: HTMLElement): string[] =>
  within(device)
    .getAllByRole('term')
    .map(
      (term) => `${term.textContent}: ${term.nextElementSibling?.textContent}`,
    )

const moreButton = (name = 'さらに表示'): HTMLElement =>
  screen.getByRole('button', { name })

const PHONE = '2026年11月13日 20:00 にサインインした端末'

type GrowingListProps = SessionListProps & {
  /** The sessions the list gets, one by one */
  coming: readonly SessionListProps['sessions'][number][]
}

/**
 * A list that gets a device when its button is pressed, as the screen does
 * when the next page arrives, and one when 「読み込み直す」 is: a list that
 * is read again may have a device more.
 */
const GrowingList = ({ coming, ...props }: GrowingListProps) => {
  const [shown, setShown] = useState(props.sessions)
  const add = (): void => setShown(coming.slice(0, shown.length + 1))

  return (
    <>
      <SessionList {...props} sessions={shown} onMore={add} />
      <button type='button' onClick={add}>
        読み込み直す
      </button>
    </>
  )
}

const growing = composeStory(
  {
    ...sessionListStories.WithMore,
    args: { ...sessionListStories.WithMore.args, sessions: [thisDevice] },
    render: (args) => <GrowingList {...args} coming={sessions} />,
  },
  sessionListStories.default,
)

describe('SessionList', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should name every device after the moment it signed in, in the order it is given, and mark this one', async () => {
    // Act
    await stories.SeveralDevices.run()

    // Assert
    expect(listed().map((device) => nameOf(device).textContent)).toEqual([
      '2026年11月20日 10:15 にサインインした端末',
      '2026年11月20日 8:30 にサインインした端末',
      PHONE,
    ])
    expect(within(deviceAt(0)).getByText('この端末')).toBeVisible()
    expect(within(deviceAt(1)).queryByText('この端末')).toBeNull()
    expect(within(deviceAt(2)).queryByText('この端末')).toBeNull()
  })

  it('should say what the API kept of a device: the browser as it is, the address, when it was used last and when its sign-in runs out', async () => {
    // Act
    await stories.SeveralDevices.run()

    // Assert
    expect(detailsOf(deviceAt(2))).toEqual([
      `ブラウザー: ${phone.userAgent}`,
      'IP アドレス: 198.51.100.7',
      '最後に使われた日時: 2026年11月19日 21:00',
      'サインインが切れる日時: 2026年12月13日 20:00',
    ])
  })

  it('should say that the API kept neither the browser nor the address of a device', async () => {
    // Act
    await stories.SeveralDevices.run()

    // Assert
    expect(unrecorded.userAgent).toBeNull()
    expect(detailsOf(deviceAt(1)).slice(0, 2)).toEqual([
      'ブラウザー: 記録されていません',
      'IP アドレス: 記録されていません',
    ])
  })

  it('should offer to sign out every device but this one, each button named after its device', async () => {
    // Act
    await stories.SeveralDevices.run()

    // Assert
    expect(within(deviceAt(0)).queryByRole('button')).toBeNull()
    expect(
      screen
        .getAllByRole('button', { name: /をサインアウトさせる$/ })
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual([
      '2026年11月20日 8:30 にサインインした端末をサインアウトさせる',
      `${PHONE}をサインアウトさせる`,
    ])
  })

  it('should hand over the device whose button was pressed, and nothing else', async () => {
    // Arrange
    await stories.SeveralDevices.run()

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: `${PHONE}をサインアウトさせる` }),
    )

    // Assert
    expect(stories.SeveralDevices.args.onEnd).toHaveBeenCalledTimes(1)
    expect(stories.SeveralDevices.args.onEnd).toHaveBeenCalledWith(phone)
  })

  it('should show that the device is being signed out, at its own button alone', async () => {
    // Act
    await stories.Ending.run()

    // Assert
    expect(within(deviceAt(2)).getByRole('button')).toHaveAttribute(
      'aria-busy',
      'true',
    )
    expect(within(deviceAt(1)).getByRole('button')).not.toHaveAttribute(
      'aria-busy',
    )
  })

  it('should have nothing to press where this is the only device', async () => {
    // Act
    await stories.OnlyThisDevice.run()

    // Assert
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent(
      '1 台の端末でサインインしています',
    )
  })

  describe('a list that goes on', () => {
    it.each([
      [stories.SeveralDevices, '3 台の端末でサインインしています'],
      [
        stories.WithMore,
        '24 台の端末でサインインしています（3 台を表示しています）',
      ],
      [stories.NotCounted, '3 台を表示しています'],
    ])(
      'should say how many devices there are and how many are shown: %#',
      async (story, count) => {
        // Act
        await story.run()

        // Assert
        expect(screen.getByRole('status')).toHaveTextContent(count)
      },
    )

    it('should have no button below the devices when every device is shown', async () => {
      // Act
      await stories.SeveralDevices.run()

      // Assert
      expect(screen.queryByRole('button', { name: 'さらに表示' })).toBeNull()
    })

    it('should ask for the next devices when its button is pressed', async () => {
      // Arrange
      await stories.WithMore.run()

      // Act
      await userEvent.click(moreButton())

      // Assert
      expect(stories.WithMore.args.onMore).toHaveBeenCalledTimes(1)
    })

    it('should show that the next devices are on their way, and not ask for them again', async () => {
      // Arrange
      await stories.LoadingMore.run()

      // Act
      await userEvent.click(moreButton())

      // Assert
      expect(moreButton()).toHaveAttribute('aria-busy', 'true')
      expect(stories.LoadingMore.args.onMore).not.toHaveBeenCalled()
    })

    it('should say that the next devices did not come, keep those that were read, and ask again when its button is pressed', async () => {
      // Arrange
      await stories.MoreFailed.run()

      // Act
      await userEvent.click(moreButton('もう一度読み込む'))

      // Assert
      expect(screen.getByRole('alert')).toHaveTextContent(
        '続きを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
      )
      expect(stories.MoreFailed.args.onMore).toHaveBeenCalledTimes(1)
      expect(listed()).toHaveLength(3)
    })

    it('should move the focus to the first device that was added, to be read from its name', async () => {
      // Arrange
      await growing.run()

      // Act
      await userEvent.click(moreButton())

      // Assert
      expect(listed()).toHaveLength(2)
      expect(deviceAt(1)).toHaveFocus()
      expect(deviceAt(1)).toHaveAttribute('tabindex', '-1')
      expect(deviceAt(1).firstElementChild).toContainElement(
        nameOf(deviceAt(1)),
      )
    })

    it('should leave the focus where it is when devices come that no press asked for', async () => {
      // Arrange
      await growing.run()

      // Act
      fireEvent.click(screen.getByRole('button', { name: '読み込み直す' }))

      // Assert
      expect(listed()).toHaveLength(2)
      expect(document.body).toHaveFocus()
    })

    it('should leave the focus where it is when the list appears', async () => {
      // Act
      await stories.WithMore.run()

      // Assert
      expect(document.body).toHaveFocus()
    })
  })
})

describe('SessionList on a page in English', () => {
  /** The name of the list in English */
  const DEVICES = 'Signed-in devices'

  afterEach(() => {
    localStorage.clear()
  })

  it('should name, count and describe the devices in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.SeveralDevices.run()

    // Assert
    expect(screen.getByText('Signed in on 3 devices')).toBeVisible()
    expect(listed(DEVICES).map((device) => nameOf(device).textContent)).toEqual(
      [
        'Device signed in on November 20, 2026 at 10:15',
        'Device signed in on November 20, 2026 at 08:30',
        'Device signed in on November 13, 2026 at 20:00',
      ],
    )
    expect(within(deviceAt(0, DEVICES)).getByText('This device')).toBeVisible()
    expect(detailsOf(deviceAt(1, DEVICES))).toEqual([
      'Browser: Not recorded',
      'IP address: Not recorded',
      'Last used: November 20, 2026 at 09:45',
      'Sign-in expires: November 20, 2026 at 16:30',
    ])
    expect(
      within(deviceAt(2, DEVICES)).getByRole('button', {
        name: 'Sign out the device signed in on November 13, 2026 at 20:00',
      }),
    ).toHaveTextContent('Sign out')
  })

  it.each([
    [stories.OnlyThisDevice, 'Signed in on 1 device'],
    [stories.WithMore, 'Signed in on 24 devices (showing 3)'],
    [stories.NotCounted, 'Showing 3 devices'],
  ])('should count the devices in English: %#, "%s"', async (story, count) => {
    // Arrange
    languageStore.choose('en')

    // Act
    await story.run()

    // Assert
    expect(screen.getByText(count)).toBeVisible()
  })
})
