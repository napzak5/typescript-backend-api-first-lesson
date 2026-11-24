import { languageStore } from '@beauty-salon-frontend/io'
import { dayNameOf } from '@beauty-salon-frontend/salon-screens'
import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import {
  dayFromToday,
  giveBack,
  refuse,
  salonIdOf,
  signInAs,
  takeAway,
  testApi,
  whenAskedFor,
} from '@beauty-salon-frontend/testing/api'
import {
  address,
  firstSight,
  heading,
  notifications,
  rowsOf,
} from '@beauty-salon-frontend/testing/screens'
import {
  KENJI,
  MANAGER,
  OPERATOR,
  OSAKA,
  OWNER,
  STYLIST,
  TOKYO,
  YUKI,
} from '@beauty-salon-frontend/testing/seed'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openAs, renderAt } from '../../__tests__/screens'
import { staffRemovedMeanwhile } from '../../customers/__tests__/arrangements'
import { arrangeSale } from '../../sales/__tests__/arrangements'
import {
  treatedBookingOf,
  treatmentIdOf,
} from '../../treatments/__tests__/arrangements'
import {
  arrange,
  bookingRemovedMeanwhile,
  clockOf,
  salonRemovedMeanwhile,
  storedBooking,
} from '../__tests__/arrangements'

const CHANGED_ELSEWHERE =
  '予約の状態が、ほかの画面か端末で変わっていました。いまの状態を読み込み直しました。'

const statusPart = (): HTMLElement =>
  screen.getByRole('region', { name: '状態' })

const statusHeading = (): HTMLElement =>
  within(statusPart()).getByRole('heading', { name: '状態' })

/** The state the screen shows, once the booking is read. */
const shownStatus = async (): Promise<string> =>
  within(await screen.findByRole('region', { name: '状態' })).getByText(
    /^(下書き|確定待ち|確定|施術中|完了|キャンセル|無断キャンセル)$/,
  ).textContent ?? ''

const buttons = (): string[] =>
  within(statusPart())
    .queryAllByRole('button')
    .map((button) => button.textContent ?? '')

/** The terms of the record of the booking, each with what it says. */
const recordTerms = (): [string, string][] =>
  within(screen.getByRole('region', { name: '予約' }))
    .getAllByRole('term')
    .map((term) => [
      term.textContent ?? '',
      term.nextElementSibling?.textContent ?? '',
    ])

/** What an account that belongs to no salon is told of the bookings of a salon. */
const NOT_THEIRS =
  'このサロンの予約は、見られません。予約を見られるのは、そのサロンのスタッフと、管理者です。'

/** The member of the staff the stylist of the seed data is */
const STYLIST_NAME = 'Hiroshi Tanaka'

/** Opens a booking of the Tokyo salon, signed in as `email`. */
const openBooking = async (id: string, email = OWNER): Promise<void> => {
  const tokyo = await salonIdOf(TOKYO)
  renderAt(`/salons/${tokyo}/bookings/${id}`)
  await signInAs(email)
  await screen.findByRole('region', { name: '状態' })
}

