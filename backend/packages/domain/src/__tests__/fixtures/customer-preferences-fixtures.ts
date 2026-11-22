import { Result } from '@beauty-salon-backend/utility'
import { vi } from 'vitest'
import type { CustomerPreferencesUseCaseDependencies } from '../../business-logic/customer-preferences'
import type { CustomerId } from '../../models/customer'
import type {
  ApiCustomerPreferencesResponse,
  ApiCustomerPreferencesUpdateRequest,
  DbCustomerPreferences,
  DbCustomerPreferencesChanges,
} from '../../models/customer-preferences'
import type {
  CustomerPreferencesLookup,
  CustomerPreferencesUpdate,
  ICustomerPreferencesRepository,
} from '../../repositories/customer-preferences.repository'

/** The staff member the customer of the fixtures prefers. */
export const PREFERRED_STAFF_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f1d01'

/** The staff member the customer of the fixtures avoids. */
export const AVOIDED_STAFF_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f1d02'

/** A staff member the preferences of the fixtures do not name. */
export const UNNAMED_STAFF_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f1d03'

/** The preferences of a customer who has stated every one, as the driver returns the columns. */
export const dbCustomerPreferences = (
  overrides: DbCustomerPreferencesChanges = {},
): DbCustomerPreferences => ({
  preferredStaffId: PREFERRED_STAFF_ID,
  preferredTimeSlots: [
    { startTime: '10:00', endTime: '12:00' },
    { startTime: '18:00', endTime: '20:30' },
  ],
  avoidStaffIds: [AVOIDED_STAFF_ID],
  stylePreferences: {
    preferredLength: 'ショート',
    preferredColors: ['アッシュ', 'ブラウン'],
    avoidStyles: ['パーマ'],
    inspirationImages: ['https://images.example.com/short.jpg'],
  },
  communicationStyle: '静かに過ごしたい',
  specialRequests: 'ドリンクは不要です',
  ...overrides,
})

/** The preferences of a customer who has no row. */
export const emptyCustomerPreferences = (): DbCustomerPreferences => ({
  preferredStaffId: null,
  preferredTimeSlots: [],
  avoidStaffIds: [],
  stylePreferences: null,
  communicationStyle: null,
  specialRequests: null,
})

/** The columns above as the API presents them: the same properties with the same values. */
export const apiCustomerPreferences = (
  overrides: Partial<ApiCustomerPreferencesResponse> = {},
): ApiCustomerPreferencesResponse => ({
  preferredStaffId: PREFERRED_STAFF_ID,
  preferredTimeSlots: [
    { startTime: '10:00', endTime: '12:00' },
    { startTime: '18:00', endTime: '20:30' },
  ],
  avoidStaffIds: [AVOIDED_STAFF_ID],
  stylePreferences: {
    preferredLength: 'ショート',
    preferredColors: ['アッシュ', 'ブラウン'],
    avoidStyles: ['パーマ'],
    inspirationImages: ['https://images.example.com/short.jpg'],
  },
  communicationStyle: '静かに過ごしたい',
  specialRequests: 'ドリンクは不要です',
  ...overrides,
})

/** A request that states every property, each with a value the rules allow. */
export const customerPreferencesUpdateRequest =
  (): Required<ApiCustomerPreferencesUpdateRequest> => ({
    preferredStaffId: PREFERRED_STAFF_ID,
    preferredTimeSlots: [
      { startTime: '09:00', endTime: '11:00' },
      { startTime: '11:00', endTime: '13:30' },
    ],
    avoidStaffIds: [AVOIDED_STAFF_ID, UNNAMED_STAFF_ID],
    stylePreferences: {
      preferredLength: 'ボブ',
      preferredColors: ['ベージュ'],
      avoidStyles: [],
      inspirationImages: [
        'https://images.example.com/bob.jpg',
        'http://images.example.com/bob-2.jpg',
      ],
    },
    communicationStyle: 'よく話したい',
    specialRequests: '香りの強い薬剤は避けてください',
  })

/**
 * Everything the customer preferences use cases need: a repository that
 * holds the preferences above for every customer and returns them with what
 * an update changed; a test overrides what it needs.
 */
export const customerPreferencesDependencies = (
  overrides: Partial<ICustomerPreferencesRepository> = {},
): CustomerPreferencesUseCaseDependencies => ({
  customerPreferencesRepository: {
    findByCustomerId: vi.fn(async () =>
      Result.success<CustomerPreferencesLookup>({
        type: 'found',
        preferences: dbCustomerPreferences(),
      }),
    ),
    update: vi.fn(
      async (_customerId: CustomerId, changes: DbCustomerPreferencesChanges) =>
        Result.success<CustomerPreferencesUpdate>({
          type: 'updated',
          preferences: dbCustomerPreferences(changes),
        }),
    ),
    ...overrides,
  },
})

/** The methods of the repository that were called, in the order of the calls. */
export const customerPreferencesRepositoryCalls = ({
  customerPreferencesRepository,
}: CustomerPreferencesUseCaseDependencies): string[] =>
  [
    ...vi
      .mocked(customerPreferencesRepository.findByCustomerId)
      .mock.invocationCallOrder.map((order) => ({
        order,
        name: 'findByCustomerId',
      })),
    ...vi
      .mocked(customerPreferencesRepository.update)
      .mock.invocationCallOrder.map((order) => ({ order, name: 'update' })),
  ]
    .toSorted((a, b) => a.order - b.order)
    .map(({ name }) => name)
