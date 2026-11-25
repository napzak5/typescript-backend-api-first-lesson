import { screen } from '@testing-library/react'
import type userEvent from '@testing-library/user-event'

/*
 * What the screen tests of the staff ledger fill in and wait for, and what
 * their screens say alike.
 */

const text = (name: string): HTMLElement =>
  screen.getByRole('textbox', { name })

/** The values a new member is given in the tests that register one */
export const NEW_MEMBER = {
  lastName: 'Kato',
  firstName: 'Rina',
  displayName: 'Rina Kato',
  email: 'rina.kato@beautysalon.jp',
  phoneNumber: '090-7777-8888',
}

/** Fills in what nobody can leave out of a new member. */
export const fillRequired = async (
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

/** Waits for the form of a member, shown once what it needs was read */
export const openedMemberForm = (): Promise<HTMLElement> =>
  screen.findByRole('group', { name: '名前' })

/** What a screen of the ledger tells an account that does not keep the staff ledger of the salon */
export const LEDGER_NOT_THEIRS =
  'このサロンのスタッフ台帳は、扱えません。スタッフ台帳を扱えるのは、そのサロンのオーナーと、管理者です。'

/** What a screen says when the members, or a member, could not be read */
export const STAFF_UNREAD =
  'スタッフを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。'
