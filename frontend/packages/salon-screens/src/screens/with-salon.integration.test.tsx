import { asked } from '@beauty-salon-frontend/testing/answers'
import {
  salonIdOf,
  testApi,
  unreadable,
} from '@beauty-salon-frontend/testing/api'
import {
  heading,
  readAgain,
  renderApplicationAt,
} from '@beauty-salon-frontend/testing/screens'
import { TOKYO } from '@beauty-salon-frontend/testing/seed'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WithSalon } from './with-salon'

/** A screen of the salon `salonId`, which shows the name and the time zone of the salon it was given. */
const renderScreenOf = (salonId: string) =>
  renderApplicationAt(
    <WithSalon salonId={salonId} title='予約'>
      {(salon) => (
        <>
          <h1>{salon.name}</h1>
          <p>{salon.timezone}</p>
        </>
      )}
    </WithSalon>,
    '/',
  )

describe('a screen of the salon of the address, against the API', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should show the screen once the salon is read, and nothing of it before', async () => {
    // Arrange
    const salonId = await salonIdOf(TOKYO)
    const fetched = vi.spyOn(globalThis, 'fetch')

    // Act
    renderScreenOf(salonId)

    // Assert
    expect(screen.getByRole('status')).toHaveTextContent(
      'サロンを読み込んでいます',
    )
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    expect(await heading(TOKYO)).toBeVisible()
    expect(screen.getByText('Asia/Tokyo')).toBeVisible()
    expect(asked(fetched)).toEqual([`GET /salons/${salonId}`])
  })

  it('should say that the salon of the address is none, and lead to the start', async () => {
    // Act
    renderScreenOf(crypto.randomUUID())

    // Assert
    expect(await heading('サロンが見つかりません')).toBeVisible()
    expect(
      screen.getByText(
        'アドレスが正しいか、お確かめください。削除されたサロンは、表示できません。',
      ),
    ).toBeVisible()
    expect(screen.getByRole('link', { name: 'トップへ戻る' })).toHaveAttribute(
      'href',
      '/',
    )
  })

  it('should say that a removed salon is none', async () => {
    // Arrange
    const salonId = await salonIdOf(TOKYO)
    await testApi().query(
      `update salons set "deletedAt" = now() where id = $1`,
      [salonId],
    )

    // Act
    renderScreenOf(salonId)

    // Assert
    expect(await heading('サロンが見つかりません')).toBeVisible()
  })

  it('should say under the title of the screen that the salon could not be read, and show the screen once it is read again', async () => {
    // Arrange
    const salonId = await salonIdOf(TOKYO)
    const readable = await unreadable('salons', 'updatedAt', salonId)
    const user = userEvent.setup()
    renderScreenOf(salonId)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'サロンを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
    )
    expect(screen.getByRole('heading', { name: '予約' })).toBeVisible()
    await readable()

    // Act
    await readAgain(user)

    // Assert
    expect(await heading(TOKYO)).toBeVisible()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
