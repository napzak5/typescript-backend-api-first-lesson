import {
  itShouldBeAccessibleInEveryStory,
  setWindowWidth,
} from '@beauty-salon-frontend/testing'
import { composeStories, composeStory } from '@storybook/react-vite'
import { act, useLayoutEffect, useState } from 'react'
import { screen, userEvent, within } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import { Button } from '../button/button'
import { PageHeader } from '../page-header/page-header'
import * as appShellStories from './app-shell.stories'
import { useScreenHeadingFocus } from './screens'

const stories = composeStories(appShellStories)

type WhatTheDocumentSays = (focused: Element | null, title: string) => void

/**
 * The list of the bookings, then a booking whose button goes when it is
 * pressed, and what the document says in every commit: the layout effects
 * of a component run in the order they are written.
 */
const AScreenAfterAnother = ({ seen }: { seen: WhatTheDocumentSays }) => {
  const [opened, setOpened] = useState(false)
  const [cancelled, setCancelled] = useState(false)
  const focusHeading = useScreenHeadingFocus()

  useLayoutEffect(() => {
    if (cancelled) {
      focusHeading()
    }
  }, [cancelled, focusHeading])

  useLayoutEffect(() => {
    seen(document.activeElement, document.title)
  })

  return opened ? (
    <>
      <PageHeader title='予約の内容' />
      {!cancelled && (
        <p>
          <Button onClick={() => setCancelled(true)}>
            予約をキャンセルする
          </Button>
        </p>
      )}
    </>
  ) : (
    <>
      <PageHeader title='予約の一覧' />
      <p>
        <Button onClick={() => setOpened(true)}>予約を開く</Button>
      </p>
    </>
  )
}

/**
 * Two screens, and what the document says in the commit that shows each: the
 * layout effect of a component runs after those of what it holds, and before
 * the browser paints.
 */
const ScreensInCommit = ({ seen }: { seen: WhatTheDocumentSays }) => {
  const [shown, setShown] = useState('予約台帳')

  useLayoutEffect(() => {
    seen(document.activeElement, document.title)
  })

  return (
    <>
      <PageHeader title={shown} />
      <p>
        <Button onClick={() => setShown('顧客台帳')}>顧客台帳を開く</Button>
      </p>
    </>
  )
}

