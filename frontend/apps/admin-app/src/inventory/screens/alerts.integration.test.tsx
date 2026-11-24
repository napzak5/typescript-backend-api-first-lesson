import { languageStore } from '@beauty-salon-frontend/io'
import { dayAfter, dayAt } from '@beauty-salon-frontend/salon-screens'
import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { salonIdOf } from '@beauty-salon-frontend/testing/api'
import {
  firstSight,
  heading,
  rowsOf,
} from '@beauty-salon-frontend/testing/screens'
import {
  MANAGER,
  OPERATOR,
  OSAKA,
  OWNER,
  STYLIST,
  TOKYO,
} from '@beauty-salon-frontend/testing/seed'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openAs } from '../../__tests__/screens'
import {
  inventoryHrefOf,
  stockAlertsHrefOf,
  stockRowHrefOf,
} from '../../navigation'
import {
  acknowledgedMeanwhile,
  acknowledgementsOf,
  displayNameOf,
  drawnOf,
  expiringOn,
  maximumOf,
  minimumOf,
  padAlertsOf,
  rowIdOf,
  usedUpMeanwhile,
} from '../__tests__/arrangements'
import { expiryNameOf } from '../utils/stock-format'

/*
 * The alerts of the stock, against the API. The salon in Tokyo of the
 * seed data keeps a row of each of six products, 20 of each, of lots that
 * expired on 31 December 2025: each row has a critical alert of its
 * expiry, and no product is short of stock or has too much of it. Every
 * member of its staff, and an administrator, sees to the alerts. The salon
 * in Osaka keeps no stock. Somebody did something meanwhile where a test
 * says so.
 */

const ALERTS = '在庫のアラート'

const NARROWED = '条件に合う在庫のアラート'

/** Waits for the alerts: the heading comes first, how many there are and the table once each was read. */
const openedAlerts = async (caption = ALERTS): Promise<void> => {
  await heading(ALERTS)
  await screen.findByText(/^今出ているアラート/)
  await screen.findByRole('table', { name: caption })
}

/** What the statuses of the screen say: how many alerts the table shows among them */
const statuses = (): (string | null)[] =>
  screen.getAllByRole('status').map((status) => status.textContent)

/** The severities and how many alerts there are of each */
const severities = (): [string, string][] =>
  screen
    .getAllByRole('term')
    .map((term) => [
      term.textContent ?? '',
      term.nextElementSibling?.textContent ?? '',
    ])

const choose = async (
  user: ReturnType<typeof userEvent.setup>,
  name: string,
  option: string,
): Promise<void> => {
  await user.selectOptions(screen.getByRole('combobox', { name }), option)
}

const SHOW = '表示する'

const COLOUR = 'Hair Color - Natural Brown'

/** The products of the rows of the salon in Tokyo, in the order of their codes, with their units */
const SEEDED: [string, string][] = [
  ['Lightening Powder 500g', 'box'],
  [COLOUR, 'tube'],
  ['Professional Conditioner 500ml', 'bottle'],
  ['Developer 6% 1000ml', 'bottle'],
  ['Professional Shampoo 500ml', 'bottle'],
  ['Intensive Hair Mask 250ml', 'jar'],
]

/** The name of the row of a product of the salon in Tokyo, by the lot the seed drew: read before a test adds rows */
const rowNameOf = async (product: string): Promise<string> => {
  const place = SEEDED.findIndex(([name]) => name === product)
  const lot = (await drawnOf(TOKYO))[place]?.lotNumber ?? ''

  return `${product}（ロット ${lot}）`
}

/** The alerts of the rows of the seed, none of them seen to */
const seededAlerts = async (): Promise<string[][]> => {
  const drawn = await drawnOf(TOKYO)

  return SEEDED.map(([product, unit], index) => [
    '緊急期限切れ',
    `${product}（ロット ${drawn[index]?.lotNumber ?? ''}）使用期限 2025年12月31日`,
    `20 ${unit}`,
    '未確認確認済みにする',
  ])
}

/**
 * The alert of the colour once its only row has no stock left: the expiry
 * of the row is no longer an alert, the stock of the product is
 */
