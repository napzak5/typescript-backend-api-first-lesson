import { customerPreferencesMessages } from '@beauty-salon-shared/i18n/messages/api'
import { describe, expect, it } from 'vitest'
import {
  AVOIDED_STAFF_ID,
  customerPreferencesUpdateRequest,
  PREFERRED_STAFF_ID,
  UNNAMED_STAFF_ID,
} from '../../__tests__/fixtures/customer-preferences-fixtures'
import { brokenRules } from '../../__tests__/fixtures/fixtures'
import { parseWith } from '../../shared'
import {
  customerPreferencesUpdateRequestSchema,
  storedStylePreferenceSchema,
  storedTimeSlotsSchema,
} from '../customer-preferences.schema'

const rulesBrokenBy = (
  schema: Parameters<typeof parseWith>[0],
  input: unknown,
): string[] => {
  const result = parseWith(schema, input, 'Invalid')
  return result.type === 'error' ? brokenRules(result.error) : []
}

const rulesOfUpdate = (input: unknown): string[] =>
  rulesBrokenBy(customerPreferencesUpdateRequestSchema, input)

const parseUpdate = (input: unknown) =>
  parseWith(customerPreferencesUpdateRequestSchema, input, 'Invalid')

/** A style preference that keeps every rule. */
const style = (overrides: Record<string, unknown> = {}) => ({
  preferredLength: 'ショート',
  preferredColors: ['アッシュ'],
  avoidStyles: ['パーマ'],
  inspirationImages: ['https://images.example.com/short.jpg'],
  ...overrides,
})

const slot = (startTime: unknown, endTime: unknown) => ({ startTime, endTime })

/** An address of exactly this many characters. */
const urlOfLength = (length: number): string =>
  'https://images.example.com/'.padEnd(length, 'a')

