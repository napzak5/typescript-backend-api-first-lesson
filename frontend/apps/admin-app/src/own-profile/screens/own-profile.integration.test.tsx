import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { salonIdOf, signInAs } from '@beauty-salon-frontend/testing/api'
import {
  OPERATOR,
  OWNER,
  STYLIST,
  TOKYO,
} from '@beauty-salon-frontend/testing/seed'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderAt } from '../../__tests__/screens'
import { OWN_PROFILE_PATH } from '../../navigation'
import {
  arrangeInactive,
  changedMeanwhile,
  staffIdOf,
  storedMemberOf,
  TANAKA,
} from '../../staff/__tests__/arrangements'

/*
 * The profile of the member an account is linked to, read and changed by
 * the member against the API: Hiroshi Tanaka (STF001, the account
 * stylist1) is introduced with everything but a photograph in the seed
 * data, Akiko Mori (the owner) with her certifications alone. Somebody did
 * something meanwhile where a test says so.
 */

const PORTAL = 'https://portal.salon.example'

/** Opens the profile, signed in as an account of the seed data. */
const openProfileAs = async (email: string): Promise<void> => {
  renderAt(OWN_PROFILE_PATH)
  await signInAs(email)
}

const RECORD = 'お客様に見せるプロフィール'

const recordHeading = () =>
  screen.findByRole('heading', { level: 2, name: RECORD })

/** What the record says, term by term. */
const terms = (): [string, string][] =>
  within(screen.getByRole('region', { name: RECORD }))
    .getAllByRole('term')
    .map((term) => [
      term.textContent ?? '',
      term.nextElementSibling?.textContent ?? '',
    ])

/** What the record says of one term */
const termOf = (term: string): string | undefined =>
  terms().find(([shown]) => shown === term)?.[1]

/** Waits for the record to say of each term what is given: it shows the profile once the cache has it. */
const recordSays = (said: Record<string, string>): Promise<void> =>
  waitFor(() =>
    expect(
      Object.fromEntries(Object.keys(said).map((term) => [term, termOf(term)])),
    ).toEqual(said),
  )

const text = (name: string): HTMLElement =>
  screen.getByRole('textbox', { name })

/** Writes a control anew: what it held is cleared first. */
const rewrite = async (
  user: ReturnType<typeof userEvent.setup>,
  name: string,
  value: string,
): Promise<void> => {
  await user.clear(text(name))
  if (value !== '') {
    await user.type(text(name), value)
  }
}

const SAVED = 'プロフィールを保存しました。お客様の画面に、すぐに出ます。'

const UNAVAILABLE =
  'このアカウントのプロフィールは、いまは使えません。スタッフ情報が無効になったか、ログインアカウントの紐づけが解除されています。サロンのオーナーに確かめてください。'

