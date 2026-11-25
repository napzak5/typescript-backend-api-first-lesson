import {
  refuse,
  salonIdOf,
  signInAs,
  unreadable,
  whenAskedFor,
} from '@beauty-salon-frontend/testing/api'
import {
  heading,
  readAgain,
  termsOf,
} from '@beauty-salon-frontend/testing/screens'
import {
  KENJI,
  MANAGER,
  OSAKA,
  OWNER,
  SAKURA,
  STYLIST,
  TOKYO,
  YUKI,
} from '@beauty-salon-frontend/testing/seed'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openAs, REST_UNREAD, renderAt } from '../../__tests__/screens'
import { arrangeMany } from '../../bookings/__tests__/arrangements'
import {
  customerIdOf,
  madeStaffMeanwhile,
  removeMeanwhile,
  staffMovedMeanwhile,
  staffRemovedMeanwhile,
} from '../../customers/__tests__/arrangements'
import {
  treatmentEntryHrefOf,
  treatmentHrefOf,
  treatmentsHrefOf,
} from '../../navigation'
import {
  arrangeVisit,
  everyTreatmentRemoved,
  firstTreatmentId,
  recordMany,
  storedTreatmentOf,
  treatedBookingOf,
  treatmentIdOf,
  treatmentRemovedMeanwhile,
  writtenMeanwhile,
} from '../__tests__/arrangements'
import {
  openEntryOf,
  openTreatmentChangeOf,
  RECORDS_UNREAD,
  treatmentForm,
} from '../__tests__/screens'

/*
 * The treatment records, when a read fails, when a write or a removal is
 * refused, when the customer or the member of the staff of a record left
 * the ledger, and when the form is wrong. The failures are arranged in the
 * database; what goes well is in `treatments.integration.test.tsx`.
 */

/** The rows of the list of records */
const recordsListed = (): HTMLElement[] =>
  within(screen.getByRole('table', { name: '施術記録' })).getAllByRole(
    'rowheader',
  )

/** Opens the list of the records of the salon in Tokyo, and waits for it. */
const openList = async (query = ''): Promise<void> => {
  await openAs(`${treatmentsHrefOf(await salonIdOf(TOKYO))}${query}`, OWNER)
  await heading('施術記録')
}

/** Opens the record of a customer of the seed data. */
const openRecordOf = async (email: string, account = OWNER): Promise<void> => {
  await openAs(
    treatmentHrefOf(await salonIdOf(TOKYO), await treatmentIdOf(email)),
    account,
  )
}

/** Opens the dialog that removes the record shown. */
const openRemoval = async (
  user: ReturnType<typeof userEvent.setup>,
  name: string,
): Promise<HTMLElement> => {
  await user.click(await screen.findByRole('button', { name: '削除' }))

  return screen.findByRole('dialog', {
    name: `${name} 様の施術記録を削除しますか？`,
  })
}

