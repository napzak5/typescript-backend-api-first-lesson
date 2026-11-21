import { applications } from '@beauty-salon-frontend/brand'
import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { testApi } from '@beauty-salon-frontend/testing/api'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as z from 'zod'
import { App } from '../App'

const TITLE = applications.portal.name
/** The heading of the first screen of the portal, the search of the salons */
const START = 'サロンを探す'

/** The two salons of the seed data */
const TOKYO = 'Beauty Studio Tokyo'
const OSAKA = 'Hair & Spa Osaka'

/** An ID that no salon has */
const NO_SALON = '00000000-0000-4000-8000-000000000000'

const UNREAD =
  'を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。'

/** The address the application is at, as the router knows it */
let address = ''

const Address = () => {
  const { pathname, search } = useLocation()
  address = `${pathname}${search}`

  return null
}

const renderAt = (path: string) =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[path]}>
        <App />
        <Address />
      </MemoryRouter>
    </QueryClientProvider>,
  )

const heading = (name: string) =>
  screen.findByRole('heading', { level: 1, name })

const idSchema = z.tuple([z.object({ id: z.uuid() })])

const salonIdOf = async (name: string): Promise<string> => {
  const [{ id }] = idSchema.parse(
    await testApi().query('select id::text from salons where name = $1', [
      name,
    ]),
  )

  return id
}

const salonPathOf = async (name: string): Promise<string> =>
  `/salons/${await salonIdOf(name)}`

/** Salons besides those of the seed data: more than a page of the search holds. */
const addSalons = (count: number) =>
  testApi().query(
    `insert into salons (name, prefecture, city, address, "phoneNumber", email, "imageUrls", features, amenities)
     select 'Kyoto Salon ' || lpad(n::text, 2, '0'), 'Kyoto', 'Kyoto-shi', n || ' Kawaramachi',
            '+81-75-555-01' || lpad(n::text, 2, '0'), 'kyoto' || n || '@salon.example', '{}', '{}', '{}'
     from generate_series(1, $1::int) n`,
    [count],
  )

/**
 * Takes a table away from the API, which then answers 500 where it reads
 * it, and gives it back: an answer that went wrong, without a stub.
 */
const takeAway = (table: string) =>
  testApi().query(`alter table ${table} rename to ${table}_away`)

const giveBack = (table: string) =>
  testApi().query(`alter table ${table}_away rename to ${table}`)

// --- The search

const keyword = () => screen.getByRole('searchbox', { name: 'キーワード' })
const prefecture = () => screen.getByRole('textbox', { name: '都道府県' })
const city = () => screen.getByRole('textbox', { name: '市区町村' })
const minRating = () => screen.getByRole('combobox', { name: '評価' })
const send = () => screen.getByRole('button', { name: '探す' })

const results = () => screen.findByRole('region', { name: '検索結果' })

const namesIn = (region: HTMLElement): (string | null)[] =>
  within(region)
    .getAllByRole('heading', { level: 3 })
    .map((name) => name.textContent)

const countIn = (region: HTMLElement): HTMLElement =>
  within(region).getByRole('status')

/** The item of a salon in the results. */
const found = (region: HTMLElement, name: string): HTMLElement => {
  const item = within(region)
    .getAllByRole('listitem')
    .find((candidate) =>
      within(candidate).queryByRole('heading', { level: 3, name }),
    )
  if (item === undefined) {
    throw new Error(`${name} is not among the results`)
  }

  return item
}

// --- The page of a salon

/** A part of the page: the card of the name. */
const part = (name: string): Promise<HTMLElement> =>
  screen.findByRole('region', { name })

/** The days under a heading of the hours: each as its name and what is said of it. */
const daysUnder = (hours: HTMLElement, name: string): (string | null)[][] =>
  Array.from(
    within(hours)
      .getByRole('heading', { level: 3, name })
      .parentElement?.querySelector('dl')?.children ?? [],
    (day) => Array.from(day.children, (said) => said.textContent),
  )

/** The services under a category, each as the texts of its paragraphs. */
const servicesOf = (menu: HTMLElement, category: string): (string | null)[][] =>
  within(within(menu).getByRole('list', { name: category }))
    .getAllByRole('listitem')
    .map((service) =>
      within(service)
        .getAllByRole('paragraph')
        .map((paragraph) => paragraph.textContent),
    )

const reviewTitles = (reviews: HTMLElement): (string | null | undefined)[] =>
  within(within(reviews).getByRole('list', { name: 'レビュー' }))
    .getAllByRole('listitem')
    .map(
      (review) => within(review).getAllByRole('paragraph').at(1)?.textContent,
    )

