import type { ModelsCustomerPreferencesResponse } from '@beauty-salon-frontend/api-client'
import { describe, expect, it } from 'vitest'
import {
  kenta,
  misaki,
  noPreferences,
  preferences,
  staff,
  yui,
} from './components/examples'
import {
  AVOIDED_STAFF,
  AVOIDED_STYLES,
  afterPreferencesChange,
  COMMUNICATION_STYLE,
  type Entered,
  endOf,
  enteredOf,
  INSPIRATION_IMAGES,
  linesOf,
  PREFERRED_COLORS,
  PREFERRED_LENGTH,
  PREFERRED_STAFF,
  readPreferencesChange,
  SPECIAL_REQUESTS,
  startOf,
  TIME_SLOTS,
} from './preferences-flow'

/** A member of the staff no screen can show: their salon no longer shows them. */
const GONE = '0f6d3b8a-7e21-4c95-b4a0-6d9e2c5f1a73'
const ALSO_GONE = '2a9c5e7f-4b10-4d68-a3f2-8e1b6c0d4f95'

/** The form as a browser sends it, for what its controls hold. */
const formOf = (entered: Entered): FormData => {
  const values = new FormData()
  if (entered.preferredStaffId !== undefined) {
    values.set(PREFERRED_STAFF, entered.preferredStaffId)
  }
  for (const id of entered.avoidStaffIds ?? []) {
    values.append(AVOIDED_STAFF, id)
  }
  for (const [index, slot] of entered.timeSlots.entries()) {
    values.set(startOf(TIME_SLOTS, index), slot.startTime)
    values.set(endOf(TIME_SLOTS, index), slot.endTime)
  }
  values.set(PREFERRED_LENGTH, entered.preferredLength)
  values.set(PREFERRED_COLORS, entered.preferredColors)
  values.set(AVOIDED_STYLES, entered.avoidStyles)
  values.set(INSPIRATION_IMAGES, entered.inspirationImages)
  values.set(COMMUNICATION_STYLE, entered.communicationStyle)
  values.set(SPECIAL_REQUESTS, entered.specialRequests)

  return values
}

/** What the form opens with for somebody who has said everything, and is offered the three members of the staff. */
const OPENED = enteredOf(preferences, staff)

/** What comes of the form that opened with `shown` when it is sent holding `entered`. */
const sending = (
  entered: Entered,
  shown: ModelsCustomerPreferencesResponse = preferences,
  offered = staff,
) => readPreferencesChange(formOf(entered), shown, offered)

describe('enteredOf', () => {
  it('should open the form with what is stored: the lists a line each', () => {
    expect(OPENED).toEqual({
      preferredStaffId: misaki.id,
      avoidStaffIds: [kenta.id, yui.id],
      timeSlots: [
        { startTime: '10:00', endTime: '12:00' },
        { startTime: '18:00', endTime: '20:30' },
      ],
      preferredLength: '肩にかかるくらい',
      preferredColors: 'アッシュブラウン\nベージュ',
      avoidStyles: '前髪を短くすること\n強いパーマ',
      inspirationImages:
        'https://images.example.com/styles/bob-ash-brown.jpg\nhttps://images.example.com/styles/layered-medium.jpg',
      communicationStyle: '静かに過ごしたい',
      specialRequests:
        '首が疲れやすいので、シャンプーのときにタオルを入れてもらえると助かります。',
    })
  })

  it('should open empty for somebody who has said nothing, with nobody wished for and nobody to avoid', () => {
    expect(enteredOf(noPreferences, staff)).toEqual({
      preferredStaffId: '',
      avoidStaffIds: [],
      timeSlots: [],
      preferredLength: '',
      preferredColors: '',
      avoidStyles: '',
      inspirationImages: '',
      communicationStyle: '',
      specialRequests: '',
    })
  })

  it('should have no value for the staff when the form offers none', () => {
    expect(enteredOf(preferences, [])).toMatchObject({
      preferredStaffId: undefined,
      avoidStaffIds: undefined,
    })
  })

  it('should wish for nobody when the member who is stored is not offered', () => {
    const entered = enteredOf({ ...preferences, preferredStaffId: GONE }, staff)

    expect(entered.preferredStaffId).toBe('')
  })

  it('should leave out those to avoid who are not offered, and keep the others in the order they are offered in', () => {
    const entered = enteredOf(
      { ...preferences, avoidStaffIds: [yui.id, GONE, kenta.id] },
      staff,
    )

    expect(entered.avoidStaffIds).toEqual([kenta.id, yui.id])
  })
})

