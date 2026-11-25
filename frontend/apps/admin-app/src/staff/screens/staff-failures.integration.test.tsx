import {
  refuse,
  salonIdOf,
  unreadable,
  whenAskedFor,
} from '@beauty-salon-frontend/testing/api'
import { readAgain, rowsOf } from '@beauty-salon-frontend/testing/screens'
import {
  MANAGER,
  OPERATOR,
  OWNER,
  THERAPIST,
  TOKYO,
} from '@beauty-salon-frontend/testing/seed'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openAs, REST_UNREAD } from '../../__tests__/screens'
import { salonRemovedMeanwhile } from '../../bookings/__tests__/arrangements'
import { madeStaffMeanwhile } from '../../customers/__tests__/arrangements'
import {
  staffChangeHrefOf,
  staffEntryHrefOf,
  staffLedgerHrefOf,
  staffMemberHrefOf,
} from '../../navigation'
import {
  arrangeMembers,
  arrangeOwnerAccount,
  crowdIdOf,
  everyMemberRemoved,
  linkedMeanwhile,
  storedMemberOf,
} from '../__tests__/arrangements'
import {
  fillRequired,
  LEDGER_NOT_THEIRS,
  NEW_MEMBER,
  openedMemberForm,
  STAFF_UNREAD,
} from '../__tests__/screens'

/*
 * The staff ledger, a member, their registration, their change and their
 * removal, when a request fails and when the account changes between two
 * requests of the screen. The failures are arranged in the database; what
 * goes well is in `staff.integration.test.tsx`.
 */

type User = ReturnType<typeof userEvent.setup>

/** What a form of a member says when the account was refused the ledger as it was sent */
const CANNOT_KEEP =
  /^このアカウントでは、このサロンのスタッフ台帳を扱えません。/

const ledger = (): Promise<HTMLElement> =>
  screen.findByRole('table', { name: 'スタッフ' })

/** The members the ledger lists, by their names */
const namesListed = (): (string | undefined)[] =>
  rowsOf(screen.getByRole('table', { name: 'スタッフ' })).map(([name]) => name)

/** Registers one member after those of the seed data, and gives the address of their page */
const crowdMemberAt = async (
  hrefOf: (salonId: string, staffId: string) => string,
): Promise<string> => {
  await arrangeMembers(1)

  return hrefOf(await salonIdOf(TOKYO), await crowdIdOf(1))
}

/** Opens the dialog of the removal of the member `arrangeMembers` registered first */
const removalDialog = async (user: User): Promise<HTMLElement> => {
  await openAs(await crowdMemberAt(staffMemberHrefOf), OWNER)
  await user.click(await screen.findByRole('button', { name: '削除' }))

  return screen.findByRole('dialog', {
    name: 'Crowd 01 さんを、スタッフ台帳から削除しますか？',
  })
}