describe('the screens of the salons, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('the search, at the root path', () => {
    it('should be the start of the application, and list the salons that take bookings', async () => {
      // Act
      renderAt('/')

      // Assert
      expect(
        screen.getByRole('heading', { level: 1, name: START }),
      ).toBeVisible()
      expect(document.title).toBe(`${START} | ${TITLE}`)
      expect(screen.getByText('サロンを探しています')).toHaveRole('status')
      const region = await results()
      expect(namesIn(region).toSorted()).toEqual([TOKYO, OSAKA])
      expect(countIn(region)).toHaveTextContent('2 件のサロンが見つかりました')
      expect(within(region).queryByRole('button')).toBeNull()
    })

    it('should say of a salon where it is, how it is rated and what it offers, and lead to its page', async () => {
      // Act
      renderAt('/')

      // Assert
      const salon = within(found(await results(), TOKYO))
      expect(salon.getByRole('link', { name: TOKYO })).toHaveAttribute(
        'href',
        await salonPathOf(TOKYO),
      )
      expect(salon.getByText('Tokyo Shibuya-ku 1-2-3 Shibuya')).toBeVisible()
      expect(
        salon.getByRole('img', { name: '5 段階中 4.0（3 件）' }),
      ).toBeVisible()
      expect(
        salon.getByText('Premium beauty salon in the heart of Tokyo'),
      ).toBeVisible()
      expect(
        within(salon.getByRole('list', { name: `${TOKYO}の特徴` }))
          .getAllByRole('listitem')
          .map((feature) => feature.textContent),
      ).toEqual(['Hair Styling', 'Hair Color', 'Treatment', 'Head Spa'])
    })

    it('should search for a word of the name, put the conditions into the address and keep the focus on the button', async () => {
      // Arrange
      renderAt('/')
      await results()
      const user = userEvent.setup()
      await user.type(keyword(), 'osaka')

      // Act
      await user.click(send())

      // Assert
      await screen.findByText('1 件のサロンが見つかりました')
      expect(namesIn(await results())).toEqual([OSAKA])
      expect(address).toBe('/?keyword=osaka')
      expect(keyword()).toHaveValue('osaka')
      expect(send()).toHaveFocus()
      // The title is that of the application still: this is the same screen
      expect(document.title).toBe(`${START} | ${TITLE}`)
    })

    it('should find a place by the whole name the salon registered, and nothing by a part of it', async () => {
      // Arrange
      renderAt('/')
      await results()
      const user = userEvent.setup()
      await user.type(prefecture(), 'Tokyo')
      await user.type(city(), 'Shibuya-ku')
      await user.click(send())
      await screen.findByText('1 件のサロンが見つかりました')
      expect(namesIn(await results())).toEqual([TOKYO])
      expect(address).toBe('/?prefecture=Tokyo&city=Shibuya-ku')

      // Act: a part of the name of the city
      await user.clear(city())
      await user.type(city(), 'Shibuya')
      await user.click(send())

      // Assert
      expect(
        await screen.findByText('条件に合うサロンが見つかりませんでした'),
      ).toBeVisible()
      expect(
        screen.getByText('条件を変えて、もう一度お探しください。'),
      ).toBeVisible()
      expect(screen.queryByRole('region', { name: '検索結果' })).toBeNull()
      expect(address).toBe('/?prefecture=Tokyo&city=Shibuya')
    })

    it('should find the salons that are rated at least as high as asked for', async () => {
      // Arrange
      renderAt('/')
      await results()
      const user = userEvent.setup()
      await user.selectOptions(minRating(), '4.5 以上')

      // Act
      await user.click(send())

      // Assert: Tokyo is rated 4.0, Osaka 5.0
      await screen.findByText('1 件のサロンが見つかりました')
      expect(namesIn(await results())).toEqual([OSAKA])
      expect(address).toBe('/?minRating=4.5')
    })

    it('should search for what the address says, and show it in the controls', async () => {
      // Act
      renderAt('/?keyword=studio&prefecture=Tokyo&city=Shibuya-ku&minRating=4')

      // Assert
      expect(namesIn(await results())).toEqual([TOKYO])
      expect(keyword()).toHaveValue('studio')
      expect(prefecture()).toHaveValue('Tokyo')
      expect(city()).toHaveValue('Shibuya-ku')
      expect(minRating()).toHaveValue('4')
    })

    it('should search for what is left of an address that somebody changed by hand, and show no error', async () => {
      // Act: a rating that is not on offer, an empty word, a parameter of no condition
      renderAt('/?minRating=9&keyword=&limit=1&city=Naniwa-ku')

      // Assert
      expect(namesIn(await results())).toEqual([OSAKA])
      expect(keyword()).toHaveValue('')
      expect(city()).toHaveValue('Naniwa-ku')
      expect(minRating()).toHaveValue('')
      expect(screen.queryByRole('alert')).toBeNull()
    })

    it('should drop the conditions by its link, and search for every salon again', async () => {
      // Arrange
      renderAt('/?keyword=osaka')
      await screen.findByText('1 件のサロンが見つかりました')

      // Act
      await userEvent.click(screen.getByRole('link', { name: '条件を外す' }))

      // Assert
      await screen.findByText('2 件のサロンが見つかりました')
      expect(address).toBe('/')
      expect(keyword()).toHaveValue('')
      expect(screen.queryByRole('link', { name: '条件を外す' })).toBeNull()
    })

    it('should show a search it has read before at once, and not take its salons for added ones', async () => {
      // Arrange: every salon was read, then those of one word
      renderAt('/')
      await screen.findByText('2 件のサロンが見つかりました')
      const user = userEvent.setup()
      await user.type(keyword(), 'osaka')
      await user.click(send())
      await screen.findByText('1 件のサロンが見つかりました')

      // Act
      await user.click(screen.getByRole('link', { name: '条件を外す' }))

      // Assert: two salons where one was, and the focus on neither
      await screen.findByText('2 件のサロンが見つかりました')
      expect(namesIn(await results())).toHaveLength(2)
      expect(document.body).toHaveFocus()
    })

    it('should read the salons again when the same search is sent again', async () => {
      // Arrange
      renderAt('/')
      await results()
      await testApi().query(
        `update salons set name = 'Beauty Studio Tokyo Annex' where name = $1`,
        [TOKYO],
      )

      // Act
      await userEvent.click(send())

      // Assert
      expect(
        await screen.findByRole('link', { name: 'Beauty Studio Tokyo Annex' }),
      ).toBeVisible()
      expect(address).toBe('/')
    })

    it('should not list a salon that takes no bookings', async () => {
      // Arrange
      await testApi().query(
        `update salons set "isActive" = false where name = $1`,
        [OSAKA],
      )

      // Act
      renderAt('/')

      // Assert
      await screen.findByText('1 件のサロンが見つかりました')
      expect(namesIn(await results())).toEqual([TOKYO])
    })

    it('should say so when no salon takes bookings, without speaking of conditions', async () => {
      // Arrange
      await testApi().query('update salons set "isActive" = false')

      // Act
      renderAt('/')

      // Assert
      expect(
        await screen.findByText('掲載中のサロンはありません'),
      ).toBeVisible()
      expect(
        screen.queryByText('条件を変えて、もう一度お探しください。'),
      ).toBeNull()
    })

    it('should show the first salons, add the next ones below when asked, and move the focus to the first that was added', async () => {
      // Arrange
      await addSalons(25)
      renderAt('/')
      const region = await results()
      expect(namesIn(region)).toHaveLength(20)
      expect(countIn(region)).toHaveTextContent(
        '27 件のサロンが見つかりました（20 件を表示しています）',
      )
      const first = namesIn(region)

      // Act
      await userEvent.click(
        within(region).getByRole('button', { name: 'さらに表示' }),
      )

      // Assert
      await screen.findByText('27 件のサロンが見つかりました')
      const all = namesIn(region)
      expect(all).toHaveLength(27)
      expect(all.slice(0, 20)).toEqual(first)
      expect(new Set(all).size).toBe(27)
      expect(
        within(region).getByRole('link', { name: all.at(20) ?? '' }),
      ).toHaveFocus()
      expect(within(region).queryByRole('button')).toBeNull()
    })

    it('should say that the salons could not be read, and read them when asked again', async () => {
      // Arrange
      await takeAway('salons')
      renderAt('/')
      expect(await screen.findByRole('alert')).toHaveTextContent(
        `サロン${UNREAD}`,
      )
      expect(screen.queryByRole('region', { name: '検索結果' })).toBeNull()
      await giveBack('salons')

      // Act
      await userEvent.click(
        screen.getByRole('button', { name: 'もう一度読み込む' }),
      )

      // Assert
      expect(namesIn(await results())).toHaveLength(2)
      expect(screen.queryByRole('alert')).toBeNull()
    })

    it('should keep the salons it has when the next ones do not come, and add them when asked again', async () => {
      // Arrange
      await addSalons(25)
      renderAt('/')
      const region = await results()
      const user = userEvent.setup()
      await takeAway('salons')
      await user.click(
        within(region).getByRole('button', { name: 'さらに表示' }),
      )
      expect(await within(region).findByRole('alert')).toHaveTextContent(
        '続きを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
      )
      expect(namesIn(region)).toHaveLength(20)
      await giveBack('salons')

      // Act
      await user.click(
        within(region).getByRole('button', { name: 'もう一度読み込む' }),
      )

      // Assert
      await screen.findByText('27 件のサロンが見つかりました')
      const all = namesIn(region)
      expect(all).toHaveLength(27)
      expect(
        within(region).getByRole('link', { name: all.at(20) ?? '' }),
      ).toHaveFocus()
      expect(within(region).queryByRole('alert')).toBeNull()
    })

    it('should open the page of a salon from its name, and come back to the search from there', async () => {
      // Arrange
      renderAt('/?prefecture=Osaka')
      const user = userEvent.setup()

      // Act
      await user.click(
        within(await results()).getByRole('link', { name: OSAKA }),
      )

      // Assert
      expect(await heading(OSAKA)).toHaveFocus()
      expect(document.title).toBe(`${OSAKA} | ${TITLE}`)
      expect(address).toBe(await salonPathOf(OSAKA))

      // Act
      await user.click(screen.getByRole('link', { name: 'サロンを探す' }))

      // Assert
      expect(await heading(START)).toHaveFocus()
      expect(address).toBe('/')
      expect(namesIn(await results())).toHaveLength(2)
    })

    it('should come back to the root from the page that does not exist', async () => {
      // Arrange
      renderAt('/no-such-page')

      // Act
      await userEvent.click(screen.getByRole('link', { name: 'トップへ戻る' }))

      // Assert
      expect(await heading(START)).toHaveFocus()
      expect(namesIn(await results())).toHaveLength(2)
    })

    it('should have no accessibility violations, with results and without', async () => {
      // Arrange
      renderAt('/?keyword=studio')
      await results()

      // Act
      const withResults = await findAccessibilityViolations()
      await userEvent.type(keyword(), ' of nowhere{Enter}')
      await screen.findByText('条件に合うサロンが見つかりませんでした')
      const withoutResults = await findAccessibilityViolations()

      // Assert
      expect(withResults).toEqual([])
      expect(withoutResults).toEqual([])
    })
  })

  describe('the page of a salon', () => {
    it('should say that it reads the salon, then show the salon under its name', async () => {
      // Act
      renderAt(await salonPathOf(TOKYO))

      // Assert: no heading names the screen before the name of the salon is known
      expect(screen.getByText('サロンを読み込んでいます')).toHaveRole('status')
      expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
      expect(await heading(TOKYO)).toBeVisible()
      expect(document.title).toBe(`${TOKYO} | ${TITLE}`)
      // The first screen of a page leaves the focus where the load put it
      expect(document.body).toHaveFocus()
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
      expect(
        screen
          .getAllByRole('heading', { level: 2 })
          .map((title) => title.textContent),
      ).toEqual([
        'サロンについて',
        '営業時間',
        'メニュー',
        'スタッフ',
        'レビュー',
      ])
      expect(
        screen.queryByText('このサロンは、現在、予約を受け付けていません。'),
      ).toBeNull()
    })

    it('should show what the salon says about itself, and how it is reached', async () => {
      // Act
      renderAt(await salonPathOf(TOKYO))

      // Assert
      const about = within(await part('サロンについて'))
      expect(
        about.getByText('Premium beauty salon in the heart of Tokyo'),
      ).toBeVisible()
      expect(
        about.getAllByRole('term').map((term) => term.textContent),
      ).toEqual(['住所', '電話番号', 'メールアドレス', 'ウェブサイト', '特徴'])
      expect(
        about.getByText('〒150-0002 Tokyo Shibuya-ku 1-2-3 Shibuya'),
      ).toBeVisible()
      expect(
        about.getByRole('link', { name: '+81-3-1234-5678' }),
      ).toHaveAttribute('href', 'tel:+81312345678')
      expect(
        about.getByRole('link', { name: 'info@beautystudio-tokyo.jp' }),
      ).toHaveAttribute('href', 'mailto:info@beautystudio-tokyo.jp')
      expect(
        about.getByRole('link', { name: 'https://beautystudio-tokyo.jp' }),
      ).toHaveAttribute('href', 'https://beautystudio-tokyo.jp')
    })

    it('should show the hours of a week, and of the dates from today on that have hours of their own', async () => {
      // Arrange: the calendar of the salon holds yesterday, today and two days to come
      const salonId = await salonIdOf(OSAKA)
      await testApi().query(`delete from opening_hours where "salonId" = $1`, [
        salonId,
      ])
      await testApi().query(
        `insert into opening_hours ("salonId", "dayOfWeek", date, "openTime", "closeTime", "isHoliday", "holidayName", notes)
         select $1::uuid, lower(trim(to_char(day, 'Day')))::day_of_week, day, opens::time, closes::time, holiday, null, notes
         from (values
           ((now() at time zone 'Asia/Tokyo')::date - 1, '10:00', '20:00', false, 'yesterday'),
           ((now() at time zone 'Asia/Tokyo')::date, '10:00', '17:00', false, 'today, until five'),
           ((now() at time zone 'Asia/Tokyo')::date + 2, null, null, true, 'closed for training'),
           ((now() at time zone 'Asia/Tokyo')::date + 1, '12:00', '20:00', false, 'tomorrow, from noon')
         ) as days (day, opens, closes, holiday, notes)`,
        [salonId],
      )

      // Act
      renderAt(await salonPathOf(OSAKA))

      // Assert
      const hours = await part('営業時間')
      expect(daysUnder(hours, '曜日ごとの営業時間').at(0)).toEqual([
        '月曜日',
        '09:00〜19:00（休憩 13:00〜14:00）',
      ])
      expect(
        daysUnder(hours, '曜日ごとの営業時間').map(([day]) => day),
      ).toEqual([
        '月曜日',
        '火曜日',
        '水曜日',
        '木曜日',
        '金曜日',
        '土曜日',
        '日曜日',
      ])
      expect(
        daysUnder(hours, '日付ごとの営業時間').map(([, time, remarks]) => [
          time,
          remarks,
        ]),
      ).toEqual([
        ['10:00〜17:00', 'today, until five'],
        ['12:00〜20:00', 'tomorrow, from noon'],
        ['休業', 'closed for training'],
      ])
    })

    it('should show the menu: the services on offer under their categories, with duration and price', async () => {
      // Act
      renderAt(await salonPathOf(TOKYO))

      // Assert: the categories that have no service are left out
      const menu = await part('メニュー')
      await within(menu).findByRole('list', { name: 'Hair Cut' })
      expect(
        within(menu)
          .getAllByRole('heading', { level: 3 })
          .map((category) => category.textContent),
      ).toEqual(['Hair Cut', 'Hair Color', 'Perm', 'Hair Treatment'])
      expect(servicesOf(menu, 'Hair Cut')).toEqual([
        [
          'Ladies Cut',
          'Includes shampoo, cut, and blow dry',
          '予約する',
          '1 時間',
          '￥5,500（税込）',
        ],
        [
          'Mens Cut',
          'Includes shampoo, cut, and styling',
          '予約する',
          '45 分',
          '￥4,000（税込）',
        ],
        [
          'Kids Cut (Under 12)',
          'Quick and gentle service for kids',
          '予約する',
          '30 分',
          '￥2,500（税込）',
        ],
      ])
      expect(servicesOf(menu, 'Hair Color')).toEqual([
        [
          'Full Color',
          'Single process color application',
          '要カウンセリング',
          '予約する',
          '2 時間',
          '通常 ￥8,000￥7,200（税込）',
        ],
        [
          'Highlights',
          'Partial or full head highlights',
          '要カウンセリング',
          '予約する',
          '2 時間 30 分',
          '￥12,000（税込）',
        ],
        [
          'Balayage',
          'Custom balayage coloring',
          '要カウンセリングオンライン予約不可',
          '3 時間',
          '￥15,000（税込）',
        ],
      ])
    })

    it('should leave out of the menu what is not on offer, and put under その他 a service whose category is not shown', async () => {
      // Arrange
      const salonId = await salonIdOf(TOKYO)
      await testApi().query(
        `update services set "serviceStatus" = 'inactive' where name = 'Mens Cut'`,
      )
      await testApi().query(
        `update services set "isActive" = false where name = 'Kids Cut (Under 12)'`,
      )
      await testApi().query(
        `update service_categories set "isActive" = false where name = 'Perm' and "salonId" = $1`,
        [salonId],
      )
      await testApi().query(
        `update services set "categoryId" = null, "pricingStrategy" = 'variable', "taxIncluded" = false where name = 'Keratin Treatment'`,
      )
      await testApi().query(
        `update services set "pricingStrategy" = 'consultation_based' where name = 'Deep Conditioning Treatment'`,
      )

      // Act
      renderAt(await salonPathOf(TOKYO))

      // Assert
      const menu = await part('メニュー')
      await within(menu).findByRole('list', { name: 'Hair Cut' })
      expect(
        within(menu)
          .getAllByRole('heading', { level: 3 })
          .map((category) => category.textContent),
      ).toEqual(['Hair Cut', 'Hair Color', 'Hair Treatment', 'その他'])
      expect(servicesOf(menu, 'Hair Cut').map(([name]) => name)).toEqual([
        'Ladies Cut',
      ])
      expect(servicesOf(menu, 'Hair Treatment')).toEqual([
        [
          'Deep Conditioning Treatment',
          'Repair and hydrate',
          '予約する',
          '30 分',
          '要相談',
        ],
      ])
      expect(servicesOf(menu, 'その他')).toEqual([
        [
          'Digital Perm',
          'Heat-activated curling system',
          '要カウンセリング',
          '予約する',
          '3 時間',
          '￥14,000（税込）',
        ],
        [
          'Straight Perm',
          'Permanent hair straightening',
          '要カウンセリングオンライン予約不可',
          '4 時間',
          '￥18,000（税込）',
        ],
        [
          'Keratin Treatment',
          'Smooth and strengthen',
          '予約する',
          '1 時間 30 分',
          '￥8,000〜（税別）',
        ],
      ])
    })

    it('should show the menu of the salon of the address, and nothing of the salon that was open before', async () => {
      // Arrange: the page of one salon was read to its end
      renderAt(await salonPathOf(TOKYO))
      await within(await part('メニュー')).findByRole('list', {
        name: 'Hair Color',
      })
      const user = userEvent.setup()
      await user.click(screen.getByRole('link', { name: 'サロンを探す' }))

      // Act
      await user.click(
        within(await results()).getByRole('link', { name: OSAKA }),
      )

      // Assert: from the moment the other salon is named, the menu is its own
      await heading(OSAKA)
      expect(screen.queryByRole('list', { name: 'Hair Color' })).toBeNull()
      const menu = await part('メニュー')
      await within(menu).findByRole('list', { name: 'Head Spa' })
      expect(
        within(menu).queryByRole('list', { name: 'Hair Color' }),
      ).toBeNull()
    })

    it('should show the people of the salon, and say who takes no bookings', async () => {
      // Act
      renderAt(await salonPathOf(TOKYO))

      // Assert
      const staff = await part('スタッフ')
      await within(staff).findByRole('heading', {
        level: 3,
        name: 'Hiroshi Tanaka',
      })
      expect(
        within(staff)
          .getAllByRole('heading', { level: 3 })
          .map((name) => name.textContent)
          .toSorted(),
      ).toEqual([
        'Akiko Mori',
        'Hiroshi Tanaka',
        'Kenji Sato',
        'Mika Suzuki',
        'Yui Watanabe',
      ])
      expect(
        within(staff).getByText('Senior Stylist・シニア・経験 10 年'),
      ).toBeVisible()
      expect(
        within(
          within(staff).getByRole('list', {
            name: 'Hiroshi Tanakaの得意な施術',
          }),
        )
          .getAllByRole('listitem')
          .map((specialty) => specialty.textContent),
      ).toEqual(['cut', 'color', 'perm'])
      // The owner and the manager take no bookings
      expect(within(staff).getAllByText('予約の受け付けなし')).toHaveLength(2)
    })

    it('should show how the salon was rated, and its reviews, the latest first', async () => {
      // Arrange: the reviews of the seed data were written at one moment
      await testApi().query(
        `update reviews set "createdAt" = now() - "overallRating" * interval '1 day'`,
      )

      // Act
      renderAt(await salonPathOf(TOKYO))

      // Assert
      const reviews = await part('レビュー')
      await within(reviews).findByRole('list', { name: 'レビュー' })
      expect(
        await within(reviews).findByRole('img', {
          name: '5 段階中 4.0（3 件）',
        }),
      ).toBeVisible()
      expect(
        within(within(reviews).getByRole('list', { name: '評価ごとの件数' }))
          .getAllByRole('listitem')
          .map((rating) => rating.textContent),
      ).toEqual([
        '評価 51 件',
        '評価 41 件',
        '評価 31 件',
        '評価 20 件',
        '評価 10 件',
      ])
      expect(
        within(reviews).getByRole('combobox', { name: '並び順' }),
      ).toHaveValue('recent')
      expect(reviewTitles(reviews)).toEqual([
        'Good but could be better',
        'Satisfied with the result',
        'Excellent service!',
      ])
      expect(within(reviews).getAllByText('来店確認済み')).toHaveLength(3)
      expect(within(reviews).getByText(/^サロンからの返信/)).toBeVisible()
      expect(within(reviews).queryByRole('button')).toBeNull()
    })

    it('should read the reviews in the order that is chosen, and keep the focus on the control of the order', async () => {
      // Arrange
      await testApi().query(
        `update reviews set "createdAt" = now() - "overallRating" * interval '1 day'`,
      )
      await testApi().query(
        `update reviews set "helpfulCount" = 9 where title = 'Good but could be better'`,
      )
      renderAt(await salonPathOf(TOKYO))
      const reviews = await part('レビュー')
      const order = await within(reviews).findByRole('combobox', {
        name: '並び順',
      })
      const user = userEvent.setup()

      // Act
      await user.selectOptions(order, '評価の高い順')

      // Assert
      await waitFor(() => {
        expect(reviewTitles(reviews)).toEqual([
          'Excellent service!',
          'Satisfied with the result',
          'Good but could be better',
        ])
      })
      expect(order).toHaveValue('rating')
      expect(order).toHaveFocus()

      // Act
      await user.selectOptions(order, '参考になった順')

      // Assert
      await waitFor(() => {
        expect(reviewTitles(reviews)).toEqual([
          'Good but could be better',
          'Excellent service!',
          'Satisfied with the result',
        ])
      })
      expect(order).toHaveFocus()
    })

    it('should show the first reviews, add the next ones below when asked, and move the focus to the first that was added', async () => {
      // Arrange: a visit has one review, so twelve earlier visits with a review each
      await testApi().query(
        `with visits as (
           insert into bookings ("bookingNumber", "salonId", "customerId", "staffId", "bookingDate", "startTime", "endTime",
                                 duration, status, subtotal, "discountAmount", "taxAmount", "totalAmount", "completedAt")
           select 'EARLIER-' || n, visit."salonId", visit."customerId", visit."staffId", visit."bookingDate" - 7 * n,
                  visit."startTime" - n * interval '7 days', visit."endTime" - n * interval '7 days',
                  visit.duration, 'completed', visit.subtotal, visit."discountAmount", visit."taxAmount", visit."totalAmount",
                  visit."endTime" - n * interval '7 days'
           from (select * from bookings where "salonId" = $1 and status = 'completed' order by "startTime" limit 1) visit
           cross join generate_series(1, 12) n
           returning id, "salonId", "customerId", "completedAt"
         )
         insert into reviews ("salonId", "customerId", "bookingId", "overallRating", title, comment, "isVerified", "createdAt")
         select "salonId", "customerId", id, 4, 'An earlier visit', 'As good as ever', true, "completedAt" + interval '1 day'
         from visits`,
        [await salonIdOf(TOKYO)],
      )
      renderAt(await salonPathOf(TOKYO))
      const reviews = await part('レビュー')
      const list = await within(reviews).findByRole('list', {
        name: 'レビュー',
      })
      expect(within(list).getAllByRole('listitem')).toHaveLength(10)

      // Act
      await userEvent.click(
        within(reviews).getByRole('button', { name: 'さらに表示' }),
      )

      // Assert
      await waitFor(() => {
        expect(within(list).getAllByRole('listitem')).toHaveLength(15)
      })
      expect(within(list).getAllByRole('listitem').at(10)).toHaveFocus()
      expect(within(reviews).queryByRole('button')).toBeNull()
    })

    it('should say so of every part when the salon has nothing to show there', async () => {
      // Arrange
      await testApi().query(
        `insert into salons (name, prefecture, city, address, "phoneNumber", email, "imageUrls", features, amenities)
         values ('Opening Soon', 'Kyoto', 'Kyoto-shi', '7 Kawaramachi', '+81-75-555-0100', 'soon@salon.example', '{}', '{}', '{}')`,
      )

      // Act
      renderAt(await salonPathOf('Opening Soon'))

      // Assert
      expect(await heading('Opening Soon')).toBeVisible()
      expect(
        within(await part('サロンについて'))
          .getAllByRole('term')
          .map((term) => term.textContent),
      ).toEqual(['住所', '電話番号', 'メールアドレス'])
      expect(
        within(await part('営業時間')).getByText(
          '曜日ごとの営業時間は、登録されていません。',
        ),
      ).toBeVisible()
      expect(
        within(await part('営業時間')).getByText(
          '日付ごとに決めた営業時間は、ありません。',
        ),
      ).toBeVisible()
      expect(
        await within(await part('メニュー')).findByText(
          '掲載中のメニューはありません',
        ),
      ).toBeVisible()
      expect(
        await within(await part('スタッフ')).findByText(
          '掲載中のスタッフはいません',
        ),
      ).toBeVisible()
      const reviews = within(await part('レビュー'))
      expect(await reviews.findByText('評価なし')).toBeVisible()
      expect(
        await reviews.findByText('レビューは、まだありません'),
      ).toBeVisible()
      expect(reviews.queryByRole('combobox')).toBeNull()
    })

    it('should open for a salon that takes no bookings, and say that it takes none', async () => {
      // Arrange
      await testApi().query(
        `update salons set "isActive" = false where name = $1`,
        [OSAKA],
      )

      // Act
      renderAt(await salonPathOf(OSAKA))

      // Assert
      expect(await heading(OSAKA)).toBeVisible()
      expect(
        screen.getByText('このサロンは、現在、予約を受け付けていません。'),
      ).toBeVisible()
      expect(
        await within(await part('メニュー')).findByRole('list', {
          name: 'Head Spa',
        }),
      ).toBeVisible()
    })

    it.each([
      ['an ID that no salon has', `/salons/${NO_SALON}`],
      ['what is no ID', '/salons/beauty-studio-tokyo'],
    ])(
      'should say that there is no such salon at the address of %s, and lead to the search',
      async (_, path) => {
        // Act
        renderAt(path)

        // Assert
        expect(await heading('サロンが見つかりません')).toBeVisible()
        expect(
          screen.getByText(
            'アドレスが正しいか、お確かめください。掲載を終えたサロンかもしれません。',
          ),
        ).toBeVisible()
        expect(
          screen.getByRole('link', { name: 'サロンを探す' }),
        ).toHaveAttribute('href', '/')
        expect(screen.queryByRole('heading', { level: 2 })).toBeNull()
      },
    )

    it('should say so of a salon that was removed', async () => {
      // Arrange
      const path = await salonPathOf(OSAKA)
      await testApi().query(
        `update salons set "deletedAt" = now() where name = $1`,
        [OSAKA],
      )

      // Act
      renderAt(path)

      // Assert
      expect(await heading('サロンが見つかりません')).toBeVisible()
    })

    it('should say that the salon could not be read, and read it when asked again', async () => {
      // Arrange: what is stored as the hours of the salon is no hours, so the API answers 500
      const path = await salonPathOf(TOKYO)
      await testApi().query(
        `update salons set "businessHours" = '{"monday": "ten to seven"}' where name = $1`,
        [TOKYO],
      )
      renderAt(path)
      expect(await screen.findByRole('alert')).toHaveTextContent(
        `サロン${UNREAD}`,
      )
      expect(
        screen.getByRole('heading', { level: 1, name: 'サロンの詳細' }),
      ).toBeVisible()
      await testApi().query(
        `update salons set "businessHours" = null where name = $1`,
        [TOKYO],
      )

      // Act
      await userEvent.click(
        screen.getByRole('button', { name: 'もう一度読み込む' }),
      )

      // Assert
      expect(await heading(TOKYO)).toBeVisible()
      expect(screen.queryByRole('alert')).toBeNull()
    })

    it('should show the other parts when one part cannot be read, and read that part when asked again', async () => {
      // Arrange
      const path = await salonPathOf(TOKYO)
      await takeAway('reviews')
      renderAt(path)
      const reviews = await part('レビュー')
      await waitFor(() => {
        expect(
          within(reviews)
            .getAllByRole('alert')
            .map((alert) => alert.textContent),
        ).toEqual([`評価${UNREAD}`, `レビュー${UNREAD}`])
      })
      // The salon, its menu and its people are there
      expect(await heading(TOKYO)).toBeVisible()
      expect(
        await within(await part('メニュー')).findByRole('list', {
          name: 'Hair Cut',
        }),
      ).toBeVisible()
      expect(
        await within(await part('スタッフ')).findByRole('heading', {
          level: 3,
          name: 'Mika Suzuki',
        }),
      ).toBeVisible()
      await giveBack('reviews')
      const user = userEvent.setup()

      // Act: the summary, then the list
      await user.click(
        within(reviews).getAllByRole('button', {
          name: 'もう一度読み込む',
        })[0] ?? reviews,
      )
      await within(reviews).findByRole('img', { name: '5 段階中 4.0（3 件）' })
      await user.click(
        within(reviews).getByRole('button', { name: 'もう一度読み込む' }),
      )

      // Assert
      expect(
        await within(reviews).findByRole('list', { name: 'レビュー' }),
      ).toBeVisible()
      expect(within(reviews).queryByRole('alert')).toBeNull()
    })

    it('should say that the menu could not be read, and leave the rest of the page as it is', async () => {
      // Arrange
      const path = await salonPathOf(TOKYO)
      await takeAway('services')

      // Act
      renderAt(path)

      // Assert
      expect(
        await within(await part('メニュー')).findByRole('alert'),
      ).toHaveTextContent(`メニュー${UNREAD}`)
      expect(
        await within(await part('レビュー')).findByRole('list', {
          name: 'レビュー',
        }),
      ).toBeVisible()
    })

    it('should have no accessibility violations', async () => {
      // Arrange
      renderAt(await salonPathOf(TOKYO))
      await within(await part('メニュー')).findByRole('list', {
        name: 'Hair Cut',
      })
      await within(await part('スタッフ')).findByRole('heading', {
        level: 3,
        name: 'Mika Suzuki',
      })
      await within(await part('レビュー')).findByRole('list', {
        name: 'レビュー',
      })

      // Act
      const violations = await findAccessibilityViolations()

      // Assert
      expect(violations).toEqual([])
    })
  })
})
