import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLayoutEffect } from 'react'
import { MemoryRouter, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../App'
import {
  MANAGER,
  OWNER,
  salonIdOf,
  signInAs,
  THERAPIST,
  TOKYO,
} from '../bookings/__tests__/arrangements'
import {
  staffChangeHrefOf,
  staffEntryHrefOf,
  staffLedgerHrefOf,
  staffMemberHrefOf,
} from '../navigation'
import {
  arrangeInactive,
  arrangeLedgerOrder,
  arrangeMembers,
  arrangeOwnerAccount,
  arrangeRemovedMember,
  changedMeanwhile,
  crowdIdOf,
  ledgerSize,
  MORI,
  removedMeanwhile,
  SUZUKI,
  staffIdOf,
  storedMemberOf,
  TANAKA,
  WATANABE,
} from './__tests__/arrangements'

/*
 * The staff ledger of the salon in Tokyo, as its owner keeps it: the five
 * members of the seed data, the owner among them, and the members a test
 * arranges. Another owner did something meanwhile where a test says so.
 */

/** The path a screen was opened at, and what the page showed in the commit that opened it */
let firstSight: [string, string] = ['', '']

const FirstSight = () => {
  const { pathname } = useLocation()
  useLayoutEffect(() => {
    firstSight = [pathname, document.querySelector('main')?.textContent ?? '']
  }, [pathname])

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
        <FirstSight />
      </MemoryRouter>
    </QueryClientProvider>,
  )

const heading = (name: string) =>
  screen.findByRole('heading', { level: 1, name })

/** What the application says in its notifications. */
const notifications = (): string[] =>
  screen
    .getAllByRole('status')
    .map((region) => region.textContent ?? '')
    .filter((said) => said !== '')

/** The rows of the ledger, cell by cell. */
const ledgerRows = (): (string | null)[][] =>
  within(screen.getByRole('table', { name: 'スタッフ' }))
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      [
        ...within(row).getAllByRole('rowheader'),
        ...within(row).getAllByRole('cell'),
      ].map((cell) => cell.textContent),
    )

/** What a card of a member says, term by term. */
const termsOf = (card: string): [string, string][] =>
  within(screen.getByRole('region', { name: card }))
    .getAllByRole('term')
    .map((term) => [
      term.textContent ?? '',
      term.nextElementSibling?.textContent ?? '',
    ])

const text = (name: string): HTMLElement =>
  screen.getByRole('textbox', { name })

/** The values a new member is given in the tests that register one */
const NEW_MEMBER = {
  lastName: 'Kato',
  firstName: 'Rina',
  displayName: 'Rina Kato',
  email: 'rina.kato@beautysalon.jp',
  phoneNumber: '090-7777-8888',
}

/** Fills in what nobody can leave out of a new member. */
const fillRequired = async (
  user: ReturnType<typeof userEvent.setup>,
  values: Partial<typeof NEW_MEMBER> = {},
): Promise<void> => {
  const filled = { ...NEW_MEMBER, ...values }
  await user.type(text('姓'), filled.lastName)
  await user.type(text('名'), filled.firstName)
  await user.type(text('表示名'), filled.displayName)
  await user.type(text('メールアドレス'), filled.email)
  await user.type(text('電話番号'), filled.phoneNumber)
  await user.selectOptions(
    screen.getByRole('combobox', { name: 'レベル' }),
    'stylist',
  )
}

/** Opens the screen that registers a member, as the owner, and waits for the form. */
const openEntry = async (): Promise<void> => {
  renderAt(staffEntryHrefOf(await salonIdOf(TOKYO)))
  await signInAs(OWNER)
  await screen.findByRole('group', { name: '名前' })
}

