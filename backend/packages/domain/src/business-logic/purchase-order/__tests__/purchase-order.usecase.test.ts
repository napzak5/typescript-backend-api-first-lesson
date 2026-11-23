import { Result } from '@beauty-salon-backend/utility'
import { purchaseOrderMessages } from '@beauty-salon-shared/i18n/messages/api'
import { describe, expect, it, vi } from 'vitest'
import { actors, STAFF_ID } from '../../../__tests__/fixtures/auth-fixtures'
import {
  brokenRules,
  MADE_UP_MESSAGE,
  OTHER_SALON_ID,
  SALON_ID,
} from '../../../__tests__/fixtures/fixtures'
import {
  INVENTORY_ID,
  OTHER_INVENTORY_ID,
} from '../../../__tests__/fixtures/inventory-fixtures'
import {
  OTHER_PURCHASE_ORDER_ID,
  PURCHASE_ORDER_ID,
  purchaseOrderCreateRequest,
  purchaseOrderDependencies,
  storedPurchaseOrder,
} from '../../../__tests__/fixtures/purchase-order-fixtures'
import type { Actor } from '../../../models/auth'
import type {
  IPurchaseOrderRepository,
  PurchaseOrderChange,
  PurchaseOrderCreation,
  PurchaseOrderListing,
} from '../../../repositories/purchase-order.repository'
import { type DomainError, DomainErrors } from '../../../shared'
import {
  ApprovePurchaseOrderUseCase,
  CancelPurchaseOrderUseCase,
  CreatePurchaseOrderUseCase,
  GetPurchaseOrderUseCase,
  ListPurchaseOrdersUseCase,
  type PurchaseOrderUseCaseDependencies,
  UpdatePurchaseOrderUseCase,
} from '..'

const databaseDown = Result.error(
  DomainErrors.database('Connection lost', null),
)
const forbidden = Result.error(DomainErrors.forbidden())

/** The broken rules of a failed result, as `field:rule`; empty for a success. */
const rulesOf = (result: Result<unknown, DomainError>): string[] =>
  result.type === 'error' ? brokenRules(result.error) : []

/** Whether no repository was asked anything. */
const untouched = ({
  purchaseOrderRepository,
  salonRepository,
}: PurchaseOrderUseCaseDependencies): boolean =>
  [
    ...Object.values(purchaseOrderRepository),
    ...Object.values(salonRepository),
  ].every((method) => vi.mocked(method).mock.calls.length === 0)

/** Every member of the salon of the fixtures. */
const members: [string, Actor][] = [
  ['an owner', actors.ofSalon('owner')],
  ['a manager', actors.ofSalon('manager')],
  ['a staff member', actors.ofSalon('staff')],
]

/** Actors who reach no orders at all. */
const outsiders: [string, Actor][] = [
  ['a customer', actors.customer],
  ['a customer account without a profile', actors.customerWithoutProfile],
  ['an account of no scope', actors.withoutScope],
]

/** Actors who neither approve nor cancel. */
const nonApprovers: [string, Actor][] = [
  ['a staff member', actors.ofSalon('staff')],
  ...outsiders,
]

const changedTo = (
  overrides: Parameters<typeof storedPurchaseOrder>[0],
): Result<PurchaseOrderChange, never> =>
  Result.success({ type: 'changed', order: storedPurchaseOrder(overrides) })

const refused = (
  refusal: PurchaseOrderChange,
): (() => Promise<Result<PurchaseOrderChange, never>>) =>
  vi.fn(async () => Result.success(refusal))

