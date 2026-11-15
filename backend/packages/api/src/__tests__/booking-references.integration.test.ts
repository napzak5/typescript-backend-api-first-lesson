import {
  bookingServices,
  bookings,
  customers,
  salons,
  services,
  staff,
  users,
} from '@beauty-salon-backend/database'
import { asc, eq } from 'drizzle-orm'
import type { Express } from 'express'
import type { Response, Test } from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  epochMs,
  insertCustomer,
  insertMember,
  insertSalon,
  insertStaff,
  insertUser,
  signedInUser,
  signIn,
} from './_shared/auth-helpers'
import {
  createTestApp,
  expectProblem,
  getTestDb,
  getTestDbClient,
  request,
} from './_shared/test-helpers'

const BOOKINGS = '/api/v1/bookings'

const notFound = { status: 404, code: '3001', type: 'not-found' }
const notAllowed = { status: 409, code: '3003', type: 'operation-not-allowed' }
const forbidden = { status: 403, code: '1005', type: 'forbidden' }

type Status = (typeof bookings.status.enumValues)[number]

/** The statuses of a booking that is not finished: an action leads on from them. */
const UNFINISHED: Status[] = ['draft', 'pending', 'confirmed', 'in_progress']
const FINISHED: Status[] = ['completed', 'cancelled', 'no_show']

/** What a booking refers to, by what the refusal of a delete calls it. */
type Kind = 'customer' | 'salon' | 'service' | 'staff member'

const KINDS: Kind[] = ['customer', 'salon', 'service', 'staff member']

/** The rows a booking refers to. */
type Referred = {
  salonId: string
  customerId: string
  staffId: string
  serviceId: string
}

/** The route that deletes each of them. */
const PATHS: Record<Kind, (of: Referred) => string> = {
  customer: ({ customerId }) => `/api/v1/customers/${customerId}`,
  salon: ({ salonId }) => `/api/v1/salons/${salonId}`,
  service: ({ salonId, serviceId }) =>
    `/api/v1/salons/${salonId}/services/${serviceId}`,
  'staff member': ({ salonId, staffId }) =>
    `/api/v1/salons/${salonId}/staff/${staffId}`,
}

const refusalOf = (kind: Kind): string =>
  `The ${kind} cannot be deleted: bookings that are not finished refer to it`

const statusAndCode = (response: Response): string =>
  response.status < 400
    ? String(response.status)
    : `${response.status} ${response.body.code}`

const pause = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

/** A time of 20 November 2026 in UTC, `HH:MM`; ten in the morning in Tokyo is 01:00. */
const at = (time: string): string => `2026-11-20T${time}:00Z`