describe('the staff ledger, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('should list the members in the order they were registered in, the inactive among them, and lead to each', async () => {
    // Arrange
    await arrangeLedgerOrder()
    await arrangeInactive(WATANABE)
    const salonId = await salonIdOf(TOKYO)

    // Act
    renderAt(staffLedgerHrefOf(salonId))
    await signInAs(OWNER)

    // Assert
    expect(await heading('スタッフ')).toHaveFocus()
    await screen.findByRole('table', { name: 'スタッフ' })
    expect(ledgerRows()).toEqual([
      [
        'Akiko Mori',
        'Mori Akiko（モリ アキコ）',
        'ディレクター',
        'Owner',
        '受けない',
        '有効',
      ],
      [
        'Kenji Sato',
        'Sato Kenji（サトウ ケンジ）',
        'ディレクター',
        'Salon Manager',
        '受けない',
        '有効',
      ],
      [
        'Hiroshi Tanaka',
        'Tanaka Hiroshi（タナカ ヒロシ）',
        'シニア',
        'Senior Stylist',
        '受ける',
        '有効',
      ],
      [
        'Mika Suzuki',
        'Suzuki Mika（スズキ ミカ）',
        'エキスパート',
        'Color Specialist',
        '受ける',
        '有効',
      ],
      [
        'Yui Watanabe',
        'Watanabe Yui（ワタナベ ユイ）',
        'ジュニア',
        'Junior Stylist',
        '受ける',
        '無効',
      ],
    ])
    expect(screen.getByText('5 人')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Hiroshi Tanaka' }),
    ).toHaveAttribute(
      'href',
      staffMemberHrefOf(salonId, await staffIdOf(TANAKA)),
    )
    expect(
      screen.getByRole('link', { name: 'スタッフを登録する' }),
    ).toHaveAttribute('href', staffEntryHrefOf(salonId))
    expect(
      within(
        screen.getByRole('navigation', { name: 'メインメニュー' }),
      ).getByRole('link', { name: 'スタッフ' }),
    ).toHaveAttribute('aria-current', 'page')
  })

  it('should read the members that come next, and give the focus to the first of them', async () => {
    // Arrange
    const user = userEvent.setup()
    await arrangeMembers(18)
    renderAt(staffLedgerHrefOf(await salonIdOf(TOKYO)))
    await signInAs(OWNER)
    await screen.findByRole('table', { name: 'スタッフ' })
    expect(
      screen.getByText('23 人（20 人を表示しています）'),
    ).toBeInTheDocument()

    // Act
    await user.click(screen.getByRole('button', { name: 'さらに表示' }))

    // Assert
    expect(await screen.findByText('23 人')).toBeInTheDocument()
    expect(ledgerRows()).toHaveLength(23)
    expect(screen.getByRole('link', { name: 'Crowd 16' })).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'さらに表示' })).toBeNull()
  })

  it('should register a member with everything the ledger keeps, and show them at once', async () => {
    // Arrange
    const user = userEvent.setup()
    const salonId = await salonIdOf(TOKYO)
    renderAt(staffLedgerHrefOf(salonId))
    await signInAs(OWNER)
    await user.click(
      await screen.findByRole('link', { name: 'スタッフを登録する' }),
    )
    expect(await heading('スタッフを登録する')).toHaveFocus()
    await fillRequired(user)
    await user.type(text('姓（フリガナ）'), 'カトウ')
    await user.type(text('名（フリガナ）'), 'リナ')
    await user.type(text('予備の電話番号'), '03-1234-5678')
    await user.type(text('スタッフコード'), 'STF010')
    await user.type(text('役職'), 'Stylist')
    await user.type(text('雇用形態'), '正社員')
    await user.type(screen.getByLabelText('入社日'), '2027-04-01')
    await user.type(text('基本給（円）'), '250,000')
    await user.type(text('歩合率（%）'), '10.5')
    await user.type(text('専門'), 'カット、カラー')
    await user.type(text('資格'), '美容師免許')
    await user.type(text('経験年数（年）'), '3')
    await user.type(text('紹介文'), 'よろしくお願いします。')
    await user.type(
      screen.getByRole('textbox', { name: '写真の URL' }),
      'https://photos.example.com/staff/rina.jpg',
    )
    await user.clear(text('同時に担当できる予約の数'))
    await user.type(text('同時に担当できる予約の数'), '2')
    await user.clear(text('予約の後に確保する時間（分）'))
    await user.type(text('予約の後に確保する時間（分）'), '10')

    // Act
    await user.click(screen.getByRole('button', { name: '登録する' }))

    // Assert
    expect(await heading('スタッフの内容')).toHaveFocus()
    expect(notifications()).toContain(
      'Rina Kato さんを、スタッフ台帳に登録しました。',
    )
    const stored = await storedMemberOf(NEW_MEMBER.email)
    expect(stored).toMatchObject({
      firstName: 'Rina',
      lastName: 'Kato',
      firstNameKana: 'リナ',
      lastNameKana: 'カトウ',
      displayName: 'Rina Kato',
      phoneNumber: '090-7777-8888',
      alternativePhone: '03-1234-5678',
      staffCode: 'STF010',
      level: 'stylist',
      position: 'Stylist',
      specialties: ['カット', 'カラー'],
      bio: 'よろしくお願いします。',
      imageUrl: 'https://photos.example.com/staff/rina.jpg',
      yearsOfExperience: 3,
      certifications: ['美容師免許'],
      hireDate: '2027-04-01',
      employmentType: '正社員',
      baseSalary: 250000,
      commissionRate: '10.50',
      canReceiveBookings: true,
      maxConcurrentBookings: 2,
      bufferTimeBefore: 0,
      bufferTimeAfter: 10,
      isActive: true,
      removed: false,
    })
    // The member the API answered with is shown in the commit that opened the page
    expect(firstSight[1]).toContain('Kato Rina（カトウ リナ）')
    expect(termsOf('雇用')).toEqual([
      ['雇用形態', '正社員'],
      ['入社日', '2027年4月1日（木）'],
      ['基本給', '￥250,000'],
      ['歩合率', '10.5%'],
    ])
  })

  it('should register a member with what nobody can leave out, active and taking one booking at a time', async () => {
    // Arrange
    const user = userEvent.setup()
    await openEntry()
    await fillRequired(user)

    // Act
    await user.click(screen.getByRole('button', { name: '登録する' }))

    // Assert
    await heading('スタッフの内容')
    expect(await storedMemberOf(NEW_MEMBER.email)).toMatchObject({
      firstNameKana: null,
      staffCode: null,
      specialties: [],
      certifications: [],
      hireDate: null,
      baseSalary: null,
      commissionRate: null,
      canReceiveBookings: true,
      maxConcurrentBookings: 1,
      bufferTimeBefore: 0,
      bufferTimeAfter: 0,
      isActive: true,
    })
    expect(termsOf('スタッフ')).toContainEqual([
      'ログインアカウント',
      '紐づいていません',
    ])
  })

  it('should say what is wrong at the controls without asking the API, the focus on the first', async () => {
    // Arrange
    const user = userEvent.setup()
    await openEntry()
    await fillRequired(user, { email: 'rina' })
    await user.type(text('歩合率（%）'), '120')

    // Act
    await user.click(screen.getByRole('button', { name: '登録する' }))

    // Assert
    expect(text('メールアドレス')).toHaveFocus()
    expect(text('メールアドレス')).toHaveAccessibleDescription(
      expect.stringContaining('hanako@example.com のような形'),
    )
    expect(text('歩合率（%）')).toHaveAccessibleDescription(
      expect.stringContaining('0 から 100 までの数で'),
    )
    expect(await ledgerSize()).toBe(5)
  })

  it('should say at the address of mail that another member of the salon has it', async () => {
    // Arrange
    const user = userEvent.setup()
    await openEntry()
    await fillRequired(user, { email: 'Stylist1@BeautySalon.jp' })
    await user.type(text('スタッフコード'), 'STF010')

    // Act
    await user.click(screen.getByRole('button', { name: '登録する' }))

    // Assert
    await waitFor(() => expect(text('メールアドレス')).toHaveFocus())
    expect(text('メールアドレス')).toHaveAccessibleDescription(
      expect.stringContaining(
        'このメールアドレスのスタッフが、すでに台帳にいます。',
      ),
    )
    expect(text('スタッフコード')).not.toHaveAttribute('aria-invalid')
    expect(await ledgerSize()).toBe(5)
  })

  it('should say at the staff code that a member who was removed keeps it', async () => {
    // Arrange
    const user = userEvent.setup()
    await arrangeRemovedMember('STF777')
    await openEntry()
    // The address of mail of the member who was removed is free again
    await fillRequired(user, { email: 'former@beautysalon.jp' })
    await user.type(text('スタッフコード'), 'STF777')

    // Act
    await user.click(screen.getByRole('button', { name: '登録する' }))

    // Assert
    await waitFor(() => expect(text('スタッフコード')).toHaveFocus())
    expect(text('スタッフコード')).toHaveAccessibleDescription(
      expect.stringContaining('台帳から削除したスタッフも含みます'),
    )
    expect(text('メールアドレス')).not.toHaveAttribute('aria-invalid')
    expect(await ledgerSize()).toBe(5)
  })

  it('should show everything the ledger keeps of a member, with the ways to change and remove them', async () => {
    // Arrange
    const salonId = await salonIdOf(TOKYO)
    const staffId = await staffIdOf(TANAKA)

    // Act
    renderAt(staffMemberHrefOf(salonId, staffId))
    await signInAs(OWNER)

    // Assert
    expect(await heading('スタッフの内容')).toHaveFocus()
    await screen.findByRole('region', { name: 'スタッフ' })
    expect(termsOf('スタッフ').slice(0, 7)).toEqual([
      ['表示名', 'Hiroshi Tanaka'],
      ['氏名', 'Tanaka Hiroshi（タナカ ヒロシ）'],
      ['スタッフコード', 'STF001'],
      ['レベル', 'シニア'],
      ['役職', 'Senior Stylist'],
      ['状態', '有効'],
      ['ログインアカウント', '紐づいています'],
    ])
    expect(termsOf('雇用')).toEqual([
      ['雇用形態', 'full-time'],
      ['入社日', '2014年4月1日（火）'],
      ['基本給', '￥350,000'],
      ['歩合率', '15%'],
    ])
    expect(termsOf('予約の受け方')).toEqual([
      ['予約', '受ける'],
      ['同時に担当できる予約', '2 件まで'],
      ['予約の前に確保する時間', '10 分'],
      ['予約の後に確保する時間', '10 分'],
    ])
    expect(
      screen.getByRole('link', { name: 'スタッフ情報を直す' }),
    ).toHaveAttribute('href', staffChangeHrefOf(salonId, staffId))
    expect(screen.getByRole('button', { name: '削除' })).toBeVisible()
  })

  it('should not offer the owner the removal of their own member', async () => {
    // Act
    renderAt(staffMemberHrefOf(await salonIdOf(TOKYO), await staffIdOf(MORI)))
    await signInAs(OWNER)

    // Assert
    expect(
      await screen.findByText(
        'ご自身のスタッフ情報です。このアカウントからは、無効にすることも、削除することもできません。',
      ),
    ).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'スタッフ情報を直す' }),
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: '削除' })).toBeNull()
  })

  it('should send what was changed and nothing else, so that what another owner wrote meanwhile stays', async () => {
    // Arrange
    const user = userEvent.setup()
    const salonId = await salonIdOf(TOKYO)
    const staffId = await staffIdOf(SUZUKI)
    renderAt(staffChangeHrefOf(salonId, staffId))
    await signInAs(OWNER)
    await screen.findByRole('group', { name: '名前' })
    await changedMeanwhile(staffId, 'カラーの相談なら何でも。')
    await user.clear(text('役職'))
    await user.type(text('役職'), 'Art Director')
    await user.click(screen.getByRole('checkbox', { name: '予約を受ける' }))

    // Act
    await user.click(screen.getByRole('button', { name: '変更を保存する' }))

    // Assert
    expect(await heading('スタッフの内容')).toHaveFocus()
    expect(notifications()).toContain('スタッフ情報を直しました。')
    expect(await storedMemberOf('stylist2@beautysalon.jp')).toMatchObject({
      position: 'Art Director',
      canReceiveBookings: false,
      bio: 'カラーの相談なら何でも。',
      level: 'expert',
    })
    expect(termsOf('スタッフ')).toContainEqual(['役職', 'Art Director'])
    expect(termsOf('予約の受け方')).toContainEqual(['予約', '受けない'])
  })

  it('should ask the API for nothing when nothing was changed', async () => {
    // Arrange
    const user = userEvent.setup()
    const salonId = await salonIdOf(TOKYO)
    const staffId = await staffIdOf(SUZUKI)
    const before = await storedMemberOf('stylist2@beautysalon.jp')
    renderAt(staffChangeHrefOf(salonId, staffId))
    await signInAs(OWNER)
    await screen.findByRole('group', { name: '名前' })

    // Act
    await user.click(screen.getByRole('button', { name: '変更を保存する' }))

    // Assert
    expect(await heading('スタッフの内容')).toHaveFocus()
    expect(notifications()).toContain('変更された項目はありません。')
    expect(await storedMemberOf('stylist2@beautysalon.jp')).toEqual(before)
  })

  it('should keep the owner from deactivating their own member', async () => {
    // Arrange
    const user = userEvent.setup()
    renderAt(staffChangeHrefOf(await salonIdOf(TOKYO), await staffIdOf(MORI)))
    await signInAs(OWNER)
    await screen.findByRole('group', { name: '在籍' })
    await user.click(screen.getByRole('checkbox', { name: '有効なスタッフ' }))

    // Act
    await user.click(screen.getByRole('button', { name: '変更を保存する' }))

    // Assert
    const active = screen.getByRole('checkbox', { name: '有効なスタッフ' })
    await waitFor(() => expect(active).toHaveFocus())
    expect(active).toHaveAccessibleDescription(
      expect.stringContaining('ご自身のスタッフ情報は、無効にできません。'),
    )
    expect(await storedMemberOf('owner@beautysalon.jp')).toMatchObject({
      isActive: true,
    })
  })

  it('should say that the member is not found when another owner removed them while the form was open', async () => {
    // Arrange
    const user = userEvent.setup()
    await arrangeMembers(1)
    const staffId = await crowdIdOf(1)
    renderAt(staffChangeHrefOf(await salonIdOf(TOKYO), staffId))
    await signInAs(OWNER)
    await screen.findByRole('group', { name: '名前' })
    await removedMeanwhile(staffId)
    await user.type(text('役職'), 'Assistant')

    // Act
    await user.click(screen.getByRole('button', { name: '変更を保存する' }))

    // Assert
    expect(await heading('スタッフが見つかりません')).toBeVisible()
    expect(await storedMemberOf('crowd-1@beautysalon.jp')).toMatchObject({
      position: null,
      removed: true,
    })
  })

  it('should remove a member after the dialog asked, and say so on a ledger read anew', async () => {
    // Arrange
    const user = userEvent.setup()
    await arrangeMembers(1)
    const salonId = await salonIdOf(TOKYO)
    renderAt(staffLedgerHrefOf(salonId))
    await signInAs(OWNER)
    await user.click(await screen.findByRole('link', { name: 'Crowd 01' }))
    await user.click(await screen.findByRole('button', { name: '削除' }))
    const dialog = await screen.findByRole('dialog', {
      name: 'Crowd 01 さんを、スタッフ台帳から削除しますか？',
    })

    // Act
    await user.click(within(dialog).getByRole('button', { name: '削除する' }))

    // Assert
    expect(await heading('スタッフ')).toHaveFocus()
    expect(notifications()).toContain(
      'Crowd 01 さんを、スタッフ台帳から削除しました。',
    )
    expect(await storedMemberOf('crowd-1@beautysalon.jp')).toMatchObject({
      removed: true,
    })
    // The ledger read before the removal is not shown, nor the registration before the ledger is read anew
    expect(firstSight[0]).toBe(staffLedgerHrefOf(salonId))
    expect(
      firstSight[1].replace('Crowd 01 さんを、', '').includes('Crowd 01'),
    ).toBe(false)
    expect(firstSight[1]).not.toContain('スタッフを登録する')
    await screen.findByRole('table', { name: 'スタッフ' })
    expect(screen.queryByRole('link', { name: 'Crowd 01' })).toBeNull()
  })

  it('should say why a member whose bookings are not finished is not removed', async () => {
    // Arrange
    const user = userEvent.setup()
    renderAt(staffMemberHrefOf(await salonIdOf(TOKYO), await staffIdOf(TANAKA)))
    await signInAs(OWNER)
    await user.click(await screen.findByRole('button', { name: '削除' }))
    const dialog = await screen.findByRole('dialog')

    // Act
    await user.click(within(dialog).getByRole('button', { name: '削除する' }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Hiroshi Tanaka さんは、終わっていない予約（下書き、確定待ち、確定、施術中）を担当しているため、削除できません。',
    )
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(await storedMemberOf('stylist1@beautysalon.jp')).toMatchObject({
      removed: false,
    })
  })

  it('should say that the member is not found when another owner removed them before the removal', async () => {
    // Arrange
    const user = userEvent.setup()
    await arrangeMembers(1)
    const staffId = await crowdIdOf(1)
    renderAt(staffMemberHrefOf(await salonIdOf(TOKYO), staffId))
    await signInAs(OWNER)
    await user.click(await screen.findByRole('button', { name: '削除' }))
    const dialog = await screen.findByRole('dialog')
    await removedMeanwhile(staffId)

    // Act
    await user.click(within(dialog).getByRole('button', { name: '削除する' }))

    // Assert
    expect(await heading('スタッフが見つかりません')).toBeVisible()
  })

  it('should tell a manager that the staff ledger is not theirs to keep, without a link to it', async () => {
    // Act
    renderAt(staffLedgerHrefOf(await salonIdOf(TOKYO)))
    await signInAs(MANAGER)

    // Assert
    expect(
      await screen.findByText(
        'このサロンのスタッフ台帳は、扱えません。スタッフ台帳を扱えるのは、そのサロンのオーナーと、管理者です。',
      ),
    ).toBeVisible()
    expect(
      within(
        screen.getByRole('navigation', { name: 'メインメニュー' }),
      ).queryByRole('link', { name: 'スタッフ' }),
    ).toBeNull()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('should tell the owner of another salon that its staff ledger is not theirs, as the API refused it', async () => {
    // Arrange
    await arrangeOwnerAccount(THERAPIST)

    // Act
    renderAt(staffMemberHrefOf(await salonIdOf(TOKYO), await staffIdOf(TANAKA)))
    await signInAs(THERAPIST)

    // Assert
    expect(
      await screen.findByText(
        'このサロンのスタッフ台帳は、扱えません。スタッフ台帳を扱えるのは、そのサロンのオーナーと、管理者です。',
      ),
    ).toBeVisible()
    expect(screen.queryByRole('region', { name: 'スタッフ' })).toBeNull()
  })

  it.each<
    [string, (salonId: string) => Promise<string>, () => Promise<unknown>]
  >([
    [
      'the ledger',
      async (salonId) => staffLedgerHrefOf(salonId),
      () => screen.findByRole('table', { name: 'スタッフ' }),
    ],
    [
      'the registration of a member',
      async (salonId) => staffEntryHrefOf(salonId),
      () => screen.findByRole('group', { name: '名前' }),
    ],
    [
      'a member',
      async (salonId) => staffMemberHrefOf(salonId, await staffIdOf(TANAKA)),
      () => screen.findByRole('region', { name: '予約の受け方' }),
    ],
    [
      'the change of a member',
      async (salonId) => staffChangeHrefOf(salonId, await staffIdOf(TANAKA)),
      () => screen.findByRole('group', { name: '在籍' }),
    ],
  ])('should be accessible on %s', async (_, hrefOf, shown) => {
    // Arrange
    renderAt(await hrefOf(await salonIdOf(TOKYO)))
    await signInAs(OWNER)

    // Act
    await shown()

    // Assert
    expect(await findAccessibilityViolations(document.body)).toEqual([])
  })
})
