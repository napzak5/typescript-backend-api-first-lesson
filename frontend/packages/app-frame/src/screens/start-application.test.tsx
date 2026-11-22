import { type StoredSession, sessionStore } from '@beauty-salon-frontend/io'
import {
  type QueryClient,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { type ReactNode, useEffect } from 'react'
import { Link, useLocation } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import { startApplication } from './start-application'

const sessionOf = (userId: string): StoredSession => ({
  accessToken: `access-${userId}`,
  refreshToken: `refresh-${userId}`,
  userId,
})

const HANAKO = sessionOf('0193a5b2-7c4e-7d1a-9f3b-2a6c8e4d1f07')
const ICHIRO = sessionOf('0193a5b2-7c4e-7d1a-9f3b-2a6c8e4d1f08')

/** The element `index.html` of an application has for it. */
const rootOfThePage = (): HTMLElement => {
  const root = document.createElement('div')
  root.id = 'root'

  return document.body.appendChild(root)
}

/** What a test started, to end after it. */
const started: (() => void)[] = []

const start = async (application: ReactNode): Promise<() => void> => {
  const end = await act(async () => startApplication(application))
  started.push(end)

  return end
}

/** The address the router shows, and a link of it. */
const Address = () => {
  const { pathname } = useLocation()

  return (
    <>
      <p>{pathname}</p>
      <Link to='/bookings'>予約の一覧</Link>
    </>
  )
}

/** How the queries of the application are read, when a screen says nothing else. */
const QueryDefaults = () => (
  <p>{JSON.stringify(useQueryClient().getDefaultOptions().queries)}</p>
)

/** A screen that reads, and says which of its reads it shows. */
const Reading = ({ reads }: { reads: string[] }) => {
  const { data } = useQuery({
    queryKey: ['read'],
    queryFn: async () => {
      reads.push('read')

      return `${reads.length} 回目に読んだもの`
    },
  })

  return <p>{data ?? '読み込んでいます'}</p>
}

/** A screen that notes every time React shows it. */
const Noting = ({ shown }: { shown: string[] }) => {
  useEffect(() => {
    shown.push('shown')
  }, [shown])

  return <p>はじめの画面</p>
}

type Held = { client: QueryClient | undefined }

/** A screen that hands out what holds the queries of the application. */
const Holding = ({ held }: { held: Held }) => {
  held.client = useQueryClient()

  return <p>はじめの画面</p>
}

describe('startApplication', () => {
  afterEach(() => {
    act(() => {
      for (const end of started.splice(0)) {
        end()
      }
    })
    document.body.replaceChildren()
    localStorage.clear()
    window.history.replaceState(null, '', '/')
  })

  it('should draw the application in the element the page has for it, and add none', async () => {
    // Arrange
    const root = rootOfThePage()

    // Act
    await start(<p>はじめの画面</p>)

    // Assert
    expect(within(root).getByText('はじめの画面')).toBeVisible()
    expect(document.body.children).toHaveLength(1)
  })

  it('should give a page without that element one at the end of its body, and draw the application there', async () => {
    // Arrange
    document.body.appendChild(document.createElement('header'))

    // Act
    await start(<p>はじめの画面</p>)

    // Assert
    expect(screen.getByText('はじめの画面').parentElement).toBe(
      document.body.lastElementChild,
    )
    expect(document.body.lastElementChild?.tagName).toBe('DIV')
    expect(document.body.children).toHaveLength(2)
  })

  it('should show the screen of the address of the browser', async () => {
    // Arrange
    rootOfThePage()
    window.history.replaceState(null, '', '/salons/a/reports')

    // Act
    await start(<Address />)

    // Assert
    expect(screen.getByText('/salons/a/reports')).toBeVisible()
  })

  it('should write the address a link leads to into the address bar, without loading a page', async () => {
    // Arrange
    rootOfThePage()
    await start(<Address />)

    // Act
    await userEvent.click(screen.getByRole('link', { name: '予約の一覧' }))

    // Assert
    expect(screen.getByText('/bookings')).toBeVisible()
    expect(window.location.pathname).toBe('/bookings')
  })

  it('should keep what was read for five minutes, try a read that failed three times more, and read nothing on coming back to the window', async () => {
    // Arrange
    rootOfThePage()

    // Act
    await start(<QueryDefaults />)

    // Assert
    expect(
      screen.getByText(
        JSON.stringify({
          staleTime: 300_000,
          gcTime: 600_000,
          retry: 3,
          refetchOnWindowFocus: false,
        }),
      ),
    ).toBeVisible()
  })

  it('should read anew for the next user what was read for the one before', async () => {
    // Arrange
    rootOfThePage()
    sessionStore.write(HANAKO)
    await start(<Reading reads={[]} />)
    await screen.findByText('1 回目に読んだもの')

    // Act
    act(() => {
      sessionStore.write(ICHIRO)
    })

    // Assert
    expect(await screen.findByText('2 回目に読んだもの')).toBeVisible()
    expect(screen.queryByText('1 回目に読んだもの')).not.toBeInTheDocument()
  })

  it('should draw the application as React does in strict mode: every effect of a screen runs twice when it is shown', async () => {
    // Arrange
    rootOfThePage()
    const shown: string[] = []

    // Act
    await start(<Noting shown={shown} />)

    // Assert
    expect(shown).toEqual(['shown', 'shown'])
  })

  it('should take the application away when it is ended, and leave what it read alone from then on', async () => {
    // Arrange
    const root = rootOfThePage()
    sessionStore.write(HANAKO)
    const held: Held = { client: undefined }
    const end = await start(<Holding held={held} />)
    held.client?.setQueryData(['read'], '花子')

    // Act
    act(() => {
      end()
    })
    sessionStore.write(ICHIRO)

    // Assert
    expect(root).toBeEmptyDOMElement()
    expect(held.client?.getQueryData(['read'])).toBe('花子')
  })
})
