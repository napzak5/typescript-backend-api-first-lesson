import { asked } from '@beauty-salon-frontend/testing/answers'
import {
  salonIdOf,
  testApi,
  unreadable,
} from '@beauty-salon-frontend/testing/api'
import {
  address,
  heading,
  renderApplicationAt,
  rowsOf,
} from '@beauty-salon-frontend/testing/screens'
import { OSAKA, TOKYO } from '@beauty-salon-frontend/testing/seed'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SalonChoiceScreen } from './salon-choice-screen'

const renderChoice = (path = '/') =>
  renderApplicationAt(
    <SalonChoiceScreen
      description='予約台帳を開くサロンを選びます。'
      salonHref={({ id }) => `/salons/${id}/bookings`}
    />,
    path,
  )

/** The names of the salons the choice shows, in its order. */
const shownSalons = (): string[] => rowsOf('サロン').map(([name]) => name ?? '')

/** The names of the salons that are not removed, in the order the API lists them: the newest first. */
const salonsOfTheDatabase = async (): Promise<string[]> =>
  (
    await testApi().query(
      `select name from salons where "deletedAt" is null
        order by "createdAt" desc, id desc`,
    )
  ).map(({ name }) => String(name))

/** Salons besides those of the seed data, newer than them: they come first, and fill a page. */
const addSalons = (count: number) =>
  testApi().query(
    `insert into salons (name, prefecture, city, address, "phoneNumber", email, "imageUrls", features, amenities)
     select 'Kyoto Salon ' || lpad(n::text, 2, '0'), 'Kyoto', 'Kyoto-shi', n || ' Kawaramachi',
            '+81-75-555-01' || lpad(n::text, 2, '0'), 'kyoto' || n || '@salon.example', '{}', '{}', '{}'
     from generate_series(1, $1::int) n`,
    [count],
  )

const search = async (
  user: ReturnType<typeof userEvent.setup>,
  keyword: string,
) => {
  const field = screen.getByRole('searchbox', { name: 'キーワード' })
  await user.clear(field)
  await user.type(field, keyword)
  await user.click(screen.getByRole('button', { name: '探す' }))
}

describe('the choice of a salon, against the API', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should list every salon, newest first, each leading to its screens', async () => {
    // Act
    renderChoice()

    // Assert
    expect(screen.getByRole('status')).toHaveTextContent(
      'サロンを読み込んでいます',
    )
    expect(await heading('サロンを選ぶ')).toBeVisible()
    const seeded = await salonsOfTheDatabase()
    await waitFor(() => expect(shownSalons()).toEqual(seeded))
    expect(screen.getByRole('link', { name: OSAKA })).toHaveAttribute(
      'href',
      `/salons/${await salonIdOf(OSAKA)}/bookings`,
    )
  })

  it('should show the salons with a keyword, and keep it in the address', async () => {
    // Arrange
    const user = userEvent.setup()
    renderChoice()
    await waitFor(() => expect(shownSalons()).toHaveLength(2))

    // Act
    await search(user, 'Osaka')

    // Assert
    await waitFor(() => expect(shownSalons()).toEqual([OSAKA]))
    expect(address()).toBe('/?keyword=Osaka')
  })

  it('should read the salons again when the same keyword is searched for again', async () => {
    // Arrange
    const user = userEvent.setup()
    renderChoice('/?keyword=Osaka')
    await waitFor(() => expect(shownSalons()).toEqual([OSAKA]))
    await testApi().query(
      `update salons set name = name || ' Namba' where name = $1`,
      [OSAKA],
    )
    const fetched = vi.spyOn(globalThis, 'fetch')

    // Act
    await search(user, 'Osaka')

    // Assert
    await waitFor(() => expect(shownSalons()).toEqual([`${OSAKA} Namba`]))
    expect(asked(fetched)).toEqual(['GET /salons?keyword=Osaka&limit=20'])
    expect(address()).toBe('/?keyword=Osaka')
  })

  it('should say that no salon matches a keyword, and how to go on', async () => {
    // Act
    renderChoice('/?keyword=Sapporo')

    // Assert
    expect(
      await screen.findByText('キーワードに合うサロンが見つかりませんでした'),
    ).toBeVisible()
    expect(
      screen.getByText('キーワードを変えて、もう一度お探しください。'),
    ).toBeVisible()
  })

  it('should say that there are no salons yet, when none is listed', async () => {
    // Arrange
    await testApi().query(`update salons set "deletedAt" = now()`)

    // Act
    renderChoice()

    // Assert
    expect(await screen.findByText('サロンはまだありません')).toBeVisible()
    expect(
      screen.queryByText('キーワードを変えて、もう一度お探しください。'),
    ).not.toBeInTheDocument()
  })

  it('should say that the salons could not be read, and list them once they are read again', async () => {
    // Arrange
    const readable = await unreadable(
      'salons',
      'updatedAt',
      await salonIdOf(TOKYO),
    )
    const user = userEvent.setup()
    renderChoice()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'サロンを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
    )
    await readable()

    // Act
    await user.click(screen.getByRole('button', { name: 'もう一度読み込む' }))

    // Assert
    const seeded = await salonsOfTheDatabase()
    await waitFor(() => expect(shownSalons()).toEqual(seeded))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('should list the salons after the first page when more are asked for', async () => {
    // Arrange
    await addSalons(20)
    const user = userEvent.setup()
    renderChoice()
    await waitFor(() => expect(shownSalons()).toHaveLength(20))

    // Act
    await user.click(screen.getByRole('button', { name: 'さらに表示' }))

    // Assert
    await waitFor(() => expect(shownSalons()).toHaveLength(22))
    expect(shownSalons()).toEqual(await salonsOfTheDatabase())
    expect(shownSalons().slice(20)).toEqual(
      expect.arrayContaining([TOKYO, OSAKA]),
    )
  })

  it('should keep the salons that were read when the next ones could not be, and read them all once asked again', async () => {
    // Arrange: the salons of the seed data are those of the second page
    await addSalons(20)
    const readable = await unreadable(
      'salons',
      'updatedAt',
      await salonIdOf(TOKYO),
    )
    const user = userEvent.setup()
    renderChoice()
    await waitFor(() => expect(shownSalons()).toHaveLength(20))
    await user.click(screen.getByRole('button', { name: 'さらに表示' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '続きを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
    )
    expect(shownSalons()).toHaveLength(20)
    await readable()

    // Act
    await user.click(screen.getByRole('button', { name: 'もう一度読み込む' }))

    // Assert
    await waitFor(() => expect(shownSalons()).toHaveLength(22))
    expect(shownSalons()).toEqual(await salonsOfTheDatabase())
    expect(shownSalons().slice(20)).toEqual(
      expect.arrayContaining([TOKYO, OSAKA]),
    )
  })
})