describe('a booking of a salon, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('should show who comes when, for what, with whom, and what it comes to', async () => {
    // Arrange
    const id = await arrange({
      bookingNumber: 'BK-TEST-0001',
      day: 3,
      at: '14:30',
      minutes: 120,
      customer: KENJI.email,
      staffCode: 'STF002',
      service: 'Full Color',
    })
    await testApi().query(
      `update bookings set "customerRequest" = '根元を明るめに', "internalNotes" = '前回より 1 トーン上',
                           source = 'online', "depositAmount" = 3000 where id = $1`,
      [id],
    )
    const day = await dayFromToday(3)
    const tokyo = await salonIdOf(TOKYO)
    const { container } = renderAt(`/salons/${tokyo}/bookings/${id}`)

    // Act
    await signInAs(MANAGER)

    // Assert: on the heading of the screen that shows the booking
    expect(await shownStatus()).toBe('確定待ち')
    expect(await heading('予約の内容')).toHaveFocus()
    expect(recordTerms()).toEqual([
      ['予約番号', 'BK-TEST-0001'],
      ['来店日', dayNameOf(day).ja],
      ['時刻', '14:30〜16:30'],
      ['お客様', KENJI.name],
      ['お客様の電話番号', expect.stringMatching(/\d/)],
      ['担当', 'Mika Suzuki'],
      ['お客様の要望', '根元を明るめに'],
      ['サロン内のメモ', '前回より 1 トーン上'],
      ['受付の経路', 'オンライン'],
      ['予約金', '￥3,000'],
    ])
    expect(rowsOf('施術明細')).toEqual([
      ['Full Color', 'Mika Suzuki', '14:30〜16:30', '￥8,000（税込）', '未'],
    ])
    expect(buttons()).toEqual(['予約を確定する', '予約をキャンセルする'])
    expect(
      screen.getByRole('link', { name: 'この日の予約へ' }),
    ).toHaveAttribute('href', `/salons/${tokyo}/bookings?date=${day}`)
    expect(await findAccessibilityViolations(container)).toEqual([])
  })

  it('should confirm a booking at once, and show the state the API left', async () => {
    // Arrange
    const user = userEvent.setup()
    const id = await arrange({
      bookingNumber: 'BK-TEST-0001',
      day: 2,
      at: '10:00',
    })
    const tokyo = await salonIdOf(TOKYO)
    const date = await dayFromToday(2)
    renderAt(`/salons/${tokyo}/bookings?date=${date}`)
    await signInAs(STYLIST)
    await user.click(await screen.findByRole('link', { name: YUKI.name }))
    await screen.findByRole('region', { name: '状態' })

    // Act
    await user.click(screen.getByRole('button', { name: '予約を確定する' }))

    // Assert
    await waitFor(() => expect(statusHeading()).toHaveFocus())
    expect(await shownStatus()).toBe('確定')
    expect(notifications()).toContain('予約を確定しました。')
    expect(buttons()).toEqual([
      '施術を始める',
      '完了にする',
      '予約をキャンセルする',
    ])
    expect((await storedBooking(id)).status).toBe('confirmed')

    // Act: back to the list, which shows nothing of what it read before
    await user.click(screen.getByRole('link', { name: 'この日の予約へ' }))

    // Assert
    expect(firstSight()).toEqual([
      `/salons/${tokyo}/bookings?date=${date}`,
      expect.stringContaining('予約を読み込んでいます'),
    ])
    const table = await screen.findByRole('table')
    const [, row] = within(table).getAllByRole('row')
    expect(row && within(row).getByText('確定')).toBeVisible()
  })

  it('should record that the treatment began', async () => {
    // Arrange
    const user = userEvent.setup()
    const id = await arrange({
      bookingNumber: 'BK-TEST-0001',
      day: 0,
      at: '23:00',
      status: 'confirmed',
    })
    await openBooking(id)

    // Act
    await user.click(screen.getByRole('button', { name: '施術を始める' }))

    // Assert
    await waitFor(() => expect(statusHeading()).toHaveFocus())
    expect(await shownStatus()).toBe('施術中')
    expect(notifications()).toContain('施術の開始を記録しました。')
    expect(buttons()).toEqual(['完了にする'])
    const stored = await storedBooking(id)
    expect(stored.status).toBe('in_progress')
    expect(stored.actualStartTime).not.toBeNull()
    expect(recordTerms()).toContainEqual([
      '実際の開始',
      expect.stringContaining(clockOf(new Date(stored.actualStartTime ?? ''))),
    ])
  })

  it('should complete a booking with the times it actually took, on the clock of the salon', async () => {
    // Arrange
    const user = userEvent.setup()
    const id = await arrange({
      bookingNumber: 'BK-TEST-0001',
      day: 1,
      at: '10:00',
      status: 'confirmed',
    })
    const day = await dayFromToday(1)
    await openBooking(id, MANAGER)

    // Act
    await user.click(screen.getByRole('button', { name: '完了にする' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('実際の開始'), {
      target: { value: `${day}T10:05` },
    })
    fireEvent.change(within(dialog).getByLabelText('実際の終了'), {
      target: { value: `${day}T11:10` },
    })
    await user.click(within(dialog).getByRole('button', { name: '完了にする' }))

    // Assert
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(statusHeading()).toHaveFocus())
    expect(await shownStatus()).toBe('完了')
    expect(notifications()).toContain('予約を完了にしました。')
    expect(buttons()).toEqual([])
    const stored = await storedBooking(id)
    expect(stored.status).toBe('completed')
    expect(stored.completedAt).not.toBeNull()
    // 10:05 and 11:10 in Tokyo
    expect([stored.actualStartTime, stored.actualEndTime]).toEqual([
      new Date(`${day}T01:05:00.000Z`).toISOString(),
      new Date(`${day}T02:10:00.000Z`).toISOString(),
    ])
    expect(recordTerms()).toEqual(
      expect.arrayContaining([
        ['実際の開始', `${dayNameOf(day).ja} 10:05`],
        ['実際の終了', `${dayNameOf(day).ja} 11:10`],
      ]),
    )
  })

  it('should send nothing when the end does not come after the beginning that was recorded', async () => {
    // Arrange
    const user = userEvent.setup()
    const day = await dayFromToday(1)
    const id = await arrange({
      bookingNumber: 'BK-TEST-0001',
      day: 1,
      at: '10:00',
      status: 'in_progress',
      actualStartTime: `${day}T01:05:00.000Z`,
    })
    await openBooking(id)
    const before = await storedBooking(id)

    // Act
    await user.click(screen.getByRole('button', { name: '完了にする' }))
    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByLabelText('実際の開始'),
    ).toHaveAccessibleDescription(
      expect.stringContaining(`${dayNameOf(day).ja} 10:05`),
    )
    fireEvent.change(within(dialog).getByLabelText('実際の終了'), {
      target: { value: `${day}T10:00` },
    })
    await user.click(within(dialog).getByRole('button', { name: '完了にする' }))

    // Assert
    expect(
      within(dialog).getByLabelText('実際の終了'),
    ).toHaveAccessibleDescription(
      expect.stringContaining(
        '終了は、記録した開始より後の時刻にしてください。',
      ),
    )
    expect(await storedBooking(id)).toEqual(before)
  })

  it('should cancel a booking with its reason, after asking', async () => {
    // Arrange
    const user = userEvent.setup()
    const id = await arrange({
      bookingNumber: 'BK-TEST-0001',
      day: 5,
      at: '13:00',
    })
    await openBooking(id)

    // Act
    await user.click(
      screen.getByRole('button', { name: '予約をキャンセルする' }),
    )
    const dialog = await screen.findByRole('dialog', {
      name: '予約をキャンセルしますか？',
    })
    await user.type(
      within(dialog).getByLabelText('キャンセルの理由'),
      'お客様から電話で連絡',
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'キャンセルを確定する' }),
    )

    // Assert
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(statusHeading()).toHaveFocus())
    expect(await shownStatus()).toBe('キャンセル')
    expect(notifications()).toContain('予約をキャンセルしました。')
    const stored = await storedBooking(id)
    expect([
      stored.status,
      stored.cancellationReason,
      stored.cancelledBy,
    ]).toEqual(['cancelled', 'お客様から電話で連絡', OWNER])
    expect(recordTerms()).toContainEqual([
      'キャンセルの理由',
      'お客様から電話で連絡',
    ])
  })

  it('should record that nobody came to a booking whose time has come, after asking', async () => {
    // Arrange: a booking that is to come is offered no such thing (the first test)
    const user = userEvent.setup()
    const past = await arrange({
      bookingNumber: 'BK-TEST-0001',
      day: -3,
      at: '10:00',
    })
    await openBooking(past)
    expect(buttons()).toEqual([
      '予約を確定する',
      '無断キャンセルを記録する',
      '予約をキャンセルする',
    ])

    // Act
    await user.click(
      screen.getByRole('button', { name: '無断キャンセルを記録する' }),
    )
    const dialog = await screen.findByRole('dialog', {
      name: '無断キャンセルを記録しますか？',
    })
    await user.click(within(dialog).getByRole('button', { name: '記録する' }))

    // Assert
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(statusHeading()).toHaveFocus())
    expect(await shownStatus()).toBe('無断キャンセル')
    expect(notifications()).toContain('無断キャンセルを記録しました。')
    expect((await storedBooking(past)).status).toBe('no_show')
  })

  it('should say that the booking changed elsewhere, and show the state it is in now', async () => {
    // Arrange
    const user = userEvent.setup()
    const id = await arrange({
      bookingNumber: 'BK-TEST-0001',
      day: 2,
      at: '10:00',
    })
    await openBooking(id)
    // The customer cancelled it in the meantime
    await testApi().query(
      `update bookings set status = 'cancelled', "cancelledAt" = now() where id = $1`,
      [id],
    )

    // Act
    await user.click(screen.getByRole('button', { name: '予約を確定する' }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      CHANGED_ELSEWHERE,
    )
    expect(statusHeading()).toHaveFocus()
    await waitFor(async () => expect(await shownStatus()).toBe('キャンセル'))
    expect(buttons()).toEqual([])
    expect((await storedBooking(id)).status).toBe('cancelled')
  })

  it('should close the dialog and say that the booking changed elsewhere', async () => {
    // Arrange
    const user = userEvent.setup()
    const id = await arrange({
      bookingNumber: 'BK-TEST-0001',
      day: 2,
      at: '10:00',
      status: 'confirmed',
    })
    await openBooking(id)
    await user.click(
      screen.getByRole('button', { name: '予約をキャンセルする' }),
    )
    const dialog = await screen.findByRole('dialog')
    await testApi().query(
      `update bookings set status = 'in_progress', "actualStartTime" = now() where id = $1`,
      [id],
    )

    // Act
    await user.click(
      within(dialog).getByRole('button', { name: 'キャンセルを確定する' }),
    )

    // Assert
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(await screen.findByRole('alert')).toHaveTextContent(
      CHANGED_ELSEWHERE,
    )
    expect(statusHeading()).toHaveFocus()
    await waitFor(async () => expect(await shownStatus()).toBe('施術中'))
  })

  it.each([
    ['a confirmation', 'pending', '予約を確定する', '予約を確定', '確定待ち'],
    [
      'the beginning of the treatment',
      'confirmed',
      '施術を始める',
      '施術の開始を記録',
      '確定',
    ],
  ])(
    'should say on the page that nothing came of %s the database refused',
    async (_case, status, name, done, shown) => {
      // Arrange
      const user = userEvent.setup()
      const id = await arrange({
        bookingNumber: 'BK-TEST-0001',
        day: 2,
        at: '10:00',
        status,
      })
      await openBooking(id)
      const before = await storedBooking(id)
      await refuse('update', 'bookings')
      const button = screen.getByRole('button', { name })

      // Act
      await user.click(button)

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(
        `${done}できませんでした。通信の状態を確かめて、もう一度お試しください。`,
      )
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(button).toHaveFocus()
      expect(await shownStatus()).toBe(shown)
      expect(await storedBooking(id)).toEqual(before)
    },
  )

  it('should say in the dialog that nothing came of a cancellation the database refused', async () => {
    // Arrange
    const user = userEvent.setup()
    const id = await arrange({
      bookingNumber: 'BK-TEST-0001',
      day: 2,
      at: '10:00',
    })
    await openBooking(id)
    await refuse('update', 'bookings')

    // Act
    await user.click(
      screen.getByRole('button', { name: '予約をキャンセルする' }),
    )
    const dialog = await screen.findByRole('dialog')
    await user.click(
      within(dialog).getByRole('button', { name: 'キャンセルを確定する' }),
    )

    // Assert
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      '予約をキャンセルできませんでした。通信の状態を確かめて、もう一度お試しください。',
    )
    expect(screen.getByRole('dialog')).toBeVisible()
    expect((await storedBooking(id)).status).toBe('pending')
  })

  it('should show an administrator a booking of any salon, and change it', async () => {
    // Arrange
    const user = userEvent.setup()
    const osaka = await salonIdOf(OSAKA)
    const id = await arrange({
      bookingNumber: 'BK-TEST-0001',
      day: 2,
      at: '10:00',
      salon: OSAKA,
      staffCode: 'STF003',
      service: 'Signature Cut',
      minutes: 75,
    })
    renderAt(`/salons/${osaka}/bookings/${id}`)
    await signInAs(OPERATOR)
    await screen.findByRole('region', { name: '状態' })

    // Act
    await user.click(screen.getByRole('button', { name: '予約を確定する' }))

    // Assert
    await waitFor(async () => expect(await shownStatus()).toBe('確定'))
    expect((await storedBooking(id)).status).toBe('confirmed')
  })

  it.each([
    ['a booking of another salon, under the address of this one', OWNER],
    ['a booking of another salon, for an administrator', OPERATOR],
  ])('should say that %s is not found', async (_case, email) => {
    // Arrange
    const tokyo = await salonIdOf(TOKYO)
    const id = await arrange({
      bookingNumber: 'BK-TEST-0001',
      day: 2,
      at: '10:00',
      salon: OSAKA,
      staffCode: 'STF003',
      service: 'Signature Cut',
      minutes: 75,
    })
    renderAt(`/salons/${tokyo}/bookings/${id}`)

    // Act
    await signInAs(email)

    // Assert
    expect(await heading('予約が見つかりません')).toHaveFocus()
    expect(screen.getByRole('link', { name: '今日の予約へ' })).toHaveAttribute(
      'href',
      `/salons/${tokyo}/bookings`,
    )
  })

  describe('when a read or a change of the booking comes to nothing', () => {
    it('should say that the booking could not be read, and show it when asked again', async () => {
      // Arrange
      const user = userEvent.setup()
      const id = await arrange({
        bookingNumber: 'BK-TEST-0001',
        day: 2,
        at: '10:00',
      })
      await takeAway('bookings')
      renderAt(`/salons/${await salonIdOf(TOKYO)}/bookings/${id}`)
      await signInAs(OWNER)
      expect(
        await screen.findByText(
          '予約を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
        ),
      ).toBeVisible()
      await giveBack('bookings')

      // Act
      await user.click(screen.getByRole('button', { name: 'もう一度読み込む' }))

      // Assert
      expect(await shownStatus()).toBe('確定待ち')
    })

    it('should say that the details could not be read, and show them when asked again', async () => {
      // Arrange
      const user = userEvent.setup()
      const id = await arrange({
        bookingNumber: 'BK-TEST-0001',
        day: 2,
        at: '10:00',
      })
      await takeAway('services')
      renderAt(`/salons/${await salonIdOf(TOKYO)}/bookings/${id}`)
      await signInAs(OWNER)
      expect(
        await screen.findByText(
          '予約の内容を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
        ),
      ).toBeVisible()
      await giveBack('services')

      // Act
      await user.click(screen.getByRole('button', { name: 'もう一度読み込む' }))

      // Assert
      expect(await shownStatus()).toBe('確定待ち')
      expect(rowsOf('施術明細')[0]?.[0]).toBe('Ladies Cut')
    })

    it('should say that the details could not be read when the salon was removed while its menu was asked for', async () => {
      // Arrange
      const id = await arrange({
        bookingNumber: 'BK-TEST-0001',
        day: 2,
        at: '10:00',
      })
      const tokyo = await salonIdOf(TOKYO)
      whenAskedFor(`GET /salons/${tokyo}/services`, () =>
        salonRemovedMeanwhile(TOKYO),
      )

      // Act
      renderAt(`/salons/${tokyo}/bookings/${id}`)
      await signInAs(OWNER)

      // Assert
      expect(
        await screen.findByText(
          '予約の内容を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
        ),
      ).toBeVisible()
      expect(screen.queryByRole('region', { name: '状態' })).toBeNull()
    })

    it('should tell an account that belongs to no salon any more that the bookings are not theirs to see', async () => {
      // Arrange
      const id = await arrange({
        bookingNumber: 'BK-TEST-0001',
        day: 2,
        at: '10:00',
      })
      whenAskedFor(`GET /bookings/${id}`, () =>
        staffRemovedMeanwhile(STYLIST_NAME),
      )

      // Act
      renderAt(`/salons/${await salonIdOf(TOKYO)}/bookings/${id}`)
      await signInAs(STYLIST)

      // Assert
      expect(await screen.findByText(NOT_THEIRS)).toBeVisible()
      expect(screen.queryByRole('region', { name: '状態' })).toBeNull()
    })

    it('should say that the booking is not found when it was removed while it was confirmed', async () => {
      // Arrange
      const user = userEvent.setup()
      const id = await arrange({
        bookingNumber: 'BK-TEST-0001',
        day: 2,
        at: '10:00',
      })
      await openBooking(id)
      whenAskedFor(`POST /bookings/${id}/confirm`, () =>
        bookingRemovedMeanwhile(id),
      )

      // Act
      await user.click(screen.getByRole('button', { name: '予約を確定する' }))

      // Assert
      expect(await heading('予約が見つかりません')).toBeVisible()
    })

    it('should tell an account that left its salon while it confirmed a booking that the bookings are not theirs to see', async () => {
      // Arrange
      const user = userEvent.setup()
      const id = await arrange({
        bookingNumber: 'BK-TEST-0001',
        day: 2,
        at: '10:00',
      })
      await openBooking(id, STYLIST)
      whenAskedFor(`POST /bookings/${id}/confirm`, () =>
        staffRemovedMeanwhile(STYLIST_NAME),
      )

      // Act
      await user.click(screen.getByRole('button', { name: '予約を確定する' }))

      // Assert
      expect(await screen.findByText(NOT_THEIRS)).toBeVisible()
      expect((await storedBooking(id)).status).toBe('pending')
    })

    it('should close the dialog and say that the booking is not found when it was removed while its removal was asked', async () => {
      // Arrange
      const user = userEvent.setup()
      const id = await arrange({
        bookingNumber: 'BK-TEST-0001',
        day: 2,
        at: '10:00',
      })
      await openBooking(id)
      await user.click(screen.getByRole('button', { name: '予約を削除する' }))
      whenAskedFor(`DELETE /bookings/${id}`, () => bookingRemovedMeanwhile(id))

      // Act
      await user.click(
        within(
          screen.getByRole('dialog', { name: '予約を削除しますか？' }),
        ).getByRole('button', { name: '削除する' }),
      )

      // Assert
      expect(await heading('予約が見つかりません')).toBeVisible()
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('should lead to the sale of a booking, read again when it could not be read', async () => {
      // Arrange
      const user = userEvent.setup()
      const id = await arrange({
        bookingNumber: 'BK-TEST-0001',
        day: -1,
        at: '10:00',
        status: 'completed',
      })
      const saleId = await arrangeSale({
        saleNumber: 'SL-TEST-0001',
        bookingId: id,
        at: '11:30',
      })
      await takeAway('sales')
      await openBooking(id)
      const checkout = screen.getByRole('region', { name: '会計' })
      await within(checkout).findByRole('button', { name: 'もう一度読み込む' })
      await giveBack('sales')

      // Act
      await user.click(
        within(checkout).getByRole('button', { name: 'もう一度読み込む' }),
      )

      // Assert
      expect(
        await within(checkout).findByRole('link', { name: 'SL-TEST-0001' }),
      ).toHaveAttribute(
        'href',
        `/salons/${await salonIdOf(TOKYO)}/sales/${saleId}`,
      )
    })

    it('should lead to the treatment record of a booking, read again when it could not be read', async () => {
      // Arrange
      const user = userEvent.setup()
      const id = await treatedBookingOf(YUKI.email)
      const recordId = await treatmentIdOf(YUKI.email)
      await takeAway('treatment_records')
      await openBooking(id)
      const record = screen.getByRole('region', { name: '施術記録' })
      await within(record).findByRole('button', { name: 'もう一度読み込む' })
      await giveBack('treatment_records')

      // Act
      await user.click(
        within(record).getByRole('button', { name: 'もう一度読み込む' }),
      )

      // Assert
      expect(await within(record).findByRole('link')).toHaveAttribute(
        'href',
        `/salons/${await salonIdOf(TOKYO)}/treatments/${recordId}`,
      )
    })
  })

  it('should say that a booking that is not there is not found', async () => {
    // Arrange
    const tokyo = await salonIdOf(TOKYO)
    renderAt(`/salons/${tokyo}/bookings/0193a5b2-8a10-7c2e-b1d4-5e6f7a8b9c01`)

    // Act
    await signInAs(OWNER)

    // Assert
    expect(await heading('予約が見つかりません')).toHaveFocus()
    expect(address()).toBe(
      `/salons/${tokyo}/bookings/0193a5b2-8a10-7c2e-b1d4-5e6f7a8b9c01`,
    )
  })
})

