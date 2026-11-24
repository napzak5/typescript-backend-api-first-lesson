import { languageStore } from '@beauty-salon-frontend/io'
import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { asked } from '@beauty-salon-frontend/testing/answers'
import { salonIdOf, testApi } from '@beauty-salon-frontend/testing/api'
import { heading, rowsOf } from '@beauty-salon-frontend/testing/screens'
import {
  KENJI,
  MANAGER,
  OPERATOR,
  OWNER,
  STYLIST,
  TOKYO,
  YUKI,
} from '@beauty-salon-frontend/testing/seed'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openAs } from '../../__tests__/screens'
import { refuse } from '../../bookings/__tests__/arrangements'
import {
  arrangePoints,
  askedForErasure,
  customerIdOf,
  storedBalanceOf,
  storedPointsOf,
} from '../../customers/__tests__/arrangements'
import { OPERATIONS_PATH } from '../../navigation'
import {
  arrangeRemovedFile,
  dueForErasure,
  storedErasureOf,
  storedFilenames,
} from '../__tests__/arrangements'
import { ADMINISTRATORS_ONLY } from '../utils/operations'

/*
 * The operations of the platform against the API: an administrator reads
 * the state of the system, and runs by hand the expiry of the points, the
 * deletion requests that are due and the removal of the attachments that
 * are no longer needed. `__tests__/arrangements.ts` gives the database
 * what each of them handles, which the seed data does not have.
 */

/** Opens the operations as the administrator, and waits for the state of the system. */
const openOperations = async (language: 'ja' | 'en' = 'ja'): Promise<void> => {
  await openAs(OPERATIONS_PATH, OPERATOR, language)
  await screen.findByRole('region', {
    name: language === 'ja' ? 'システムの状態' : 'State of the system',
  })
}

/** Each term of the state of the system with its description */
const stateOf = (name = 'システムの状態'): string[][] => {
  const record = screen.getByRole('region', { name })
  const descriptions = within(record).getAllByRole('definition')

  return within(record)
    .getAllByRole('term')
    .map((term, index) => [
      term.textContent ?? '',
      descriptions[index]?.textContent ?? '',
    ])
}

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
      await openAs('/', OPERATOR)

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
      expect(rowsOf('依存先の状態')).toEqual([
        [
          'データベース',
          '動いています',
          expect.stringMatching(/^\d+ ミリ秒$/),
          'ありません',
        ],
      ])
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
        expect(
          asked(fetched).filter((line) => line.endsWith('/api/system/health')),
        ).toHaveLength(1)
      })

      // Act
      await user.click(screen.getByRole('button', { name: 'もう一度確かめる' }))

      // Assert
      await waitFor(() => {
        expect(
          ['alive', 'ready', 'health'].map(
            (probe) =>
              asked(fetched).filter((line) =>
                line.endsWith(`/api/system/${probe}`),
              ).length,
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
      expect(
        rowsOf(within(region).getByRole('table', { name: '実行した依頼' })),
      ).toEqual([
        [
          expect.any(String),
          expect.any(String),
          expect.stringMatching(/ご本人からのお申し出$/),
        ],
      ])
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
        expect(screen.getByRole('main')).toHaveTextContent(
          ADMINISTRATORS_ONLY.ja,
        )
        expect(screen.queryByRole('link', { name: '運用' })).toBeNull()
        expect(
          screen.queryByRole('region', { name: 'システムの状態' }),
        ).toBeNull()
        expect(
          asked(fetched).filter((line) => line.includes('/api/system/')),
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

describe('the operations of the platform on a page in English', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
    languageStore.choose('en')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('should say the state of the system in English', async () => {
    // Act
    await openOperations('en')

    // Assert
    expect(await heading('Operations')).toBeVisible()
    expect(stateOf('State of the system')).toEqual(
      expect.arrayContaining([
        ['Process', 'Running'],
        ['Accepting requests', 'Accepting'],
        ['Overall state', 'Healthy'],
      ]),
    )
    expect(rowsOf('State of the dependencies')).toEqual([
      ['Database', 'Up', expect.stringMatching(/^[\d,]+ ms$/), 'None'],
    ])
    expect(
      screen.getByText(
        /^Times are shown in the time zone of this device \(.+\)\.$/,
      ),
    ).toBeVisible()
  })

  it('should expire the points after a dialog, and say what it did, in English', async () => {
    // Arrange
    const user = userEvent.setup()
    await arrangeExpiredPoints(YUKI.email, 300)
    await openOperations('en')

    // Act
    const { region } = await run(
      user,
      'Expiring points',
      'Expire the points',
      'Expire the points past their date of expiry?',
      'Expire',
    )

    // Assert
    expect(
      await screen.findByText('Expired 300 points of 1 customer in all.'),
    ).toBeVisible()
    expect(region).toHaveTextContent(
      /Ran on .+\. Expired 300 points of 1 customer in all\./,
    )
  })

  it('should carry out the requests that are due, and list them, in English', async () => {
    // Arrange
    const user = userEvent.setup()
    await dueForErasure(YUKI.email, OWNER)
    await openOperations('en')

    // Act
    const { region } = await run(
      user,
      'Carrying out the requests to erase data',
      'Carry out the requests',
      'Carry out every request to erase data past its scheduled time?',
      'Carry out',
    )

    // Assert
    expect(
      await within(region).findByRole('table', {
        name: 'Requests carried out',
      }),
    ).toBeVisible()
    expect(region).toHaveTextContent(
      'Carried out 1 request, and erased the data of the customers.',
    )
  })

  it('should tell an owner in English that the administrator runs the platform', async () => {
    // Act
    await openAs(OPERATIONS_PATH, OWNER, 'en')

    // Assert
    expect(await heading('Operations')).toBeVisible()
    expect(screen.getByRole('main')).toHaveTextContent(ADMINISTRATORS_ONLY.en)
    expect(screen.getByRole('link', { name: 'Back to the top' })).toBeVisible()
  })
})
