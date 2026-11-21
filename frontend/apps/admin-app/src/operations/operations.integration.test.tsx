import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { testApi } from '@beauty-salon-frontend/testing/api'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest'
import { App } from '../App'
import {
  ADMIN,
  KENJI,
  MANAGER,
  OWNER,
  refuse,
  STYLIST,
  salonIdOf,
  signInAs,
  TOKYO,
  YUKI,
} from '../bookings/__tests__/arrangements'
import {
  arrangePoints,
  askedForErasure,
  customerIdOf,
  storedBalanceOf,
  storedPointsOf,
} from '../customers/__tests__/arrangements'
import { OPERATIONS_PATH } from '../navigation'
import {
  arrangeRemovedFile,
  dueForErasure,
  storedErasureOf,
  storedFilenames,
} from './__tests__/arrangements'
import { ADMINISTRATORS_ONLY } from './operations'

/*
 * The operations of the platform against the API: an administrator reads
 * the state of the system, and runs by hand the expiry of the points, the
 * deletion requests that are due and the removal of the attachments that
 * are no longer needed. `__tests__/arrangements.ts` gives the database
 * what each of them handles, which the seed data does not have.
 */

const TITLE = 'Beauty Salon Admin'

const renderAt = (path: string) =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )

/** Opens a screen, signed in as an account of the seed data. */
const openAs = async (path: string, email: string): Promise<void> => {
  renderAt(path)
  await signInAs(email)
}

const heading = (name: string) =>
  screen.findByRole('heading', { level: 1, name })

/** Opens the operations as the administrator, and waits for the state of the system. */
const openOperations = async (): Promise<void> => {
  await openAs(OPERATIONS_PATH, ADMIN)
  await screen.findByRole('region', { name: 'システムの状態' })
}

/** Each term of the state of the system with its description */
const stateOf = (): string[][] => {
  const record = screen.getByRole('region', { name: 'システムの状態' })
  const descriptions = within(record).getAllByRole('definition')

  return within(record)
    .getAllByRole('term')
    .map((term, index) => [
      term.textContent ?? '',
      descriptions[index]?.textContent ?? '',
    ])
}

/** The requests sent to a probe, by its path */
const probed = (fetched: MockInstance<typeof fetch>, path: string): number =>
  fetched.mock.calls.filter(([input]) => new Request(input).url.endsWith(path))
    .length

/** Runs an operation from its part: its button, then that of its dialog. */
const run = async (
  user: ReturnType<typeof userEvent.setup>,
  part: string,
  button: string,
  question: string,
  confirm: string,
) => {
  const region = await screen.findByRole('region', { name: part })
  await user.click(within(region).getByRole('button', { name: button }))
  const dialog = await screen.findByRole('dialog', { name: question })
  await user.click(within(dialog).getByRole('button', { name: confirm }))

  return { region, dialog }
}

const expire = (user: ReturnType<typeof userEvent.setup>) =>
  run(
    user,
    'ポイントの失効',
    'ポイントを失効させる',
    '有効期限の過ぎたポイントを失効させますか？',
    '失効させる',
  )

const erase = (user: ReturnType<typeof userEvent.setup>) =>
  run(
    user,
    'データの消去の依頼の実行',
    '消去の依頼を実行する',
    '予定日時を過ぎた消去の依頼を、すべて実行しますか？',
    '実行する',
  )

const purge = (user: ReturnType<typeof userEvent.setup>) =>
  run(
    user,
    '添付ファイルの掃除',
    '添付ファイルを掃除する',
    '要らなくなった添付ファイルを消しますか？',
    '消す',
  )

/** Lets the customer of the address have earned points a month ago that expired three days ago. */
const arrangeExpiredPoints = (email: string, points: number) =>
  arrangePoints(email, [{ type: 'earned', points, daysAgo: 30, expiresIn: -3 }])

