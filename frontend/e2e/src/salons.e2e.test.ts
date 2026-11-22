import { OSAKA, TOKYO } from '@beauty-salon-frontend/testing/seed'
import type { Locator, Page } from '@playwright/test'
import { PORTAL } from './applications'
import { expectSoundPage } from './checks'
import { expect, test } from './fixtures'
import { part } from './screen'
import { heading, PORTAL_START } from './sign-in'

const search = (page: Page): Locator =>
  page.getByRole('search', { name: 'サロンを探す' })

const keyword = (page: Page): Locator =>
  search(page).getByRole('searchbox', { name: 'キーワード' })

const prefecture = (page: Page): Locator =>
  search(page).getByRole('textbox', { name: '都道府県' })

const send = (page: Page): Locator =>
  search(page).getByRole('button', { name: '探す' })

const results = (page: Page): Locator => part(page, '検索結果')

const names = (page: Page): Locator =>
  results(page).getByRole('heading', { level: 3 })

/** Waits until every part of the page of the Tokyo salon shows what it read. */
const expectWholePage = async (page: Page): Promise<void> => {
  await expect(
    part(page, 'メニュー')
      .getByRole('list', { name: 'Hair Cut' })
      .getByRole('listitem'),
  ).toHaveCount(3)
  await expect(
    part(page, 'スタッフ').getByRole('heading', { level: 3 }),
  ).toHaveCount(5)
  await expect(
    part(page, 'レビュー')
      .getByRole('list', { name: 'レビュー' })
      .getByRole('listitem'),
  ).toHaveCount(3)
}

