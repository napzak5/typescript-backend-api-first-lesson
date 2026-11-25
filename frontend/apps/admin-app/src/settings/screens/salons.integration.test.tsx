import { languageStore } from '@beauty-salon-frontend/io'
import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import {
  countOf,
  refuse,
  salonIdOf,
  testApi,
} from '@beauty-salon-frontend/testing/api'
import {
  firstSight,
  heading,
  notifications,
  termsOf,
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
import * as z from 'zod'
import { openAs } from '../../__tests__/screens'
import { salonRemovedMeanwhile } from '../../bookings/__tests__/arrangements'
import { SALON_ENTRY_PATH, settingsHrefOf } from '../../navigation'
import { storedSalonOf } from '../__tests__/arrangements'

/*
 * Adding and removing a salon, against the API. An administrator adds
 * salons from the choice of a salon; the owner of a salon and an
 * administrator remove it from its settings. Both salons of the seed data
 * have bookings that are not finished; a test that removes one finishes
 * them first, in the database.
 */

/** The salons the choice lists, by their names */
const listedSalons = async (): Promise<(string | null)[]> =>
  within(await screen.findByRole('table', { name: 'サロン' }))
    .getAllByRole('link')
    .map((link) => link.textContent)

/** The links of the header: their names, where they lead, and which is the screen shown */
const navigationItems = () =>
  within(screen.getByRole('navigation', { name: 'メインメニュー' }))
    .getAllByRole('link')
    .map((link) => [
      link.textContent,
      link.getAttribute('href'),
      link.getAttribute('aria-current'),
    ])

const text = (name: string): HTMLElement =>
  screen.getByRole('textbox', { name })

const NEW_NAME = 'Salon Hikari 新宿店'

/** Fills in what a salon to be added needs, with the email address given. */
const fillInSalon = async (email: string): Promise<void> => {
  const user = userEvent.setup()
  await user.type(text('名前'), NEW_NAME)
  await user.type(text('都道府県'), '東京都')
  await user.type(text('市区町村'), '新宿区')
  await user.type(text('町名・番地'), '西新宿 1-1-1')
  await user.type(text('電話番号'), '03-1111-2222')
  await user.type(text('メールアドレス'), email)
}

const add = (): HTMLElement =>
  screen.getByRole('button', { name: 'サロンを登録する' })

/** How many salons there are, removed ones included */
const salonCount = (): Promise<number> => countOf('select count(*) from salons')

const addedSchema = z.array(
  z.object({
    timezone: z.string(),
    currency: z.string(),
    taxRate: z.string(),
    isActive: z.boolean(),
    businessHours: z.unknown(),
    hours: z.coerce.number(),
  }),
)

/** What the database keeps of the salons of a name: their time zone, currency, tax, bookings online and hours */
const storedAdded = async (name: string) =>
  addedSchema.parse(
    await testApi().query(
      `select s.timezone, s.currency, s."taxRate"::text, s."isActive", s."businessHours",
         (select count(*) from opening_hours o where o."salonId" = s.id) as hours
       from salons s where s.name = $1`,
      [name],
    ),
  )

const removedSchema = z.tuple([z.object({ removed: z.boolean() })])

/** Whether a salon is removed */
const isRemoved = async (name: string): Promise<boolean> =>
  removedSchema.parse(
    await testApi().query(
      'select "deletedAt" is not null as removed from salons where name = $1',
      [name],
    ),
  )[0].removed

/** Lets every booking of a salon that is not finished be finished: marked as a no-show. */
const bookingsFinished = (name: string): Promise<unknown> =>
  testApi().query(
    `update bookings b set status = 'no_show'
     from salons s
     where s.id = b."salonId" and s.name = $1
       and b.status in ('draft', 'pending', 'confirmed', 'in_progress')`,
    [name],
  )

/** Opens the dialog that asks whether to remove the salon of the settings. */
const askToRemove = async (name: string): Promise<HTMLElement> => {
  const user = userEvent.setup()
  await user.click(
    await screen.findByRole('button', { name: 'サロンを削除する' }),
  )

  return screen.findByRole('dialog', {
    name: `サロン「${name}」を削除しますか？`,
  })
}

describe('adding a salon, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('should let an administrator add a salon from the choice of a salon, with the time zone and the currency chosen, and show it in its settings without hours', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAs('/', OPERATOR)
    expect(await listedSalons()).toEqual(expect.arrayContaining([TOKYO, OSAKA]))
    await user.click(screen.getByRole('link', { name: 'サロンを登録する' }))
    expect(await heading('サロンを登録する')).toHaveFocus()
    expect(navigationItems()).toEqual([
      ['サロンを選ぶ', '/', null],
      ['運用', '/operations', null],
    ])
    await fillInSalon('shinjuku@example.com')
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'タイムゾーン' }),
      'Asia/Seoul',
    )
    await user.selectOptions(
      screen.getByRole('combobox', { name: '通貨' }),
      'KRW',
    )

    // Act
    await user.click(add())

    // Assert: the salon the API answered with is shown at once, its settings read anew
    expect(await heading('サロンの設定')).toHaveFocus()
    expect(firstSight()[1]).not.toContain('サロンを読み込んでいます')
    expect(firstSight()[1]).toContain('サロンの設定を読み込んでいます')
    expect(notifications()).toContain(
      `サロン「${NEW_NAME}」を登録しました。営業時間とメニューを入れてから、オンライン予約を受け付けてください。`,
    )
    await screen.findByRole('region', { name: 'サロン' })
    expect(termsOf('サロン')).toContainEqual(['オンライン予約', '止めている'])
    expect(termsOf('会計')).toEqual(
      expect.arrayContaining([
        ['タイムゾーン', 'Asia/Seoul'],
        ['通貨', 'KRW'],
        ['税率', '10%'],
      ]),
    )
    expect(
      within(screen.getByRole('table', { name: '営業時間' }))
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(Array.from({ length: 7 }, () => '休業'))
    expect(await storedAdded(NEW_NAME)).toEqual([
      {
        timezone: 'Asia/Seoul',
        currency: 'KRW',
        taxRate: '10.00',
        isActive: false,
        businessHours: null,
        hours: 0,
      },
    ])

    // Act
    await user.click(screen.getByRole('link', { name: 'サロンを選ぶ' }))

    // Assert: the choice read before the salon was added is not shown
    expect(firstSight()[0]).toBe('/')
    expect(firstSight()[1]).toContain('サロンを読み込んでいます')
    expect(await listedSalons()).toContain(NEW_NAME)
  })

  it('should say an email address of another salon at the email address, and add nothing', async () => {
    // Arrange
    const user = userEvent.setup()
    const count = await salonCount()
    const { email } = await storedSalonOf(TOKYO)
    await openAs(SALON_ENTRY_PATH, OPERATOR)
    await heading('サロンを登録する')
    await fillInSalon(email)

    // Act
    await user.click(add())

    // Assert
    await waitFor(() =>
      expect(text('メールアドレス')).toHaveAccessibleDescription(
        expect.stringContaining(
          'このメールアドレスは、ほかのサロンが使っています。',
        ),
      ),
    )
    expect(await salonCount()).toBe(count)
  })

  it('should say what is wrong before sending, and send nothing', async () => {
    // Arrange
    const user = userEvent.setup()
    const count = await salonCount()
    await openAs(SALON_ENTRY_PATH, OPERATOR)
    await heading('サロンを登録する')
    await fillInSalon('shinjuku@example.com')
    await user.clear(text('電話番号'))
    await user.type(text('電話番号'), 'でんわ')
    await user.clear(text('税率（%）'))
    await user.type(text('税率（%）'), '101')

    // Act
    await user.click(add())

    // Assert
    expect(text('電話番号')).toHaveAttribute('aria-invalid', 'true')
    expect(text('税率（%）')).toHaveAccessibleDescription(
      expect.stringContaining('税率は、0 から 100 までの数'),
    )
    expect(await heading('サロンを登録する')).toBeInTheDocument()
    expect(await salonCount()).toBe(count)
  })

  it.each<[string, string]>([
    ['the owner of a salon', OWNER],
    ['a manager', MANAGER],
  ])(
    'should tell %s that the account does not add salons',
    async (_, email) => {
      // Act
      await openAs(SALON_ENTRY_PATH, email)

      // Assert
      expect(
        await screen.findByText(
          'このアカウントでは、サロンを登録できません。サロンを登録できるのは、管理者です。',
        ),
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('textbox', { name: '名前' }),
      ).not.toBeInTheDocument()
    },
  )

  it('should have no accessibility violations on the form, nor with what is wrong said', async () => {
    // Arrange
    const user = userEvent.setup()
    const { container } = await openAs(SALON_ENTRY_PATH, OPERATOR)
    await heading('サロンを登録する')
    expect(await findAccessibilityViolations(container)).toEqual([])

    // Act
    await user.click(add())

    // Assert
    expect(text('名前')).toHaveAttribute('aria-invalid', 'true')
    expect(await findAccessibilityViolations(container)).toEqual([])
  })
})