describe('the treatment records, when something fails or changes meanwhile, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('should say that the records could not be read, and list them when asked again', async () => {
    // Arrange
    const user = userEvent.setup()
    const readable = await unreadable(
      'treatment_records',
      'updatedAt',
      await treatmentIdOf(YUKI.email),
    )
    await openList()
    expect(await screen.findByText(RECORDS_UNREAD)).toBeVisible()
    await readable()

    // Act
    await readAgain(user)

    // Assert
    await screen.findByRole('table', { name: '施術記録' })
    expect(recordsListed()).toHaveLength(3)
  })

  it('should say that the records that come next could not be read, and list them when asked again', async () => {
    // Arrange
    const user = userEvent.setup()
    await arrangeMany(-1, 21)
    await recordMany()
    const readable = await unreadable(
      'treatment_records',
      'updatedAt',
      await firstTreatmentId(),
    )
    await openList()
    await screen.findByRole('table', { name: '施術記録' })
    await user.click(screen.getByRole('button', { name: 'さらに表示' }))
    expect(await screen.findByText(REST_UNREAD)).toBeVisible()
    expect(recordsListed()).toHaveLength(20)
    await readable()

    // Act
    await readAgain(user)

    // Assert
    expect(await screen.findByText('24 件')).toBeVisible()
    expect(recordsListed()).toHaveLength(24)
  })

  it('should read the records again when the same conditions are sent again', async () => {
    // Arrange
    const user = userEvent.setup()
    const bookingId = await arrangeVisit()
    await openList()
    await screen.findByRole('table', { name: '施術記録' })
    expect(recordsListed()).toHaveLength(3)
    await writtenMeanwhile(bookingId)

    // Act
    await user.click(screen.getByRole('button', { name: '表示する' }))

    // Assert
    expect(await screen.findByText(`${KENJI.name} 様`)).toBeVisible()
    expect(recordsListed()).toHaveLength(4)
  })

  it('should say that the salon has no record yet, and how one is written', async () => {
    // Arrange
    await everyTreatmentRemoved()

    // Act
    await openList()

    // Assert
    expect(await screen.findByText('施術記録はありません')).toBeVisible()
    expect(
      screen.getByText('施術記録は、施術を始めた予約の画面から書きます。'),
    ).toBeVisible()
  })

  it('should name a customer who left the ledger as such in the conditions of the list', async () => {
    // Arrange
    const customerId = await customerIdOf(YUKI.email)
    await removeMeanwhile(YUKI.email)

    // Act
    await openList(`?customer=${customerId}`)

    // Assert
    expect(
      await screen.findByText('お客様：台帳から削除されたお客様'),
    ).toBeVisible()
  })

  it('should say that a record could not be read, and show it when asked again', async () => {
    // Arrange
    const user = userEvent.setup()
    const readable = await unreadable(
      'treatment_records',
      'updatedAt',
      await treatmentIdOf(YUKI.email),
    )
    await openRecordOf(YUKI.email)
    expect(await screen.findByText(RECORDS_UNREAD)).toBeVisible()
    await readable()

    // Act
    await readAgain(user)

    // Assert
    expect(await screen.findByText('Hiroshi Tanaka')).toBeVisible()
  })

  it('should say that the booking of a record could not be read, and show the record when asked again', async () => {
    // Arrange
    const user = userEvent.setup()
    const readable = await unreadable(
      'bookings',
      'updatedAt',
      await treatedBookingOf(YUKI.email),
    )
    await openRecordOf(YUKI.email)
    expect(await screen.findByText(RECORDS_UNREAD)).toBeVisible()
    await readable()

    // Act
    await readAgain(user)

    // Assert
    expect(await screen.findByText('Hiroshi Tanaka')).toBeVisible()
  })

  it('should name the customer and the member of the staff of a record who left the ledger as such', async () => {
    // Arrange
    await removeMeanwhile(YUKI.email)
    await staffRemovedMeanwhile('Hiroshi Tanaka')

    // Act
    await openRecordOf(YUKI.email)

    // Assert
    await screen.findByRole('region', { name: '施術' })
    expect(termsOf('施術')).toContainEqual([
      'お客様',
      '台帳から削除されたお客様',
    ])
    expect(termsOf('施術')).toContainEqual(['担当', '一覧にないスタッフ'])
  })

  it('should name the member of the staff of a record who left the ledger as such on its change', async () => {
    // Arrange
    await staffRemovedMeanwhile('Hiroshi Tanaka')

    // Act
    await openTreatmentChangeOf(YUKI.email)

    // Assert
    expect(screen.getByText('一覧にないスタッフ')).toBeVisible()
  })

  it('should leave the member of the staff to choose when the one of the booking left the ledger', async () => {
    // Arrange
    const bookingId = await arrangeVisit()
    await staffRemovedMeanwhile('Hiroshi Tanaka')

    // Act
    await openEntryOf(bookingId)

    // Assert
    expect(screen.getByRole('combobox', { name: '担当' })).toHaveDisplayValue(
      '選んでください',
    )
  })

  it('should let the record of a booking of a customer who left the ledger be opened, and name them as such', async () => {
    // Arrange
    const bookingId = await arrangeVisit()
    await removeMeanwhile(KENJI.email)

    // Act
    await openEntryOf(bookingId)

    // Assert
    expect(screen.getByText(/台帳から削除されたお客様/)).toBeVisible()
  })

  it('should say that what the record of a booking needs could not be read, and show the form when asked again', async () => {
    // Arrange: the account moves to another salon as the records of the customer are read
    const user = userEvent.setup()
    const bookingId = await arrangeVisit()
    whenAskedFor('GET /treatments', () =>
      staffMovedMeanwhile('Hiroshi Tanaka', OSAKA),
    )
    renderAt(treatmentEntryHrefOf(await salonIdOf(TOKYO), bookingId))
    await signInAs(STYLIST)
    expect(
      await screen.findByText(
        'お客様と商品を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
      ),
    ).toBeVisible()
    await staffMovedMeanwhile('Hiroshi Tanaka', TOKYO)

    // Act
    await readAgain(user)

    // Assert
    await treatmentForm()
    expect(screen.getByRole('combobox', { name: '担当' })).toHaveDisplayValue(
      'Hiroshi Tanaka',
    )
  })

  it('should say that the record could not be changed, and keep what was typed', async () => {
    // Arrange
    const user = userEvent.setup()
    await refuse('update', 'treatment_records')
    await openTreatmentChangeOf(SAKURA.email)
    const time = screen.getByRole('textbox', { name: '施術時間（分）' })
    await user.type(time, '0')

    // Act
    await user.click(screen.getByRole('button', { name: '変更を保存する' }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '施術記録を直せませんでした。通信の状態を確かめて、もう一度お試しください。',
    )
    expect(time).toHaveValue('450')
    expect(
      (await storedTreatmentOf(await treatedBookingOf(SAKURA.email)))
        ?.processingTime,
    ).toBe(45)
  })

  it('should say that the account may not write records when it no longer belongs to a salon, and change nothing', async () => {
    // Arrange
    const user = userEvent.setup()
    const bookingId = await treatedBookingOf(YUKI.email)
    const before = await storedTreatmentOf(bookingId)
    await openTreatmentChangeOf(YUKI.email, STYLIST)
    await user.type(
      screen.getByRole('textbox', { name: '施術時間（分）' }),
      '0',
    )
    await staffRemovedMeanwhile('Hiroshi Tanaka')

    // Act
    await user.click(screen.getByRole('button', { name: '変更を保存する' }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'このアカウントでは、施術記録を書けません。',
    )
    expect(await storedTreatmentOf(bookingId)).toEqual(before)
  })

  it('should change nothing with a treatment time of more than a day, and say why at the control', async () => {
    // Arrange
    const user = userEvent.setup()
    await openTreatmentChangeOf(SAKURA.email)
    const time = screen.getByRole('textbox', { name: '施術時間（分）' })
    await user.clear(time)
    await user.type(time, '1441')

    // Act
    await user.click(screen.getByRole('button', { name: '変更を保存する' }))

    // Assert
    await waitFor(() =>
      expect(time).toHaveAccessibleDescription(
        expect.stringContaining(
          '施術時間は、0 から 1,440 までの分の整数で入力してください。',
        ),
      ),
    )
    expect(time).toHaveFocus()
    expect(
      (await storedTreatmentOf(await treatedBookingOf(SAKURA.email)))
        ?.processingTime,
    ).toBe(45)
  })

  it('should say in the dialog that the record could not be removed, and keep it when the dialog is closed', async () => {
    // Arrange
    const user = userEvent.setup()
    await refuse('delete', 'treatment_records')
    await openRecordOf(SAKURA.email)
    const dialog = await openRemoval(user, SAKURA.name)
    await user.click(within(dialog).getByRole('button', { name: '削除する' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      '施術記録を削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
    )

    // Act
    await user.click(within(dialog).getByRole('button', { name: '戻る' }))

    // Assert
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(
      await storedTreatmentOf(await treatedBookingOf(SAKURA.email)),
    ).toEqual(expect.objectContaining({ processingTime: 45 }))
  })

  it('should say above the record that the account may no longer remove records, and keep it', async () => {
    // Arrange
    const user = userEvent.setup()
    await openRecordOf(SAKURA.email, MANAGER)
    const dialog = await openRemoval(user, SAKURA.name)
    await madeStaffMeanwhile(MANAGER)

    // Act
    await user.click(within(dialog).getByRole('button', { name: '削除する' }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'このアカウントでは、施術記録を削除できません。',
    )
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(
      await storedTreatmentOf(await treatedBookingOf(SAKURA.email)),
    ).toBeDefined()
  })

  it('should say that the record was removed meanwhile when it is removed', async () => {
    // Arrange
    const user = userEvent.setup()
    await openRecordOf(SAKURA.email)
    const dialog = await openRemoval(user, SAKURA.name)
    await treatmentRemovedMeanwhile(await treatmentIdOf(SAKURA.email))

    // Act
    await user.click(within(dialog).getByRole('button', { name: '削除する' }))

    // Assert
    expect(await heading('施術記録が見つかりません')).toBeVisible()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