test.describe('the salons, in a browser', () => {
  test('should find a salon, open its page and show its hours, its menu, its people and its reviews', async ({
    page,
  }) => {
    // Arrange: the start lists the salons
    await page.goto(PORTAL.origin)
    await expect(heading(page, PORTAL_START)).toBeVisible()
    await expect(names(page)).toHaveCount(2)
    await expectSoundPage(page)

    // Act: a word of the name and a rating, then the salon that is found
    await keyword(page).fill('studio')
    await search(page)
      .getByRole('combobox', { name: '評価' })
      .selectOption('4.0 以上')
    await send(page).click()
    await expect(results(page).getByRole('status')).toHaveText(
      '1 件のサロンが見つかりました',
    )
    await expect(page).toHaveURL(`${PORTAL.origin}/?keyword=studio&minRating=4`)
    await expect(send(page)).toBeFocused()
    await results(page).getByRole('link', { name: TOKYO }).click()

    // Assert
    await expect(heading(page, TOKYO)).toBeFocused()
    await expect(page).toHaveTitle(`${TOKYO} | ${PORTAL.title}`)
    await expectWholePage(page)
    await expect(
      part(page, 'サロンについて').getByRole('link', {
        name: 'info@beautystudio-tokyo.jp',
      }),
    ).toBeVisible()
    await expect(part(page, '営業時間').getByRole('term').first()).toHaveText(
      '月曜日',
    )
    await expect(
      part(page, '営業時間').getByRole('definition').first(),
    ).toHaveText('10:00〜20:00')
    await expect(
      part(page, 'メニュー').getByRole('list', { name: 'Hair Cut' }),
    ).toContainText(/[¥￥]5,500（税込）/)
    await expect(
      part(page, 'レビュー').getByRole('img', {
        name: '5 段階中 4.0（3 件）',
      }),
    ).toBeVisible()
    await expectSoundPage(page)
  })

  test('should show the search as it was when the visitor comes back from a salon, and the one before when they go back again', async ({
    page,
  }) => {
    // Arrange: every salon, then those of Osaka, then the salon
    await page.goto(PORTAL.origin)
    await expect(names(page)).toHaveCount(2)
    await prefecture(page).fill('Osaka')
    await send(page).click()
    await expect(names(page)).toHaveText([OSAKA])
    await results(page).getByRole('link', { name: OSAKA }).click()
    await expect(heading(page, OSAKA)).toBeFocused()

    // Act
    await page.goBack()

    // Assert
    await expect(page).toHaveURL(`${PORTAL.origin}/?prefecture=Osaka`)
    await expect(heading(page, PORTAL_START)).toBeFocused()
    await expect(prefecture(page)).toHaveValue('Osaka')
    await expect(names(page)).toHaveText([OSAKA])

    // Act
    await page.goBack()

    // Assert: the controls follow the address
    await expect(page).toHaveURL(`${PORTAL.origin}/`)
    await expect(prefecture(page)).toHaveValue('')
    await expect(names(page)).toHaveCount(2)
  })

  test('should show the same search after a reload, and to whoever opens its address', async ({
    page,
    context,
  }) => {
    // Arrange
    await page.goto(PORTAL.origin)
    await keyword(page).fill('spa')
    await keyword(page).press('Enter')
    await expect(names(page)).toHaveText([OSAKA])
    const address = page.url()

    // Act
    await page.reload()
    const other = await context.newPage()
    await other.goto(address)

    // Assert
    expect(address).toBe(`${PORTAL.origin}/?keyword=spa`)
    await expect(keyword(page)).toHaveValue('spa')
    await expect(names(page)).toHaveText([OSAKA])
    await expect(keyword(other)).toHaveValue('spa')
    await expect(names(other)).toHaveText([OSAKA])
  })

  test('should add the next salons below and move the focus to the first of them', async ({
    page,
    api,
  }) => {
    // Arrange: more salons than a page of the search holds
    await api.query(
      `insert into salons (name, prefecture, city, address, "phoneNumber", email, "imageUrls", features, amenities)
       select 'Kyoto Salon ' || lpad(n::text, 2, '0'), 'Kyoto', 'Kyoto-shi', n || ' Kawaramachi',
              '+81-75-555-01' || lpad(n::text, 2, '0'), 'kyoto' || n || '@salon.example', '{}', '{}', '{}'
       from generate_series(1, 25) n`,
    )
    await page.goto(PORTAL.origin)
    await expect(names(page)).toHaveCount(20)
    await expect(results(page).getByRole('status')).toHaveText(
      '27 件のサロンが見つかりました（20 件を表示しています）',
    )

    // Act
    await results(page).getByRole('button', { name: 'さらに表示' }).click()

    // Assert
    await expect(names(page)).toHaveCount(27)
    await expect(names(page).nth(20).getByRole('link')).toBeFocused()
    await expect(names(page).nth(20)).toBeInViewport()
    await expect(results(page).getByRole('button')).toHaveCount(0)
    await expectSoundPage(page)
  })

  test('should read the reviews in the order that is chosen, and keep the focus on the control', async ({
    page,
    api,
  }) => {
    // Arrange: the reviews of the seed data were written at one moment
    await api.query(
      `update reviews set "createdAt" = now() - "overallRating" * interval '1 day'`,
    )
    const id = await api.idOf('select id::text from salons where name = $1', [
      TOKYO,
    ])
    await page.goto(`${PORTAL.origin}/salons/${id}`)
    const reviews = part(page, 'レビュー')
    const order = reviews.getByRole('combobox', { name: '並び順' })
    const ratings = reviews
      .getByRole('list', { name: 'レビュー' })
      .getByRole('img')
    await expect(ratings).toHaveCount(3)
    const latestFirst = await ratings.evaluateAll((drawn) =>
      drawn.map((rating) => rating.getAttribute('aria-label')),
    )

    // Act: `selectOption` sets the value without the focus a person brings
    await order.focus()
    await order.selectOption('評価の高い順')

    // Assert
    await expect(ratings.first()).toHaveAccessibleName('5 段階中 5.0')
    expect(latestFirst).toEqual([
      '5 段階中 3.0',
      '5 段階中 4.0',
      '5 段階中 5.0',
    ])
    await expect(order).toBeFocused()
  })

  test('should say that there is no such salon, and lead to the search', async ({
    page,
  }) => {
    // Act
    await page.goto(
      `${PORTAL.origin}/salons/00000000-0000-4000-8000-000000000000`,
    )

    // Assert
    await expect(heading(page, 'サロンが見つかりません')).toBeVisible()
    await expectSoundPage(page)
    await page.getByRole('link', { name: 'サロンを探す' }).click()
    await expect(heading(page, PORTAL_START)).toBeFocused()
    await expect(names(page)).toHaveCount(2)
  })
})

test.describe('the salons, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should fit the search, with results and without, into the width', async ({
    page,
  }) => {
    // Arrange
    await page.goto(PORTAL.origin)
    await expect(names(page)).toHaveCount(2)

    // Act
    await expectSoundPage(page)
    await keyword(page).fill('a salon that nobody registered')
    await send(page).click()

    // Assert
    await expect(
      page.getByText('条件に合うサロンが見つかりませんでした'),
    ).toBeVisible()
    await expectSoundPage(page)
  })

  test('should fit the page of a salon into the width, with hours that take more than a line', async ({
    page,
  }) => {
    // Arrange: the salon in Osaka has a break at noon, which makes its hours long
    await page.goto(PORTAL.origin)
    await results(page).getByRole('link', { name: OSAKA }).click()

    // Act
    await expect(heading(page, OSAKA)).toBeFocused()
    await expect(
      part(page, '営業時間').getByRole('definition').first(),
    ).toHaveText('09:00〜19:00（休憩 13:00〜14:00）')
    await expect(
      part(page, 'メニュー')
        .getByRole('list', { name: 'Head Spa' })
        .getByRole('listitem'),
    ).toHaveCount(3)
    await expect(
      part(page, 'スタッフ').getByRole('heading', { level: 3 }),
    ).toHaveCount(1)
    await expect(
      part(page, 'レビュー')
        .getByRole('list', { name: 'レビュー' })
        .getByRole('listitem'),
    ).toHaveCount(2)

    // Assert
    await expectSoundPage(page)
  })
})