describe('ListPurchaseOrdersUseCase', () => {
  const list = (
    dependencies: PurchaseOrderUseCaseDependencies,
    actor: Actor = actors.admin,
    query: Result<unknown, DomainError> = Result.success({}),
  ) => new ListPurchaseOrdersUseCase(dependencies).execute(actor, query)

  it('lists the orders of every salon for an administrator, 20 to a page', async () => {
    const dependencies = purchaseOrderDependencies()

    const result = await list(dependencies)

    expect(result).toMatchObject({
      type: 'success',
      data: {
        data: [{ id: PURCHASE_ORDER_ID, items: [{}, {}] }],
        meta: {
          total: 1,
          limit: 20,
          hasMore: false,
          cursor: null,
          nextCursor: null,
          prevCursor: null,
        },
      },
    })
    expect(dependencies.purchaseOrderRepository.list).toHaveBeenCalledWith({
      reach: { type: 'everySalon' },
      limit: 20,
      after: null,
      salonId: null,
      status: null,
      supplier: null,
      startDate: null,
      endDate: null,
    })
  })

  it.each(members)(
    'lists the orders of the salon for %s',
    async (_who, actor) => {
      const dependencies = purchaseOrderDependencies()

      await list(dependencies, actor)

      expect(dependencies.purchaseOrderRepository.list).toHaveBeenCalledWith(
        expect.objectContaining({
          reach: { type: 'salon', salonId: SALON_ID },
        }),
      )
    },
  )

  it('passes every filter, the moments to the millisecond, and points to the next page from the last order of the page', async () => {
    const dependencies = purchaseOrderDependencies({
      list: vi.fn(async () =>
        Result.success<PurchaseOrderListing>({
          type: 'listed',
          orders: [
            storedPurchaseOrder({ id: OTHER_PURCHASE_ORDER_ID }),
            storedPurchaseOrder(),
          ],
          total: 3,
          hasMore: true,
        }),
      ),
    })

    const result = await list(
      dependencies,
      actors.ofSalon('staff'),
      Result.success({
        limit: 2,
        cursor: OTHER_PURCHASE_ORDER_ID,
        salonId: SALON_ID,
        status: 'pending',
        supplier: 'Beauty Supply Tokyo',
        startDate: '2026-11-01T00:00:00Z',
        endDate: '2026-11-30T23:59:59.999Z',
      }),
    )

    expect(dependencies.purchaseOrderRepository.list).toHaveBeenCalledWith({
      reach: { type: 'salon', salonId: SALON_ID },
      limit: 2,
      after: OTHER_PURCHASE_ORDER_ID,
      salonId: SALON_ID,
      status: 'pending',
      supplier: 'Beauty Supply Tokyo',
      startDate: '2026-11-01T00:00:00.000Z',
      endDate: '2026-11-30T23:59:59.999Z',
    })
    expect(result).toMatchObject({
      type: 'success',
      data: {
        meta: {
          total: 3,
          limit: 2,
          hasMore: true,
          cursor: OTHER_PURCHASE_ORDER_ID,
          nextCursor: PURCHASE_ORDER_ID,
        },
      },
    })
  })

  it.each(outsiders)(
    'refuses %s before the query is looked at',
    async (_who, actor) => {
      const dependencies = purchaseOrderDependencies()

      const result = await list(
        dependencies,
        actor,
        Result.error(DomainErrors.validation('Bad query', [])),
      )

      expect(result).toEqual(forbidden)
      expect(untouched(dependencies)).toBe(true)
    },
  )

  it('refuses a member of a salon who names another salon', async () => {
    const dependencies = purchaseOrderDependencies()

    const result = await list(
      dependencies,
      actors.ofSalon('owner'),
      Result.success({ salonId: OTHER_SALON_ID }),
    )

    expect(result).toEqual(forbidden)
    expect(untouched(dependencies)).toBe(true)
  })

  it('passes on a query the caller could not decode, and refuses one that breaks a rule', async () => {
    const undecoded = Result.error(
      DomainErrors.validation('Invalid query', [
        { field: 'limit', rule: 'invalid_type', message: MADE_UP_MESSAGE },
      ]),
    )
    const dependencies = purchaseOrderDependencies()

    expect(await list(dependencies, actors.admin, undecoded)).toEqual(undecoded)
    expect(
      rulesOf(
        await list(
          dependencies,
          actors.admin,
          Result.success({
            startDate: '2026-11-02T00:00:00Z',
            endDate: '2026-11-01T00:00:00Z',
          }),
        ),
      ),
    ).toEqual(['endDate:custom'])
    expect(untouched(dependencies)).toBe(true)
  })

  it('refuses a cursor that names no order of the list', async () => {
    const dependencies = purchaseOrderDependencies({
      list: vi.fn(async () =>
        Result.success<PurchaseOrderListing>({ type: 'cursorNotFound' }),
      ),
    })

    const result = await list(
      dependencies,
      actors.admin,
      Result.success({ cursor: OTHER_PURCHASE_ORDER_ID }),
    )

    expect(rulesOf(result)).toEqual(['cursor:not_found'])
  })

  it('passes on what the database could not do', async () => {
    const dependencies = purchaseOrderDependencies({
      list: vi.fn(async () => databaseDown),
    })

    expect(await list(dependencies)).toEqual(databaseDown)
  })
})