describe('customerPreferencesUpdateRequestSchema', () => {
  it.each(Object.entries(customerPreferencesUpdateRequest()))(
    'accepts %s alone and returns it unchanged',
    (property, value) => {
      expect(parseUpdate({ [property]: value })).toEqual({
        type: 'success',
        data: { [property]: value },
      })
    },
  )

  it('accepts the six properties together and returns the request unchanged', () => {
    const request = customerPreferencesUpdateRequest()

    expect(parseUpdate(request)).toEqual({ type: 'success', data: request })
  })

  it.each([
    'preferredStaffId',
    'stylePreferences',
    'communicationStyle',
    'specialRequests',
  ])('lets null clear %s', (property) => {
    expect(parseUpdate({ [property]: null })).toEqual({
      type: 'success',
      data: { [property]: null },
    })
  })

  it.each(['preferredTimeSlots', 'avoidStaffIds'])(
    'rejects null for %s: a list is cleared with the empty list',
    (property) => {
      expect(rulesOfUpdate({ [property]: null })).toEqual([
        `${property}:invalid_type`,
      ])
      expect(parseUpdate({ [property]: [] })).toEqual({
        type: 'success',
        data: { [property]: [] },
      })
    },
  )

  it.each(Object.keys(customerPreferencesUpdateRequest()))(
    'rejects %s when it is present without a value',
    (property) => {
      expect(rulesOfUpdate({ [property]: undefined })).toEqual([
        `${property}:invalid_type`,
      ])
    },
  )

  describe('the staff members', () => {
    it('puts the IDs in lower case', () => {
      expect(
        parseUpdate({
          preferredStaffId: PREFERRED_STAFF_ID.toUpperCase(),
          avoidStaffIds: [AVOIDED_STAFF_ID.toUpperCase(), UNNAMED_STAFF_ID],
        }),
      ).toEqual({
        type: 'success',
        data: {
          preferredStaffId: PREFERRED_STAFF_ID,
          avoidStaffIds: [AVOIDED_STAFF_ID, UNNAMED_STAFF_ID],
        },
      })
    })

    it.each<[string, unknown, string]>([
      ['text that is not a UUID', 'hanako', 'invalid_format'],
      ['the empty string', '', 'invalid_format'],
      [
        'a UUID with something after it',
        `${PREFERRED_STAFF_ID}0`,
        'invalid_format',
      ],
      ['a number', 7, 'invalid_type'],
      ['a list', [PREFERRED_STAFF_ID], 'invalid_type'],
    ])('rejects %s as the preferred staff member', (_case, value, rule) => {
      expect(rulesOfUpdate({ preferredStaffId: value })).toEqual([
        `preferredStaffId:${rule}`,
      ])
    })

    it.each<[string, unknown, string[]]>([
      [
        'a single ID instead of a list',
        AVOIDED_STAFF_ID,
        ['avoidStaffIds:invalid_type'],
      ],
      [
        'an entry that is not a UUID',
        [AVOIDED_STAFF_ID, 'hanako'],
        ['avoidStaffIds.1:invalid_format'],
      ],
      ['an entry that is null', [null], ['avoidStaffIds.0:invalid_type']],
      [
        'an entry that repeats an earlier one',
        [AVOIDED_STAFF_ID, UNNAMED_STAFF_ID, AVOIDED_STAFF_ID],
        ['avoidStaffIds.2:custom'],
      ],
      [
        'an entry that repeats an earlier one in another case',
        [AVOIDED_STAFF_ID, AVOIDED_STAFF_ID.toUpperCase()],
        ['avoidStaffIds.1:custom'],
      ],
      [
        'three entries that are the same',
        [AVOIDED_STAFF_ID, AVOIDED_STAFF_ID, AVOIDED_STAFF_ID],
        ['avoidStaffIds.1:custom', 'avoidStaffIds.2:custom'],
      ],
    ])('rejects %s among the avoided staff members', (_case, value, rules) => {
      expect(rulesOfUpdate({ avoidStaffIds: value })).toEqual(rules)
    })

    it('leaves the rule that ties the preferred staff member to the avoided ones to whoever holds the stored preferences', () => {
      expect(
        rulesOfUpdate({
          preferredStaffId: PREFERRED_STAFF_ID,
          avoidStaffIds: [PREFERRED_STAFF_ID],
        }),
      ).toEqual([])
    })
  })

  describe('the time slots', () => {
    it.each<[string, unknown[]]>([
      ['one slot', [slot('10:00', '12:00')]],
      ['a slot of one minute', [slot('10:00', '10:01')]],
      ['a slot of the whole day', [slot('00:00', '23:59')]],
      [
        'two slots that touch',
        [slot('10:00', '12:00'), slot('12:00', '14:00')],
      ],
      [
        'two slots that touch, the later one first',
        [slot('12:00', '14:00'), slot('10:00', '12:00')],
      ],
      [
        'slots that are apart, in any order',
        [
          slot('18:00', '20:00'),
          slot('09:00', '10:00'),
          slot('13:00', '15:30'),
        ],
      ],
    ])('accepts %s and keeps the order', (_case, slots) => {
      expect(parseUpdate({ preferredTimeSlots: slots })).toEqual({
        type: 'success',
        data: { preferredTimeSlots: slots },
      })
    })

    it.each<[string, unknown, string[]]>([
      [
        'a time without a leading zero',
        slot('9:00', '12:00'),
        [
          'preferredTimeSlots.0.startTime:invalid_format',
          'preferredTimeSlots.0.endTime:custom',
        ],
      ],
      [
        'a time with seconds',
        slot('10:00', '12:00:00'),
        ['preferredTimeSlots.0.endTime:invalid_format'],
      ],
      [
        'an hour that no day has',
        slot('10:00', '24:00'),
        ['preferredTimeSlots.0.endTime:invalid_format'],
      ],
      [
        'a minute that no hour has',
        slot('10:60', '12:00'),
        ['preferredTimeSlots.0.startTime:invalid_format'],
      ],
      [
        'a time in words',
        slot('morning', 'noon'),
        [
          'preferredTimeSlots.0.startTime:invalid_format',
          'preferredTimeSlots.0.endTime:invalid_format',
        ],
      ],
      [
        'a time that is a number',
        slot(10, '12:00'),
        ['preferredTimeSlots.0.startTime:invalid_type'],
      ],
      [
        'a time that is null',
        slot('10:00', null),
        ['preferredTimeSlots.0.endTime:invalid_type'],
      ],
      [
        'a slot without an end',
        { startTime: '10:00' },
        ['preferredTimeSlots.0.endTime:invalid_type'],
      ],
      [
        'a slot without a beginning',
        { endTime: '10:00' },
        ['preferredTimeSlots.0.startTime:invalid_type'],
      ],
      [
        'a slot with another property',
        { ...slot('10:00', '12:00'), dayOfWeek: 'monday' },
        ['preferredTimeSlots.0.dayOfWeek:unrecognized_keys'],
      ],
      [
        'a slot that is text',
        '10:00-12:00',
        ['preferredTimeSlots.0:invalid_type'],
      ],
      [
        'a slot that ends when it begins',
        slot('10:00', '10:00'),
        ['preferredTimeSlots.0.endTime:custom'],
      ],
      [
        'a slot that ends before it begins',
        slot('12:00', '10:00'),
        ['preferredTimeSlots.0.endTime:custom'],
      ],
    ])('rejects %s', (_case, entry, rules) => {
      expect(rulesOfUpdate({ preferredTimeSlots: [entry] })).toEqual(rules)
    })

    it.each<[string, unknown[], string[]]>([
      [
        'a slot that begins before an earlier one ends',
        [slot('10:00', '12:00'), slot('11:59', '13:00')],
        ['preferredTimeSlots.1:custom'],
      ],
      [
        'a slot that ends after an earlier one begins',
        [slot('10:00', '12:00'), slot('09:00', '10:01')],
        ['preferredTimeSlots.1:custom'],
      ],
      [
        'a slot inside an earlier one',
        [slot('10:00', '12:00'), slot('10:30', '11:00')],
        ['preferredTimeSlots.1:custom'],
      ],
      [
        'a slot around an earlier one',
        [slot('10:30', '11:00'), slot('10:00', '12:00')],
        ['preferredTimeSlots.1:custom'],
      ],
      [
        'the same slot twice',
        [slot('10:00', '12:00'), slot('10:00', '12:00')],
        ['preferredTimeSlots.1:custom'],
      ],
      [
        'a third slot that overlaps the first',
        [
          slot('10:00', '12:00'),
          slot('13:00', '14:00'),
          slot('11:00', '12:30'),
        ],
        ['preferredTimeSlots.2:custom'],
      ],
      [
        'two slots that each overlap an earlier one',
        [
          slot('10:00', '12:00'),
          slot('11:00', '13:00'),
          slot('12:30', '14:00'),
        ],
        ['preferredTimeSlots.1:custom', 'preferredTimeSlots.2:custom'],
      ],
    ])(
      'rejects %s, under the index of the later one',
      (_case, slots, rules) => {
        expect(rulesOfUpdate({ preferredTimeSlots: slots })).toEqual(rules)
      },
    )

    it('says of a slot that overlaps an earlier one what is wrong with it', () => {
      expect(
        parseUpdate({
          preferredTimeSlots: [slot('10:00', '12:00'), slot('11:00', '13:00')],
        }),
      ).toEqual({
        type: 'error',
        error: {
          type: 'validation',
          message: 'Invalid',
          issues: [
            {
              field: 'preferredTimeSlots.1',
              rule: 'custom',
              message: customerPreferencesMessages.noOverlappingSlot,
            },
          ],
        },
      })
    })

    it('rejects a single slot instead of a list', () => {
      expect(
        rulesOfUpdate({ preferredTimeSlots: slot('10:00', '12:00') }),
      ).toEqual(['preferredTimeSlots:invalid_type'])
    })
  })

  describe('the style preference', () => {
    it.each<[string, Record<string, unknown>]>([
      ['no preferred length', { preferredLength: null }],
      [
        'empty lists',
        { preferredColors: [], avoidStyles: [], inspirationImages: [] },
      ],
      [
        'nothing in it at all',
        {
          preferredLength: null,
          preferredColors: [],
          avoidStyles: [],
          inspirationImages: [],
        },
      ],
      [
        'text with spaces around it',
        { preferredLength: ' ショート ', preferredColors: [' アッシュ'] },
      ],
      [
        'an image at an http address',
        { inspirationImages: ['http://images.example.com/a.jpg'] },
      ],
      [
        'an image address of 500 characters',
        { inspirationImages: [urlOfLength(500)] },
      ],
      [
        'the same text in two lists',
        { preferredColors: ['ブリーチ'], avoidStyles: ['ブリーチ'] },
      ],
      ['entries that differ in case', { preferredColors: ['Ash', 'ash'] }],
    ])('accepts a style preference with %s', (_case, overrides) => {
      const stylePreferences = style(overrides)

      expect(parseUpdate({ stylePreferences })).toEqual({
        type: 'success',
        data: { stylePreferences },
      })
    })

    it.each([
      'preferredLength',
      'preferredColors',
      'avoidStyles',
      'inspirationImages',
    ])(
      'rejects a style preference without %s: it is replaced as a whole',
      (property) => {
        const whole: Record<string, unknown> = style()
        const { [property]: _left, ...rest } = whole

        expect(rulesOfUpdate({ stylePreferences: rest })).toEqual([
          `stylePreferences.${property}:invalid_type`,
        ])
      },
    )

    it.each<[string, Record<string, unknown>, string[]]>([
      [
        'a preferred length of spaces',
        { preferredLength: '   ' },
        ['stylePreferences.preferredLength:invalid_format'],
      ],
      [
        'an empty preferred length',
        { preferredLength: '' },
        ['stylePreferences.preferredLength:invalid_format'],
      ],
      [
        'a preferred length that is a number',
        { preferredLength: 30 },
        ['stylePreferences.preferredLength:invalid_type'],
      ],
      [
        'null for the preferred colours',
        { preferredColors: null },
        ['stylePreferences.preferredColors:invalid_type'],
      ],
      [
        'null for the avoided styles',
        { avoidStyles: null },
        ['stylePreferences.avoidStyles:invalid_type'],
      ],
      [
        'null for the images',
        { inspirationImages: null },
        ['stylePreferences.inspirationImages:invalid_type'],
      ],
      [
        'a blank preferred colour',
        { preferredColors: ['アッシュ', ' '] },
        ['stylePreferences.preferredColors.1:invalid_format'],
      ],
      [
        'a preferred colour twice',
        { preferredColors: ['アッシュ', 'ブラウン', 'アッシュ'] },
        ['stylePreferences.preferredColors.2:custom'],
      ],
      [
        'a preferred colour that is a number',
        { preferredColors: [7] },
        ['stylePreferences.preferredColors.0:invalid_type'],
      ],
      [
        'a blank avoided style',
        { avoidStyles: [''] },
        ['stylePreferences.avoidStyles.0:invalid_format'],
      ],
      [
        'an avoided style twice',
        { avoidStyles: ['パーマ', 'パーマ'] },
        ['stylePreferences.avoidStyles.1:custom'],
      ],
      [
        'an image that is no address',
        { inspirationImages: ['short.jpg'] },
        ['stylePreferences.inspirationImages.0:invalid_format'],
      ],
      [
        'an image at an ftp address',
        { inspirationImages: ['ftp://images.example.com/a.jpg'] },
        ['stylePreferences.inspirationImages.0:invalid_format'],
      ],
      [
        'an image in a data address',
        { inspirationImages: ['data:image/png;base64,AAAA'] },
        ['stylePreferences.inspirationImages.0:invalid_format'],
      ],
      [
        'an image address of 501 characters',
        { inspirationImages: [urlOfLength(501)] },
        ['stylePreferences.inspirationImages.0:too_big'],
      ],
      [
        'an image twice',
        {
          inspirationImages: [
            'https://images.example.com/a.jpg',
            'https://images.example.com/a.jpg',
          ],
        },
        ['stylePreferences.inspirationImages.1:custom'],
      ],
      [
        'another property',
        { preferredStylist: 'Hanako' },
        ['stylePreferences.preferredStylist:unrecognized_keys'],
      ],
    ])('rejects a style preference with %s', (_case, overrides, rules) => {
      expect(rulesOfUpdate({ stylePreferences: style(overrides) })).toEqual(
        rules,
      )
    })

    it.each<[string, unknown]>([
      ['text', 'ショート'],
      ['a list', [style()]],
      ['a number', 1],
    ])('rejects %s as the style preference', (_case, value) => {
      expect(rulesOfUpdate({ stylePreferences: value })).toEqual([
        'stylePreferences:invalid_type',
      ])
    })
  })

  describe('the texts', () => {
    it('accepts a communication style of 100 characters and rejects one of 101', () => {
      expect(rulesOfUpdate({ communicationStyle: 'あ'.repeat(100) })).toEqual(
        [],
      )
      expect(rulesOfUpdate({ communicationStyle: 'あ'.repeat(101) })).toEqual([
        'communicationStyle:too_big',
      ])
    })

    it('accepts a special request of any length', () => {
      expect(rulesOfUpdate({ specialRequests: 'あ'.repeat(5000) })).toEqual([])
    })

    it.each(['communicationStyle', 'specialRequests'])(
      'rejects a %s that says nothing, and one that is not text',
      (property) => {
        expect(rulesOfUpdate({ [property]: '' })).toEqual([
          `${property}:invalid_format`,
        ])
        expect(rulesOfUpdate({ [property]: ' \n\t' })).toEqual([
          `${property}:invalid_format`,
        ])
        expect(rulesOfUpdate({ [property]: 5 })).toEqual([
          `${property}:invalid_type`,
        ])
      },
    )

    it.each(['communicationStyle', 'specialRequests'])(
      'keeps a %s as it is written, untrimmed',
      (property) => {
        expect(parseUpdate({ [property]: '  静かに \n' })).toEqual({
          type: 'success',
          data: { [property]: '  静かに \n' },
        })
      },
    )
  })

  it.each<[string, unknown]>([
    ['id', '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f1e01'],
    ['customerId', '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f1e02'],
    ['createdAt', '2026-11-15T09:00:00.000Z'],
    ['updatedAt', '2026-11-15T09:00:00.000Z'],
    ['preferredServices', ['cut']],
    ['notes', 'Prefers a short fringe'],
    ['preferredStaff', PREFERRED_STAFF_ID],
  ])('does not know the property %s', (property, value) => {
    expect(
      rulesOfUpdate({ communicationStyle: '静かに', [property]: value }),
    ).toEqual([`${property}:unrecognized_keys`])
  })

  it('rejects an empty request with one error for the request as a whole', () => {
    expect(rulesOfUpdate({})).toEqual([':custom'])
  })

  it('reports an unknown property as such, not as an empty request', () => {
    expect(rulesOfUpdate({ notes: 'x' })).toEqual(['notes:unrecognized_keys'])
  })

  it.each<[string, unknown]>([
    ['null', null],
    ['a list', [{ specialRequests: 'x' }]],
    ['text', 'specialRequests'],
    ['a number', 1],
    ['nothing', undefined],
  ])('rejects %s as the request', (_case, input) => {
    expect(rulesOfUpdate(input)).toEqual([':invalid_type'])
  })

  it('reports every broken rule at once', () => {
    expect(
      rulesOfUpdate({
        preferredStaffId: 'hanako',
        preferredTimeSlots: [
          slot('10:00', '12:00'),
          slot('11:00', '11:30'),
          slot('13:00', '12:00'),
        ],
        avoidStaffIds: [AVOIDED_STAFF_ID, AVOIDED_STAFF_ID, 'taro'],
        stylePreferences: style({
          preferredLength: ' ',
          preferredColors: ['a', 'a'],
          avoidStyles: [''],
          inspirationImages: ['ftp://images.example.com/a.jpg'],
        }),
        communicationStyle: 'あ'.repeat(101),
        specialRequests: ' ',
        notes: 'x',
      }).toSorted(),
    ).toEqual(
      [
        'preferredStaffId:invalid_format',
        'preferredTimeSlots.1:custom',
        'preferredTimeSlots.2.endTime:custom',
        'avoidStaffIds.1:custom',
        'avoidStaffIds.2:invalid_format',
        'stylePreferences.preferredLength:invalid_format',
        'stylePreferences.preferredColors.1:custom',
        'stylePreferences.avoidStyles.0:invalid_format',
        'stylePreferences.inspirationImages.0:invalid_format',
        'communicationStyle:too_big',
        'specialRequests:invalid_format',
        'notes:unrecognized_keys',
      ].toSorted(),
    )
  })
})

