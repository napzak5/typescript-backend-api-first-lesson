import { languageStore } from '@beauty-salon-frontend/io'
import { periodNameOf } from '@beauty-salon-frontend/salon-screens'
import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import {
  dayFromToday,
  salonIdOf,
  signInAs,
} from '@beauty-salon-frontend/testing/api'
import {
  firstSight,
  heading,
  notifications,
  rowsOf,
  termsOf,
} from '@beauty-salon-frontend/testing/screens'
import {
  OWNER,
  SAKURA,
  STYLIST,
  TOKYO,
  VIP,
  YUKI,
} from '@beauty-salon-frontend/testing/seed'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openAs, renderAt } from '../../__tests__/screens'
import {
  treatmentHrefOf,
  treatmentPhotosHrefOf,
  treatmentStatisticsHrefOf,
  treatmentsHrefOf,
} from '../../navigation'
import {
  photoRemovedMeanwhile,
  photosAddedMeanwhile,
  storedPhotosOf,
  treatmentIdOf,
  treatmentRemovedMeanwhile,
} from '../__tests__/arrangements'

/*
 * The photos of the treatment records of the seed data: Tanaka Yuki's has
 * one taken after the treatment, Nakamura Hiroshi's one before and one
 * after, Sato Sakura's none. Their addresses are below the ID of their
 * record. The statistics count the three records of the salon in Tokyo,
 * which were written when the data was seeded. An owner works, unless a
 * test says otherwise; another account did something meanwhile.
 */

/** The address the seed data keeps a photo of a record at */
const seedPhotoOf = (treatmentId: string, file: string): string =>
  `https://images.example.com/treatments/${treatmentId}/${file}`

const photosPart = (): Promise<HTMLElement> =>
  screen.findByRole('region', { name: '施術写真' })

/** What the record shows of each photo: its caption */
const captions = async (): Promise<string[]> =>
  within(await photosPart())
    .queryAllByRole('figure')
    .map((figure) => figure.textContent ?? '')

const photoRow = (number: number): HTMLElement =>
  screen.getByRole('group', { name: `${number} 枚目の写真` })

type Filled = {
  photoType: string
  photoUrl: string
  angle?: string
  description?: string
  thumbnailUrl?: string
  consent?: boolean
  outside?: boolean
}

/** Fills in the row of the photo of a number, counted from 1. */
const fillPhoto = async (
  user: ReturnType<typeof userEvent.setup>,
  number: number,
  filled: Filled,
): Promise<void> => {
  const row = photoRow(number)
  await user.selectOptions(
    within(row).getByRole('combobox', { name: '区分' }),
    filled.photoType,
  )
  await user.type(
    within(row).getByRole('textbox', { name: '写真の URL' }),
    filled.photoUrl,
  )
  if (filled.thumbnailUrl !== undefined) {
    await user.type(
      within(row).getByRole('textbox', { name: '縮小した写真の URL' }),
      filled.thumbnailUrl,
    )
  }
  if (filled.angle !== undefined) {
    await user.type(
      within(row).getByRole('textbox', { name: '撮った向き' }),
      filled.angle,
    )
  }
  if (filled.description !== undefined) {
    await user.type(
      within(row).getByRole('textbox', { name: '写真の説明' }),
      filled.description,
    )
  }
  if (filled.consent === true) {
    await user.click(
      within(row).getByRole('checkbox', {
        name: 'お客様が、写真の撮影と利用に同意している',
      }),
    )
  }
  if (filled.outside === true) {
    await user.click(
      within(row).getByRole('checkbox', {
        name: 'サロンの外（サロンのページなど）に見せてよい',
      }),
    )
  }
}

/** Opens the screen that adds photos to the record of a customer of the seed data, and waits for the form. */
const openPhotosOf = async (
  email: string,
  account = OWNER,
): Promise<string> => {
  const treatmentId = await treatmentIdOf(email)
  renderAt(treatmentPhotosHrefOf(await salonIdOf(TOKYO), treatmentId))
  await signInAs(account)
  await screen.findByRole('group', { name: '1 枚目の写真' })

  return treatmentId
}

