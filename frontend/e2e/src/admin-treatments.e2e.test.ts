import { KENJI, OWNER, TOKYO } from '@beauty-salon-frontend/testing/seed'
import type { Locator, Page } from '@playwright/test'
import * as z from 'zod'
import { ADMIN } from './applications'
import { HIROSHI, LADIES_CUT, salonId } from './bookings'
import { expectSoundPage } from './checks'
import { expect, type TestApi, test } from './fixtures'
import { enterCredentials, heading } from './sign-in'

/*
 * The treatment record of a visit, as the staff write it beside the chair:
 * from the page of a booking whose treatment began, with a material of a
 * product kept by lots, then changed, then found again in the list of the
 * salon, with the keyboard alone. The tests put the booking into the
 * database: a cut of Yamamoto Kenji with Hiroshi, today, begun at 10:00.
 * The seed data has three records, which are shown on a screen as narrow
 * as a phone.
 */

const MASK = { code: 'TREAT001', name: 'Intensive Hair Mask 250ml（TREAT001）' }

/** Puts the booking of the tests into the database, its treatment begun. */
const arrangeVisit = (api: TestApi): Promise<string> =>
  api.idOf(
    `with picked as (
         select salons.id as "salonId", customers.id as "customerId", staff.id as "staffId",
                services.id as "serviceId", services.price, services.duration,
                (now() at time zone 'Asia/Tokyo')::date as day
         from salons
         join staff on staff."salonId" = salons.id and staff."displayName" = $2
         join services on services."salonId" = salons.id and services.name = $3
         cross join customers
         where salons.name = $1 and customers.email = $4
       ), made as (
         insert into bookings ("bookingNumber", "salonId", "customerId", "staffId", "bookingDate",
                               "startTime", "endTime", duration, status, subtotal, "totalAmount",
                               "actualStartTime")
         select 'BK-E2E-0201', "salonId", "customerId", "staffId", day,
                (day + '10:00'::time) at time zone 'Asia/Tokyo',
                (day + '10:00'::time) at time zone 'Asia/Tokyo' + make_interval(mins => duration),
                duration, 'in_progress', price, price,
                (day + '10:00'::time) at time zone 'Asia/Tokyo'
         from picked
         returning id, "staffId", "startTime", "endTime", duration, subtotal
       ), lines as (
         insert into booking_services ("bookingId", "serviceId", "staffId", "startTime", "endTime",
                                       duration, price, "finalPrice", "taxIncluded")
         select made.id, picked."serviceId", made."staffId", made."startTime", made."endTime",
                made.duration, made.subtotal, made.subtotal, true
         from made cross join picked
       )
       select id::text from made`,
    [TOKYO, HIROSHI, LADIES_CUT, KENJI.email],
  )

const lotSchema = z.tuple([z.object({ lotNumber: z.string() })])

/** The lot of the mask that the stock of the salon holds: the seed data numbers it at random. */
const lotOfTheMask = async (api: TestApi): Promise<string> => {
  const [{ lotNumber }] = lotSchema.parse(
    await api.query(
      `select inventory."lotNumber"
       from inventory join products on products.id = inventory."productId"
       join salons on salons.id = products."salonId"
       where salons.name = $1 and products."productCode" = $2`,
      [TOKYO, MASK.code],
    ),
  )

  return lotNumber
}

const storedSchema = z.array(
  z.object({
    processingTime: z.number().nullable(),
    materials: z.array(
      z.object({
        productCode: z.string(),
        quantity: z.string(),
        lotNumber: z.string().nullable(),
      }),
    ),
  }),
)

/** The record of a booking as the database of the API has it, with its materials in their order. */
const storedRecord = async (api: TestApi, bookingId: string) =>
  storedSchema.parse(
    await api.query(
      `select records."processingTime",
              (select coalesce(jsonb_agg(jsonb_build_object(
                        'productCode', products."productCode", 'quantity', materials.quantity::text,
                        'lotNumber', materials."lotNumber") order by materials."sortOrder"), '[]')
               from treatment_materials materials
               join products on products.id = materials."productId"
               where materials."treatmentRecordId" = records.id) as materials
       from treatment_records records where records."bookingId" = $1`,
      [bookingId],
    ),
  )

/** Presses a link or a button as somebody does who works with the keyboard alone. */
const pressWithTheKeyboard = async (control: Locator): Promise<void> => {
  await control.focus()
  await control.press('Enter')
}

const materials = (page: Page): Locator =>
  page.getByRole('table', { name: '使った商材の一覧' })

