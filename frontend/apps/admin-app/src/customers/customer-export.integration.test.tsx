import {
  findAccessibilityViolations,
  type SavedFile,
  savedFiles,
} from '@beauty-salon-frontend/testing'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../App'
import {
  MANAGER,
  OWNER,
  STYLIST,
  salonIdOf,
  signInAs,
  TOKYO,
  YUKI,
} from '../bookings/__tests__/arrangements'
import { customerHrefOf, customersHrefOf } from '../navigation'
import {
  arrangeCrowd,
  arrangePoints,
  customerIdOf,
  removedMeanwhile,
} from './__tests__/arrangements'
import { rowsOfCsv } from './customer-file'
import { customerQueryOf } from './customer-ledger'

/*
 * The customers these tests export are those of the seed data: Tanaka
 * Yuki and Nakamura Hiroshi are tagged vip, Yamamoto Kenji and Sato
 * Sakura are not. An owner exports; a member of the staff is offered no
 * export.
 */

const HIROSHI = { email: 'vip.customer@example.com', name: 'Nakamura Hiroshi' }

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

const heading = (name: string) =>
  screen.findByRole('heading', { level: 1, name })

/** What the application says in its notifications. */
const notifications = (): string[] =>
  screen
    .getAllByRole('status')
    .map((region) => region.textContent ?? '')
    .filter((said) => said !== '')

/** The part of a page under a heading. */
const part = (name: string): HTMLElement => screen.getByRole('region', { name })

/** Opens a page of the salon in Tokyo at its address, signed in. */
const openAt = async (path: (tokyo: string) => string, email = OWNER) => {
  const tokyo = await salonIdOf(TOKYO)
  renderAt(path(tokyo))
  await signInAs(email)

  return tokyo
}

/** The ledger of the salon, under the conditions of its address. */
const ledgerOf =
  (query: URLSearchParams) =>
  (tokyo: string): string =>
    `${customersHrefOf(tokyo)}?${query}`

/** Waits for the ledger: its heading, then what it lists. */
const theLedger = async (): Promise<void> => {
  await heading('顧客台帳')
  await waitFor(() =>
    expect(screen.queryByText('お客様を読み込んでいます')).toBeNull(),
  )
}

/** Waits for the page of a customer, down to the part of the requests. */
const theCustomer = async (): Promise<void> => {
  await heading('お客様の台帳')
  await screen.findByRole('region', { name: '台帳' })
  await screen.findByRole('region', { name: 'ご本人からの請求' })
}

/** The rows of a saved CSV file, the one that names the columns first. */
const rowsIn = ({ text }: SavedFile): string[][] => {
  const read = rowsOfCsv(text.replace(/^﻿/, ''))
  return read.type === 'rows' ? read.rows : []
}

/** The values of a column of a saved CSV file, by the name of the column. */
const columnIn = (file: SavedFile, column: string): string[] => {
  const [names = [], ...rows] = rowsIn(file)
  const index = names.indexOf(column)
  return rows.map((row) => row[index] ?? '')
}

/** The only file the page saved, once it has saved one. */
const theSavedFile = async (): Promise<SavedFile> => {
  await waitFor(async () => expect(await savedFiles()).toHaveLength(1))
  const [file] = await savedFiles()
  if (file === undefined) {
    throw new Error('The page saved no file')
  }
  return file
}