const OUT_OF_COLOUR = [
  '緊急在庫僅少',
  `${COLOUR}（COLOR001）`,
  '0 tube最低在庫数 10 tube',
  '未確認確認済みにする',
]

/** The alerts of the rows of the seed once the colour is used up */
const withoutColour = async (): Promise<string[][]> =>
  (await seededAlerts()).map((alert, index) =>
    index === 1 ? OUT_OF_COLOUR : alert,
  )

/** The day at the salon in Tokyo, some days from today */
const dayFromToday = (days: number): string =>
  dayAfter(dayAt(new Date(), 'Asia/Tokyo'), days)

/** A moment on the clock of the salon, as the screens say it */
const MOMENT = String.raw`\d{4}年\d{1,2}月\d{1,2}日（.） \d{2}:\d{2}`

describe('the screen of the alerts of the stock', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('should lead the stylist from the stock to the alerts, the expired rows in the order of the codes of their products, and on to a row', async () => {
    // Arrange
    const user = userEvent.setup()
    const salonId = await salonIdOf(TOKYO)
    await openAs(inventoryHrefOf(salonId), STYLIST)
    await heading('在庫')
    await screen.findByRole('table', { name: '在庫' })

    // Act
    await user.click(screen.getByRole('link', { name: ALERTS }))

    // Assert
    await openedAlerts()
    expect(firstSight()[0]).toBe(stockAlertsHrefOf(salonId))
    expect(
      screen.getByRole('heading', { level: 1, name: ALERTS }),
    ).toHaveFocus()
    expect(
      screen.getByText(
        '今出ているアラートは 6 件で、そのうち 6 件が未確認です。',
      ),
    ).toBeVisible()
    expect(severities()).toEqual([
      ['緊急', '6 件'],
      ['注意', '0 件'],
      ['情報', '0 件'],
    ])
    expect(rowsOf(ALERTS)).toEqual(await seededAlerts())
    expect(statuses()).toContain('6 件')

    // Act
    await user.click(
      screen.getByRole('link', { name: await rowNameOf(COLOUR) }),
    )

    // Assert
    await heading('在庫の行')
    expect(firstSight()[0]).toBe(
      stockRowHrefOf(salonId, await rowIdOf(TOKYO, 'COLOR001')),
    )
  })

  it('should let the stylist see to the expired colour with notes, read the alerts anew, and name the stylist', async () => {
    // Arrange
    const user = userEvent.setup()
    const salonId = await salonIdOf(TOKYO)
    const colour = await rowNameOf(COLOUR)
    const stylist = await displayNameOf(STYLIST)
    await openAs(stockAlertsHrefOf(salonId), STYLIST)
    await openedAlerts()
    await user.click(
      screen.getByRole('button', {
        name: `${colour}の期限切れを確認済みにする`,
      }),
    )
    const dialog = screen.getByRole('dialog', {
      name: `${colour}の期限切れを確認済みにしますか？`,
    })
    await user.type(
      within(dialog).getByRole('textbox', { name: 'メモ' }),
      '  廃棄する。メーカーには連絡済み。  ',
    )

    // Act
    await user.click(
      within(dialog).getByRole('button', { name: '確認済みにする' }),
    )

    // Assert
    expect(
      await screen.findByText(`${colour}の期限切れを確認済みにしました。`),
    ).toBeVisible()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(
      screen.getByRole('heading', { level: 1, name: ALERTS }),
    ).toHaveFocus()
    // The alerts were read anew before the dialog closed
    expect(
      screen.getByText(
        '今出ているアラートは 6 件で、そのうち 5 件が未確認です。',
      ),
    ).toBeVisible()
    expect(rowsOf(ALERTS)[1]?.[3]).toMatch(
      new RegExp(`^${MOMENT}（${stylist}）廃棄する。メーカーには連絡済み。$`),
    )
    expect(
      screen.queryByRole('button', {
        name: `${colour}の期限切れを確認済みにする`,
      }),
    ).toBeNull()
    expect(await acknowledgementsOf(TOKYO)).toEqual([
      {
        productCode: 'COLOR001',
        alert: 'expired',
        severity: 'critical',
        threshold: null,
        expiryDate: '2025-12-31',
        notes: '廃棄する。メーカーには連絡済み。',
        acknowledgedBy: stylist,
      },
    ])

    // Act
    await choose(user, '確認', '未確認')
    await user.click(screen.getByRole('button', { name: SHOW }))

    // Assert
    await openedAlerts(NARROWED)
    expect(firstSight()[0]).toBe(
      `${stockAlertsHrefOf(salonId)}?acknowledged=false`,
    )
    expect(rowsOf(NARROWED)).toEqual(
      (await seededAlerts()).filter(
        ([, subject]) => !subject?.startsWith(colour),
      ),
    )
  })

  it('should show the alerts of every kind, and narrow them by kind and severity, kept in the address', async () => {
    // Arrange
    const user = userEvent.setup()
    const salonId = await salonIdOf(TOKYO)
    const soon = dayFromToday(10)
    await minimumOf(TOKYO, 'COLOR001', 20)
    await maximumOf(TOKYO, 'SHMP001', 15)
    await expiringOn(TOKYO, 'TREAT001', soon)
    const [powder, colour, conditioner, developer, shampoo] =
      await seededAlerts()

    // Act
    await openAs(stockAlertsHrefOf(salonId), MANAGER)

    // Assert
    await openedAlerts()
    expect(
      screen.getByText(
        '今出ているアラートは 8 件で、そのうち 8 件が未確認です。',
      ),
    ).toBeVisible()
    expect(severities()).toEqual([
      ['緊急', '5 件'],
      ['注意', '2 件'],
      ['情報', '1 件'],
    ])
    const short = [
      '注意在庫僅少',
      `${COLOUR}（COLOR001）`,
      '20 tube最低在庫数 20 tube',
      '未確認確認済みにする',
    ]
    const expiring = [
      '注意期限切れ間近',
      `${await rowNameOf('Intensive Hair Mask 250ml')}使用期限 ${expiryNameOf(soon).ja}`,
      '20 jar',
      '未確認確認済みにする',
    ]
    expect(rowsOf(ALERTS)).toEqual([
      powder,
      short,
      colour,
      conditioner,
      developer,
      [
        '情報在庫過剰',
        'Professional Shampoo 500ml（SHMP001）',
        '20 bottle最大在庫数 15 bottle',
        '未確認確認済みにする',
      ],
      shampoo,
      expiring,
    ])

    // Act
    await choose(user, '重要度', '注意')
    await user.click(screen.getByRole('button', { name: SHOW }))

    // Assert
    await openedAlerts(NARROWED)
    expect(firstSight()[0]).toBe(
      `${stockAlertsHrefOf(salonId)}?severity=warning`,
    )
    expect(rowsOf(NARROWED)).toEqual([short, expiring])
    expect(screen.getByRole('combobox', { name: '重要度' })).toHaveValue(
      'warning',
    )

    // Act
    await choose(user, '種類', '在庫過剰')
    await user.click(screen.getByRole('button', { name: SHOW }))

    // Assert
    expect(
      await screen.findByText('条件に合う在庫のアラートはありません'),
    ).toBeVisible()
    expect(firstSight()[0]).toBe(
      `${stockAlertsHrefOf(salonId)}?alert=overstock&severity=warning`,
    )

    // Act
    await user.click(screen.getByRole('link', { name: '条件を外す' }))

    // Assert
    await openedAlerts()
    expect(firstSight()[0]).toBe(stockAlertsHrefOf(salonId))
    expect(rowsOf(ALERTS)).toHaveLength(8)
  })

  it('should read the alerts as they are now when the same conditions are sent again', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAs(stockAlertsHrefOf(await salonIdOf(TOKYO)), MANAGER)
    await openedAlerts()
    await minimumOf(TOKYO, 'COLOR001', 20)

    // Act
    await user.click(screen.getByRole('button', { name: SHOW }))

    // Assert
    expect(
      await screen.findByText(
        '今出ているアラートは 7 件で、そのうち 7 件が未確認です。',
      ),
    ).toBeVisible()
    await waitFor(() => expect(rowsOf(ALERTS)).toHaveLength(7))
    expect(rowsOf(ALERTS)[1]?.[0]).toBe('注意在庫僅少')
  })

  it('should read the alerts that come after a page, and take the focus to the first of them', async () => {
    // Arrange
    const user = userEvent.setup()
    const mask = await rowNameOf('Intensive Hair Mask 250ml')
    await padAlertsOf(TOKYO, 15)
    await openAs(stockAlertsHrefOf(await salonIdOf(TOKYO)), OWNER)
    await openedAlerts()
    expect(rowsOf(ALERTS)).toHaveLength(20)
    expect(statuses()).toContain('21 件（20 件を表示しています）')

    // Act
    await user.click(screen.getByRole('button', { name: 'さらに表示' }))

    // Assert
    await waitFor(() => expect(rowsOf(ALERTS)).toHaveLength(21))
    expect(rowsOf(ALERTS)[20]?.[1]).toBe(`${mask}使用期限 2025年12月31日`)
    expect(screen.getByRole('link', { name: mask })).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'さらに表示' })).toBeNull()
  })

  it('should say that an alert is no longer there when its stock was used up meanwhile, and read the alerts anew with the alert that took its place', async () => {
    // Arrange
    const user = userEvent.setup()
    const colour = await rowNameOf(COLOUR)
    await openAs(stockAlertsHrefOf(await salonIdOf(TOKYO)), STYLIST)
    await openedAlerts()
    await user.click(
      screen.getByRole('button', {
        name: `${colour}の期限切れを確認済みにする`,
      }),
    )
    await usedUpMeanwhile(await rowIdOf(TOKYO, 'COLOR001'))

    // Act
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: '確認済みにする',
      }),
    )

    // Assert
    expect(
      await screen.findByText(
        `${colour}の期限切れは、もう出ていません。その間に、在庫が動いたか、商品が変わりました。アラートを読み直しました。`,
      ),
    ).toBeVisible()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(
      screen.getByRole('heading', { level: 1, name: ALERTS }),
    ).toHaveFocus()
    expect(rowsOf(ALERTS)).toEqual(await withoutColour())
    expect(await acknowledgementsOf(TOKYO)).toEqual([])
  })

  it('should say that somebody else saw to an alert meanwhile, and show who', async () => {
    // Arrange
    const user = userEvent.setup()
    const colour = await rowNameOf(COLOUR)
    const owner = await displayNameOf(OWNER)
    await openAs(stockAlertsHrefOf(await salonIdOf(TOKYO)), MANAGER)
    await openedAlerts()
    await user.click(
      screen.getByRole('button', {
        name: `${colour}の期限切れを確認済みにする`,
      }),
    )
    await acknowledgedMeanwhile(
      await rowIdOf(TOKYO, 'COLOR001'),
      owner,
      '返品の手続きをする。',
    )

    // Act
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: '確認済みにする',
      }),
    )

    // Assert
    expect(
      await screen.findByText(
        `${colour}の期限切れは、その間に、ほかの人が確認済みにしました。アラートを読み直しました。`,
      ),
    ).toBeVisible()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(rowsOf(ALERTS)[1]?.[3]).toMatch(
      new RegExp(`^${MOMENT}（${owner}）返品の手続きをする。$`),
    )
    expect(
      (await acknowledgementsOf(TOKYO)).map(
        ({ acknowledgedBy }) => acknowledgedBy,
      ),
    ).toEqual([owner])
  })

  it('should let an administrator see to an alert without notes, naming nobody', async () => {
    // Arrange
    const user = userEvent.setup()
    const powder = await rowNameOf('Lightening Powder 500g')
    await openAs(stockAlertsHrefOf(await salonIdOf(TOKYO)), OPERATOR)
    await openedAlerts()
    await user.click(
      screen.getByRole('button', {
        name: `${powder}の期限切れを確認済みにする`,
      }),
    )

    // Act
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: '確認済みにする',
      }),
    )

    // Assert
    expect(
      await screen.findByText(`${powder}の期限切れを確認済みにしました。`),
    ).toBeVisible()
    expect(rowsOf(ALERTS)[0]?.[3]).toMatch(new RegExp(`^${MOMENT}$`))
    expect(await acknowledgementsOf(TOKYO)).toEqual([
      expect.objectContaining({
        productCode: 'BLEACH001',
        notes: null,
        acknowledgedBy: null,
      }),
    ])
  })

  it('should drop the alerts read before a count, which changes them', async () => {
    // Arrange
    const user = userEvent.setup()
    const salonId = await salonIdOf(TOKYO)
    await openAs(stockAlertsHrefOf(salonId), MANAGER)
    await openedAlerts()
    await user.click(screen.getByRole('link', { name: '在庫へ' }))
    await heading('在庫')
    await user.click(screen.getByRole('link', { name: '棚卸しする' }))
    await heading('棚卸し')
    await user.type(
      await screen.findByRole('textbox', { name: new RegExp(`^${COLOUR}`) }),
      '0',
    )
    await user.click(screen.getByRole('button', { name: '記録する' }))
    await screen.findByText(
      '1 行の棚卸しを記録しました。帳簿の在庫数と差のあった行は 1 行です。',
    )
    await user.click(screen.getByRole('link', { name: '在庫へ' }))
    await heading('在庫')

    // Act
    await user.click(screen.getByRole('link', { name: ALERTS }))

    // Assert: the alerts read before the count are not shown again, they are read anew
    await waitFor(() =>
      expect(firstSight()[0]).toBe(stockAlertsHrefOf(salonId)),
    )
    expect(firstSight()[1]).not.toContain(await rowNameOf(COLOUR))
    await openedAlerts()
    expect(rowsOf(ALERTS)).toEqual(await withoutColour())
  })

  it('should say to the stylist of another salon that its alerts are not theirs', async () => {
    // Act
    await openAs(stockAlertsHrefOf(await salonIdOf(OSAKA)), STYLIST)

    // Assert
    expect(
      await screen.findByText(
        'このサロンの在庫は、見られません。在庫を見られるのは、そのサロンのスタッフと、管理者です。',
      ),
    ).toBeVisible()
    expect(screen.queryByRole('table')).toBeNull()
    expect(within(screen.getByRole('main')).queryByRole('combobox')).toBeNull()
  })

  it('should say that a salon without stock has no alerts', async () => {
    // Act
    await openAs(stockAlertsHrefOf(await salonIdOf(OSAKA)), OPERATOR)

    // Assert
    expect(await screen.findByText('在庫のアラートはありません')).toBeVisible()
    // How many there are is read apart from the list, and may come after it
    expect(
      await screen.findByText('今出ているアラートはありません。'),
    ).toBeVisible()
    expect(screen.queryByRole('term')).toBeNull()
  })

  it.each<[string, string, string, () => Promise<void>]>([
    ['the alerts', TOKYO, MANAGER, () => openedAlerts()],
    [
      'the dialog that sees to an alert',
      TOKYO,
      STYLIST,
      async () => {
        await openedAlerts()
        await userEvent.click(
          screen.getByRole('button', {
            name: `${await rowNameOf(COLOUR)}の期限切れを確認済みにする`,
          }),
        )
        await screen.findByRole('dialog')
      },
    ],
    [
      'a salon without alerts',
      OSAKA,
      OPERATOR,
      async () => {
        await screen.findByText('在庫のアラートはありません')
      },
    ],
  ])('should show %s accessibly', async (_, salon, email, opened) => {
    // Arrange
    await openAs(stockAlertsHrefOf(await salonIdOf(salon)), email)
    await opened()

    // Act
    const violations = await findAccessibilityViolations(document.body)

    // Assert
    expect(violations).toEqual([])
  })
})