describe('the operations of the platform, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_APP_TITLE', TITLE)
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  describe('the state of the system', () => {
    it('should lead an administrator from the header to the operations, and say that the API runs, takes requests and reaches its database', async () => {
      // Arrange
      const user = userEvent.setup()
      await openAs('/', ADMIN)

      // Act
      await user.click(await screen.findByRole('link', { name: '運用' }))

      // Assert
      expect(await heading('運用')).toBeVisible()
      await screen.findByRole('region', { name: 'システムの状態' })
      expect(stateOf()).toEqual(
        expect.arrayContaining([
          ['プロセス', '動いています'],
          ['リクエストの受け付け', '受け付けています'],
          ['全体の状態', '正常です'],
        ]),
      )
      expect(stateOf().map(([term]) => term)).toEqual([
        'プロセス',
        'リクエストの受け付け',
        '全体の状態',
        'API のバージョン',
        '確かめた日時',
      ])
      const [, dependency] = within(
        screen.getByRole('table', { name: '依存先の状態' }),
      ).getAllByRole('row')
      expect(dependency).toHaveTextContent(
        /^データベース動いています\d+ ミリ秒ありません$/,
      )
      expect(screen.getByRole('link', { name: '運用' })).toHaveAttribute(
        'aria-current',
        'page',
      )
    })

    it('should ask the three probes again when the administrator asks', async () => {
      // Arrange
      const user = userEvent.setup()
      const fetched = vi.spyOn(globalThis, 'fetch')
      await openOperations()
      await waitFor(() => {
        expect(probed(fetched, '/api/system/health')).toBe(1)
      })

      // Act
      await user.click(screen.getByRole('button', { name: 'もう一度確かめる' }))

      // Assert
      await waitFor(() => {
        expect(
          ['alive', 'ready', 'health'].map((probe) =>
            probed(fetched, `/api/system/${probe}`),
          ),
        ).toEqual([2, 2, 2])
      })
      expect(
        screen.getByRole('button', { name: 'もう一度確かめる' }),
      ).toHaveFocus()
    })
  })

  describe('the expiry of the points', () => {
    it('should expire the points whose date has passed, of every customer, after a dialog, and find none on a second run', async () => {
      // Arrange
      const user = userEvent.setup()
      await arrangeExpiredPoints(YUKI.email, 300)
      await arrangeExpiredPoints(KENJI.email, 120)
      const balances = await Promise.all(
        [YUKI.email, KENJI.email].map(storedBalanceOf),
      )
      await openOperations()

      // Act
      const { region } = await expire(user)

      // Assert
      expect(
        await screen.findByText(
          '2 人のお客様の、合わせて 420 ポイントを失効させました。',
        ),
      ).toBeVisible()
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(region).toHaveTextContent(
        /に実行しました。2 人のお客様の、合わせて 420 ポイントを失効させました。/,
      )
      expect((await storedPointsOf(YUKI.email))[0]).toEqual({
        transactionType: 'expired',
        points: -300,
        balance: (balances[0] ?? 0) - 300,
        description: null,
        referenceType: null,
        referenceId: null,
        expiryDate: null,
      })
      expect(
        await Promise.all([YUKI.email, KENJI.email].map(storedBalanceOf)),
      ).toEqual([(balances[0] ?? 0) - 300, (balances[1] ?? 0) - 120])

      // Act
      await expire(user)

      // Assert
      expect(
        await within(region).findByText(
          /に実行しました。失効させるポイントはありませんでした。$/,
        ),
      ).toBeVisible()
      expect(await storedPointsOf(YUKI.email)).toHaveLength(3)
    })

    it('should say in the dialog that the run may have stopped halfway when the database fails, and expire the points on another attempt', async () => {
      // Arrange
      const user = userEvent.setup()
      await arrangeExpiredPoints(YUKI.email, 300)
      await refuse('insert', 'customer_points')
      await openOperations()

      // Act
      const { dialog } = await expire(user)

      // Assert
      expect(await within(dialog).findByRole('alert')).toHaveTextContent(
        'ポイントの失効を終えられませんでした。途中で止まったときも、それまでの分は失効させてあります。通信の状態を確かめて、もう一度実行すると、残りを失効させます。',
      )
      expect((await storedPointsOf(YUKI.email))[0]?.transactionType).toBe(
        'earned',
      )

      // Act
      await testApi().query('drop trigger refuse on customer_points')
      await user.click(
        within(dialog).getByRole('button', { name: '失効させる' }),
      )

      // Assert
      expect(
        await screen.findByText(
          '1 人のお客様の、合わせて 300 ポイントを失効させました。',
        ),
      ).toBeVisible()
      expect((await storedPointsOf(YUKI.email))[0]?.transactionType).toBe(
        'expired',
      )
    })
  })

  describe('the deletion requests that are due', () => {
    it('should carry out the requests whose date has come, list them, leave those still to come, and find none on a second run', async () => {
      // Arrange
      const user = userEvent.setup()
      const yuki = await customerIdOf(YUKI.email)
      const kenji = await customerIdOf(KENJI.email)
      await dueForErasure(YUKI.email, OWNER)
      await askedForErasure(KENJI.email, OWNER)
      await openOperations()

      // Act
      const { region } = await erase(user)

      // Assert
      expect(
        await screen.findByText(
          '1 件の依頼を実行して、お客様のデータを消去しました。消去したことは、依頼を受け付けたサロンから本人に知らせてください。',
        ),
      ).toBeVisible()
      const rows = within(
        within(region).getByRole('table', { name: '実行した依頼' }),
      ).getAllByRole('row')
      expect(rows).toHaveLength(2)
      expect(rows[1]).toHaveTextContent(/ご本人からのお申し出$/)
      expect(await storedErasureOf(yuki)).toEqual([
        { email: `${yuki}@erased.invalid`, removed: true, status: 'completed' },
      ])
      expect(await storedErasureOf(kenji)).toEqual([
        { email: KENJI.email, removed: false, status: 'pending' },
      ])

      // Act
      await erase(user)

      // Assert
      expect(
        await within(region).findByText(
          /に実行しました。予定日時を過ぎた依頼はありませんでした。$/,
        ),
      ).toBeVisible()
      expect(within(region).queryByRole('table')).toBeNull()
    })
  })

  describe('the removal of the attachments that are no longer needed', () => {
    it('should remove the deleted attachments whose address for the upload ran out, and leave those whose address may still be used', async () => {
      // Arrange
      const user = userEvent.setup()
      const salonId = await salonIdOf(TOKYO)
      await arrangeRemovedFile(salonId, STYLIST, 60)
      await arrangeRemovedFile(salonId, STYLIST, 5)
      await openOperations()

      // Act
      const { region } = await purge(user)

      // Assert
      expect(
        await screen.findByText(
          '1 件の添付ファイルを、保存先のファイルと一緒に消しました。',
        ),
      ).toBeVisible()
      expect(region).toHaveTextContent(/に実行しました。1 件の添付ファイルを/)
      expect(await storedFilenames()).toEqual(['削除した書類 5.pdf'])
    })
  })

  describe('the other roles', () => {
    it.each<[string, string]>([
      ['the owner of a salon', OWNER],
      ['its manager', MANAGER],
      ['a stylist', STYLIST],
    ])(
      'should tell %s that the administrator runs the platform, without asking the API',
      async (_, email) => {
        // Arrange
        const fetched = vi.spyOn(globalThis, 'fetch')

        // Act
        await openAs(OPERATIONS_PATH, email)

        // Assert
        expect(await heading('運用')).toBeVisible()
        expect(screen.getByRole('main')).toHaveTextContent(ADMINISTRATORS_ONLY)
        expect(screen.queryByRole('link', { name: '運用' })).toBeNull()
        expect(
          screen.queryByRole('region', { name: 'システムの状態' }),
        ).toBeNull()
        expect(
          fetched.mock.calls.filter(([input]) =>
            new Request(input).url.includes('/api/system/'),
          ),
        ).toEqual([])
      },
    )
  })

  it('should be accessible with the state of the system and the requests a run carried out', async () => {
    // Arrange
    const user = userEvent.setup()
    await dueForErasure(YUKI.email, OWNER)
    await openOperations()
    const { region } = await erase(user)
    await within(region).findByRole('table', { name: '実行した依頼' })

    // Assert
    expect(await findAccessibilityViolations(document.body)).toEqual([])
  })
})