describe('storedTimeSlotsSchema', () => {
  it.each<[string, unknown]>([
    ['no slot', []],
    [
      'slots as a request states them',
      [slot('10:00', '12:00'), slot('18:00', '20:30')],
    ],
    ['a slot that ends before it begins', [slot('12:00', '10:00')]],
    ['slots that overlap', [slot('10:00', '12:00'), slot('11:00', '13:00')]],
  ])('reads %s: only the shape is checked', (_case, stored) => {
    expect(parseWith(storedTimeSlotsSchema, stored, 'Invalid')).toEqual({
      type: 'success',
      data: stored,
    })
  })

  it.each<[string, unknown, string[]]>([
    ['null', null, [':invalid_type']],
    ['an object', {}, [':invalid_type']],
    [
      'a slot with seconds',
      [slot('10:00:00', '12:00')],
      ['0.startTime:invalid_format'],
    ],
    [
      'a slot without an end',
      [{ startTime: '10:00' }],
      ['0.endTime:invalid_type'],
    ],
    [
      'a slot with another property',
      [{ ...slot('10:00', '12:00'), note: 'x' }],
      ['0.note:unrecognized_keys'],
    ],
    ['an entry that is text', ['10:00'], ['0:invalid_type']],
  ])('does not read %s', (_case, stored, rules) => {
    expect(rulesBrokenBy(storedTimeSlotsSchema, stored)).toEqual(rules)
  })
})