describe('GetPurchaseOrderUseCase', () => {
  const get = (
    dependencies: PurchaseOrderUseCaseDependencies,
    actor: Actor = actors.admin,
    id: unknown = PURCHASE_ORDER_ID,
  ) => new GetPurchaseOrderUseCase(dependencies).execute(actor, id)

  it.each([['an administrator', actors.admin], ...members])(
    'finds an order with its items for %s',
    async (_who, actor) => {
      const dependencies = purchaseOrderDependencies()

      const result = await get(dependencies, actor)

      expect(result).toMatchObject({
        type: 'success',
        data: { id: PURCHASE_ORDER_ID, status: 'pending', items: [{}, {}] },
      })
      expect(
        dependencies.purchaseOrderRepository.findById,
      ).toHaveBeenCalledWith(
        actor === actors.admin
          ? { type: 'everySalon' }
          : { type: 'salon', salonId: SALON_ID },
        PURCHASE_ORDER_ID,
      )
    },
  )

  it.each(outsiders)(
    'refuses %s before the ID is looked at',
    async (_who, actor) => {
      const dependencies = purchaseOrderDependencies()

      expect(await get(dependencies, actor, 'not-an-id')).toEqual(forbidden)
      expect(untouched(dependencies)).toBe(true)
    },
  )

  it('refuses an ID that is no UUID', async () => {
    const dependencies = purchaseOrderDependencies()

    const result = await get(dependencies, actors.admin, 'PO-1')

    expect(result).toMatchObject({
      type: 'error',
      error: {
        type: 'validation',
        message: purchaseOrderMessages.invalidPurchaseOrderId,
      },
    })
    expect(rulesOf(result)).toEqual(['id:invalid_format'])
    expect(untouched(dependencies)).toBe(true)
  })

  it('does not find an order that is not there, or not within the reach', async () => {
    const dependencies = purchaseOrderDependencies({
      findById: vi.fn(async () => Result.success(null)),
    })

    expect(await get(dependencies)).toEqual(
      Result.error(DomainErrors.notFound('PurchaseOrder', PURCHASE_ORDER_ID)),
    )
  })

  it('passes on what the database could not do', async () => {
    const dependencies = purchaseOrderDependencies({
      findById: vi.fn(async () => databaseDown),
    })

    expect(await get(dependencies)).toEqual(databaseDown)
  })
})