describe('Deleting what bookings refer to', () => {
  let app: Express
  let db: ReturnType<typeof getTestDb>
  /** The Authorization header of an admin. */
  let asAdmin: string
  /** What the bookings of a test refer to, unless the test says otherwise. */
  let ours: Referred

  type NewStaff = typeof staff.$inferInsert
  type NewService = typeof services.$inferInsert
  type NewBooking = typeof bookings.$inferInsert
  type NewLine = typeof bookingServices.$inferInsert
  type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]
  type Executor = Pick<typeof db, 'insert'>

  const insertService = async (
    salonId: string,
    overrides: Partial<NewService> = {},
  ): Promise<string> => {
    const [service] = await db
      .insert(services)
      .values({
        salonId,
        name: 'Cut and blow-dry',
        duration: 60,
        price: 6600,
        imageUrls: [],
        tags: [],
        packageServiceIds: [],
        bookingRequirements: [],
        ...overrides,
      })
      .returning({ id: services.id })
    if (service === undefined) {
      throw new Error('No service was inserted')
    }
    return service.id
  }

  /** A staff member who takes one booking at a time and keeps no time free. */
  const staffOf = (
    salonId: string,
    overrides: Partial<NewStaff> = {},
  ): Promise<string> =>
    insertStaff(db, salonId, {
      maxConcurrentBookings: 1,
      bufferTimeBefore: 0,
      bufferTimeAfter: 0,
      ...overrides,
    })

  /** A salon in Tokyo with a staff member and a service, and a customer. */
  const referred = async (): Promise<Referred> => {
    const salonId = await insertSalon(db, {
      timezone: 'Asia/Tokyo',
      taxRate: '10.00',
    })
    return {
      salonId,
      customerId: await insertCustomer(db),
      staffId: await staffOf(salonId),
      serviceId: await insertService(salonId),
    }
  }

  beforeEach(async () => {
    app = createTestApp()
    db = getTestDb()
    asAdmin = (await signedInUser(app, db, { role: 'admin' })).authorization
    ours = await referred()
  })

  const authorized = (call: Test, authorization: string): Test =>
    call.set('Authorization', authorization)

  /** Deletes one of the things a booking refers to; as the admin unless said otherwise. */
  const remove = (kind: Kind, of: Referred = ours, as: string = asAdmin) =>
    authorized(request(app).delete(PATHS[kind](of)), as)

  /** Signs in as a member of a salon; of the salon of the test unless another is given. */
  const member = async (
    role: 'owner' | 'manager' | 'staff',
    salonId: string = ours.salonId,
  ): Promise<{ authorization: string; staffId: string }> => {
    const { email, staffId } = await insertMember(db, role, salonId)
    return { authorization: (await signIn(app, email)).authorization, staffId }
  }

  let rows = 0

  /** A row of `bookings` that keeps every constraint: pending, an hour from ten in Tokyo. */
  const bookingRow = (
    of: Referred,
    overrides: Partial<NewBooking>,
  ): NewBooking => {
    rows += 1
    return {
      bookingNumber: `BK-REFER-${String(rows).padStart(4, '0')}`,
      salonId: of.salonId,
      customerId: of.customerId,
      staffId: of.staffId,
      bookingDate: '2026-11-20',
      startTime: at('01:00'),
      endTime: at('02:00'),
      duration: 60,
      status: 'pending',
      subtotal: 6600,
      totalAmount: 6600,
      ...overrides,
    }
  }

  /** A row of `booking_services` that keeps every constraint: the service of the booking above, by its staff member. */
  const lineRow = (
    bookingId: string,
    of: Referred,
    overrides: Partial<NewLine>,
  ): NewLine => ({
    bookingId,
    serviceId: of.serviceId,
    staffId: of.staffId,
    startTime: at('01:00'),
    endTime: at('02:00'),
    duration: 60,
    price: 6600,
    finalPrice: 6600,
    ...overrides,
  })

  /** A status with the times the table wants a booking in that status to have, and no others. */
  const inStatus = (status: Status): Partial<NewBooking> => ({
    status,
    cancelledAt: status === 'cancelled' ? at('00:30') : null,
    completedAt: status === 'completed' ? at('02:00') : null,
    actualStartTime: status === 'in_progress' ? at('01:05') : null,
  })

  /**
   * Writes a booking directly, pending unless said otherwise, with one
   * service line unless others are given; returns the ID of the booking.
   */
  const insertBooking = async ({
    of = ours,
    booking = {},
    lines = [{}],
    executor = db,
  }: {
    of?: Referred
    booking?: Partial<NewBooking>
    lines?: Partial<NewLine>[]
    executor?: Executor
  } = {}): Promise<string> => {
    const [row] = await executor
      .insert(bookings)
      .values(bookingRow(of, booking))
      .returning({ id: bookings.id })
    if (row === undefined) {
      throw new Error('No booking was inserted')
    }
    for (const [sortOrder, line] of lines.entries()) {
      await executor
        .insert(bookingServices)
        .values(lineRow(row.id, of, { sortOrder, ...line }))
    }
    return row.id
  }

  /** A booking in a status that refers to what the test has. */
  const bookingIn = (status: Status): Promise<string> =>
    insertBooking({ booking: inStatus(status) })

  /** A request that enters a booking of one service line. */
  const entryOf = (of: Referred = ours) => ({
    salonId: of.salonId,
    customerId: of.customerId,
    staffId: of.staffId,
    depositAmount: null,
    customerRequest: null,
    internalNotes: null,
    source: null,
    services: [
      {
        serviceId: of.serviceId,
        staffId: of.staffId,
        startTime: at('01:00'),
        notes: null,
      },
    ],
  })

  /** Enters a booking through the API; as the admin. */
  const enter = (of: Referred = ours) =>
    authorized(request(app).post(BOOKINGS), asAdmin).send(entryOf(of))

  /** The ID of a booking entered through the API; anything but 201 fails the test. */
  const entered = async (of: Referred = ours): Promise<string> => {
    const response = await enter(of)
    if (response.status !== 201) {
      throw new Error(
        `Expected 201, got ${response.status}: ${JSON.stringify(response.body)}`,
      )
    }
    return response.body.data.id
  }

  /** Takes a booking to another status through the API. */
  const act = (
    id: string,
    action: 'confirm' | 'cancel' | 'complete',
    body: object | null = null,
  ): Test => {
    const call = authorized(
      request(app).post(`${BOOKINGS}/${id}/${action}`),
      asAdmin,
    )
    return body === null ? call : call.send(body)
  }

  /** Moves a booking to two hours later and to a staff member, through the API. */
  const moveTo = (id: string, staffId: string) =>
    authorized(request(app).post(`${BOOKINGS}/${id}/reschedule`), asAdmin).send(
      { startTime: at('03:00'), staffId },
    )

  /** The marks of a delete on a row: whether it is deleted, and the moments it was deleted and written at. */
  type Marks = {
    deletedAt: string | null
    deletedMs: number
    updatedMs: number
  }

  const MARKS: Record<Kind, (of: Referred) => Promise<Marks[]>> = {
    customer: ({ customerId }) =>
      db
        .select({
          deletedAt: customers.deletedAt,
          deletedMs: epochMs(customers.deletedAt),
          updatedMs: epochMs(customers.updatedAt),
        })
        .from(customers)
        .where(eq(customers.id, customerId)),
    salon: ({ salonId }) =>
      db
        .select({
          deletedAt: salons.deletedAt,
          deletedMs: epochMs(salons.deletedAt),
          updatedMs: epochMs(salons.updatedAt),
        })
        .from(salons)
        .where(eq(salons.id, salonId)),
    service: ({ serviceId }) =>
      db
        .select({
          deletedAt: services.deletedAt,
          deletedMs: epochMs(services.deletedAt),
          updatedMs: epochMs(services.updatedAt),
        })
        .from(services)
        .where(eq(services.id, serviceId)),
    'staff member': ({ staffId }) =>
      db
        .select({
          deletedAt: staff.deletedAt,
          deletedMs: epochMs(staff.deletedAt),
          updatedMs: epochMs(staff.updatedAt),
        })
        .from(staff)
        .where(eq(staff.id, staffId)),
  }

  const marksOf = async (kind: Kind, of: Referred = ours): Promise<Marks> => {
    const [row] = await MARKS[kind](of)
    if (row === undefined) {
      throw new Error(`The ${kind} is not stored`)
    }
    return row
  }

  const isDeleted = async (kind: Kind, of: Referred = ours): Promise<boolean> =>
    (await marksOf(kind, of)).deletedAt !== null

  /** Which of the four things of the test are deleted. */
  const deletedAmongOurs = async (): Promise<Kind[]> => {
    const deleted: Kind[] = []
    for (const kind of KINDS) {
      if (await isDeleted(kind)) {
        deleted.push(kind)
      }
    }
    return deleted
  }

  /** Everything a delete could write, as it is stored. */
  const everything = async () => ({
    customers: await db.select().from(customers).orderBy(asc(customers.id)),
    salons: await db.select().from(salons).orderBy(asc(salons.id)),
    staff: await db.select().from(staff).orderBy(asc(staff.id)),
    services: await db.select().from(services).orderBy(asc(services.id)),
    bookings: await db.select().from(bookings).orderBy(asc(bookings.id)),
    lines: await db
      .select()
      .from(bookingServices)
      .orderBy(asc(bookingServices.id)),
    accounts: await db
      .select({
        id: users.id,
        customerId: users.customerId,
        staffId: users.staffId,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .orderBy(asc(users.id)),
  })

  /**
   * Holds a row the way an entry of a booking holds what it refers to: the
   * salon, the customer and the service shared, the staff member alone.
   */
  const HOLDS: Record<
    Kind,
    (tx: Transaction, of: Referred) => Promise<unknown>
  > = {
    customer: (tx, { customerId }) =>
      tx
        .select({ id: customers.id })
        .from(customers)
        .where(eq(customers.id, customerId))
        .for('share'),
    salon: (tx, { salonId }) =>
      tx
        .select({ id: salons.id })
        .from(salons)
        .where(eq(salons.id, salonId))
        .for('share'),
    service: (tx, { serviceId }) =>
      tx
        .select({ id: services.id })
        .from(services)
        .where(eq(services.id, serviceId))
        .for('share'),
    'staff member': (tx, { staffId }) =>
      tx
        .select({ id: staff.id })
        .from(staff)
        .where(eq(staff.id, staffId))
        .for('update'),
  }

  /** The clock the deletes write by, in milliseconds. */
  const databaseClock = async (): Promise<number> => {
    const [row] = await getTestDbClient()<{ now: number }[]>`
      SELECT (extract(epoch from clock_timestamp()) * 1000)::float8 AS now
    `
    if (row === undefined) {
      throw new Error('The database did not tell the time')
    }
    return row.now
  }

  /**
   * A booking that is not finished and refers to another one of a kind,
   * and to what the test has in whatever else it can.
   */
  const ELSEWHERE: Record<Kind, () => Promise<string>> = {
    customer: async () =>
      insertBooking({ booking: { customerId: await insertCustomer(db) } }),
    salon: async () =>
      insertBooking({
        of: { ...(await referred()), customerId: ours.customerId },
      }),
    service: async () =>
      insertBooking({
        lines: [{ serviceId: await insertService(ours.salonId) }],
      }),
    'staff member': async () => {
      const other = await staffOf(ours.salonId)
      return insertBooking({
        booking: { staffId: other },
        lines: [{ staffId: other }],
      })
    },
  }

  describe.each(KINDS)('the %s of a booking', (kind) => {
    it.each(UNFINISHED)(
      'is not deleted while the booking is %s, and nothing is written',
      async (status) => {
        await bookingIn(status)
        const before = await everything()

        const response = await remove(kind)

        expectProblem(response, notAllowed)
        expect(response.body.detail).toBe(refusalOf(kind))
        expect(await everything()).toEqual(before)
      },
    )

    it.each(FINISHED)(
      'is deleted when the booking is %s, and nothing else is',
      async (status) => {
        await bookingIn(status)

        const response = await remove(kind)

        expect(response.status).toBe(204)
        expect(response.text).toBe('')
        expect(await deletedAmongOurs()).toEqual([kind])
      },
    )

    it('is not deleted when one of several bookings is not finished', async () => {
      await bookingIn('completed')
      await bookingIn('cancelled')
      await bookingIn('in_progress')
      await bookingIn('no_show')

      expectProblem(await remove(kind), notAllowed)
      expect(await deletedAmongOurs()).toEqual([])
    })

    it('is deleted when every one of several bookings is finished', async () => {
      await bookingIn('completed')
      await bookingIn('cancelled')
      await bookingIn('no_show')

      expect((await remove(kind)).status).toBe(204)
      expect(await deletedAmongOurs()).toEqual([kind])
    })

    it('is deleted while a booking that is not finished refers to another one, and its own are finished', async () => {
      await bookingIn('completed')
      await ELSEWHERE[kind]()

      expect((await remove(kind)).status).toBe(204)
      expect(await deletedAmongOurs()).toEqual([kind])
    })

    it('is deleted once the booking is cancelled', async () => {
      const id = await entered()
      expectProblem(await remove(kind), notAllowed)

      const cancelled = await act(id, 'cancel', { cancellationReason: null })
      const response = await remove(kind)

      expect([cancelled.status, response.status]).toEqual([200, 204])
      expect(await deletedAmongOurs()).toEqual([kind])
    })

    it('is deleted once the visit is completed', async () => {
      const id = await entered()
      const confirmed = await act(id, 'confirm')
      expectProblem(await remove(kind), notAllowed)

      const completed = await act(id, 'complete', {
        actualStartTime: null,
        actualEndTime: null,
      })
      const response = await remove(kind)

      expect([confirmed.status, completed.status, response.status]).toEqual([
        200, 200, 204,
      ])
      expect(await deletedAmongOurs()).toEqual([kind])
    })

    it('is deleted once the booking is removed from the ledger', async () => {
      const id = await entered()
      expectProblem(await remove(kind), notAllowed)

      const removed = await authorized(
        request(app).delete(`${BOOKINGS}/${id}`),
        asAdmin,
      )
      const response = await remove(kind)

      expect([removed.status, response.status]).toEqual([204, 204])
      expect(await deletedAmongOurs()).toEqual([kind])
    })

    it('is refused to a staff account of the salon before the bookings are looked at', async () => {
      await bookingIn('pending')
      const { authorization } = await member('staff')

      const response = await remove(kind, ours, authorization)

      expectProblem(response, forbidden)
      expect(await deletedAmongOurs()).toEqual([])
    })

    describe('requests at the same moment', () => {
      it('waits for an entry of a booking that holds it, then finds the booking', async () => {
        const { pending } = await db.transaction(async (tx) => {
          await HOLDS[kind](tx, ours)
          await insertBooking({ executor: tx })
          const underWay = remove(kind).then((response) => response)
          await pause(300)

          return { pending: underWay }
        })
        const response = await pending

        expectProblem(response, notAllowed)
        expect(await deletedAmongOurs()).toEqual([])
      })

      it('waits for an entry of a booking that holds it, then deletes when the entry is given up', async () => {
        const held: { pending: Promise<Response> | null } = { pending: null }

        await expect(
          db.transaction(async (tx) => {
            await HOLDS[kind](tx, ours)
            await insertBooking({ executor: tx })
            held.pending = remove(kind).then((response) => response)
            await pause(300)
            throw new Error('given up')
          }),
        ).rejects.toThrow('given up')
        const response = await held.pending

        expect(response?.status).toBe(204)
        expect(await deletedAmongOurs()).toEqual([kind])
      })

      it('writes the moment it got hold of the row, not the one it began to wait at', async () => {
        const { pending, released } = await db.transaction(async (tx) => {
          await HOLDS[kind](tx, ours)
          const underWay = remove(kind).then((response) => response)
          await pause(300)

          return { pending: underWay, released: await databaseClock() }
        })
        const response = await pending

        expect(response.status).toBe(204)
        const marks = await marksOf(kind)
        expect(marks.deletedMs).toBeGreaterThanOrEqual(released)
        expect(marks.updatedMs).toBeGreaterThanOrEqual(released)
      })

      it('never leaves a booking that is not finished with what was deleted, when an entry and the delete come together', async () => {
        for (let round = 0; round < 6; round += 1) {
          const of = await referred()

          const [entry, deletion] = await Promise.all([
            enter(of),
            remove(kind, of),
          ])

          expect([
            statusAndCode(entry),
            statusAndCode(deletion),
            await db.$count(bookings, eq(bookings.salonId, of.salonId)),
            await isDeleted(kind, of),
          ]).toEqual(
            entry.status === 201
              ? ['201', '409 3003', 1, false]
              : ['400 2001', '204', 0, true],
          )
        }
      })
    })
  })

  describe('a customer', () => {
    it('is not deleted while a booking in another salon is not finished, also by a manager who does not see that booking', async () => {
      const elsewhere = await referred()
      await insertBooking({
        of: { ...elsewhere, customerId: ours.customerId },
      })
      const { authorization } = await member('manager')

      const response = await remove('customer', ours, authorization)

      expectProblem(response, notAllowed)
      expect(response.body.detail).toBe(refusalOf('customer'))
      expect(await isDeleted('customer')).toBe(false)
    })

    it('keeps its account while it is not deleted, and loses it when it is', async () => {
      const account = await insertUser(db, { customerId: ours.customerId })
      const id = await bookingIn('confirmed')
      const profileOf = async (): Promise<string | null | undefined> => {
        const [row] = await db
          .select({ customerId: users.customerId })
          .from(users)
          .where(eq(users.id, account.id))
        return row?.customerId
      }

      expectProblem(await remove('customer'), notAllowed)
      const whileRefused = await profileOf()
      await db
        .update(bookings)
        .set(inStatus('no_show'))
        .where(eq(bookings.id, id))
      const response = await remove('customer')

      expect(whileRefused).toBe(ours.customerId)
      expect(response.status).toBe(204)
      expect(await profileOf()).toBeNull()
    })

    it('writes the moment it got hold of the customer to the account it leaves', async () => {
      const account = await insertUser(db, { customerId: ours.customerId })

      const { pending, released } = await db.transaction(async (tx) => {
        await HOLDS.customer(tx, ours)
        const underWay = remove('customer').then((response) => response)
        await pause(300)

        return { pending: underWay, released: await databaseClock() }
      })
      const response = await pending

      expect(response.status).toBe(204)
      const [row] = await db
        .select({ updatedMs: epochMs(users.updatedAt) })
        .from(users)
        .where(eq(users.id, account.id))
      expect(row?.updatedMs).toBeGreaterThanOrEqual(released)
    })

    it('is counted for the visit and is deleted or stays, when the completion of its booking and its delete come together', async () => {
      for (let round = 0; round < 6; round += 1) {
        const of = await referred()
        const id = await entered(of)
        await act(id, 'confirm')

        const [completion, deletion] = await Promise.all([
          act(id, 'complete', { actualStartTime: null, actualEndTime: null }),
          remove('customer', of),
        ])

        const [row] = await db
          .select({ visitCount: customers.visitCount })
          .from(customers)
          .where(eq(customers.id, of.customerId))
        expect(statusAndCode(completion)).toBe('200')
        expect(['204', '409 3003']).toContain(statusAndCode(deletion))
        expect(row?.visitCount).toBe(1)
        expect(await isDeleted('customer', of)).toBe(deletion.status === 204)
      }
    })
  })

  describe('a staff member', () => {
    it('is not deleted while in charge of a booking that is not finished, without doing any of its lines', async () => {
      const other = await staffOf(ours.salonId)
      await insertBooking({ lines: [{ staffId: other }, { staffId: null }] })

      const response = await remove('staff member')

      expectProblem(response, notAllowed)
      expect(response.body.detail).toBe(refusalOf('staff member'))
      expect(await isDeleted('staff member')).toBe(false)
    })

    it('is not deleted while doing a line of a booking that is not finished and that another one is in charge of', async () => {
      const other = await staffOf(ours.salonId)
      await insertBooking({
        booking: { staffId: other },
        lines: [{ staffId: other }, { staffId: null }, {}],
      })

      const response = await remove('staff member')

      expectProblem(response, notAllowed)
      expect(response.body.detail).toBe(refusalOf('staff member'))
      expect(await isDeleted('staff member')).toBe(false)
    })

    it('is deleted when the lines it does are of finished bookings, while others have bookings that are not', async () => {
      const other = await staffOf(ours.salonId)
      await insertBooking({
        booking: { ...inStatus('completed'), staffId: other },
        lines: [{ staffId: other }, {}],
      })
      await insertBooking({
        booking: { staffId: other },
        lines: [{ staffId: other }],
      })

      expect((await remove('staff member')).status).toBe(204)
      expect(await deletedAmongOurs()).toEqual(['staff member'])
    })

    it('is deleted once its booking is moved to another staff member, who is not', async () => {
      const other = await staffOf(ours.salonId)
      const id = await entered()
      expectProblem(await remove('staff member'), notAllowed)

      const moved = await moveTo(id, other)
      const response = await remove('staff member')
      const stays = await remove('staff member', { ...ours, staffId: other })

      expect([moved.status, response.status]).toEqual([200, 204])
      expect(await isDeleted('staff member')).toBe(true)
      expectProblem(stays, notAllowed)
    })

    it('is told that nobody deletes their own record before the bookings are looked at', async () => {
      const owner = await member('owner')
      const own = { ...ours, staffId: owner.staffId }
      await insertBooking({ of: own })

      const response = await remove('staff member', own, owner.authorization)

      expectProblem(response, notAllowed)
      expect(response.body.detail).toBe(
        'You cannot delete your own staff record',
      )
    })

    it('is not found under another salon, whatever bookings it has', async () => {
      const elsewhere = await referred()
      await bookingIn('pending')

      const response = await remove('staff member', {
        ...ours,
        salonId: elsewhere.salonId,
      })

      expectProblem(response, notFound)
      expect(await isDeleted('staff member')).toBe(false)
    })

    it('is deleted or gets the booking, never both, when a move to it and its delete come together', async () => {
      for (let round = 0; round < 6; round += 1) {
        const of = await referred()
        const other = await staffOf(of.salonId)
        const id = await entered({ ...of, staffId: other })

        const [move, deletion] = await Promise.all([
          moveTo(id, of.staffId),
          remove('staff member', of),
        ])

        const [row] = await db
          .select({ staffId: bookings.staffId })
          .from(bookings)
          .where(eq(bookings.id, id))
        expect([
          statusAndCode(move),
          statusAndCode(deletion),
          row?.staffId,
          await isDeleted('staff member', of),
        ]).toEqual(
          move.status === 200
            ? ['200', '409 3003', of.staffId, false]
            : ['400 2001', '204', other, true],
        )
      }
    })
  })

  describe('a service', () => {
    it('is not deleted while a later line of a booking that is not finished has it', async () => {
      const other = await insertService(ours.salonId)
      await insertBooking({ lines: [{ serviceId: other }, {}] })

      const response = await remove('service')

      expectProblem(response, notAllowed)
      expect(response.body.detail).toBe(refusalOf('service'))
      expect(await isDeleted('service')).toBe(false)
    })

    it('is deleted when the lines that have it are of finished bookings, while bookings of other services are not', async () => {
      const other = await insertService(ours.salonId)
      await insertBooking({
        booking: inStatus('cancelled'),
        lines: [{ serviceId: other }, {}],
      })
      await insertBooking({ lines: [{ serviceId: other }] })

      expect((await remove('service')).status).toBe(204)
      expect(await deletedAmongOurs()).toEqual(['service'])
    })

    it('is told of the package first, when a package contains it and a booking that is not finished has it', async () => {
      await insertService(ours.salonId, {
        name: 'Cut and colour',
        isPackage: true,
        packageServiceIds: [
          ours.serviceId,
          await insertService(ours.salonId, { name: 'Colour' }),
        ],
      })
      await bookingIn('pending')

      const response = await remove('service')

      expectProblem(response, notAllowed)
      expect(response.body.detail).toBe(
        'The service is part of a package and has to leave it first',
      )
      expect(await isDeleted('service')).toBe(false)
    })

    it('is not found under another salon, whatever bookings it has', async () => {
      const elsewhere = await referred()
      await bookingIn('pending')

      const response = await remove('service', {
        ...ours,
        salonId: elsewhere.salonId,
      })

      expectProblem(response, notFound)
      expect(await isDeleted('service')).toBe(false)
    })
  })

  describe('a salon', () => {
    it('is not deleted by its owner either, while one of its bookings is not finished', async () => {
      await bookingIn('draft')
      const { authorization } = await member('owner')

      const response = await remove('salon', ours, authorization)

      expectProblem(response, notAllowed)
      expect(response.body.detail).toBe(refusalOf('salon'))
      expect(await isDeleted('salon')).toBe(false)
    })
  })
})