describe('the own profile, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
    vi.stubEnv('VITE_PORTAL_APP_URL', PORTAL)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('should lead a stylist from the navigation to the profile the customers are shown, and to where they read it', async () => {
    // Arrange
    const user = userEvent.setup()
    renderAt('/')
    await signInAs(STYLIST)

    // Act
    await user.click(
      await within(
        await screen.findByRole('navigation', { name: 'メインメニュー' }),
      ).findByRole('link', { name: 'プロフィール' }),
    )

    // Assert
    await recordHeading()
    expect(terms()).toEqual([
      ['表示名', 'Hiroshi Tanaka'],
      ['レベル', 'シニア'],
      ['役職', 'Senior Stylist'],
      ['予約', '受ける'],
      ['専門', 'cutcolorperm'],
      ['資格', '美容師免許管理美容師'],
      ['経験年数', '10 年'],
      [
        '紹介文',
        'Over 10 years of experience in hair styling. Specializes in modern cuts and color techniques.',
      ],
      ['写真の URL', '記録なし'],
    ])
    expect(
      screen.getByRole('link', {
        name: 'お客様からの見え方を、サロンのページで見る',
      }),
    ).toHaveAttribute('href', `${PORTAL}/salons/${await salonIdOf(TOKYO)}`)
    expect(text('専門')).toHaveValue('cut、color、perm')
    expect(
      screen.getByRole('link', { name: 'プロフィール', current: 'page' }),
    ).toBeInTheDocument()
  })

  it('should save what the member changed, show it at once and keep what they did not change', async () => {
    // Arrange
    const user = userEvent.setup()
    await openProfileAs(STYLIST)
    await recordHeading()

    // Act
    await rewrite(user, '専門', 'カット、メンズカット')
    await rewrite(user, '紹介文', '週末は指名のお客様が中心です。')
    await rewrite(
      user,
      '写真の URL',
      'https://photos.example.com/staff/tanaka.jpg',
    )
    await user.click(screen.getByRole('button', { name: '保存する' }))

    // Assert
    expect(await screen.findByText(SAVED)).toBeInTheDocument()
    expect(await recordHeading()).toHaveFocus()
    await recordSays({
      専門: 'カットメンズカット',
      紹介文: '週末は指名のお客様が中心です。',
    })
    expect(text('専門')).toHaveValue('カット、メンズカット')
    expect(await storedMemberOf(STYLIST)).toMatchObject({
      specialties: ['カット', 'メンズカット'],
      bio: '週末は指名のお客様が中心です。',
      imageUrl: 'https://photos.example.com/staff/tanaka.jpg',
      yearsOfExperience: 10,
      certifications: ['美容師免許', '管理美容師'],
      displayName: 'Hiroshi Tanaka',
    })
  })

  it('should clear what was emptied: a list to none, a value to nothing', async () => {
    // Arrange
    const user = userEvent.setup()
    await openProfileAs(STYLIST)
    await recordHeading()

    // Act
    await rewrite(user, '資格', '')
    await rewrite(user, '経験年数（年）', '')
    await rewrite(user, '紹介文', '')
    await user.click(screen.getByRole('button', { name: '保存する' }))

    // Assert
    expect(await screen.findByText(SAVED)).toBeInTheDocument()
    await recordSays({
      資格: 'なし',
      経験年数: '記録なし',
      紹介文: '記録なし',
    })
    expect(await storedMemberOf(STYLIST)).toMatchObject({
      certifications: [],
      yearsOfExperience: null,
      bio: null,
      specialties: ['cut', 'color', 'perm'],
    })
  })

  it('should send nothing when nothing was changed, and say so', async () => {
    // Arrange
    const user = userEvent.setup()
    await openProfileAs(STYLIST)
    await recordHeading()
    const before = await storedMemberOf(STYLIST)

    // Act
    await user.click(screen.getByRole('button', { name: '保存する' }))

    // Assert
    expect(
      await screen.findByText('変更された項目はありません。'),
    ).toBeInTheDocument()
    expect((await storedMemberOf(STYLIST))?.updatedAt).toBe(before?.updatedAt)
  })

  it.each<[string, string, string, string]>([
    [
      'more years than a career has',
      '経験年数（年）',
      '101',
      '経験年数は、0 から 100 までの整数で入力してください。',
    ],
    [
      'an address that is no web address',
      '写真の URL',
      'photos.example.com/tanaka.jpg',
      'http:// か https:// で始まる、ドメイン名（example.com など）の URL を、500 文字以内で入力してください。',
    ],
  ])(
    'should say at the control what is wrong with %s, and send nothing',
    async (_, control, value, error) => {
      // Arrange
      const user = userEvent.setup()
      await openProfileAs(STYLIST)
      await recordHeading()
      const before = await storedMemberOf(STYLIST)

      // Act
      await rewrite(user, control, value)
      await user.click(screen.getByRole('button', { name: '保存する' }))

      // Assert
      expect(text(control)).toHaveAccessibleDescription(
        expect.stringContaining(error),
      )
      expect(text(control)).toHaveFocus()
      expect((await storedMemberOf(STYLIST))?.updatedAt).toBe(before?.updatedAt)
    },
  )

  it('should keep what is being written when the profile is read anew, and what the salon changed in the ledger meanwhile', async () => {
    // Arrange
    const user = userEvent.setup()
    await openProfileAs(STYLIST)
    await recordHeading()
    await rewrite(user, '専門', 'カット')
    await changedMeanwhile(
      await staffIdOf(TANAKA),
      'サロンが書き直した紹介文です。',
    )

    // Act: the window comes back, and the profile is read anew
    window.dispatchEvent(new Event('visibilitychange'))

    // Assert
    await recordSays({ 紹介文: 'サロンが書き直した紹介文です。' })
    expect(text('専門')).toHaveValue('カット')

    // Act
    await user.click(screen.getByRole('button', { name: '保存する' }))

    // Assert
    expect(await screen.findByText(SAVED)).toBeInTheDocument()
    await recordSays({
      専門: 'カット',
      紹介文: 'サロンが書き直した紹介文です。',
    })
    expect(text('紹介文')).toHaveValue('サロンが書き直した紹介文です。')
    expect(await storedMemberOf(STYLIST)).toMatchObject({
      specialties: ['カット'],
      bio: 'サロンが書き直した紹介文です。',
    })
  })

  it('should say the profile is not available once the member was made inactive meanwhile', async () => {
    // Arrange
    const user = userEvent.setup()
    await openProfileAs(STYLIST)
    await recordHeading()
    await arrangeInactive(TANAKA)

    // Act
    await rewrite(user, '専門', 'カット')
    await user.click(screen.getByRole('button', { name: '保存する' }))

    // Assert
    expect(await screen.findByText(UNAVAILABLE)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: RECORD })).toBeNull()
    expect((await storedMemberOf(STYLIST))?.specialties).toEqual([
      'cut',
      'color',
      'perm',
    ])
  })

  it('should say the profile is not available to a member who is inactive', async () => {
    // Arrange
    await arrangeInactive(TANAKA)

    // Act
    await openProfileAs(STYLIST)

    // Assert
    expect(await screen.findByText(UNAVAILABLE)).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('should say what is not written yet of an owner', async () => {
    // Act
    await openProfileAs(OWNER)
    await recordHeading()

    // Assert
    expect(terms()).toEqual([
      ['表示名', 'Akiko Mori'],
      ['レベル', 'ディレクター'],
      ['役職', 'Owner'],
      ['予約', '受けない'],
      ['専門', 'なし'],
      ['資格', '美容師免許管理美容師'],
      ['経験年数', '記録なし'],
      ['紹介文', '記録なし'],
      ['写真の URL', '記録なし'],
    ])
  })

  it('should let an owner write her own introduction, and leave the other members as they are', async () => {
    // Arrange
    const user = userEvent.setup()
    await openProfileAs(OWNER)
    await recordHeading()

    // Act
    await rewrite(user, '専門', 'カット、ヘッドスパ')
    await rewrite(user, '経験年数（年）', '20')
    await user.click(screen.getByRole('button', { name: '保存する' }))

    // Assert
    expect(await screen.findByText(SAVED)).toBeInTheDocument()
    await recordSays({ 専門: 'カットヘッドスパ', 経験年数: '20 年' })
    expect(await storedMemberOf(OWNER)).toMatchObject({
      specialties: ['カット', 'ヘッドスパ'],
      yearsOfExperience: 20,
      certifications: ['美容師免許', '管理美容師'],
    })
    expect(await storedMemberOf(STYLIST)).toMatchObject({
      specialties: ['cut', 'color', 'perm'],
      yearsOfExperience: 10,
    })
  })

  it('should tell an administrator that the account has no profile, and lead nowhere to it', async () => {
    // Act
    await openProfileAs(OPERATOR)

    // Assert
    expect(
      await screen.findByText(
        '管理者のアカウントには、スタッフのプロフィールがありません。プロフィールは、サロンのスタッフに紐づいたアカウントで見て、直します。',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'プロフィール' })).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  describe('accessibility', () => {
    it('should have no violations with the profile and its form', async () => {
      // Arrange
      const { container } = renderAt(OWN_PROFILE_PATH)
      await signInAs(STYLIST)
      await recordHeading()

      // Act
      const violations = await findAccessibilityViolations(container)

      // Assert
      expect(violations).toEqual([])
    })

    it('should have no violations with what was refused at the controls', async () => {
      // Arrange
      const user = userEvent.setup()
      const { container } = renderAt(OWN_PROFILE_PATH)
      await signInAs(STYLIST)
      await recordHeading()
      await rewrite(user, '経験年数（年）', '101')
      await user.click(screen.getByRole('button', { name: '保存する' }))
      await screen.findAllByText(
        /経験年数は、0 から 100 までの整数で入力してください。/,
      )

      // Act
      const violations = await findAccessibilityViolations(container)

      // Assert
      expect(violations).toEqual([])
    })
  })
})