describe('CreatePurchaseOrderUseCase', () => {
  const create = (
    dependencies: PurchaseOrderUseCaseDependencies,
    actor: Actor = actors.admin,
    input: unknown = purchaseOrderCreateRequest(),
  ) => new CreatePurchaseOrderUseCase(dependencies).execute(actor, input)

  it('drafts an order for an administrator under a number of the issuer, with its amounts, by no staff member', async () => {
    const dependencies = purchaseOrderDependencies()

    const result = await create(dependencies)

    expect(result).toMatchObject({
      type: 'success',
      data: { id: PURCHASE_ORDER_ID, status: 'draft' },
    })
    expect(dependencies.purchaseOrderRepository.create).toHaveBeenCalledWith({
      order: {
        salonId: SALON_ID,
        supplier: 'Beauty Supply Tokyo',
        subtotal: 22498,
        taxAmount: 2250,
        shippingCost: 800,
        totalAmount: 25548,
        expectedDelivery: '2026-11-21T01:00:00.000Z',
        paymentTerms: '月末締め翌月末払い',
        notes: '定期補充',
        createdBy: null,
      },
      items: [
        {
          inventoryId: INVENTORY_ID,
          quantity: '10.00',
          unitPrice: 1500,
          totalPrice: 15000,
          notes: null,
        },
        {
          inventoryId: OTHER_INVENTORY_ID,
          quantity: '2.50',
          unitPrice: 2999,
          totalPrice: 7498,
          notes: '至急',
        },
      ],
      orderNumber: 'PO-0000-0001',
    })
    expect(dependencies.salonRepository.exists).toHaveBeenCalledWith(SALON_ID)
  })

  it.each(members)(
    'drafts an order of the salon for %s, as the staff member',
    async (_who, actor) => {
      const dependencies = purchaseOrderDependencies()

      await create(dependencies, actor)

      expect(dependencies.purchaseOrderRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          order: expect.objectContaining({ createdBy: STAFF_ID }),
        }),
      )
    },
  )

  it('tries another number when another order has the one drafted', async () => {
    const create_ = vi
      .fn<IPurchaseOrderRepository['create']>()
      .mockResolvedValueOnce(Result.success({ type: 'orderNumberTaken' }))
      .mockResolvedValueOnce(
        Result.success({ type: 'created', order: storedPurchaseOrder() }),
      )
    const dependencies = purchaseOrderDependencies({ create: create_ })

    const result = await create(dependencies)

    expect(result.type).toBe('success')
    expect(
      create_.mock.calls.map(([criteria]) => criteria.orderNumber),
    ).toEqual(['PO-0000-0001', 'PO-0000-0002'])
  })

  it('gives up after three numbers that are taken', async () => {
    const dependencies = purchaseOrderDependencies({
      create: vi.fn(async () =>
        Result.success<PurchaseOrderCreation>({ type: 'orderNumberTaken' }),
      ),
    })

    expect(await create(dependencies)).toMatchObject({
      type: 'error',
      error: {
        type: 'database',
        message:
          'No purchase order number that is free was found in 3 attempts',
      },
    })
    expect(dependencies.purchaseOrderRepository.create).toHaveBeenCalledTimes(3)
  })

  it('refuses the items whose stock rows are not of the salon, each of them', async () => {
    const dependencies = purchaseOrderDependencies({
      create: vi.fn(async () =>
        Result.success<PurchaseOrderCreation>({
          type: 'rowsNotFound',
          indexes: [0, 1],
        }),
      ),
    })

    expect(rulesOf(await create(dependencies))).toEqual([
      'items.0.inventoryId:not_found',
      'items.1.inventoryId:not_found',
    ])
  })

  it.each(outsiders)(
    'refuses %s before the request is read',
    async (_who, actor) => {
      const dependencies = purchaseOrderDependencies()

      expect(await create(dependencies, actor, null)).toEqual(forbidden)
      expect(untouched(dependencies)).toBe(true)
    },
  )

  it('refuses a request that breaks a rule before anything is looked up', async () => {
    const dependencies = purchaseOrderDependencies()

    const result = await create(
      dependencies,
      actors.admin,
      purchaseOrderCreateRequest({ supplier: ' ', items: [] }),
    )

    expect(rulesOf(result)).toEqual([
      'supplier:invalid_format',
      'items:too_small',
    ])
    expect(untouched(dependencies)).toBe(true)
  })

  it('refuses a member of a salon who orders for another salon, before the salon is looked up', async () => {
    const dependencies = purchaseOrderDependencies()

    const result = await create(
      dependencies,
      actors.ofSalon('staff'),
      purchaseOrderCreateRequest({ salonId: OTHER_SALON_ID }),
    )

    expect(result).toEqual(forbidden)
    expect(untouched(dependencies)).toBe(true)
  })

  it('refuses a salon that is not there, as a property of the request', async () => {
    const dependencies = purchaseOrderDependencies(
      {},
      { exists: vi.fn(async () => Result.success(false)) },
    )

    expect(rulesOf(await create(dependencies))).toEqual(['salonId:not_found'])
    expect(dependencies.purchaseOrderRepository.create).not.toHaveBeenCalled()
  })

  it('passes on what the database could not do, of the salon or of the order', async () => {
    expect(
      await create(
        purchaseOrderDependencies(
          {},
          { exists: vi.fn(async () => databaseDown) },
        ),
      ),
    ).toEqual(databaseDown)
    expect(
      await create(
        purchaseOrderDependencies({ create: vi.fn(async () => databaseDown) }),
      ),
    ).toEqual(databaseDown)
  })
})