describe('linesOf', () => {
  it('should read an entry from every line', () => {
    expect(linesOf('アッシュブラウン\nベージュ')).toEqual([
      'アッシュブラウン',
      'ベージュ',
    ])
  })

  it('should leave out the spaces around an entry, and the lines that hold nothing', () => {
    expect(linesOf('  ベージュ \n\n   \nピンク\n')).toEqual([
      'ベージュ',
      'ピンク',
    ])
  })

  it('should read the lines of a text whose lines end as a form sends them', () => {
    expect(linesOf('ベージュ\r\nピンク\r\n')).toEqual(['ベージュ', 'ピンク'])
  })

  it('should keep an entry once that is written twice: the API takes none twice', () => {
    expect(linesOf('ベージュ\nピンク\nベージュ ')).toEqual([
      'ベージュ',
      'ピンク',
    ])
  })

  it('should read nothing from an empty text', () => {
    expect(linesOf('')).toEqual([])
  })
})

describe('readPreferencesChange', () => {
  describe('a form that is sent as it was opened', () => {
    it('should have nothing to change for somebody who has said everything', () => {
      expect(sending(OPENED)).toEqual({ type: 'unchanged' })
    })

    it('should have nothing to change for somebody who has said nothing', () => {
      expect(sending(enteredOf(noPreferences, staff), noPreferences)).toEqual({
        type: 'unchanged',
      })
    })

    it('should have nothing to change when it offers no staff', () => {
      expect(sending(enteredOf(preferences, []), preferences, [])).toEqual({
        type: 'unchanged',
      })
    })

    it('should have nothing to change when what is stored names staff that is not offered', () => {
      const stored = {
        ...preferences,
        preferredStaffId: GONE,
        avoidStaffIds: [ALSO_GONE, yui.id],
      }

      expect(sending(enteredOf(stored, staff), stored)).toEqual({
        type: 'unchanged',
      })
    })

    it('should have nothing to change when a style is stored that holds nothing', () => {
      const stored = {
        ...noPreferences,
        stylePreferences: {
          preferredLength: null,
          preferredColors: [],
          avoidStyles: [],
          inspirationImages: [],
        },
      }

      expect(sending(enteredOf(stored, staff), stored)).toEqual({
        type: 'unchanged',
      })
    })

    it('should take spaces around a text, empty lines and an empty row for no change', () => {
      expect(
        sending({
          ...OPENED,
          timeSlots: [...OPENED.timeSlots, { startTime: '', endTime: '' }],
          preferredLength: ' 肩にかかるくらい ',
          preferredColors: 'アッシュブラウン\n\nベージュ\n',
          communicationStyle: '静かに過ごしたい  ',
        }),
      ).toEqual({ type: 'unchanged' })
    })
  })

  describe('one preference that was changed', () => {
    it.each([
      [
        'another member who is wished for, and who is no longer to be avoided',
        { preferredStaffId: yui.id, avoidStaffIds: [kenta.id] },
        { preferredStaffId: yui.id, avoidStaffIds: [kenta.id] },
      ],
      [
        'nobody wished for any more',
        { preferredStaffId: '' },
        { preferredStaffId: null },
      ],
      [
        'one member fewer to avoid',
        { avoidStaffIds: [yui.id] },
        { avoidStaffIds: [yui.id] },
      ],
      [
        'nobody to avoid any more',
        { avoidStaffIds: [] },
        { avoidStaffIds: [] },
      ],
      [
        'another way to be talked to',
        { communicationStyle: 'たくさん話したい' },
        { communicationStyle: 'たくさん話したい' },
      ],
      [
        'no way to be talked to any more',
        { communicationStyle: '   ' },
        { communicationStyle: null },
      ],
      [
        'another request',
        { specialRequests: ' 駐車場を使います。\n2 台です。 ' },
        { specialRequests: '駐車場を使います。\n2 台です。' },
      ],
      [
        'no request any more',
        { specialRequests: '' },
        { specialRequests: null },
      ],
    ])('should send %s, and nothing else', (_case, change, request) => {
      expect(sending({ ...OPENED, ...change })).toEqual({
        type: 'valid',
        value: request,
      })
    })
  })

  describe('the staff', () => {
    it('should not send again a member to avoid who is not offered, when the others change', () => {
      const stored = { ...preferences, avoidStaffIds: [GONE, kenta.id] }
      const opened = enteredOf(stored, staff)

      expect(
        sending({ ...opened, avoidStaffIds: [kenta.id, yui.id] }, stored),
      ).toEqual({
        type: 'valid',
        value: { avoidStaffIds: [kenta.id, yui.id] },
      })
    })

    it('should put the member who is chosen in the place of one who is not offered', () => {
      const stored = { ...noPreferences, preferredStaffId: GONE }
      const opened = enteredOf(stored, staff)

      expect(
        sending({ ...opened, preferredStaffId: kenta.id }, stored),
      ).toEqual({ type: 'valid', value: { preferredStaffId: kenta.id } })
    })

    it('should send nothing of the staff from a form that offers none, and what else was changed', () => {
      const opened = enteredOf(preferences, [])

      expect(
        sending({ ...opened, communicationStyle: '' }, preferences, []),
      ).toEqual({ type: 'valid', value: { communicationStyle: null } })
    })

    it('should send both when the member who was wished for is to be avoided and another is wished for', () => {
      expect(
        sending({
          ...OPENED,
          preferredStaffId: kenta.id,
          avoidStaffIds: [misaki.id, yui.id],
        }),
      ).toEqual({
        type: 'valid',
        value: {
          preferredStaffId: kenta.id,
          avoidStaffIds: [misaki.id, yui.id],
        },
      })
    })

    it('should not send a member who is wished for and to be avoided at once, and say so at those to avoid', () => {
      expect(sending({ ...OPENED, preferredStaffId: kenta.id })).toEqual({
        type: 'invalid',
        errors: {
          avoidStaffIds:
            '指名したいスタッフは、避けたいスタッフに選べません。どちらかを変えてください。',
        },
      })
    })
  })

  describe('the time slots', () => {
    const slots = (
      ...timeSlots: [string, string][]
    ): Pick<Entered, 'timeSlots'> => ({
      timeSlots: timeSlots.map(([startTime, endTime]) => ({
        startTime,
        endTime,
      })),
    })

    it('should send all of them, in the order of the rows, when one was added', () => {
      expect(
        sending({
          ...OPENED,
          ...slots(['10:00', '12:00'], ['18:00', '20:30'], ['13:00', '14:00']),
        }),
      ).toEqual({
        type: 'valid',
        value: {
          preferredTimeSlots: [
            { startTime: '10:00', endTime: '12:00' },
            { startTime: '18:00', endTime: '20:30' },
            { startTime: '13:00', endTime: '14:00' },
          ],
        },
      })
    })

    it('should send those that are left when one was taken away', () => {
      expect(sending({ ...OPENED, ...slots(['18:00', '20:30']) })).toEqual({
        type: 'valid',
        value: {
          preferredTimeSlots: [{ startTime: '18:00', endTime: '20:30' }],
        },
      })
    })

    it('should send none when all were taken away', () => {
      expect(sending({ ...OPENED, ...slots() })).toEqual({
        type: 'valid',
        value: { preferredTimeSlots: [] },
      })
    })

    it('should send them in the other order when the rows were written the other way round', () => {
      expect(
        sending({
          ...OPENED,
          ...slots(['18:00', '20:30'], ['10:00', '12:00']),
        }),
      ).toMatchObject({
        type: 'valid',
        value: {
          preferredTimeSlots: [
            { startTime: '18:00', endTime: '20:30' },
            { startTime: '10:00', endTime: '12:00' },
          ],
        },
      })
    })

    it('should leave out a row without a time', () => {
      expect(
        sending({
          ...OPENED,
          ...slots(['', ''], ['10:00', '12:00'], ['', ''], ['12:00', '13:00']),
        }),
      ).toEqual({
        type: 'valid',
        value: {
          preferredTimeSlots: [
            { startTime: '10:00', endTime: '12:00' },
            { startTime: '12:00', endTime: '13:00' },
          ],
        },
      })
    })

    it('should take two time slots that touch, and one that lies between two others', () => {
      expect(
        sending({
          ...OPENED,
          ...slots(['10:00', '12:00'], ['14:00', '16:00'], ['12:00', '14:00']),
        }),
      ).toMatchObject({ type: 'valid' })
    })

    it('should take a time slot from the first minute of a day to its last', () => {
      expect(
        sending({ ...OPENED, ...slots(['00:00', '23:59']) }),
      ).toMatchObject({ type: 'valid' })
    })

    it.each([
      [
        'the time it begins at is missing',
        ['', '12:00'],
        'preferredTimeSlots.0.startTime',
        '開始の時刻を入力してください。',
      ],
      [
        'the time it ends at is missing',
        ['10:00', ''],
        'preferredTimeSlots.0.endTime',
        '終了の時刻を入力してください。',
      ],
      [
        'the time it begins at has one digit for the hour',
        ['9:30', '12:00'],
        'preferredTimeSlots.0.startTime',
        '時刻は、09:30 のように入力してください。',
      ],
      [
        'the time it begins at has seconds',
        ['09:30:00', '12:00'],
        'preferredTimeSlots.0.startTime',
        '時刻は、09:30 のように入力してください。',
      ],
      [
        'the time it ends at is no time of a day',
        ['10:00', '24:00'],
        'preferredTimeSlots.0.endTime',
        '時刻は、09:30 のように入力してください。',
      ],
      [
        'the time it ends at has no minute of an hour',
        ['10:00', '11:60'],
        'preferredTimeSlots.0.endTime',
        '時刻は、09:30 のように入力してください。',
      ],
      [
        'it ends when it begins',
        ['10:00', '10:00'],
        'preferredTimeSlots.0.endTime',
        '終了は、開始より後の時刻にしてください。',
      ],
      [
        'it ends before it begins',
        ['18:00', '09:00'],
        'preferredTimeSlots.0.endTime',
        '終了は、開始より後の時刻にしてください。',
      ],
    ])(
      'should not send a time slot when %s, and say so at the time to correct',
      (_case, [startTime = '', endTime = ''], control, message) => {
        expect(sending({ ...OPENED, ...slots([startTime, endTime]) })).toEqual({
          type: 'invalid',
          errors: { [control]: message },
        })
      },
    )

    it.each([
      ['begins inside it', ['11:00', '13:00']],
      ['ends inside it', ['09:00', '10:01']],
      ['lies inside it', ['10:30', '11:30']],
      ['holds it', ['09:00', '13:00']],
      ['is the same', ['10:00', '12:00']],
    ])(
      'should not send a time slot that overlaps an earlier one because it %s, and say so at the later row',
      (_case, [startTime = '', endTime = '']) => {
        expect(
          sending({
            ...OPENED,
            ...slots(['10:00', '12:00'], [startTime, endTime]),
          }),
        ).toEqual({
          type: 'invalid',
          errors: {
            'preferredTimeSlots.1.startTime':
              'ほかの時間帯と重なっています。重ならない時刻にしてください。',
          },
        })
      },
    )

    it('should say of every row what is wrong with it, by the number of the row as the form shows it', () => {
      expect(
        sending({
          ...OPENED,
          ...slots(
            ['', ''],
            ['10:00', '12:00'],
            ['12:00', '11:00'],
            ['11:00', '11:30'],
            ['', '15:00'],
          ),
        }),
      ).toEqual({
        type: 'invalid',
        errors: {
          'preferredTimeSlots.2.endTime':
            '終了は、開始より後の時刻にしてください。',
          'preferredTimeSlots.3.startTime':
            'ほかの時間帯と重なっています。重ならない時刻にしてください。',
          'preferredTimeSlots.4.startTime': '開始の時刻を入力してください。',
        },
      })
    })

    it('should not take a row that is wrong itself for one that others overlap', () => {
      expect(
        sending({
          ...OPENED,
          ...slots(['12:00', '10:00'], ['10:30', '11:30']),
        }),
      ).toEqual({
        type: 'invalid',
        errors: {
          'preferredTimeSlots.0.endTime':
            '終了は、開始より後の時刻にしてください。',
        },
      })
    })
  })

  describe('the style', () => {
    it('should send the whole of it when one part was changed: the API replaces it as a whole', () => {
      expect(sending({ ...OPENED, preferredLength: 'あごのライン' })).toEqual({
        type: 'valid',
        value: {
          stylePreferences: {
            preferredLength: 'あごのライン',
            preferredColors: ['アッシュブラウン', 'ベージュ'],
            avoidStyles: ['前髪を短くすること', '強いパーマ'],
            inspirationImages: [
              'https://images.example.com/styles/bob-ash-brown.jpg',
              'https://images.example.com/styles/layered-medium.jpg',
            ],
          },
        },
      })
    })

    it('should send the entries of a list without empty lines, without spaces around them, and each once', () => {
      expect(
        sending({
          ...OPENED,
          preferredColors: ' ピンク \n\nアッシュブラウン\nピンク\n',
        }),
      ).toMatchObject({
        type: 'valid',
        value: {
          stylePreferences: { preferredColors: ['ピンク', 'アッシュブラウン'] },
        },
      })
    })

    it('should send lists without an entry, and no length, for what was emptied', () => {
      expect(
        sending({
          ...OPENED,
          preferredLength: '',
          avoidStyles: '',
          inspirationImages: ' ',
        }),
      ).toEqual({
        type: 'valid',
        value: {
          stylePreferences: {
            preferredLength: null,
            preferredColors: ['アッシュブラウン', 'ベージュ'],
            avoidStyles: [],
            inspirationImages: [],
          },
        },
      })
    })

    it('should send no style at all when every part of it was emptied', () => {
      expect(
        sending({
          ...OPENED,
          preferredLength: '',
          preferredColors: '',
          avoidStyles: '\n',
          inspirationImages: '',
        }),
      ).toEqual({ type: 'valid', value: { stylePreferences: null } })
    })

    it('should send a style for somebody who had none, with the lists that were not written empty', () => {
      expect(
        sending(
          {
            ...enteredOf(noPreferences, staff),
            avoidStyles: '刈り上げ',
          },
          noPreferences,
        ),
      ).toEqual({
        type: 'valid',
        value: {
          stylePreferences: {
            preferredLength: null,
            preferredColors: [],
            avoidStyles: ['刈り上げ'],
            inspirationImages: [],
          },
        },
      })
    })

    it.each([
      ['an address of `http`', 'http://images.example.com/a.jpg'],
      [
        'an address with a query',
        'https://images.example.com/a.jpg?size=large',
      ],
      [
        'an address of 500 characters',
        `https://images.example.com/${'a'.repeat(473)}`,
      ],
    ])('should take %s for a picture', (_case, address) => {
      expect(address.length).toBeLessThanOrEqual(500)
      expect(sending({ ...OPENED, inspirationImages: address })).toMatchObject({
        type: 'valid',
        value: { stylePreferences: { inspirationImages: [address] } },
      })
    })

    it.each([
      ['words', '雑誌の切り抜き'],
      ['an address of another kind', 'ftp://images.example.com/a.jpg'],
      ['an address without a host', 'https://'],
      ['an address without its beginning', 'images.example.com/a.jpg'],
      [
        'an address of 501 characters',
        `https://images.example.com/${'a'.repeat(474)}`,
      ],
    ])(
      'should not send %s as the address of a picture, and name its line',
      (_case, address) => {
        expect(
          sending({
            ...OPENED,
            inspirationImages: `https://images.example.com/a.jpg\n${address}`,
          }),
        ).toEqual({
          type: 'invalid',
          errors: {
            'stylePreferences.inspirationImages':
              '2 行目を確かめてください。http:// または https:// で始まる URL を、500 文字以内で書いてください。',
          },
        })
      },
    )

    it('should count the lines as the control shows them, the empty ones too, and name the first that is wrong', () => {
      expect(
        sending({
          ...OPENED,
          inspirationImages:
            'https://images.example.com/a.jpg\n\n  \nno address\nnone either',
        }),
      ).toMatchObject({
        type: 'invalid',
        errors: {
          'stylePreferences.inspirationImages':
            expect.stringMatching(/^4 行目を確かめてください。/),
        },
      })
    })
  })

  describe('the way to be talked to', () => {
    it('should take 100 characters', () => {
      const text = 'あ'.repeat(100)

      expect(sending({ ...OPENED, communicationStyle: text })).toEqual({
        type: 'valid',
        value: { communicationStyle: text },
      })
    })

    it('should not count the spaces around it', () => {
      const text = 'あ'.repeat(100)

      expect(
        sending({ ...OPENED, communicationStyle: `  ${text}  ` }),
      ).toMatchObject({ type: 'valid' })
    })

    it('should not send 101 characters, and say how many there may be', () => {
      expect(
        sending({ ...OPENED, communicationStyle: 'あ'.repeat(101) }),
      ).toEqual({
        type: 'invalid',
        errors: { communicationStyle: '100 文字以内で入力してください。' },
      })
    })
  })

  it('should send every preference that was changed, and none that was not', () => {
    expect(
      sending({
        ...OPENED,
        preferredStaffId: '',
        timeSlots: [{ startTime: '09:00', endTime: '10:30' }],
        specialRequests: '',
      }),
    ).toEqual({
      type: 'valid',
      value: {
        preferredStaffId: null,
        preferredTimeSlots: [{ startTime: '09:00', endTime: '10:30' }],
        specialRequests: null,
      },
    })
  })

  it('should say everything that is wrong at once, and send nothing', () => {
    expect(
      sending({
        ...OPENED,
        preferredStaffId: yui.id,
        timeSlots: [{ startTime: '10:00', endTime: '' }],
        inspirationImages: 'no address',
        communicationStyle: 'あ'.repeat(101),
        specialRequests: 'これは送られません',
      }),
    ).toEqual({
      type: 'invalid',
      errors: {
        avoidStaffIds:
          '指名したいスタッフは、避けたいスタッフに選べません。どちらかを変えてください。',
        'preferredTimeSlots.0.endTime': '終了の時刻を入力してください。',
        'stylePreferences.inspirationImages':
          '1 行目を確かめてください。http:// または https:// で始まる URL を、500 文字以内で書いてください。',
        communicationStyle: '100 文字以内で入力してください。',
      },
    })
  })
})