describe('exporting customers, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  describe('the ledger as a CSV file', () => {
    it('should save the customers who meet the conditions of the ledger, as the API writes them, and say how many', async () => {
      // Arrange
      const user = userEvent.setup()
      await openAt(ledgerOf(customerQueryOf({ tags: ['vip'] })))
      await theLedger()
      await screen.findByRole('table', { name: '条件に合うお客様' })

      // Act
      await user.click(screen.getByRole('button', { name: 'CSV に出力する' }))

      // Assert
      const file = await theSavedFile()
      expect(file.name).toMatch(/^customers-\d{4}-\d{2}-\d{2}\.csv$/)
      expect(file.type).toBe('text/csv; charset=utf-8')
      // A spreadsheet reads the file as UTF-8 by the mark of its byte order
      expect(file.text.startsWith('﻿id,')).toBe(true)
      expect(file.text.endsWith('\r\n')).toBe(true)
      expect(columnIn(file, 'email').toSorted()).toEqual(
        [YUKI.email, HIROSHI.email].toSorted(),
      )
      expect(columnIn(file, 'lastName').toSorted()).toEqual([
        'Nakamura',
        'Tanaka',
      ])
      expect(notifications()).toContain(
        `2 人のお客様を、${file.name} に出力しました。`,
      )
      expect(screen.queryByRole('alert')).toBeNull()
    })

    it('should save every customer of a ledger without conditions', async () => {
      // Arrange
      const user = userEvent.setup()
      await openAt(customersHrefOf, MANAGER)
      await screen.findByRole('table', { name: '顧客台帳' })

      // Act
      await user.click(screen.getByRole('button', { name: 'CSV に出力する' }))

      // Assert
      const file = await theSavedFile()
      expect(rowsIn(file)).toHaveLength(5)
      expect(notifications()).toContain(
        `4 人のお客様を、${file.name} に出力しました。`,
      )
    })

    it('should save no file when nobody meets the conditions, and say so', async () => {
      // Arrange
      const user = userEvent.setup()
      await openAt(ledgerOf(customerQueryOf({ search: 'nobody', tags: [] })))
      await theLedger()
      await screen.findByText('条件に合うお客様はいません')

      // Act
      await user.click(screen.getByRole('button', { name: 'CSV に出力する' }))

      // Assert
      expect(
        await screen.findByText(
          '条件に合うお客様がいないため、出力しませんでした。',
        ),
      ).toBeVisible()
      expect(await savedFiles()).toEqual([])
    })

    it('should save no file of more customers than the API writes at once, and say so under those conditions only', async () => {
      // Arrange
      const user = userEvent.setup()
      await arrangeCrowd(10_001, 'crowd')
      await openAt(ledgerOf(customerQueryOf({ tags: ['crowd'] })))
      await screen.findByRole('table', { name: '条件に合うお客様' })

      // Act
      await user.click(screen.getByRole('button', { name: 'CSV に出力する' }))

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(
        '条件に合うお客様が 10,000 人を超えるため、出力できません。条件を絞ってから、もう一度出力してください。',
      )
      expect(await savedFiles()).toEqual([])

      // Act: other conditions are another export
      await user.type(
        screen.getByRole('searchbox', { name: 'キーワード' }),
        'Crowd 00001',
      )
      await user.click(screen.getByRole('button', { name: '探す' }))

      // Assert
      await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    })

    it('should not offer the export to a member of the staff', async () => {
      // Arrange
      await openAt(customersHrefOf, STYLIST)

      // Act
      await screen.findByRole('table', { name: '顧客台帳' })

      // Assert
      expect(
        screen.getByRole('link', { name: 'CSV から登録する' }),
      ).toBeVisible()
      expect(
        screen.queryByRole('button', { name: 'CSV に出力する' }),
      ).toBeNull()
    })
  })

  describe('the data of a customer as a JSON file', () => {
    it('should save everything held of the customer, as the API writes it, and say whose it is', async () => {
      // Arrange
      const user = userEvent.setup()
      const yuki = await customerIdOf(YUKI.email)
      await arrangePoints(YUKI.email, [
        { type: 'earned', points: 120, daysAgo: 3, description: 'ご来店' },
      ])
      await openAt((tokyo) => customerHrefOf(tokyo, yuki))
      await theCustomer()

      // Act
      await user.click(
        within(part('ご本人からの請求')).getByRole('button', {
          name: 'データを出力する',
        }),
      )

      // Assert
      const file = await theSavedFile()
      expect(file.name).toBe(`customer-${yuki}.json`)
      expect(file.type).toBe('application/json; charset=utf-8')
      expect(JSON.parse(file.text)).toMatchObject({
        customer: { id: yuki, email: YUKI.email },
        bookings: expect.arrayContaining([
          expect.objectContaining({ customerId: yuki }),
        ]),
        pointTransactions: expect.arrayContaining([
          expect.objectContaining({ points: 120, description: 'ご来店' }),
        ]),
      })
      // Indented by two spaces, as the API writes it
      expect(file.text).toBe(JSON.stringify(JSON.parse(file.text), null, 2))
      expect(notifications()).toContain(
        `${YUKI.name} 様のデータを、customer-${yuki}.json に出力しました。`,
      )
    })

    it('should show the customer as removed when another account removed them meanwhile', async () => {
      // Arrange
      const user = userEvent.setup()
      const yuki = await customerIdOf(YUKI.email)
      await openAt((tokyo) => customerHrefOf(tokyo, yuki))
      await theCustomer()
      await removedMeanwhile(yuki, MANAGER)

      // Act
      await user.click(
        within(part('ご本人からの請求')).getByRole('button', {
          name: 'データを出力する',
        }),
      )

      // Assert
      expect(
        await screen.findByRole('region', { name: '削除されたときの台帳' }),
      ).toBeVisible()
      expect(await heading('お客様の台帳')).toHaveFocus()
      expect(await savedFiles()).toEqual([])
    })

    it('should tell a member of the staff who answers, and offer no export', async () => {
      // Arrange
      const yuki = await customerIdOf(YUKI.email)
      await openAt((tokyo) => customerHrefOf(tokyo, yuki), STYLIST)

      // Act
      await theCustomer()

      // Assert
      expect(
        within(part('ご本人からの請求')).getByText(
          'ご本人からのデータの開示と消去の請求には、オーナーとマネージャーが応えます。',
        ),
      ).toBeVisible()
      expect(
        screen.queryByRole('button', { name: 'データを出力する' }),
      ).toBeNull()
    })
  })

  it('should have no accessibility violations on the ledger that said why it saved no file', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAt(ledgerOf(customerQueryOf({ search: 'nobody', tags: [] })))
    await theLedger()
    await user.click(screen.getByRole('button', { name: 'CSV に出力する' }))
    await screen.findByText(
      '条件に合うお客様がいないため、出力しませんでした。',
    )

    // Act
    const violations = await findAccessibilityViolations(document.body)

    // Assert
    expect(violations).toEqual([])
  })

  it('should have no accessibility violations on the customer whose data was saved', async () => {
    // Arrange
    const user = userEvent.setup()
    const yuki = await customerIdOf(YUKI.email)
    await openAt((tokyo) => customerHrefOf(tokyo, yuki))
    await theCustomer()
    await user.click(screen.getByRole('button', { name: 'データを出力する' }))
    await theSavedFile()

    // Act
    const violations = await findAccessibilityViolations(document.body)

    // Assert
    expect(violations).toEqual([])
  })
})