describe('UpdatePurchaseOrderUseCase', () => {
  const update = (
    dependencies: PurchaseOrderUseCaseDependencies,
    actor: Actor = actors.admin,
    id: unknown = PURCHASE_ORDER_ID,
    input: unknown = { status: 'pending' },
  ) => new UpdatePurchaseOrderUseCase(dependencies).execute(actor, id, input)

  it.each([['an administrator', actors.admin], ...members])(
    'writes what the update states for %s',
    async (_who, actor) => {
      const dependencies = purchaseOrderDependencies()

      const result = await update(dependencies, actor, PURCHASE_ORDER_ID, {
        status: 'pending',
        deliveryNotes: '午前着',
      })

      expect(result).toMatchObject({
        type: 'success',
        data: { id: PURCHASE_ORDER_ID },
      })
      expect(dependencies.purchaseOrderRepository.update).toHaveBeenCalledWith(
        actor === actors.admin
          ? { type: 'everySalon' }
          : { type: 'salon', salonId: SALON_ID },
        PURCHASE_ORDER_ID,
        { status: 'pending', deliveryNotes: '午前着' },
      )
    },
  )

  it.each(outsiders)(
    'refuses %s before the ID is looked at',
    async (_who, actor) => {
      const dependencies = purchaseOrderDependencies()

      expect(await update(dependencies, actor, 'x', null)).toEqual(forbidden)
      expect(untouched(dependencies)).toBe(true)
    },
  )

  it('refuses an ID that is no UUID before the request, and a request that breaks a rule', async () => {
    const dependencies = purchaseOrderDependencies()

    expect(rulesOf(await update(dependencies, actors.admin, 'x', {}))).toEqual([
      'id:invalid_format',
    ])
    expect(
      rulesOf(await update(dependencies, actors.admin, PURCHASE_ORDER_ID, {})),
    ).toEqual([':custom'])
    expect(
      rulesOf(
        await update(dependencies, actors.admin, PURCHASE_ORDER_ID, {
          items: [],
        }),
      ),
    ).toEqual(['items:unrecognized_keys'])
    expect(untouched(dependencies)).toBe(true)
  })

  it('does not find an order that is not there, or not within the reach', async () => {
    const dependencies = purchaseOrderDependencies({
      update: refused({ type: 'notFound' }),
    })

    expect(await update(dependencies)).toEqual(
      Result.error(DomainErrors.notFound('PurchaseOrder', PURCHASE_ORDER_ID)),
    )
  })

  it('tells why where the order stands does not take the update', async () => {
    const closed = purchaseOrderDependencies({
      update: refused({ type: 'closed', status: 'delivered' }),
    })
    const notFromStatus = purchaseOrderDependencies({
      update: refused({ type: 'notFromStatus', status: 'pending' }),
    })

    expect(await update(closed)).toEqual(
      Result.error(
        DomainErrors.conflict(
          `Purchase order ${PURCHASE_ORDER_ID} is delivered: a delivered or cancelled order does not change`,
        ),
      ),
    )
    expect(
      await update(notFromStatus, actors.admin, PURCHASE_ORDER_ID, {
        status: 'approved',
      }),
    ).toEqual(
      Result.error(
        DomainErrors.conflict(
          `Purchase order ${PURCHASE_ORDER_ID} is pending: an update moves a draft to pending, an approved order to ordered and an ordered one to shipped`,
        ),
      ),
    )
  })

  it('passes on what the database could not do', async () => {
    const dependencies = purchaseOrderDependencies({
      update: vi.fn(async () => databaseDown),
    })

    expect(await update(dependencies)).toEqual(databaseDown)
  })
})