describe('AppShell', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should name the application in the banner, with a link to its first screen beside the mark', async () => {
    // Act
    await stories.NavigationInHeader.run()

    // Assert: the mark adds nothing to the name of the link, and is not read out
    const name = within(screen.getByRole('banner')).getByRole('link', {
      name: 'Kushi Admin',
    })
    expect(name).toHaveAttribute('href', '/')
    expect(name.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('should hold the content of the screen in the main landmark', async () => {
    // Act
    await stories.NavigationInHeader.run()

    // Assert
    expect(
      within(screen.getByRole('main')).getByRole('heading', {
        level: 1,
        name: '予約台帳',
      }),
    ).toBeVisible()
  })

  it('should hold the navigation outside the main content', async () => {
    // Act
    await stories.NavigationInHeader.run()

    // Assert
    expect(
      screen.getByRole('navigation', { name: 'メインメニュー' }),
    ).toBeVisible()
    expect(
      within(screen.getByRole('main')).queryByRole('navigation'),
    ).toBeNull()
  })

  it('should show what belongs to the account in the banner', async () => {
    // Act
    await stories.NavigationInHeader.run()
    const banner = within(screen.getByRole('banner'))

    // Assert
    expect(banner.getByText('佐藤 美咲')).toBeVisible()
    expect(banner.getByRole('button', { name: 'サインアウト' })).toBeVisible()
  })

  it('should keep the place of the notification at the top of the main content', async () => {
    // Act
    await stories.NavigationInHeader.run()
    const main = screen.getByRole('main')

    // Assert
    expect(main.firstElementChild).toContainElement(
      within(main).getByRole('status'),
    )
    expect(main.lastElementChild).toContainElement(
      within(main).getByRole('heading', { level: 1 }),
    )
    expect(within(main).getByRole('status')).toBeEmptyDOMElement()
  })

  it('should offer a link to the main content as the first stop of the Tab key', async () => {
    // Arrange
    await stories.NavigationInHeader.run()

    // Act
    await userEvent.tab()

    // Assert
    expect(screen.getByRole('link', { name: '本文へ移動' })).toHaveFocus()
    expect(screen.getByRole('link', { name: '本文へ移動' })).toHaveAttribute(
      'href',
      '#main',
    )
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main')
  })

  it('should keep the link to the main content out of sight until the keyboard reaches it', async () => {
    // Act
    await stories.NavigationInHeader.run()

    // Assert
    expect(screen.getByRole('link', { name: '本文へ移動' })).toHaveClass(
      'skipLink',
      'hidden',
    )
  })

  it('should mark the link of the current screen in the navigation', async () => {
    // Act
    await stories.NavigationInHeader.run()

    // Assert
    const navigation = within(
      screen.getByRole('navigation', { name: 'メインメニュー' }),
    )
    expect(navigation.getByRole('link', { name: '予約台帳' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(navigation.getAllByRole('link')).toHaveLength(4)
  })

  it('should have no navigation when the application gives it no links', async () => {
    // Arrange
    const WithoutLinks = composeStory(
      { ...appShellStories.NavigationInHeader, args: { navigation: [] } },
      appShellStories.default,
    )

    // Act
    await WithoutLinks.run()

    // Assert
    expect(screen.queryByRole('navigation')).toBeNull()
    expect(
      within(screen.getByRole('banner')).getByRole('button', {
        name: 'サインアウト',
      }),
    ).toBeVisible()
  })

  it('should hold the links and the account behind the button of the menu on a narrow screen', async () => {
    // Act
    await stories.NarrowScreen.run()

    // Assert: the header is the name and the button
    const banner = within(screen.getByRole('banner'))
    expect(banner.getByRole('link', { name: 'Kushi Admin' })).toBeVisible()
    expect(
      banner.getByRole('button', { name: 'メインメニュー' }),
    ).toHaveAttribute('aria-haspopup', 'dialog')
    expect(screen.queryByRole('navigation')).toBeNull()
    expect(screen.queryByRole('button', { name: 'サインアウト' })).toBeNull()
    expect(screen.queryByText('佐藤 美咲')).not.toBeVisible()
  })

  it('should open the menu, with the links and the account, as a dialog of its name', async () => {
    // Act
    await stories.MenuOnNarrowScreen.run()

    // Assert
    const menu = within(screen.getByRole('dialog', { name: 'メインメニュー' }))
    const links = within(
      menu.getByRole('navigation', { name: 'メインメニュー' }),
    ).getAllByRole('link')
    expect(links.map((link) => link.textContent)).toEqual([
      '予約台帳',
      '会計',
      '顧客台帳',
      'スタッフ',
    ])
    expect(links[0]).toHaveAttribute('aria-current', 'page')
    expect(menu.getByText('佐藤 美咲')).toBeVisible()
    expect(menu.getByRole('button', { name: 'サインアウト' })).toBeVisible()
    expect(menu.getByRole('button', { name: '閉じる' })).toBeVisible()
  })

  it.each<[string, string]>([
    ['link', '顧客台帳'],
    ['button', 'サインアウト'],
    ['button', '閉じる'],
  ])(
    'should close the menu once a %s in it is pressed: %s',
    async (role, name) => {
      // Arrange: links within the page, which jsdom follows
      const MenuOnNarrowScreen = composeStory(
        {
          ...appShellStories.MenuOnNarrowScreen,
          args: {
            navigation: [
              { href: '#bookings', label: '予約台帳', current: true },
              { href: '#customers', label: '顧客台帳' },
            ],
          },
        },
        appShellStories.default,
      )
      await MenuOnNarrowScreen.run()

      // Act
      await userEvent.click(
        within(screen.getByRole('dialog')).getByRole(role, { name }),
      )

      // Assert
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(
        screen.getByRole('button', { name: 'メインメニュー' }),
      ).toBeVisible()
    },
  )

  it('should close the menu on a press on the overlay, and open it again from its button', async () => {
    // Arrange
    await stories.MenuOnNarrowScreen.run()

    // Act
    await userEvent.click(screen.getByRole('dialog'))
    const closed = screen.queryByRole('dialog')
    await userEvent.click(
      screen.getByRole('button', { name: 'メインメニュー' }),
    )

    // Assert
    expect(closed).toBeNull()
    expect(screen.getByRole('dialog', { name: 'メインメニュー' })).toBeVisible()
  })

  it('should keep the account beside the name on a narrow screen without links', async () => {
    // Act
    await stories.SignedOutOnNarrowScreen.run()

    // Assert
    const banner = within(screen.getByRole('banner'))
    expect(banner.getByRole('link', { name: 'サインイン' })).toBeVisible()
    expect(banner.queryByRole('button', { name: 'メインメニュー' })).toBeNull()
  })

  it('should draw the menu when the window is made narrow, and the navigation again when it is made wide', async () => {
    // Arrange
    await stories.NavigationInHeader.run()

    // Act
    act(() => setWindowWidth(390))
    const narrow = screen.queryByRole('navigation')
    act(() => setWindowWidth(1024))

    // Assert
    expect(narrow).toBeNull()
    expect(
      screen.getByRole('navigation', { name: 'メインメニュー' }),
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: 'メインメニュー' })).toBeNull()
  })

  it('should have no navigation and nothing of an account before signing in', async () => {
    // Act
    await stories.SignedOut.run()

    // Assert
    expect(screen.queryByRole('navigation')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
    expect(
      within(screen.getByRole('banner')).getByRole('link', { name: 'Kushi' }),
    ).toHaveAttribute('href', '/')
  })

  it('should name the document after the screen and the application', async () => {
    // Act
    await stories.NavigationInHeader.run()

    // Assert
    expect(document.title).toBe('予約台帳 | Kushi Admin')
  })

  it('should name the document once when the screen is named like the application', async () => {
    // Act
    await stories.HomeScreen.run()

    // Assert
    expect(document.title).toBe('Kushi Admin')
  })

  it('should leave the focus alone for the first screen of a page', async () => {
    // Act
    await stories.ScreenChange.run()

    // Assert
    expect(document.body).toHaveFocus()
  })

  it('should move the focus to the heading of a screen that takes the place of another', async () => {
    // Arrange
    await stories.ScreenChange.run()

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '顧客台帳を開く' }),
    )

    // Assert
    expect(
      screen.getByRole('heading', { level: 1, name: '顧客台帳' }),
    ).toHaveFocus()
    expect(document.title).toBe('顧客台帳 | Kushi Admin')
  })

  it('should have moved the focus and named the document in the commit that shows the screen, before it is painted', async () => {
    // Arrange
    const seen = vi.fn<WhatTheDocumentSays>()
    const ScreenChange = composeStory(
      {
        ...appShellStories.ScreenChange,
        args: { children: <ScreensInCommit seen={seen} /> },
      },
      appShellStories.default,
    )
    await ScreenChange.run()

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '顧客台帳を開く' }),
    )

    // Assert
    expect(seen).toHaveBeenLastCalledWith(
      screen.getByRole('heading', { level: 1, name: '顧客台帳' }),
      '顧客台帳 | Kushi Admin',
    )
  })

  it('should move the focus to the heading of the screen when the screen asks for it: a step took the place of what had the focus', async () => {
    // Arrange
    await stories.StepChange.run()

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: 'お客様の情報を登録する' }),
    )

    // Assert
    expect(
      screen.getByRole('heading', { level: 1, name: '予約する' }),
    ).toHaveFocus()
  })

  it('should leave the focus alone until a screen asks for it', async () => {
    // Act
    await stories.StepChange.run()

    // Assert
    expect(document.body).toHaveFocus()
  })

  it('should move the focus for a screen that asks for it to the heading that is shown now, in the commit the screen asks in, before it is painted', async () => {
    // Arrange
    const seen = vi.fn<WhatTheDocumentSays>()
    const AfterAnotherScreen = composeStory(
      {
        ...appShellStories.StepChange,
        args: { children: <AScreenAfterAnother seen={seen} /> },
      },
      appShellStories.default,
    )
    await AfterAnotherScreen.run()
    await userEvent.click(screen.getByRole('button', { name: '予約を開く' }))
    await userEvent.tab()
    const onTheButton = document.activeElement

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '予約をキャンセルする' }),
    )

    // Assert
    expect(onTheButton).toHaveAccessibleName('予約をキャンセルする')
    expect(seen).toHaveBeenLastCalledWith(
      screen.getByRole('heading', { level: 1, name: '予約の内容' }),
      '予約の内容 | Kushi Admin',
    )
  })

  it('should keep the heading out of the stops of the Tab key', async () => {
    // Act
    await stories.NavigationInHeader.run()

    // Assert
    expect(screen.getByRole('heading', { level: 1 })).toHaveAttribute(
      'tabindex',
      '-1',
    )
  })
})
