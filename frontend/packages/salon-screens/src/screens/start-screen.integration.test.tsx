import { signIn } from '@beauty-salon-frontend/session'
import {
  giveBack,
  idOf,
  salonIdOf,
  takeAway,
  testApi,
} from '@beauty-salon-frontend/testing/api'
import {
  address,
  goBack,
  heading,
  renderApplicationAt,
} from '@beauty-salon-frontend/testing/screens'
import {
  CUSTOMER,
  OPERATOR,
  STYLIST,
  TOKYO,
} from '@beauty-salon-frontend/testing/seed'
import { ButtonLink } from '@beauty-salon-frontend/ui'
import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { StartScreen } from './start-screen'

const TITLE = 'Kushi Admin'

/** The start of an application, and the first screen of a salon it leads to. */
const renderStart = () =>
  renderApplicationAt(
    <Routes>
      <Route
        path='/'
        element={
          <StartScreen
            title={TITLE}
            choice='予約台帳を開くサロンを選びます。'
            salonHref={(salonId) => `/salons/${salonId}/bookings`}
            choiceActions={
              <ButtonLink href='/salons/new'>サロンを登録する</ButtonLink>
            }
          />
        }
      />
      <Route path='/salons/:salonId/bookings' element={<h1>予約台帳</h1>} />
      <Route path='/before' element={<h1>前の画面</h1>} />
    </Routes>,
    '/',
    { before: ['/before'] },
  )

const signInAs = async (email: string): Promise<void> => {
  expect(
    await signIn({
      email,
      password: testApi().seedPassword,
      rememberMe: false,
      twoFactorCode: null,
    }),
  ).toEqual({ type: 'signedIn' })
}

/** The salon a member of the staff works at, as the database has it. */
const salonOf = (email: string): Promise<string> =>
  idOf(
    `select s."salonId" as id from staff s join users u on u.id = s."userId"
      where u.email = $1`,
    [email],
  )

describe('the start of an application of a salon, against the API', () => {
  it('should say that the salon is checked while it is read, under the title of the application', async () => {
    // Arrange
    await signInAs(STYLIST)

    // Act
    renderStart()

    // Assert
    expect(screen.getByRole('heading', { name: TITLE })).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent(
      'サロンを確かめています',
    )
    await heading('予約台帳')
  })

  it('should lead a member of a salon on to the screens of their salon, in place of the start', async () => {
    // Arrange
    await signInAs(STYLIST)

    // Act
    renderStart()

    // Assert
    expect(await heading('予約台帳')).toBeVisible()
    expect(address()).toBe(`/salons/${await salonOf(STYLIST)}/bookings`)
    // The start was replaced: going back leads to the screen before it
    act(() => goBack())
    expect(await heading('前の画面')).toBeVisible()
  })

  it('should let the operator of the platform choose a salon, each leading to its screens', async () => {
    // Arrange
    await signInAs(OPERATOR)

    // Act
    renderStart()

    // Assert
    expect(await heading('サロンを選ぶ')).toBeVisible()
    expect(screen.getByText('予約台帳を開くサロンを選びます。')).toBeVisible()
    expect(await screen.findByRole('link', { name: TOKYO })).toHaveAttribute(
      'href',
      `/salons/${await salonIdOf(TOKYO)}/bookings`,
    )
    expect(
      screen.getByRole('link', { name: 'サロンを登録する' }),
    ).toHaveAttribute('href', '/salons/new')
    expect(address()).toBe('/')
  })

  it('should tell an account that belongs to no salon that it has nothing here', async () => {
    // Arrange
    await signInAs(CUSTOMER)

    // Act
    renderStart()

    // Assert
    expect(await heading('どのサロンにも属していません')).toBeVisible()
    expect(address()).toBe('/')
  })

  it('should say that the salon could not be read, and lead on once it is read again', async () => {
    // Arrange: the profile reads every column of the member of the staff
    await signInAs(STYLIST)
    await takeAway('staff', 'bio')
    const user = userEvent.setup()
    renderStart()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '所属するサロンを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
    )
    expect(screen.getByRole('heading', { name: TITLE })).toBeVisible()
    await giveBack('staff', 'bio')

    // Act
    await user.click(screen.getByRole('button', { name: 'もう一度読み込む' }))

    // Assert
    expect(await heading('予約台帳')).toBeVisible()
    await waitFor(() =>
      expect(screen.queryByRole('alert')).not.toBeInTheDocument(),
    )
  })
})