describe('ApprovePurchaseOrderUseCase', () => {
  const approve = (
    dependencies: PurchaseOrderUseCaseDependencies,
    actor: Actor = actors.admin,
    id: unknown = PURCHASE_ORDER_ID,
  ) => new ApprovePurchaseOrderUseCase(dependencies).execute(actor, id)

  it('approves an order of any salon for an administrator, by no staff member', async () => {
    const dependencies = purchaseOrderDependencies({
      approve: vi.fn(async () =>
        changedTo({ status: 'approved', approvedAt: '2026-11-15 10:00:00+09' }),
      ),
    })

    const result = await approve(dependencies)

    expect(result).toMatchObject({
      type: 'success',
      data: { status: 'approved', approvedAt: '2026-11-15T01:00:00.000Z' },
    })
    expect(dependencies.purchaseOrderRepository.approve).toHaveBeenCalledWith(
      { type: 'everySalon' },
      PURCHASE_ORDER_ID,
      null,
    )
  })

  it.each([
    ['an owner', actors.ofSalon('owner')],
    ['a manager', actors.ofSalon('manager')],
  ])(
    'approves an order of the salon for %s, as the staff member',
    async (_who, actor) => {
      const dependencies = purchaseOrderDependencies()

      await approve(dependencies, actor)

      expect(dependencies.purchaseOrderRepository.approve).toHaveBeenCalledWith(
        { type: 'salon', salonId: SALON_ID },
        PURCHASE_ORDER_ID,
        STAFF_ID,
      )
    },
  )

  it.each(nonApprovers)(
    'refuses %s before the ID is looked at',
    async (_who, actor) => {
      const dependencies = purchaseOrderDependencies()

      expect(await approve(dependencies, actor, 'x')).toEqual(forbidden)
      expect(untouched(dependencies)).toBe(true)
    },
  )

  it('refuses an ID that is no UUID', async () => {
    const dependencies = purchaseOrderDependencies()

    expect(rulesOf(await approve(dependencies, actors.admin, 'x'))).toEqual([
      'id:invalid_format',
    ])
    expect(untouched(dependencies)).toBe(true)
  })

  it('does not find an order that is not there, and tells why one that is not pending is not approved', async () => {
    expect(
      await approve(
        purchaseOrderDependencies({ approve: refused({ type: 'notFound' }) }),
      ),
    ).toEqual(
      Result.error(DomainErrors.notFound('PurchaseOrder', PURCHASE_ORDER_ID)),
    )
    expect(
      await approve(
        purchaseOrderDependencies({
          approve: refused({ type: 'notFromStatus', status: 'approved' }),
        }),
      ),
    ).toEqual(
      Result.error(
        DomainErrors.conflict(
          `Purchase order ${PURCHASE_ORDER_ID} is approved: only a pending order is approved`,
        ),
      ),
    )
    expect(
      await approve(
        purchaseOrderDependencies({
          approve: refused({ type: 'closed', status: 'cancelled' }),
        }),
      ),
    ).toEqual(
      Result.error(
        DomainErrors.conflict(
          `Purchase order ${PURCHASE_ORDER_ID} is cancelled: a delivered or cancelled order does not change`,
        ),
      ),
    )
  })

  it('passes on what the database could not do', async () => {
    const dependencies = purchaseOrderDependencies({
      approve: vi.fn(async () => databaseDown),
    })

    expect(await approve(dependencies)).toEqual(databaseDown)
  })
})