describe('the screen of the alerts of the stock on a page in English', () => {
  const ALERTS_IN_ENGLISH = 'Inventory alerts'

  /** Waits for the alerts in English: the heading, how many there are, then the table. */
  const theAlertsInEnglish = async (
    caption = ALERTS_IN_ENGLISH,
  ): Promise<void> => {
    await heading(ALERTS_IN_ENGLISH)
    await screen.findByText(/^Alerts raised now/)
    await screen.findByRole('table', { name: caption })
  }

  /** The name of the row of a product of the salon in Tokyo, in English */
  const rowInEnglishOf = async (product: string): Promise<string> => {
    const place = SEEDED.findIndex(([name]) => name === product)
    const lot = (await drawnOf(TOKYO))[place]?.lotNumber ?? ''

    return `${product} (lot ${lot})`
  }

  /** A moment on the clock of the salon, as the screens say it in English */
  const MOMENT_IN_ENGLISH = String.raw`[A-Z][a-z]{2}, [A-Z][a-z]+ \d{1,2}, \d{4} at \d{2}:\d{2}`

  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
    languageStore.choose('en')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('should show the alerts, and let the stylist see to one with notes, in English', async () => {
    // Arrange
    const user = userEvent.setup()
    const drawn = await drawnOf(TOKYO)
    const colour = await rowInEnglishOf(COLOUR)
    const stylist = await displayNameOf(STYLIST)
    await openAs(stockAlertsHrefOf(await salonIdOf(TOKYO)), STYLIST, 'en')
    await theAlertsInEnglish()
    expect(
      screen.getByText('Alerts raised now: 6, of which 6 not acknowledged.'),
    ).toBeVisible()
    expect(severities()).toEqual([
      ['Critical', '6 alerts'],
      ['Warning', '0 alerts'],
      ['Info', '0 alerts'],
    ])
    expect(rowsOf(ALERTS_IN_ENGLISH)).toEqual(
      SEEDED.map(([product, unit], index) => [
        'CriticalExpired',
        `${product} (lot ${drawn[index]?.lotNumber ?? ''})Expiry: December 31, 2025`,
        `20 ${unit}`,
        'Not acknowledgedAcknowledge',
      ]),
    )
    expect(statuses()).toContain('6 items')
    await user.click(
      screen.getByRole('button', {
        name: `Acknowledge the alert “Expired” for ${colour}`,
      }),
    )
    const dialog = screen.getByRole('dialog', {
      name: `Acknowledge the alert “Expired” for ${colour}?`,
    })
    await user.type(
      within(dialog).getByRole('textbox', { name: 'Notes' }),
      'To be disposed of.',
    )

    // Act
    await user.click(
      within(dialog).getByRole('button', { name: 'Acknowledge' }),
    )

    // Assert
    expect(
      await screen.findByText(
        `Acknowledged the alert “Expired” for ${colour}.`,
      ),
    ).toBeVisible()
    expect(
      screen.getByText('Alerts raised now: 6, of which 5 not acknowledged.'),
    ).toBeVisible()
    expect(rowsOf(ALERTS_IN_ENGLISH)[1]?.[3]).toMatch(
      new RegExp(`^${MOMENT_IN_ENGLISH} \\(${stylist}\\)To be disposed of\\.$`),
    )

    // Act
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Acknowledgement' }),
      'Not acknowledged',
    )
    await user.click(screen.getByRole('button', { name: 'Show' }))

    // Assert
    await theAlertsInEnglish('Inventory alerts matching the filters')
    expect(rowsOf('Inventory alerts matching the filters')).toHaveLength(5)
  })

  it('should say in English that an alert is no longer there when its stock was used up meanwhile', async () => {
    // Arrange
    const user = userEvent.setup()
    const colour = await rowInEnglishOf(COLOUR)
    await openAs(stockAlertsHrefOf(await salonIdOf(TOKYO)), STYLIST, 'en')
    await theAlertsInEnglish()
    await user.click(
      screen.getByRole('button', {
        name: `Acknowledge the alert “Expired” for ${colour}`,
      }),
    )
    await usedUpMeanwhile(await rowIdOf(TOKYO, 'COLOR001'))

    // Act
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Acknowledge',
      }),
    )

    // Assert
    expect(
      await screen.findByText(
        `The alert “Expired” for ${colour} is no longer raised. Meanwhile the stock moved or the product changed. The alerts were loaded again.`,
      ),
    ).toBeVisible()
    expect(rowsOf(ALERTS_IN_ENGLISH)[1]).toEqual([
      'CriticalLow stock',
      `${COLOUR} (COLOR001)`,
      '0 tubeMinimum stock: 10 tube',
      'Not acknowledgedAcknowledge',
    ])
  })

  it('should say in English that a salon without stock has no alerts', async () => {
    // Act
    await openAs(stockAlertsHrefOf(await salonIdOf(OSAKA)), OPERATOR, 'en')

    // Assert
    expect(await screen.findByText('No inventory alerts')).toBeVisible()
    expect(await screen.findByText('No alerts are raised now.')).toBeVisible()
  })
})