describe('storedStylePreferenceSchema', () => {
  it.each<[string, unknown]>([
    ['a style preference as a request states it', style()],
    [
      'one with nothing in it',
      style({
        preferredLength: null,
        preferredColors: [],
        avoidStyles: [],
        inspirationImages: [],
      }),
    ],
    [
      'blank texts, repeated entries and images that are no addresses',
      style({
        preferredLength: ' ',
        preferredColors: ['a', 'a', ''],
        inspirationImages: ['short.jpg'],
      }),
    ],
  ])('reads %s: only the shape is checked', (_case, stored) => {
    expect(parseWith(storedStylePreferenceSchema, stored, 'Invalid')).toEqual({
      type: 'success',
      data: stored,
    })
  })

  it.each<[string, unknown, string[]]>([
    ['null', null, [':invalid_type']],
    ['a list', [], [':invalid_type']],
    [
      'the empty object',
      {},
      [
        'preferredLength:invalid_type',
        'preferredColors:invalid_type',
        'avoidStyles:invalid_type',
        'inspirationImages:invalid_type',
      ],
    ],
    [
      'a list that is null',
      style({ avoidStyles: null }),
      ['avoidStyles:invalid_type'],
    ],
    [
      'an entry that is not text',
      style({ preferredColors: ['a', 1] }),
      ['preferredColors.1:invalid_type'],
    ],
    [
      'images that are one text and not a list',
      style({ inspirationImages: 'https://images.example.com/short.jpg' }),
      ['inspirationImages:invalid_type'],
    ],
    [
      'an image that is not text',
      style({ inspirationImages: [{ url: 'short.jpg' }] }),
      ['inspirationImages.0:invalid_type'],
    ],
    [
      'a style to avoid that is not text',
      style({ avoidStyles: [null] }),
      ['avoidStyles.0:invalid_type'],
    ],
    [
      'a preferred length that is not text',
      style({ preferredLength: 30 }),
      ['preferredLength:invalid_type'],
    ],
    ['another property', style({ note: 'x' }), ['note:unrecognized_keys']],
  ])('does not read %s', (_case, stored, rules) => {
    expect(rulesBrokenBy(storedStylePreferenceSchema, stored)).toEqual(rules)
  })
})