describe('removing a salon, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('should let an administrator remove a salon chosen at the start whose bookings are finished, after asking, and show the choice without it', async () => {
    // Arrange
    const user = userEvent.setup()
    await bookingsFinished(OSAKA)
    await openAs('/', OPERATOR)
    await user.click(await screen.findByRole('link', { name: OSAKA }))
    await user.click(
      within(
        await screen.findByRole('navigation', { name: 'メインメニュー' }),
      ).getByRole('link', { name: '設定' }),
    )
    await screen.findByRole('region', { name: 'サロンの削除' })
    const asked = await askToRemove(OSAKA)
    await user.click(within(asked).getByRole('button', { name: '戻る' }))
    expect(await isRemoved(OSAKA)).toBe(false)
    const dialog = await askToRemove(OSAKA)

    // Act
    await user.click(within(dialog).getByRole('button', { name: '削除する' }))

    // Assert
    expect(await heading('サロンを選ぶ')).toHaveFocus()
    expect(notifications()).toContain(`サロン「${OSAKA}」を削除しました。`)
    expect(await isRemoved(OSAKA)).toBe(true)
    // The choice read before the removal is not shown
    expect(firstSight()[1]).toContain('サロンを読み込んでいます')
    expect(await listedSalons()).toEqual(expect.not.arrayContaining([OSAKA]))
    expect(await listedSalons()).toContain(TOKYO)
  })

  it('should let the owner remove their salon, from the salon the start led to, and tell them after that no salon reaches the account', async () => {
    // Arrange
    const user = userEvent.setup()
    await bookingsFinished(TOKYO)
    await openAs('/', OWNER)
    expect(await heading('予約台帳')).toBeInTheDocument()
    await user.click(
      within(
        screen.getByRole('navigation', { name: 'メインメニュー' }),
      ).getByRole('link', { name: '設定' }),
    )
    const dialog = await askToRemove(TOKYO)

    // Act
    await user.click(within(dialog).getByRole('button', { name: '削除する' }))

    // Assert
    expect(
      await screen.findByText('どのサロンにも属していません'),
    ).toBeInTheDocument()
    expect(notifications()).toContain(`サロン「${TOKYO}」を削除しました。`)
    expect(await isRemoved(TOKYO)).toBe(true)
  })

  it('should keep a salon with bookings that are not finished, say why where it was asked, and lead to the bookings', async () => {
    // Arrange
    const user = userEvent.setup()
    const tokyo = await salonIdOf(TOKYO)
    await openAs(settingsHrefOf(tokyo), OWNER)
    const dialog = await askToRemove(TOKYO)

    // Act
    await user.click(within(dialog).getByRole('button', { name: '削除する' }))

    // Assert
    const removal = screen.getByRole('region', { name: 'サロンの削除' })
    expect(await within(removal).findByRole('alert')).toHaveTextContent(
      `サロン「${TOKYO}」には、終わっていない予約（下書き、確定待ち、確定、施術中）があるため、削除できません。`,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await isRemoved(TOKYO)).toBe(false)

    // Act
    await user.click(
      within(removal).getByRole('link', { name: '予約台帳を開く' }),
    )

    // Assert
    expect(await heading('予約台帳')).toHaveFocus()
  })

  it('should say a refusal to the owner of another salon where it was asked', async () => {
    // Arrange
    const user = userEvent.setup()
    await bookingsFinished(OSAKA)
    await openAs(settingsHrefOf(await salonIdOf(OSAKA)), OWNER)
    const dialog = await askToRemove(OSAKA)

    // Act
    await user.click(within(dialog).getByRole('button', { name: '削除する' }))

    // Assert
    expect(
      await within(
        screen.getByRole('region', { name: 'サロンの削除' }),
      ).findByRole('alert'),
    ).toHaveTextContent(
      'このアカウントでは、このサロンを削除できません。サロンを削除できるのは、そのサロンのオーナーと、管理者です。',
    )
    expect(
      screen.queryByRole('link', { name: '予約台帳を開く' }),
    ).not.toBeInTheDocument()
    expect(await isRemoved(OSAKA)).toBe(false)
  })

  it('should say in the dialog that the salon could not be removed when the database fails, keep it, and close the dialog when asked', async () => {
    // Arrange
    const user = userEvent.setup()
    await bookingsFinished(OSAKA)
    await openAs(settingsHrefOf(await salonIdOf(OSAKA)), OPERATOR)
    const dialog = await askToRemove(OSAKA)
    await refuse('update', 'salons')
    await user.click(within(dialog).getByRole('button', { name: '削除する' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'サロンを削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
    )

    // Act
    await user.click(within(dialog).getByRole('button', { name: '戻る' }))

    // Assert
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(await isRemoved(OSAKA)).toBe(false)

    // Act
    const opened = await askToRemove(OSAKA)

    // Assert: what went wrong is said no more
    expect(within(opened).queryByRole('alert')).toBeNull()
  })

  it('should show a salon removed meanwhile as not found', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAs(settingsHrefOf(await salonIdOf(OSAKA)), OPERATOR)
    const dialog = await askToRemove(OSAKA)
    await salonRemovedMeanwhile(OSAKA)

    // Act
    await user.click(within(dialog).getByRole('button', { name: '削除する' }))

    // Assert
    expect(await heading('サロンが見つかりません')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it.each<[string, string]>([
    ['a manager', MANAGER],
    ['a stylist', STYLIST],
  ])('should not offer the removal to %s', async (_, email) => {
    // Act
    await openAs(settingsHrefOf(await salonIdOf(TOKYO)), email)

    // Assert
    await screen.findByRole('region', { name: 'サロン' })
    expect(
      screen.queryByRole('region', { name: 'サロンの削除' }),
    ).not.toBeInTheDocument()
  })

  it('should have no accessibility violations with the removal offered, asked and refused', async () => {
    // Arrange
    const user = userEvent.setup()
    const { container } = await openAs(
      settingsHrefOf(await salonIdOf(TOKYO)),
      OWNER,
    )
    await screen.findByRole('region', { name: 'サロンの削除' })
    expect(await findAccessibilityViolations(container)).toEqual([])
    const dialog = await askToRemove(TOKYO)
    expect(await findAccessibilityViolations(container)).toEqual([])

    // Act
    await user.click(within(dialog).getByRole('button', { name: '削除する' }))

    // Assert
    await within(
      screen.getByRole('region', { name: 'サロンの削除' }),
    ).findByRole('alert')
    expect(await findAccessibilityViolations(container)).toEqual([])
  })
})

describe('adding and removing a salon on a page in English', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
    languageStore.choose('en')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    localStorage.clear()
  })

  it('should say in English what is wrong, then add the salon and say so in English', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAs(SALON_ENTRY_PATH, OPERATOR, 'en')
    expect(await heading('Register a salon')).toHaveFocus()
    expect(
      screen.getByText(
        'The hours are entered in the settings of the salon once it is registered.',
      ),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Register the salon' }))
    expect(text('Name')).toHaveAccessibleDescription(
      expect.stringContaining('Salon name: enter 1 to 255 characters.'),
    )
    await user.type(text('Name'), NEW_NAME)
    await user.type(text('Prefecture'), '東京都')
    await user.type(text('City'), '新宿区')
    await user.type(text('Street address'), '西新宿 1-1-1')
    await user.type(text('Phone number'), '03-1111-2222')
    await user.type(text('Email address'), 'shinjuku@example.com')

    // Act
    await user.click(screen.getByRole('button', { name: 'Register the salon' }))

    // Assert
    expect(await heading('Salon settings')).toHaveFocus()
    expect(notifications()).toContain(
      `Registered the salon “${NEW_NAME}”. Enter its hours and its menu, then accept online bookings.`,
    )
    await screen.findByRole('region', { name: 'Salon' })
    expect(termsOf('Salon')).toContainEqual(['Online booking', 'Paused'])
  })

  it('should tell the owner of a salon in English that the account does not add salons', async () => {
    // Act
    await openAs(SALON_ENTRY_PATH, OWNER, 'en')

    // Assert
    expect(
      await screen.findByText(
        'This account cannot register salons. Only administrators can register a salon.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Back to the start' }),
    ).toBeInTheDocument()
  })

  it('should ask in English, and say in English why bookings that are not finished keep the salon', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAs(settingsHrefOf(await salonIdOf(TOKYO)), OWNER, 'en')
    await user.click(
      await screen.findByRole('button', { name: 'Remove the salon' }),
    )
    const dialog = await screen.findByRole('dialog', {
      name: `Remove the salon “${TOKYO}”?`,
    })
    expect(dialog).toHaveAccessibleDescription(
      'A removed salon cannot be restored: it is taken off the list of salons and the screens of the customers, and the staff can no longer use its screens.',
    )

    // Act
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }))

    // Assert
    const removal = screen.getByRole('region', { name: 'Remove the salon' })
    expect(await within(removal).findByRole('alert')).toHaveTextContent(
      `The salon “${TOKYO}” has bookings that are not finished (draft, awaiting confirmation, confirmed, in progress), so it cannot be removed.`,
    )
    expect(
      within(removal).getByRole('link', { name: 'Open the booking ledger' }),
    ).toBeInTheDocument()
    expect(await isRemoved(TOKYO)).toBe(false)
  })
})