describe('the photos and the statistics of the treatment records, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('should show the photos of a record in their order, each with what it shows and how it may be used', async () => {
    // Arrange
    const treatmentId = await treatmentIdOf(VIP.email)

    // Act
    renderAt(treatmentHrefOf(await salonIdOf(TOKYO), treatmentId))
    await signInAs(OWNER)

    // Assert
    const part = await photosPart()
    const items = await within(part).findAllByRole('listitem')
    expect(await captions()).toEqual([
      '1 枚目：施術前の写真（側面）中間から毛先の退色お客様の同意あり。サロンの中だけで使います。',
      '2 枚目：施術後の写真（側面）お客様の同意あり。サロンの外にも見せられます。',
    ])
    expect(
      items.map((item) => [
        item.querySelector('img')?.getAttribute('src'),
        within(item).getByRole('link').getAttribute('href'),
      ]),
    ).toEqual([
      [
        seedPhotoOf(treatmentId, 'before-side.jpg'),
        seedPhotoOf(treatmentId, 'before-side.jpg'),
      ],
      [
        seedPhotoOf(treatmentId, 'after-side.jpg'),
        seedPhotoOf(treatmentId, 'after-side.jpg'),
      ],
    ])
  })

  it('should add photos to a record as a member of the staff, after those it holds, and show them on the record at once', async () => {
    // Arrange
    const user = userEvent.setup()
    const treatmentId = await treatmentIdOf(YUKI.email)
    const salonId = await salonIdOf(TOKYO)
    renderAt(treatmentHrefOf(salonId, treatmentId))
    await signInAs(STYLIST)
    await user.click(
      within(await photosPart()).getByRole('link', { name: '写真を足す' }),
    )
    expect(await heading('施術写真を足す')).toHaveFocus()
    await screen.findByRole('group', { name: '1 枚目の写真' })
    await fillPhoto(user, 1, {
      photoType: '施術前',
      photoUrl: 'https://photos.example.com/yuki/before.jpg',
      angle: '正面',
      description: '毛先の広がり',
      consent: true,
    })
    await user.click(screen.getByRole('button', { name: '写真の欄を足す' }))
    await fillPhoto(user, 2, {
      photoType: '施術後',
      photoUrl: 'https://photos.example.com/yuki/after.jpg',
      thumbnailUrl: 'https://photos.example.com/yuki/after-small.jpg',
      consent: true,
      outside: true,
    })

    // Act
    await user.click(screen.getByRole('button', { name: '写真を足す' }))

    // Assert
    expect(await heading('施術記録の内容')).toHaveFocus()
    expect(notifications()).toContain('施術写真を 2 枚足しました。')
    expect(firstSight()[0]).toBe(treatmentHrefOf(salonId, treatmentId))
    expect(firstSight()[1]).toContain('3 枚目：施術後の写真')
    expect(await captions()).toEqual([
      '1 枚目：施術後の写真（正面）お客様の同意あり。サロンの中だけで使います。',
      '2 枚目：施術前の写真（正面）毛先の広がりお客様の同意あり。サロンの中だけで使います。',
      '3 枚目：施術後の写真お客様の同意あり。サロンの外にも見せられます。',
    ])
    expect(await storedPhotosOf(treatmentId)).toEqual([
      {
        photoType: 'after',
        photoUrl: seedPhotoOf(treatmentId, 'after-front.jpg'),
        thumbnailUrl: null,
        angle: '正面',
        description: null,
        isPublic: false,
        customerConsent: true,
        sortOrder: 0,
      },
      {
        photoType: 'before',
        photoUrl: 'https://photos.example.com/yuki/before.jpg',
        thumbnailUrl: null,
        angle: '正面',
        description: '毛先の広がり',
        isPublic: false,
        customerConsent: true,
        sortOrder: 1,
      },
      {
        photoType: 'after',
        photoUrl: 'https://photos.example.com/yuki/after.jpg',
        thumbnailUrl: 'https://photos.example.com/yuki/after-small.jpg',
        angle: null,
        description: null,
        isPublic: true,
        customerConsent: true,
        sortOrder: 2,
      },
    ])
  })

  it('should say under its control an address the record came to hold meanwhile, and add the photo at another', async () => {
    // Arrange
    const user = userEvent.setup()
    const treatmentId = await openPhotosOf(SAKURA.email)
    await fillPhoto(user, 1, {
      photoType: '施術後',
      photoUrl: 'https://photos.example.com/sakura/after.jpg',
    })
    await photosAddedMeanwhile(treatmentId, [
      'https://photos.example.com/sakura/after.jpg',
    ])

    // Act
    await user.click(screen.getByRole('button', { name: '写真を足す' }))

    // Assert
    const address = within(photoRow(1)).getByRole('textbox', {
      name: '写真の URL',
    })
    expect(await screen.findByText(/同じ URL の写真があります/)).toBeVisible()
    expect(address).toHaveFocus()
    expect(address).toHaveAccessibleDescription(
      expect.stringContaining('この施術記録には、同じ URL の写真があります。'),
    )

    // Act
    await user.clear(address)
    await user.type(address, 'https://photos.example.com/sakura/after-2.jpg')
    await user.click(screen.getByRole('button', { name: '写真を足す' }))

    // Assert
    expect(await heading('施術記録の内容')).toHaveFocus()
    expect(
      (await storedPhotosOf(treatmentId)).map(({ photoUrl, sortOrder }) => [
        photoUrl,
        sortOrder,
      ]),
    ).toEqual([
      ['https://photos.example.com/sakura/after.jpg', 101],
      ['https://photos.example.com/sakura/after-2.jpg', 102],
    ])
  })

  it('should say how many photos a record that was added to meanwhile has room for, and add as many', async () => {
    // Arrange
    const user = userEvent.setup()
    const treatmentId = await openPhotosOf(SAKURA.email)
    await fillPhoto(user, 1, {
      photoType: '施術前',
      photoUrl: 'https://photos.example.com/sakura/before.jpg',
    })
    await user.click(screen.getByRole('button', { name: '写真の欄を足す' }))
    await fillPhoto(user, 2, {
      photoType: '施術後',
      photoUrl: 'https://photos.example.com/sakura/after.jpg',
    })
    await photosAddedMeanwhile(
      treatmentId,
      Array.from(
        { length: 19 },
        (_, index) => `https://photos.example.com/sakura/${index}.jpg`,
      ),
    )

    // Act
    await user.click(screen.getByRole('button', { name: '写真を足す' }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'この施術記録には、あと 1 枚まで足せます。写真の欄を減らしてください。',
    )

    // Act
    await user.click(
      screen.getByRole('button', { name: '2 枚目の写真の欄を外す' }),
    )
    await user.click(screen.getByRole('button', { name: '写真を足す' }))

    // Assert
    await heading('施術記録の内容')
    expect(await storedPhotosOf(treatmentId)).toHaveLength(20)
    const part = await photosPart()
    expect(within(part).queryByRole('link', { name: '写真を足す' })).toBeNull()
    expect(part).toHaveTextContent(
      '施術写真は、20 枚まで記録できます。足すときは、写真を外してから足してください。',
    )
  })

  it('should say that a record as full as it may be takes no more photos', async () => {
    // Arrange
    const treatmentId = await treatmentIdOf(SAKURA.email)
    await photosAddedMeanwhile(
      treatmentId,
      Array.from(
        { length: 20 },
        (_, index) => `https://photos.example.com/sakura/${index}.jpg`,
      ),
    )

    // Act
    renderAt(treatmentPhotosHrefOf(await salonIdOf(TOKYO), treatmentId))
    await signInAs(OWNER)

    // Assert
    expect(
      await screen.findByText(
        'この施術記録の写真は、20 枚になりました。写真を外してから足してください。',
      ),
    ).toBeVisible()
    expect(screen.queryByRole('group', { name: '1 枚目の写真' })).toBeNull()
  })

  it('should say that a record removed meanwhile is not found', async () => {
    // Arrange
    const user = userEvent.setup()
    const treatmentId = await openPhotosOf(SAKURA.email)
    await fillPhoto(user, 1, {
      photoType: '施術後',
      photoUrl: 'https://photos.example.com/sakura/after.jpg',
    })
    await treatmentRemovedMeanwhile(treatmentId)

    // Act
    await user.click(screen.getByRole('button', { name: '写真を足す' }))

    // Assert
    expect(await heading('施術記録が見つかりません')).toBeVisible()
  })

  it('should take a photo away after the dialog asked, and give the focus to the heading of the photos', async () => {
    // Arrange
    const user = userEvent.setup()
    const treatmentId = await treatmentIdOf(VIP.email)
    renderAt(treatmentHrefOf(await salonIdOf(TOKYO), treatmentId))
    await signInAs(STYLIST)
    await user.click(
      within(await photosPart()).getByRole('button', {
        name: '1 枚目の写真を外す',
      }),
    )
    const dialog = await screen.findByRole('dialog', {
      name: '1 枚目：施術前の写真（側面）を外しますか？',
    })

    // Act
    await user.click(within(dialog).getByRole('button', { name: '外す' }))

    // Assert
    expect(
      await screen.findByText('施術前の写真（側面）を外しました。'),
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { level: 2, name: '施術写真' }),
    ).toHaveFocus()
    expect(notifications()).toContain('施術前の写真（側面）を外しました。')
    expect(await captions()).toEqual([
      '1 枚目：施術後の写真（側面）お客様の同意あり。サロンの外にも見せられます。',
    ])
    expect(
      (await storedPhotosOf(treatmentId)).map(({ photoUrl }) => photoUrl),
    ).toEqual([seedPhotoOf(treatmentId, 'after-side.jpg')])
  })

  it('should say that a photo was taken away meanwhile, and show the photos as they are now', async () => {
    // Arrange
    const user = userEvent.setup()
    const treatmentId = await treatmentIdOf(VIP.email)
    renderAt(treatmentHrefOf(await salonIdOf(TOKYO), treatmentId))
    await signInAs(OWNER)
    await user.click(
      within(await photosPart()).getByRole('button', {
        name: '1 枚目の写真を外す',
      }),
    )
    const dialog = await screen.findByRole('dialog')
    await photoRemovedMeanwhile(seedPhotoOf(treatmentId, 'before-side.jpg'))

    // Act
    await user.click(within(dialog).getByRole('button', { name: '外す' }))

    // Assert
    const part = await photosPart()
    expect(
      await within(part).findByText('この写真は、その間に外されていました。'),
    ).toBeVisible()
    expect(within(part).getByRole('status')).toHaveTextContent(
      'この写真は、その間に外されていました。',
    )
    expect(
      screen.getByRole('heading', { level: 2, name: '施術写真' }),
    ).toHaveFocus()
    await waitFor(() =>
      expect(within(part).getAllByRole('figure')).toHaveLength(1),
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('should open the statistics from the list, count the month up to today, and the seed records in it', async () => {
    // Arrange
    const user = userEvent.setup()
    const salonId = await salonIdOf(TOKYO)
    const today = await dayFromToday(0)
    const first = `${today.slice(0, 8)}01`
    renderAt(treatmentsHrefOf(salonId))
    await signInAs(OWNER)

    // Act
    await user.click(await screen.findByRole('link', { name: '施術の統計' }))

    // Assert
    expect(await heading('施術の統計')).toHaveFocus()
    expect(await screen.findByLabelText('集計する期間（から）')).toHaveValue(
      first,
    )
    expect(screen.getByLabelText('集計する期間（まで）')).toHaveValue(today)
    expect(
      screen.getByText(
        `${periodNameOf({ from: first, to: today }).ja}に書いた施術記録`,
      ),
    ).toBeVisible()
    const counted = await screen.findByRole('region', { name: '施術記録の数' })
    expect(
      within(counted)
        .getAllByRole('term')
        .map((term) => [
          term.textContent,
          term.nextElementSibling?.textContent,
        ]),
    ).toEqual([
      ['施術記録', '3 件'],
      ['施術時間の平均', '80 分'],
    ])
    expect(rowsOf('メニューの区分ごとの施術記録')).toEqual([
      ['カット', '3 件'],
      ['カラー', '1 件'],
      ['トリートメント', '1 件'],
    ])
    const services = rowsOf('施術記録の多いサービス')
    expect(services).toHaveLength(4)
    expect(services[0]).toEqual(['1 位', 'Ladies Cut', '2 件'])
    // Services of as many records are in the order of their IDs
    expect(
      services.slice(1).map(([rank, , records]) => [rank, records]),
    ).toEqual([
      ['2 位', '1 件'],
      ['3 位', '1 件'],
      ['4 位', '1 件'],
    ])
    expect(
      services
        .slice(1)
        .map(([, service]) => service)
        .toSorted(),
    ).toEqual(['Deep Conditioning Treatment', 'Full Color', 'Mens Cut'])
  })

  it('should count over the days chosen, years of them, and say when no record was written in them', async () => {
    // Arrange
    const user = userEvent.setup()
    renderAt(treatmentStatisticsHrefOf(await salonIdOf(TOKYO)))
    await signInAs(OWNER)
    await screen.findByRole('region', { name: '施術記録の数' })
    const from = screen.getByLabelText('集計する期間（から）')
    const to = screen.getByLabelText('集計する期間（まで）')
    await user.clear(from)
    await user.type(from, '2020-01-01')
    await user.clear(to)
    await user.type(to, '2021-12-31')

    // Act
    await user.click(screen.getByRole('button', { name: '集計する' }))

    // Assert
    expect(
      await screen.findByText('この期間に書いた施術記録はありません'),
    ).toBeVisible()
    expect(
      screen.getByText(
        `${periodNameOf({ from: '2020-01-01', to: '2021-12-31' }).ja}に書いた施術記録`,
      ),
    ).toBeVisible()
  })

  it('should say what is wrong with a last day before the first, and give it the focus', async () => {
    // Arrange
    const user = userEvent.setup()
    renderAt(treatmentStatisticsHrefOf(await salonIdOf(TOKYO)))
    await signInAs(OWNER)
    await screen.findByRole('region', { name: '施術記録の数' })
    const to = screen.getByLabelText('集計する期間（まで）')
    await user.clear(to)
    await user.type(to, '2020-01-31')

    // Act
    await user.click(screen.getByRole('button', { name: '集計する' }))

    // Assert
    expect(to).toHaveFocus()
    expect(to).toHaveAccessibleDescription(
      expect.stringContaining(
        '終わりの日は、始まりの日と同じか、その後にしてください。',
      ),
    )
  })

  it.each<
    [string, (salonId: string) => Promise<string>, () => Promise<unknown>]
  >([
    [
      'a record with photos',
      async (salonId) =>
        treatmentHrefOf(salonId, await treatmentIdOf(VIP.email)),
      () => screen.findAllByRole('figure'),
    ],
    [
      'the photos added to a record',
      async (salonId) =>
        treatmentPhotosHrefOf(salonId, await treatmentIdOf(VIP.email)),
      () => screen.findByRole('group', { name: '1 枚目の写真' }),
    ],
    [
      'the statistics',
      async (salonId) => treatmentStatisticsHrefOf(salonId),
      () => screen.findByRole('table', { name: '施術記録の多いサービス' }),
    ],
  ])('should be accessible on %s', async (_, hrefOf, shown) => {
    // Arrange
    renderAt(await hrefOf(await salonIdOf(TOKYO)))
    await signInAs(OWNER)

    // Act
    await shown()

    // Assert
    expect(await findAccessibilityViolations(document.body)).toEqual([])
  })
})

describe('the photos and the statistics of the treatment records on a page in English', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
    languageStore.choose('en')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  /** The photos of the record in English */
  const photosInEnglish = (): Promise<HTMLElement> =>
    screen.findByRole('region', { name: 'Treatment photos' })

  it('should add a photo to a record, in English', async () => {
    // Arrange
    const user = userEvent.setup()
    const treatmentId = await treatmentIdOf(SAKURA.email)
    await openAs(
      treatmentPhotosHrefOf(await salonIdOf(TOKYO), treatmentId),
      OWNER,
      'en',
    )
    const row = await screen.findByRole('group', { name: 'Photo 1' })
    await user.selectOptions(
      within(row).getByRole('combobox', { name: 'Kind' }),
      'After the treatment',
    )
    await user.type(
      within(row).getByRole('textbox', { name: 'Photo URL' }),
      'https://images.example.com/treatments/new/after-front.jpg',
    )
    await user.type(within(row).getByRole('textbox', { name: 'Angle' }), '正面')
    await user.click(
      within(row).getByRole('checkbox', {
        name: 'May be shown outside the salon (on the page of the salon, for example)',
      }),
    )

    // Act
    await user.click(screen.getByRole('button', { name: 'Add photos' }))

    // Assert: a photo the customer did not agree to is not shown outside
    expect(
      within(row).getByRole('checkbox', {
        name: 'May be shown outside the salon (on the page of the salon, for example)',
      }),
    ).toHaveAccessibleDescription(
      'Only photos the customer agreed to can be shown outside the salon. A photo the customer did not agree to cannot be shown outside the salon. Check that the customer agrees, or clear this check box.',
    )

    // Act
    await user.click(
      within(row).getByRole('checkbox', {
        name: 'The customer agrees to the photo being taken and used',
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Add photos' }))

    // Assert
    expect(
      await within(await photosInEnglish()).findAllByRole('figure'),
    ).toHaveLength(1)
    expect(notifications()).toContain('Added 1 treatment photo.')
    expect(
      within(await photosInEnglish()).getByRole('figure').textContent,
    ).toBe(
      'Photo 1: After the treatment (正面)The customer agreed. It may be shown outside the salon.',
    )
  })

  it('should take a photo away after the dialog asked, in English', async () => {
    // Arrange
    const user = userEvent.setup()
    const treatmentId = await treatmentIdOf(VIP.email)
    await openAs(
      treatmentHrefOf(await salonIdOf(TOKYO), treatmentId),
      OWNER,
      'en',
    )
    await user.click(
      within(await photosInEnglish()).getByRole('button', {
        name: 'Remove photo 1',
      }),
    )
    const dialog = await screen.findByRole('dialog', {
      name: 'Remove “Photo 1: Before the treatment (側面)”?',
    })

    // Act
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }))

    // Assert
    expect(
      await screen.findByText(
        'Removed the photo “Before the treatment (側面)”.',
      ),
    ).toBeVisible()
    expect(
      (await storedPhotosOf(treatmentId)).map(({ photoUrl }) => photoUrl),
    ).toEqual([seedPhotoOf(treatmentId, 'after-side.jpg')])
  })

  it('should count the records of the month up to today, in English', async () => {
    // Arrange
    const today = await dayFromToday(0)
    const first = `${today.slice(0, 8)}01`

    // Act
    await openAs(treatmentStatisticsHrefOf(await salonIdOf(TOKYO)), OWNER, 'en')

    // Assert
    expect(await heading('Treatment statistics')).toBeVisible()
    expect(await screen.findByLabelText('Period to count (from)')).toHaveValue(
      first,
    )
    expect(
      screen.getByText(
        `Treatment records for ${periodNameOf({ from: first, to: today }).en}`,
      ),
    ).toBeVisible()
    await screen.findByRole('region', { name: 'Number of treatment records' })
    expect(termsOf('Number of treatment records')).toEqual([
      ['Treatment records', '3 records'],
      ['Average treatment time', '80 min'],
    ])
    expect(rowsOf('Treatment records by menu category')).toEqual([
      ['Cut', '3 records'],
      ['Color', '1 record'],
      ['Treatment', '1 record'],
    ])
    expect(rowsOf('Services with the most treatment records')[0]).toEqual([
      '1st',
      'Ladies Cut',
      '2 records',
    ])
    expect(
      screen.getByRole('link', { name: 'Go to the treatment records' }),
    ).toBeVisible()
  })
})