describe('a booking of a salon on a page in English', () => {
  /** The part of the page with the state of the booking, in English. */
  const statusInEnglish = (): HTMLElement =>
    screen.getByRole('region', { name: 'Status' })

  /** Opens a booking of the Tokyo salon in English, signed in as the owner. */
  const openInEnglish = async (id: string): Promise<void> => {
    await openAs(
      `/salons/${await salonIdOf(TOKYO)}/bookings/${id}`,
      OWNER,
      'en',
    )
    await screen.findByRole('region', { name: 'Status' })
  }

  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
    languageStore.choose('en')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('should show who comes when, and confirm the booking, in English', async () => {
    // Arrange
    const user = userEvent.setup()
    const id = await arrange({
      bookingNumber: 'BK-TEST-0001',
      day: 3,
      at: '14:30',
      minutes: 120,
      customer: KENJI.email,
      staffCode: 'STF002',
      service: 'Full Color',
    })
    await testApi().query(
      `update bookings set source = 'online', "depositAmount" = 3000 where id = $1`,
      [id],
    )
    const day = await dayFromToday(3)
    await openInEnglish(id)
    expect(await heading('Booking details')).toBeVisible()
    expect(
      within(screen.getByRole('region', { name: 'Booking' }))
        .getAllByRole('term')
        .map((term) => [
          term.textContent,
          term.nextElementSibling?.textContent,
        ]),
    ).toEqual([
      ['Booking number', 'BK-TEST-0001'],
      ['Date of visit', dayNameOf(day).en],
      ['Time', '14:30–16:30'],
      ['Customer', KENJI.name],
      ['Customer’s phone number', expect.stringMatching(/\d/)],
      ['Staff', 'Mika Suzuki'],
      ['Customer’s requests', 'Not recorded'],
      ['Notes for the salon', 'Not recorded'],
      ['How it was booked', 'Online'],
      ['Deposit', '¥3,000'],
    ])
    expect(rowsOf('Service lines')).toEqual([
      [
        'Full Color',
        'Mika Suzuki',
        '14:30–16:30',
        '¥8,000 (tax included)',
        'Not yet',
      ],
    ])

    // Act
    await user.click(
      screen.getByRole('button', { name: 'Confirm the booking' }),
    )

    // Assert
    await waitFor(() =>
      expect(within(statusInEnglish()).getByText('Confirmed')).toBeVisible(),
    )
    expect(notifications()).toContain('Confirmed the booking.')
    expect(
      within(statusInEnglish())
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Start the treatment', 'Complete', 'Cancel the booking'])
    expect(
      screen.getByRole('link', { name: 'Go to the bookings of this day' }),
    ).toHaveAttribute(
      'href',
      `/salons/${await salonIdOf(TOKYO)}/bookings?date=${day}`,
    )
  })

  it('should cancel a booking with its reason, after asking, in English', async () => {
    // Arrange
    const user = userEvent.setup()
    const id = await arrange({
      bookingNumber: 'BK-TEST-0001',
      day: 5,
      at: '13:00',
    })
    await openInEnglish(id)

    // Act
    await user.click(screen.getByRole('button', { name: 'Cancel the booking' }))
    const dialog = await screen.findByRole('dialog', {
      name: 'Cancel the booking?',
    })
    await user.type(
      within(dialog).getByLabelText('Reason for cancelling'),
      'Called to cancel',
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Confirm the cancellation' }),
    )

    // Assert
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(within(statusInEnglish()).getByText('Cancelled')).toBeVisible()
    expect(notifications()).toContain('Cancelled the booking.')
    expect(
      within(statusInEnglish()).getByText(
        'The status of this booking cannot be changed any more. If it was recorded by mistake, remove the booking and make it again.',
      ),
    ).toBeVisible()
    expect((await storedBooking(id)).cancellationReason).toBe(
      'Called to cancel',
    )
  })

  it('should tell an account that belongs to no salon any more, in English, that the bookings are not theirs to see', async () => {
    // Arrange
    const id = await arrange({
      bookingNumber: 'BK-TEST-0001',
      day: 2,
      at: '10:00',
    })
    whenAskedFor(`GET /bookings/${id}`, () =>
      staffRemovedMeanwhile(STYLIST_NAME),
    )

    // Act
    await openAs(
      `/salons/${await salonIdOf(TOKYO)}/bookings/${id}`,
      STYLIST,
      'en',
    )

    // Assert
    expect(
      await screen.findByText(
        'You cannot see the bookings of this salon. Only the staff of the salon and the administrators can.',
      ),
    ).toBeVisible()
  })

  it('should say in English that a booking that is not there is not found', async () => {
    // Arrange
    const tokyo = await salonIdOf(TOKYO)

    // Act
    await openAs(
      `/salons/${tokyo}/bookings/0193a5b2-8a10-7c2e-b1d4-5e6f7a8b9c01`,
      OWNER,
      'en',
    )

    // Assert
    expect(await heading('Booking not found')).toHaveFocus()
    expect(
      screen.getByText(
        'Check that the address is right. A removed booking cannot be shown.',
      ),
    ).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Go to today’s bookings' }),
    ).toHaveAttribute('href', `/salons/${tokyo}/bookings`)
  })
})