describe('afterPreferencesChange', () => {
  const refused = (...values: [string, string][]) =>
    afterPreferencesChange({
      type: 'invalid',
      values: values.map(([field, rule]) => ({ field, rule })),
    })

  it('should say that there were too many requests', () => {
    expect(afterPreferencesChange({ type: 'tooManyRequests' })).toEqual({
      message:
        'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
      errors: {},
    })
  })

  it('should say that nothing was sent when there was no answer', () => {
    expect(afterPreferencesChange({ type: 'failed' })).toEqual({
      message:
        '送信できませんでした。通信の状態を確かめて、もう一度お試しください。',
      errors: {},
    })
  })

  it.each([
    [
      'a member who is wished for and is gone',
      'preferredStaffId',
      'not_found',
      'preferredStaffId',
      'このスタッフは、選べなくなりました。ほかのスタッフを選んでください。',
    ],
    [
      'a member who is wished for and is to be avoided, as a salon stored it in the meantime',
      'preferredStaffId',
      'avoided',
      'preferredStaffId',
      'このスタッフは、避けたいスタッフに入っています。どちらかを変えてください。',
    ],
    [
      'one of those to avoid who is gone',
      'avoidStaffIds.1',
      'not_found',
      'avoidStaffIds',
      '選べなくなったスタッフが含まれています。ページを読み込み直して、選び直してください。',
    ],
    [
      'the list of those to avoid',
      'avoidStaffIds',
      'invalid_type',
      'avoidStaffIds',
      '選べなくなったスタッフが含まれています。ページを読み込み直して、選び直してください。',
    ],
    [
      'a way to be talked to that is too long',
      'communicationStyle',
      'too_big',
      'communicationStyle',
      '100 文字以内で入力してください。',
    ],
    [
      'a way to be talked to that is refused for another rule',
      'communicationStyle',
      'invalid_format',
      'communicationStyle',
      'この内容は登録できません。入力し直してください。',
    ],
    [
      'a request',
      'specialRequests',
      'invalid_format',
      'specialRequests',
      'この内容は登録できません。入力し直してください。',
    ],
    [
      'a length',
      'stylePreferences.preferredLength',
      'invalid_format',
      'stylePreferences.preferredLength',
      'この内容は登録できません。入力し直してください。',
    ],
    [
      'one of the colours',
      'stylePreferences.preferredColors.0',
      'custom',
      'stylePreferences.preferredColors',
      'この内容は登録できません。入力し直してください。',
    ],
    [
      'one of the styles to avoid',
      'stylePreferences.avoidStyles.2',
      'custom',
      'stylePreferences.avoidStyles',
      'この内容は登録できません。入力し直してください。',
    ],
    [
      'one of the pictures',
      'stylePreferences.inspirationImages.1',
      'invalid_format',
      'stylePreferences.inspirationImages',
      'この内容は登録できません。入力し直してください。',
    ],
  ])(
    'should say at its control what the API does not take: %s',
    (_case, field, rule, control, message) => {
      expect(refused([field, rule])).toEqual({
        message: undefined,
        errors: { [control]: message },
      })
    },
  )

  it.each([
    ['a time of a row', 'preferredTimeSlots.0.endTime'],
    ['a row', 'preferredTimeSlots.1'],
    ['the list', 'preferredTimeSlots'],
  ])(
    'should say of the attempt that the time slots were not taken, when the API refuses %s: its rows are not those of the form',
    (_case, field) => {
      expect(refused([field, 'custom'])).toEqual({
        message: '希望する時間帯を確かめて、もう一度お試しください。',
        errors: {},
      })
    },
  )

  it('should say both what a control is to blame for and that the time slots were not taken', () => {
    expect(
      refused(
        ['preferredTimeSlots.0', 'custom'],
        ['specialRequests', 'custom'],
      ),
    ).toEqual({
      message: '希望する時間帯を確かめて、もう一度お試しください。',
      errors: {
        specialRequests: 'この内容は登録できません。入力し直してください。',
      },
    })
  })

  it.each([
    ['a property the form has no control for', 'stylePreferences'],
    ['a property the contract does not have', 'somethingElse'],
    [
      'a property whose name only begins like one of the form',
      'avoidStaffIdsOld',
    ],
  ])(
    'should say of the attempt that something is wrong, when the API refuses %s',
    (_case, field) => {
      expect(refused([field, 'custom'])).toEqual({
        message: '入力した内容を確かめて、もう一度お試しください。',
        errors: {},
      })
    },
  )

  it('should say of the attempt that something is wrong when the API names no value', () => {
    expect(refused()).toEqual({
      message: '入力した内容を確かめて、もう一度お試しください。',
      errors: {},
    })
  })

  it('should say the first thing the API says about a value', () => {
    expect(
      refused(
        ['preferredStaffId', 'avoided'],
        ['preferredStaffId', 'not_found'],
      ),
    ).toEqual({
      message: undefined,
      errors: {
        preferredStaffId:
          'このスタッフは、避けたいスタッフに入っています。どちらかを変えてください。',
      },
    })
  })
})