describe('the staff ledger, when something fails or changes meanwhile, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('should tell the owner of another salon that its ledger is not theirs, as the API refused it', async () => {
    // Arrange
    await arrangeOwnerAccount(THERAPIST)

    // Act
    await openAs(staffLedgerHrefOf(await salonIdOf(TOKYO)), THERAPIST)

    // Assert
    expect(await screen.findByText(LEDGER_NOT_THEIRS)).toBeVisible()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('should say that the ledger could not be read, and show it when asked again', async () => {
    // Arrange
    const user = userEvent.setup()
    await arrangeMembers(1)
    const readable = await unreadable('staff', 'createdAt', await crowdIdOf(1))
    await openAs(staffLedgerHrefOf(await salonIdOf(TOKYO)), OWNER)
    expect(await screen.findByText(STAFF_UNREAD)).toBeVisible()
    await readable()

    // Act
    await readAgain(user)

    // Assert
    await ledger()
    expect(namesListed()).toContain('Crowd 01')
  })

  it('should say that the members that come next could not be read, and show them when asked again', async () => {
    // Arrange
    const user = userEvent.setup()
    await arrangeMembers(18)
    // A moment that is none comes after every other: the member is on the second page
    const readable = await unreadable('staff', 'createdAt', await crowdIdOf(18))
    await openAs(staffLedgerHrefOf(await salonIdOf(TOKYO)), OWNER)
    await ledger()
    await user.click(screen.getByRole('button', { name: 'さらに表示' }))
    expect(await screen.findByText(REST_UNREAD)).toBeVisible()
    expect(namesListed()).toHaveLength(20)
    await readable()

    // Act
    await readAgain(user)

    // Assert
    await waitFor(() => expect(namesListed()).toHaveLength(23))
    expect(namesListed().at(-1)).toBe('Crowd 18')
  })

  it('should end the ledger where a page after the first was refused to an account that keeps it no more', async () => {
    // Arrange
    const user = userEvent.setup()
    await arrangeMembers(18)
    const salonId = await salonIdOf(TOKYO)
    await openAs(staffLedgerHrefOf(salonId), OWNER)
    await ledger()
    whenAskedFor(`GET /salons/${salonId}/staff`, () =>
      madeStaffMeanwhile(OWNER),
    )

    // Act
    await user.click(screen.getByRole('button', { name: 'さらに表示' }))

    // Assert
    expect(await screen.findByText(REST_UNREAD)).toBeVisible()
    expect(namesListed()).toHaveLength(20)
  })

  it('should say that the ledger has no members yet, and lead to registering them', async () => {
    // Arrange
    await everyMemberRemoved()

    // Act
    await openAs(staffLedgerHrefOf(await salonIdOf(TOKYO)), OPERATOR)

    // Assert
    expect(await screen.findByText('スタッフはいません')).toBeVisible()
    expect(
      screen.getByText('サロンで働くスタッフを、台帳に登録してください。'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('should say that a member could not be read, and show them when asked again', async () => {
    // Arrange
    const user = userEvent.setup()
    const href = await crowdMemberAt(staffMemberHrefOf)
    const readable = await unreadable('staff', 'createdAt', await crowdIdOf(1))
    await openAs(href, OWNER)
    expect(await screen.findByText(STAFF_UNREAD)).toBeVisible()
    await readable()

    // Act
    await readAgain(user)

    // Assert
    expect(
      await screen.findByRole('region', { name: '予約の受け方' }),
    ).toBeInTheDocument()
  })

  it('should tell a manager that the registration of a member is not theirs', async () => {
    // Act
    await openAs(staffEntryHrefOf(await salonIdOf(TOKYO)), MANAGER)

    // Assert
    expect(await screen.findByText(LEDGER_NOT_THEIRS)).toBeVisible()
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('should say that the account registers nobody when it keeps the ledger no more', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAs(staffEntryHrefOf(await salonIdOf(TOKYO)), OWNER)
    await openedMemberForm()
    await fillRequired(user)
    await madeStaffMeanwhile(OWNER)

    // Act
    await user.click(screen.getByRole('button', { name: '登録する' }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(CANNOT_KEEP)
    expect(await storedMemberOf(NEW_MEMBER.email)).toBeUndefined()
  })

  it('should say that the account changes nobody when it keeps the ledger no more', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAs(await crowdMemberAt(staffChangeHrefOf), OWNER)
    await openedMemberForm()
    await user.type(screen.getByRole('textbox', { name: '役職' }), 'Assistant')
    await madeStaffMeanwhile(OWNER)

    // Act
    await user.click(screen.getByRole('button', { name: '変更を保存する' }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(CANNOT_KEEP)
    expect(await storedMemberOf('crowd-1@beautysalon.jp')).toMatchObject({
      position: null,
    })
  })

  it.each<[string, string, () => Promise<unknown>, RegExp]>([
    [
      'the account keeps the ledger no more',
      OWNER,
      () => madeStaffMeanwhile(OWNER),
      CANNOT_KEEP,
    ],
    [
      'the salon was removed',
      // A member of the salon is refused a removed salon: an administrator is told it is not found
      OPERATOR,
      () => salonRemovedMeanwhile(TOKYO),
      /^スタッフを登録できませんでした。/,
    ],
  ])(
    'should say above the form what kept the ledger from being read for the value that is taken when %s',
    async (_, email, change, said) => {
      // Arrange
      const user = userEvent.setup()
      const salonId = await salonIdOf(TOKYO)
      await openAs(staffEntryHrefOf(salonId), email)
      await openedMemberForm()
      await fillRequired(user)
      // The code of Hiroshi Tanaka, with an address of mail nobody has: the API does not say which is taken
      await user.type(
        screen.getByRole('textbox', { name: 'スタッフコード' }),
        'STF001',
      )
      whenAskedFor(`GET /salons/${salonId}/staff`, change)

      // Act
      await user.click(screen.getByRole('button', { name: '登録する' }))

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(said)
      expect(await storedMemberOf(NEW_MEMBER.email)).toBeUndefined()
    },
  )

  it('should say at the box that the member stays active when the account was linked to them while the form was open', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAs(await crowdMemberAt(staffChangeHrefOf), OWNER)
    await openedMemberForm()
    await linkedMeanwhile(OWNER, await crowdIdOf(1))
    await user.click(screen.getByRole('checkbox', { name: '有効なスタッフ' }))

    // Act
    await user.click(screen.getByRole('button', { name: '変更を保存する' }))

    // Assert
    const active = screen.getByRole('checkbox', { name: '有効なスタッフ' })
    await waitFor(() => expect(active).toHaveFocus())
    expect(active).toHaveAccessibleDescription(
      expect.stringContaining('ご自身のスタッフ情報は、無効にできません。'),
    )
    expect(await storedMemberOf('crowd-1@beautysalon.jp')).toMatchObject({
      isActive: true,
    })
  })

  it('should say in the dialog that the member could not be removed, and keep it open to try again', async () => {
    // Arrange
    const user = userEvent.setup()
    const dialog = await removalDialog(user)
    await refuse('update', 'staff')

    // Act
    await user.click(within(dialog).getByRole('button', { name: '削除する' }))

    // Assert
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'スタッフを削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
    )
    expect(screen.getByRole('dialog')).toBe(dialog)
    expect(await storedMemberOf('crowd-1@beautysalon.jp')).toMatchObject({
      removed: false,
    })
  })

  it('should close the dialog and say that the account removes nobody when it keeps the ledger no more', async () => {
    // Arrange
    const user = userEvent.setup()
    const dialog = await removalDialog(user)
    await madeStaffMeanwhile(OWNER)

    // Act
    await user.click(within(dialog).getByRole('button', { name: '削除する' }))

    // Assert
    expect(
      await screen.findByText(
        /^このアカウントでは、このサロンのスタッフを削除できません。/,
      ),
    ).toBeVisible()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(await storedMemberOf('crowd-1@beautysalon.jp')).toMatchObject({
      removed: false,
    })
  })
})