describe('CancelPurchaseOrderUseCase', () => {
  const cancel = (
    dependencies: PurchaseOrderUseCaseDependencies,
    actor: Actor = actors.admin,
    id: unknown = PURCHASE_ORDER_ID,
    input: unknown = { cancellationReason: '仕入先の在庫切れ' },
  ) => new CancelPurchaseOrderUseCase(dependencies).execute(actor, id, input)

  it.each([
    ['an administrator', actors.admin],
    ['an owner', actors.ofSalon('owner')],
    ['a manager', actors.ofSalon('manager')],
  ])('cancels an order for the reason for %s', async (_who, actor) => {
    const dependencies = purchaseOrderDependencies({
      cancel: vi.fn(async () =>
        changedTo({
          status: 'cancelled',
          cancelledAt: '2026-11-15 10:00:00+09',
          cancellationReason: '仕入先の在庫切れ',
        }),
      ),
    })

    const result = await cancel(dependencies, actor)

    expect(result).toMatchObject({
      type: 'success',
      data: {
        status: 'cancelled',
        cancelledAt: '2026-11-15T01:00:00.000Z',
        cancellationReason: '仕入先の在庫切れ',
      },
    })
    expect(dependencies.purchaseOrderRepository.cancel).toHaveBeenCalledWith(
      actor === actors.admin
        ? { type: 'everySalon' }
        : { type: 'salon', salonId: SALON_ID },
      PURCHASE_ORDER_ID,
      '仕入先の在庫切れ',
    )
  })

  it.each(nonApprovers)(
    'refuses %s before the ID is looked at',
    async (_who, actor) => {
      const dependencies = purchaseOrderDependencies()

      expect(await cancel(dependencies, actor, 'x', null)).toEqual(forbidden)
      expect(untouched(dependencies)).toBe(true)
    },
  )

  it('refuses an ID that is no UUID before the request, and a request without a reason', async () => {
    const dependencies = purchaseOrderDependencies()

    expect(rulesOf(await cancel(dependencies, actors.admin, 'x', {}))).toEqual([
      'id:invalid_format',
    ])
    expect(
      rulesOf(
        await cancel(dependencies, actors.admin, PURCHASE_ORDER_ID, {
          cancellationReason: ' ',
        }),
      ),
    ).toEqual(['cancellationReason:invalid_format'])
    expect(untouched(dependencies)).toBe(true)
  })

  it('does not find an order that is not there, and tells why a closed one is not cancelled', async () => {
    expect(
      await cancel(
        purchaseOrderDependencies({ cancel: refused({ type: 'notFound' }) }),
      ),
    ).toEqual(
      Result.error(DomainErrors.notFound('PurchaseOrder', PURCHASE_ORDER_ID)),
    )
    expect(
      await cancel(
        purchaseOrderDependencies({
          cancel: refused({ type: 'closed', status: 'delivered' }),
        }),
      ),
    ).toEqual(
      Result.error(
        DomainErrors.conflict(
          `Purchase order ${PURCHASE_ORDER_ID} is delivered: a delivered or cancelled order does not change`,
        ),
      ),
    )
  })

  it('passes on what the database could not do', async () => {
    const dependencies = purchaseOrderDependencies({
      cancel: vi.fn(async () => databaseDown),
    })

    expect(await cancel(dependencies)).toEqual(databaseDown)
  })
})
