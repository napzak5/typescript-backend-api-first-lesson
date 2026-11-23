import type { LocalizedText } from '@beauty-salon-shared/i18n'
import {
  ruleMessages,
  salonMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { describe, expect, it } from 'vitest'
import {
  brokenRules,
  MADE_UP_HEADLINE,
  OTHER_SALON_ID,
  SALON_ID,
  salonCreateRequest,
} from '../../__tests__/fixtures/fixtures'
import { parseWith } from '../../shared'
import {
  salonCreateRequestSchema,
  salonSearchRequestSchema,
  salonUpdateRequestSchema,
  storedBusinessHoursSchema,
} from '../salon.schema'

const rulesBrokenBy = (
  schema: Parameters<typeof parseWith>[0],
  input: unknown,
): string[] => {
  const result = parseWith(schema, input, MADE_UP_HEADLINE)
  return result.type === 'error' ? brokenRules(result.error) : []
}

const openingDay = () => ({
  dayOfWeek: 'monday',
  date: '2026-11-16',
  openTime: '10:00',
  closeTime: '19:00',
  isHoliday: false,
  holidayName: null,
  notes: null,
})

const businessDay = () => ({
  dayOfWeek: 'monday',
  operatingSlots: [{ startTime: '10:00', endTime: '19:00' }],
  breakSlots: null,
  isClosed: false,
  effectivePeriod: null,
})

describe('salonCreateRequestSchema', () => {
  it('accepts a request that satisfies every rule and returns it unchanged', () => {
    const request = salonCreateRequest()

    const result = parseWith(
      salonCreateRequestSchema,
      request,
      MADE_UP_HEADLINE,
    )

    expect(result).toEqual({ type: 'success', data: request })
  })

  it('accepts null for every column that allows NULL', () => {
    const result = parseWith(
      salonCreateRequestSchema,
      {
        ...salonCreateRequest(),
        nameKana: null,
        description: null,
        postalCode: null,
        building: null,
        latitude: null,
        longitude: null,
        alternativePhone: null,
        websiteUrl: null,
        logoUrl: null,
        businessHours: null,
      },
      MADE_UP_HEADLINE,
    )

    expect(result.type).toBe('success')
  })

  it.each([
    ['a blank name', { name: '   ' }, ['name:invalid_format']],
    ['a name over 255 characters', { name: 'a'.repeat(256) }, ['name:too_big']],
    ['null for a NOT NULL column', { name: null }, ['name:invalid_type']],
    [
      'an empty text where null means unset',
      { building: '' },
      ['building:invalid_format'],
    ],
    [
      'a postal code over 10 characters',
      { postalCode: '1'.repeat(11) },
      ['postalCode:too_big'],
    ],
    ['a latitude outside ±90', { latitude: 90.1 }, ['latitude:too_big']],
    [
      'a longitude outside ±180',
      { longitude: -180.1 },
      ['longitude:too_small'],
    ],
    [
      'a phone number with letters',
      { phoneNumber: 'call-me-maybe' },
      ['phoneNumber:invalid_format', 'phoneNumber:custom'],
    ],
    [
      'a phone number under 10 digits',
      { phoneNumber: '03-1234' },
      ['phoneNumber:custom'],
    ],
    ['a malformed email', { email: 'not-an-email' }, ['email:invalid_format']],
    [
      'a website URL that is not http(s)',
      { websiteUrl: 'ftp://example.com' },
      ['websiteUrl:invalid_format'],
    ],
    [
      'an image URL that is not a URL',
      { imageUrls: ['front.jpg'] },
      ['imageUrls.0:invalid_format'],
    ],
    [
      'a blank feature tag',
      { features: ['color', ' '] },
      ['features.1:invalid_format'],
    ],
    [
      'a currency that is not three capitals',
      { currency: 'yen' },
      ['currency:invalid_format'],
    ],
    [
      'a time zone that is not known',
      { timezone: 'Mars/Olympus' },
      ['timezone:custom'],
    ],
    [
      'an offset for the time zone',
      { timezone: '+09:00' },
      ['timezone:custom'],
    ],
    ['an empty time zone', { timezone: '' }, ['timezone:custom']],
    ['a tax rate above 100', { taxRate: 100.01 }, ['taxRate:too_big']],
    [
      'a tax rate with three decimals',
      { taxRate: 10.125 },
      ['taxRate:not_multiple_of'],
    ],
    [
      'a property the client may not set',
      { rating: 5, id: SALON_ID },
      ['rating:unrecognized_keys', 'id:unrecognized_keys'],
    ],
  ])('rejects %s', (_case, change, expected) => {
    const rules = rulesBrokenBy(salonCreateRequestSchema, {
      ...salonCreateRequest(),
      ...change,
    })

    expect(rules).toEqual(expected)
  })

  it('rejects a request that leaves a property out', () => {
    const { building: _building, ...withoutBuilding } = salonCreateRequest()

    const rules = rulesBrokenBy(salonCreateRequestSchema, withoutBuilding)

    expect(rules).toEqual(['building:invalid_type'])
  })

  it('reports every broken rule at once', () => {
    const rules = rulesBrokenBy(salonCreateRequestSchema, {
      ...salonCreateRequest(),
      name: '',
      email: 'nope',
      taxRate: -1,
    })

    expect(rules).toEqual([
      'name:invalid_format',
      'email:invalid_format',
      'taxRate:too_small',
    ])
  })

  describe('openingHours', () => {
    it.each([
      [
        'a time that is not HH:mm or HH:mm:ss',
        { openTime: '10am' },
        ['openingHours.0.openTime:invalid_format'],
      ],
      [
        'a date that does not exist',
        { date: '2026-02-30' },
        ['openingHours.0.date:invalid_format'],
      ],
      [
        'a day of the week that is not the date’s',
        { dayOfWeek: 'tuesday' },
        ['openingHours.0.dayOfWeek:custom'],
      ],
      [
        'a closing time before the opening time',
        { closeTime: '09:59' },
        ['openingHours.0.closeTime:custom'],
      ],
      [
        'a closing time equal to the opening time',
        { closeTime: '10:00:00' },
        ['openingHours.0.closeTime:custom'],
      ],
      [
        'a working day without times',
        { openTime: null, closeTime: null },
        ['openingHours.0.openTime:custom', 'openingHours.0.closeTime:custom'],
      ],
      [
        'a holiday with only one of the times',
        {
          isHoliday: true,
          closeTime: null,
        },
        ['openingHours.0.closeTime:custom'],
      ],
      [
        'an unknown property',
        { salonId: SALON_ID },
        ['openingHours.0.salonId:unrecognized_keys'],
      ],
    ])('rejects %s', (_case, change, expected) => {
      const rules = rulesBrokenBy(salonCreateRequestSchema, {
        ...salonCreateRequest(),
        openingHours: [{ ...openingDay(), ...change }],
      })

      expect(rules).toEqual(expected)
    })

    it('accepts times with seconds and a holiday that still opens', () => {
      const result = parseWith(
        salonCreateRequestSchema,
        {
          ...salonCreateRequest(),
          openingHours: [
            {
              ...openingDay(),
              openTime: '10:00:00',
              closeTime: '15:30:00',
              isHoliday: true,
              holidayName: 'Short day',
            },
          ],
        },
        MADE_UP_HEADLINE,
      )

      expect(result.type).toBe('success')
    })

    it('rejects two entries for the same date', () => {
      const rules = rulesBrokenBy(salonCreateRequestSchema, {
        ...salonCreateRequest(),
        openingHours: [openingDay(), openingDay()],
      })

      expect(rules).toEqual(['openingHours.1.date:custom'])
    })

    it('reports malformed entries without evaluating the rules that need them', () => {
      const rules = rulesBrokenBy(salonCreateRequestSchema, {
        ...salonCreateRequest(),
        openingHours: [{ ...openingDay(), date: 20261116 }, 'monday'],
      })

      expect(rules).toEqual([
        'openingHours.0.date:invalid_type',
        'openingHours.1:invalid_type',
      ])
    })
  })

  describe('businessHours', () => {
    it.each([
      [
        'a slot that ends before it starts',
        {
          operatingSlots: [{ startTime: '19:00', endTime: '10:00' }],
        },
        ['businessHours.0.operatingSlots.0.endTime:custom'],
      ],
      [
        'a slot time with seconds',
        {
          breakSlots: [{ startTime: '12:00:00', endTime: '13:00' }],
        },
        ['businessHours.0.breakSlots.0.startTime:invalid_format'],
      ],
      [
        'a closed day that lists operating slots',
        { isClosed: true },
        ['businessHours.0.operatingSlots:custom'],
      ],
      [
        'a day with a time zone of its own',
        { timezone: 'Asia/Tokyo' },
        ['businessHours.0.timezone:unrecognized_keys'],
      ],
      [
        'a day whose own time zone is null',
        { timezone: null },
        ['businessHours.0.timezone:unrecognized_keys'],
      ],
      [
        'a period that ends before it starts',
        {
          effectivePeriod: {
            startDate: '2026-12-01T00:00:00Z',
            endDate: '2026-11-01T00:00:00Z',
          },
        },
        ['businessHours.0.effectivePeriod.endDate:custom'],
      ],
      [
        'a period that ends half a second before it starts',
        {
          effectivePeriod: {
            startDate: '2026-11-01T00:00:00.500Z',
            endDate: '2026-11-01T00:00:00Z',
          },
        },
        ['businessHours.0.effectivePeriod.endDate:custom'],
      ],
    ])('rejects %s', (_case, change, expected) => {
      const rules = rulesBrokenBy(salonCreateRequestSchema, {
        ...salonCreateRequest(),
        businessHours: [{ ...businessDay(), ...change }],
      })

      expect(rules).toEqual(expected)
    })

    it.each([
      [
        'ends half a second after it starts',
        {
          startDate: '2026-11-01T00:00:00Z',
          endDate: '2026-11-01T00:00:00.500Z',
        },
      ],
      [
        'starts and ends at one moment written in two ways',
        {
          startDate: '2026-11-01T00:00:00Z',
          endDate: '2026-11-01T00:00:00.000Z',
        },
      ],
    ])('accepts a period that %s', (_case, effectivePeriod) => {
      const rules = rulesBrokenBy(salonCreateRequestSchema, {
        ...salonCreateRequest(),
        businessHours: [{ ...businessDay(), effectivePeriod }],
      })

      expect(rules).toEqual([])
    })

    it('rejects two entries for the same day of the week', () => {
      const rules = rulesBrokenBy(salonCreateRequestSchema, {
        ...salonCreateRequest(),
        businessHours: [businessDay(), businessDay()],
      })

      expect(rules).toEqual(['businessHours.1.dayOfWeek:custom'])
    })
  })
})

describe('storedBusinessHoursSchema', () => {
  it('checks the shape of stored hours but not the business rules', () => {
    const stored = {
      ...businessDay(),
      operatingSlots: [{ startTime: '19:00', endTime: '10:00' }],
    }

    expect(
      parseWith(storedBusinessHoursSchema, stored, MADE_UP_HEADLINE).type,
    ).toBe('success')
    expect(
      rulesBrokenBy(storedBusinessHoursSchema, { dayOfWeek: 'monday' }),
    ).toContain('operatingSlots:invalid_type')
  })

  it('does not know a time zone of a day: the hours are in the time zone of the salon', () => {
    expect(
      rulesBrokenBy(storedBusinessHoursSchema, {
        ...businessDay(),
        timezone: null,
      }),
    ).toEqual(['timezone:unrecognized_keys'])
  })
})

describe('salonUpdateRequestSchema', () => {
  it.each(['Asia/Tokyo', 'America/New_York', 'UTC'])(
    'accepts the time zone %s',
    (timezone) => {
      expect(
        parseWith(salonUpdateRequestSchema, { timezone }, MADE_UP_HEADLINE),
      ).toEqual({ type: 'success', data: { timezone } })
    },
  )

  it('accepts any subset of the properties', () => {
    const result = parseWith(
      salonUpdateRequestSchema,
      { name: 'Renamed', building: null },
      MADE_UP_HEADLINE,
    )

    expect(result).toEqual({
      type: 'success',
      data: { name: 'Renamed', building: null },
    })
  })

  it.each([
    ['an empty request', {}, [':custom']],
    ['null for a NOT NULL column', { city: null }, ['city:invalid_type']],
    [
      'a value that breaks the rule of its property',
      { email: 'nope' },
      ['email:invalid_format'],
    ],
    [
      'a time zone that is not known',
      { timezone: 'Tokyo' },
      ['timezone:custom'],
    ],
    [
      'a property the client may not set',
      { reviewCount: 99 },
      ['reviewCount:unrecognized_keys'],
    ],
    [
      'a calendar that repeats a date',
      {
        openingHours: [openingDay(), openingDay()],
      },
      ['openingHours.1.date:custom'],
    ],
  ])('rejects %s', (_case, input, expected) => {
    expect(rulesBrokenBy(salonUpdateRequestSchema, input)).toEqual(expected)
  })
})

describe('salonSearchRequestSchema', () => {
  it('accepts a request without any filter', () => {
    expect(parseWith(salonSearchRequestSchema, {}, MADE_UP_HEADLINE)).toEqual({
      type: 'success',
      data: {},
    })
  })

  it('accepts every filter together', () => {
    const request = {
      limit: 100,
      cursor: OTHER_SALON_ID,
      keyword: 'aoyama',
      prefecture: '東京都',
      city: '港区',
      isActive: true,
      minRating: 4.5,
      features: ['color'],
    }

    expect(
      parseWith(salonSearchRequestSchema, request, MADE_UP_HEADLINE),
    ).toEqual({
      type: 'success',
      data: request,
    })
  })

  it.each([
    ['a limit of 0', { limit: 0 }, ['limit:too_small']],
    ['a limit over 100', { limit: 101 }, ['limit:too_big']],
    ['a fractional limit', { limit: 1.5 }, ['limit:invalid_type']],
    ['a limit that is still text', { limit: '10' }, ['limit:invalid_type']],
    [
      'a cursor that is not an ID',
      { cursor: 'offset:20' },
      ['cursor:invalid_format'],
    ],
    ['a blank keyword', { keyword: ' ' }, ['keyword:invalid_format']],
    ['a rating above 5', { minRating: 5.1 }, ['minRating:too_big']],
    [
      'a parameter that does not exist',
      { page: 2 },
      ['page:unrecognized_keys'],
    ],
  ])('rejects %s', (_case, input, expected) => {
    expect(rulesBrokenBy(salonSearchRequestSchema, input)).toEqual(expected)
  })
})

/** What a refused salon is told of a property, in the order of the issues. */
const toldOf = (
  changed: Record<string, unknown>,
  field: string,
): LocalizedText[] => {
  const result = parseWith(
    salonCreateRequestSchema,
    { ...salonCreateRequest(), ...changed },
    salonMessages.invalidSalon,
  )

  return result.type === 'error' && result.error.type === 'validation'
    ? result.error.issues
        .filter((issue) => issue.field === field)
        .map((issue) => issue.message)
    : []
}

describe('what a refused salon is told', () => {
  it.each<[string, Record<string, unknown>, string, LocalizedText[]]>([
    ['a blank name', { name: ' ' }, 'name', [ruleMessages.notBlank]],
    [
      'a phone number with letters',
      { phoneNumber: 'call the salon' },
      'phoneNumber',
      [ruleMessages.phoneNumber, ruleMessages.phoneDigits(10)],
    ],
    [
      'a phone number of too few digits',
      { phoneNumber: '03-1234' },
      'phoneNumber',
      [ruleMessages.phoneDigits(10)],
    ],
    [
      'an offset for a time zone',
      { timezone: '+09:00' },
      'timezone',
      [ruleMessages.timeZoneName],
    ],
    [
      'a currency that is no code',
      { currency: 'yen' },
      'currency',
      [salonMessages.currencyCode],
    ],
    [
      'an opening time that is no time',
      { openingHours: [{ ...openingDay(), openTime: '10am' }] },
      'openingHours.0.openTime',
      [ruleMessages.timeOfDay],
    ],
    [
      'a closing time that is not after the opening time',
      { openingHours: [{ ...openingDay(), closeTime: '10:00' }] },
      'openingHours.0.closeTime',
      [ruleMessages.laterThan('openTime')],
    ],
    [
      'a day of the week that is not that of the date',
      { openingHours: [{ ...openingDay(), dayOfWeek: 'tuesday' }] },
      'openingHours.0.dayOfWeek',
      [salonMessages.dayOfWeekOf('2026-11-16')],
    ],
    [
      'a working day without an opening time',
      { openingHours: [{ ...openingDay(), openTime: null }] },
      'openingHours.0.openTime',
      [salonMessages.timesUnlessHoliday],
    ],
    [
      'a working day without a closing time',
      { openingHours: [{ ...openingDay(), closeTime: null }] },
      'openingHours.0.closeTime',
      [salonMessages.timesUnlessHoliday],
    ],
    [
      'a date that an earlier entry has',
      { openingHours: [openingDay(), openingDay()] },
      'openingHours.1.date',
      [salonMessages.noRepeatedDate],
    ],
    [
      'a date before 1900',
      { openingHours: [{ ...openingDay(), date: '1899-12-31' }] },
      'openingHours.0.date',
      [ruleMessages.notEarlierThan('1900-01-01')],
    ],
    [
      'a date after 2999',
      { openingHours: [{ ...openingDay(), date: '3000-01-01' }] },
      'openingHours.0.date',
      [ruleMessages.notLaterThan('2999-12-31')],
    ],
    [
      'a slot that ends before it begins',
      {
        businessHours: [
          {
            ...businessDay(),
            operatingSlots: [{ startTime: '19:00', endTime: '10:00' }],
          },
        ],
      },
      'businessHours.0.operatingSlots.0.endTime',
      [ruleMessages.laterThan('startTime')],
    ],
    [
      'a period that ends before it begins',
      {
        businessHours: [
          {
            ...businessDay(),
            effectivePeriod: {
              startDate: '2026-12-01T00:00:00Z',
              endDate: '2026-11-01T00:00:00Z',
            },
          },
        ],
      },
      'businessHours.0.effectivePeriod.endDate',
      [ruleMessages.notEarlierThan('startDate')],
    ],
    [
      'a closed day with opening slots',
      { businessHours: [{ ...businessDay(), isClosed: true }] },
      'businessHours.0.operatingSlots',
      [salonMessages.emptyWhenClosed],
    ],
    [
      'a day of the week that an earlier entry has',
      { businessHours: [businessDay(), businessDay()] },
      'businessHours.1.dayOfWeek',
      [salonMessages.noRepeatedDay],
    ],
  ])(
    'should be the message of the rule, in every language, for %s',
    (_what, changed, field, messages) => {
      // Act
      const told = toldOf(changed, field)

      // Assert
      expect(told).toEqual(messages)
    },
  )

  it('should be what the rule of an update says, for a change that names no property', () => {
    // Act
    const result = parseWith(
      salonUpdateRequestSchema,
      {},
      salonMessages.invalidSalonUpdate,
    )

    // Assert
    expect(result).toEqual({
      type: 'error',
      error: {
        type: 'validation',
        message: salonMessages.invalidSalonUpdate,
        issues: [
          {
            field: '',
            rule: 'custom',
            message: ruleMessages.atLeastOneProperty,
          },
        ],
      },
    })
  })
})