test.describe('the treatment records, in a browser', () => {
  test('should write the record of a visit with a material, change it and find it in the list, with the keyboard', async ({
    page,
    api,
  }) => {
    // Arrange
    const salon = await salonId(api)
    const bookingId = await arrangeVisit(api)
    const lot = await lotOfTheMask(api)
    await page.goto(`${ADMIN.origin}/salons/${salon}/bookings/${bookingId}`)
    await enterCredentials(page, OWNER, api.seedPassword)
    const part = page.getByRole('region', { name: '施術記録', exact: true })
    await expect(part).toContainText('まだ施術記録を書いていません。')

    // Act: the form, from the booking
    await pressWithTheKeyboard(
      part.getByRole('link', { name: '施術記録を書く' }),
    )
    await expect(heading(page, '施術記録を書く')).toBeFocused()
    await expect(page.getByRole('combobox', { name: '担当' })).toHaveValue(/.+/)
    await expect(
      page.getByRole('checkbox', { name: LADIES_CUT }).first(),
    ).toBeChecked()
    await page.getByRole('textbox', { name: '施術時間（分）' }).focus()
    await page.keyboard.type('55')
    await pressWithTheKeyboard(page.getByRole('button', { name: '商材を足す' }))
    const row = page.getByRole('group', { name: '1 件目の商材' })
    const product = row.getByRole('combobox', { name: '商品' })
    await expect(product).toBeFocused()
    await product.selectOption({ label: MASK.name })
    await expect(row.getByRole('textbox', { name: '単位' })).toHaveValue('jar')
    await page.keyboard.press('Tab')
    await expect(row.getByRole('textbox', { name: '量' })).toBeFocused()
    await page.keyboard.type('15')
    await row.getByRole('textbox', { name: 'ロット番号' }).focus()
    await page.keyboard.type(lot)
    await pressWithTheKeyboard(
      page.getByRole('button', { name: '施術記録を書く' }),
    )

    // Assert
    await expect(
      page.getByText(`${KENJI.name} 様の施術記録を書きました。`),
    ).toBeVisible()
    await expect(materials(page).getByRole('row').nth(1)).toContainText(
      `${MASK.name}15 jar${lot}`,
    )
    expect(await storedRecord(api, bookingId)).toEqual([
      {
        processingTime: 55,
        materials: [
          { productCode: MASK.code, quantity: '15.00', lotNumber: lot },
        ],
      },
    ])

    // Act: the time made longer, the material taken away
    await pressWithTheKeyboard(
      page.getByRole('link', { name: '施術記録を直す' }),
    )
    await expect(heading(page, '施術記録を直す')).toBeFocused()
    const time = page.getByRole('textbox', { name: '施術時間（分）' })
    await time.focus()
    await time.press('ControlOrMeta+a')
    await page.keyboard.type('65')
    await pressWithTheKeyboard(
      page.getByRole('button', { name: '1 件目の商材を外す' }),
    )
    await expect(page.getByRole('button', { name: '商材を足す' })).toBeFocused()
    await pressWithTheKeyboard(
      page.getByRole('button', { name: '変更を保存する' }),
    )

    // Assert
    await expect(
      page.getByText(`${KENJI.name} 様の施術記録を直しました。`),
    ).toBeVisible()
    await expect(materials(page)).toContainText('使った商材はありません')
    expect(await storedRecord(api, bookingId)).toEqual([
      { processingTime: 65, materials: [] },
    ])

    // Act: the list of the salon, narrowed to the member of the staff
    await pressWithTheKeyboard(
      page.getByRole('link', { name: '施術記録', exact: true }),
    )
    await expect(heading(page, '施術記録')).toBeFocused()
    await page.getByRole('combobox', { name: '担当' }).selectOption({
      label: HIROSHI,
    })
    await pressWithTheKeyboard(page.getByRole('button', { name: '表示する' }))

    // Assert
    const found = page.getByRole('table', {
      name: '条件に合う施術記録',
      exact: true,
    })
    await expect(found.getByRole('row')).toHaveCount(3)
    await expect(found.getByRole('row').nth(1)).toContainText(
      `${KENJI.name} 様${HIROSHI}${LADIES_CUT}65 分未回答`,
    )
  })
})

test.describe('the treatment records, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should fit the list, a record, the dialog of a removal and the form into the width', async ({
    page,
    api,
  }) => {
    // Arrange
    const salon = await salonId(api)
    await page.goto(`${ADMIN.origin}/salons/${salon}/treatments`)
    await enterCredentials(page, OWNER, api.seedPassword)

    // Act
    const list = page.getByRole('table', { name: '施術記録', exact: true })
    await expect(list.getByRole('rowheader')).toHaveCount(3)

    // Assert
    await expectSoundPage(page)

    // Act: the record of the colour, which has two materials
    await list.getByRole('rowheader').first().getByRole('link').click()
    await expect(materials(page).getByRole('rowheader')).toHaveCount(2)

    // Assert
    await expectSoundPage(page)

    // Act
    await page.getByRole('button', { name: '削除' }).click()

    // Assert
    await expect(page.getByRole('dialog')).toBeVisible()
    await expectSoundPage(page)

    // Act
    await page.keyboard.press('Escape')
    await page.getByRole('link', { name: '施術記録を直す' }).click()
    await expect(
      page.getByRole('group', { name: '2 件目の商材' }),
    ).toBeVisible()

    // Assert
    await expectSoundPage(page)
  })
})
