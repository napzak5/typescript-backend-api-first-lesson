import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  type RenderResult,
  render,
  screen,
  within,
} from '@testing-library/react'
import { type ReactNode, useLayoutEffect } from 'react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router'

/*
 * What the tests of screens share: an application at an address, the
 * address it is at, what its page said at first sight, and how a test
 * reads what a screen says.
 */

/** A client of a test's own, which tries a read once. */
export const queryClientOfATest = (): QueryClient =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } })

type Shown = {
  address: string
  firstSight: [string, string]
  goTo: (to: string) => void
  goBack: () => void
}

let shown: Shown = {
  address: '',
  firstSight: ['', ''],
  goTo: () => undefined,
  goBack: () => undefined,
}

/**
 * Keeps, beside the application, what the router says: the address, the
 * way to another one, and what `main` said in the commit that showed an
 * address, which is before an answer of the API could arrive. A test that
 * looks at the page after waiting for something on it looks too late: by
 * then, a screen that showed what it had kept has read again.
 */
const Shown = () => {
  const { pathname, search, hash } = useLocation()
  const navigate = useNavigate()
  useLayoutEffect(() => {
    shown = { ...shown, address: `${pathname}${search}${hash}` }
  }, [pathname, search, hash])
  useLayoutEffect(() => {
    shown = {
      ...shown,
      firstSight: [
        `${pathname}${search}`,
        document.querySelector('main')?.textContent ?? '',
      ],
    }
  }, [pathname, search])
  useLayoutEffect(() => {
    shown = {
      ...shown,
      goTo: (to) => void navigate(to),
      goBack: () => void navigate(-1),
    }
  }, [navigate])

  return null
}

/**
 * A client that keeps what it read as an application does
 * (`startApplication`): for five minutes, it does not read again.
 */
export const asTheApplicationKeeps = (): QueryClient =>
  new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 5 * 60 * 1000 } },
  })

export type ApplicationAt = {
  /** The client of the queries, for a test that renders again with what the first kept */
  client?: QueryClient
  /** The addresses the history has before the one the application is at */
  before?: string[]
}

/**
 * `application` at `path`, in a router that keeps its addresses in memory
 * and with a client of its own.
 */
export const renderApplicationAt = (
  application: ReactNode,
  path: string,
  { client = queryClientOfATest(), before = [] }: ApplicationAt = {},
): RenderResult =>
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[...before, path]}>
        {application}
        <Shown />
      </MemoryRouter>
    </QueryClientProvider>,
  )

/** The address the application is at: its path, its search and its fragment. */
export const address = (): string => shown.address

/**
 * The address of the last screen (its path and its search), and what
 * `main` said in the commit that showed it.
 */
export const firstSight = (): [string, string] => shown.firstSight

/** Leads the application to an address, as a link of its own would. Call it in `act`. */
export const goTo = (to: string): void => shown.goTo(to)

/** Leads the application a step back in its history. Call it in `act`. */
export const goBack = (): void => shown.goBack()

/** The heading of a screen, once it is there. */
export const heading = (name: string | RegExp): Promise<HTMLElement> =>
  screen.findByRole('heading', { level: 1, name })

/** What the application says in its notifications. */
export const notifications = (): string[] =>
  screen
    .getAllByRole('status')
    .map((region) => region.textContent ?? '')
    .filter((said) => said !== '')

/**
 * What is said in the status messages of the content, the empty ones too:
 * the notification is one of them, and a screen that searches has others.
 */
export const statusMessages = (): (string | null)[] =>
  within(screen.getByRole('main'))
    .getAllByRole('status')
    .map((status) => status.textContent)

const termsIn = (card: HTMLElement): [string, string][] =>
  within(card)
    .getAllByRole('term')
    .map((term) => [
      term.textContent ?? '',
      term.nextElementSibling?.textContent ?? '',
    ])

/** What a card says, term by term. */
export const termsOf = (card: string): [string, string][] =>
  termsIn(screen.getByRole('region', { name: card }))

/** The same, of a card that is awaited. */
export const termsOnceThere = async (
  card: string,
): Promise<[string, string][]> =>
  termsIn(await screen.findByRole('region', { name: card }))
