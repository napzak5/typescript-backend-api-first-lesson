import type { ModelsReviewResponse } from '@beauty-salon-frontend/api-client'
import { describe, expect, it } from 'vitest'
import { booking } from '../../bookings/components/examples'
import { staff } from '../../salons/components/examples'
import {
  everythingEntered,
  plainReview,
  ratedReview,
  visit,
} from '../components/examples'
import {
  afterReviewChange,
  afterReviewWriting,
  COMMENT,
  type Entered,
  enteredForVisit,
  enteredOf,
  IMAGES,
  isOfTheVisit,
  OVERALL_RATING,
  readNewReview,
  readReviewChange,
  STAFF,
  STAFF_RATING,
  TITLE,
} from './review-flow'

/**
 * The form as a browser sends it, for what its controls hold. A group of
 * radio buttons of which none is chosen sends nothing, and a control that
 * is not there sends nothing either.
 */
const formOf = (entered: Entered): FormData => {
  const values = new FormData()
  if (entered.staffId !== undefined) {
    values.set(STAFF, entered.staffId)
  }
  if (entered.overallRating !== '') {
    values.set(OVERALL_RATING, entered.overallRating)
  }
  values.set('serviceRating', entered.serviceRating)
  if (entered.staffRating !== undefined) {
    values.set(STAFF_RATING, entered.staffRating)
  }
  values.set('atmosphereRating', entered.atmosphereRating)
  values.set('cleanlinessRating', entered.cleanlinessRating)
  values.set('valueRating', entered.valueRating)
  values.set(TITLE, entered.title)
  values.set(COMMENT, entered.comment)
  values.set(IMAGES, entered.imageUrls)

  return values
}

/** The least a new review holds: its rating, of a visit whose member of the staff is chosen. */
const LEAST: Entered = { ...enteredForVisit(visit), overallRating: '4' }

const writing = (entered: Entered, of = visit) =>
  readNewReview(formOf(entered), of)

const changing = (
  entered: Partial<Entered>,
  shown: ModelsReviewResponse = ratedReview,
) => readReviewChange(formOf({ ...enteredOf(shown), ...entered }), shown)

const PICTURE = 'https://images.example.com/reviews/after.jpg'
const OTHER_PICTURE = 'https://images.example.com/reviews/three-weeks-later.jpg'

const pictures = (count: number): string =>
  Array.from(
    { length: count },
    (_, index) => `https://images.example.com/reviews/${index}.jpg`,
  ).join('\n')

const OVERALL_RATING_MISSING = {
  en: 'Choose an overall rating.',
  ja: '総合の評価を選んでください。',
}
const TITLE_TOO_LONG = {
  en: 'Enter up to 255 characters.',
  ja: '255 文字以内で入力してください。',
}
const TOO_MANY_IMAGES = {
  en: 'Add up to 10 pictures. Remove some lines.',
  ja: '画像は 10 個までです。行を減らしてください。',
}
const UNACCEPTABLE = {
  en: 'This value was not accepted. Check what you entered.',
  ja: 'この値は受け付けられませんでした。入力を確かめてください。',
}
const STAFF_GONE = {
  en: 'This member of the staff can no longer be chosen. Choose another, or “Do not rate the staff”.',
  ja: 'このスタッフは、選べなくなりました。ほかのスタッフか、「スタッフを評価しない」を選んでください。',
}
const TOO_MANY_REQUESTS = {
  en: 'There are too many requests. Wait a while and try again.',
  ja: 'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
}
const NOT_SENT = {
  en: 'It could not be sent. Check your connection and try again.',
  ja: '送信できませんでした。通信の状態を確かめて、もう一度お試しください。',
}
const VISIT_READ_AGAIN = {
  en: 'This review could not be posted. The visit was loaded again: please check it.',
  ja: 'このレビューは、投稿できませんでした。来店の内容を読み込み直しましたので、お確かめください。',
}
const CHECK_AGAIN = {
  en: 'Check what you entered and try again.',
  ja: '入力した内容を確かめて、もう一度お試しください。',
}

/** What is said of the line of the pictures that is no address the API takes */
const notAPictureAt = (line: number) => ({
  en: `Check line ${line}. Enter a URL that begins with http:// or https:// and has a domain name (such as example.com), up to 500 characters.`,
  ja: `${line} 行目を確かめてください。http:// か https:// で始まる、ドメイン名（example.com など）の URL を、500 文字以内で入力してください。`,
})

describe('enteredForVisit', () => {
  it('should open the form with nothing but the member of the staff the booking was with', () => {
    expect(enteredForVisit(visit)).toEqual({
      staffId: booking.staffId,
      overallRating: '',
      serviceRating: '',
      staffRating: '',
      atmosphereRating: '',
      cleanlinessRating: '',
      valueRating: '',
      title: '',
      comment: '',
      imageUrls: '',
    })
  })

  it('should choose nobody, and have no rating of the staff, when the member of the booking is not among those offered', () => {
    const others = staff.filter(({ id }) => id !== booking.staffId)

    expect(enteredForVisit({ ...visit, staff: others })).toMatchObject({
      staffId: '',
      staffRating: undefined,
    })
  })

  it('should have no value for the staff when the form offers nobody', () => {
    expect(enteredForVisit({ ...visit, staff: [] })).toMatchObject({
      staffId: undefined,
      staffRating: undefined,
    })
  })
})

describe('enteredOf', () => {
  it('should open the form with what the review holds: the ratings as the values of their options, the pictures a line each', () => {
    expect(enteredOf(ratedReview)).toEqual({
      staffId: undefined,
      overallRating: '5',
      serviceRating: '5',
      staffRating: '5',
      atmosphereRating: '4',
      cleanlinessRating: '5',
      valueRating: '4',
      title: '思ったとおりの色になりました',
      comment:
        '写真を見せて相談したら、髪の状態に合わせた染め方を提案してくれました。色もちもよいです。',
      imageUrls: `${PICTURE}\n${OTHER_PICTURE}`,
    })
  })

  it('should open empty where the review holds nothing, and have no rating of the staff for a review that rates nobody', () => {
    expect(enteredOf(plainReview)).toEqual({
      staffId: undefined,
      overallRating: '3',
      serviceRating: '',
      staffRating: undefined,
      atmosphereRating: '',
      cleanlinessRating: '',
      valueRating: '',
      title: '',
      comment: '',
      imageUrls: '',
    })
  })

  it('should have a rating of the staff that is not chosen for a review that rates somebody without one', () => {
    expect(enteredOf({ ...ratedReview, staffRating: null })).toMatchObject({
      staffRating: '',
    })
  })
})

describe('readNewReview', () => {
  it('should say whose visit the review is of from what the screen read, and send what the form holds', () => {
    expect(writing(everythingEntered)).toEqual({
      type: 'valid',
      value: {
        salonId: visit.booking.salonId,
        customerId: visit.customerId,
        bookingId: visit.booking.id,
        staffId: booking.staffId,
        overallRating: 5,
        serviceRating: 5,
        staffRating: 4,
        atmosphereRating: null,
        cleanlinessRating: 5,
        valueRating: 3,
        title: '思ったとおりの色になりました',
        comment: '写真を見せて相談しました。\n色もちもよいです。',
        imageUrls: [PICTURE],
      },
    })
  })

  it('should send the rating alone, with nothing for everything that was left empty', () => {
    expect(writing(LEAST)).toEqual({
      type: 'valid',
      value: {
        salonId: visit.booking.salonId,
        customerId: visit.customerId,
        bookingId: visit.booking.id,
        staffId: booking.staffId,
        overallRating: 4,
        serviceRating: null,
        staffRating: null,
        atmosphereRating: null,
        cleanlinessRating: null,
        valueRating: null,
        title: null,
        comment: null,
        imageUrls: [],
      },
    })
  })

  it.each([
    ['chose to rate nobody', { staffId: '', staffRating: undefined }],
    [
      'has no control for the staff',
      { staffId: undefined, staffRating: undefined },
    ],
    // No form sends this: a rating of the staff goes with a member
    [
      'holds a rating of the staff all the same',
      { staffId: '', staffRating: '5' },
    ],
  ])(
    'should send a review that rates nobody, without a rating of the staff, when the form %s',
    (_case, entered) => {
      expect(writing({ ...LEAST, ...entered })).toMatchObject({
        type: 'valid',
        value: { staffId: null, staffRating: null },
      })
    },
  )

  it('should send the texts without the spaces around them, and nothing for a text of spaces', () => {
    expect(
      writing({ ...LEAST, title: '  また行きます\n', comment: ' \n ' }),
    ).toMatchObject({
      type: 'valid',
      value: { title: 'また行きます', comment: null },
    })
  })

  it('should send the pictures without empty lines, without spaces around them, and each once', () => {
    expect(
      writing({
        ...LEAST,
        imageUrls: `\n  ${PICTURE}  \n\n${OTHER_PICTURE}\n${PICTURE}\n`,
      }),
    ).toMatchObject({
      type: 'valid',
      value: { imageUrls: [PICTURE, OTHER_PICTURE] },
    })
  })

  it.each([
    ['none is chosen', ''],
    ['it is below the least', '0'],
    ['it is above the most', '6'],
    ['it is no number', 'good'],
    ['it is between two of them', '4.5'],
  ])(
    'should not send a review without its rating, and say so at the rating, when %s',
    (_case, overallRating) => {
      expect(writing({ ...everythingEntered, overallRating })).toEqual({
        type: 'invalid',
        errors: { overallRating: OVERALL_RATING_MISSING },
      })
    },
  )

  it.each(['1', '2', '3', '4', '5'])(
    'should take the rating %s',
    (overallRating) => {
      expect(writing({ ...LEAST, overallRating })).toMatchObject({
        type: 'valid',
        value: { overallRating: Number(overallRating) },
      })
    },
  )

  it('should send no rating of a side for a value that is none', () => {
    expect(
      writing({ ...LEAST, serviceRating: '6', valueRating: '0' }),
    ).toMatchObject({
      type: 'valid',
      value: { serviceRating: null, valueRating: null },
    })
  })

  it('should take a title of 255 characters, counted as the API counts them, and not count the spaces around it', () => {
    expect(
      writing({ ...LEAST, title: `  ${'𠮷'.repeat(255)}  ` }),
    ).toMatchObject({ type: 'valid', value: { title: '𠮷'.repeat(255) } })
  })

  it('should not send a title of 256 characters, and say how many there may be', () => {
    expect(writing({ ...LEAST, title: 'あ'.repeat(256) })).toEqual({
      type: 'invalid',
      errors: { title: TITLE_TOO_LONG },
    })
  })

  it('should take ten pictures', () => {
    expect(writing({ ...LEAST, imageUrls: pictures(10) })).toMatchObject({
      type: 'valid',
    })
  })

  it('should count a picture that is written twice once', () => {
    expect(
      writing({ ...LEAST, imageUrls: `${pictures(10)}\n${pictures(1)}` }),
    ).toMatchObject({ type: 'valid' })
  })

  it('should not send eleven pictures, and say how many there may be', () => {
    expect(writing({ ...LEAST, imageUrls: pictures(11) })).toEqual({
      type: 'invalid',
      errors: { imageUrls: TOO_MANY_IMAGES },
    })
  })

  it('should not send a line that is no address of the web, and name the line as the control shows it', () => {
    expect(writing({ ...LEAST, imageUrls: `${PICTURE}\n\nafter.jpg` })).toEqual(
      {
        type: 'invalid',
        errors: {
          imageUrls: notAPictureAt(3),
        },
      },
    )
  })

  it('should say everything that is wrong at once, and send nothing', () => {
    expect(
      writing({
        ...everythingEntered,
        overallRating: '',
        title: 'あ'.repeat(256),
        imageUrls: 'ftp://images.example.com/after.jpg',
      }),
    ).toEqual({
      type: 'invalid',
      errors: {
        overallRating: OVERALL_RATING_MISSING,
        title: TITLE_TOO_LONG,
        imageUrls: notAPictureAt(1),
      },
    })
  })
})

describe('readReviewChange', () => {
  describe('a form that is sent as it was opened', () => {
    it('should have nothing to change for a review that holds everything', () => {
      expect(changing({})).toEqual({ type: 'unchanged' })
    })

    it('should have nothing to change for a review that holds its rating alone', () => {
      expect(changing({}, plainReview)).toEqual({ type: 'unchanged' })
    })

    it('should take spaces around a text and empty lines among the pictures for no change', () => {
      expect(
        changing({
          title: `  ${ratedReview.title}  `,
          comment: `${ratedReview.comment}\n`,
          imageUrls: `${PICTURE}\n\n${OTHER_PICTURE}\n`,
        }),
      ).toEqual({ type: 'unchanged' })
    })

    it('should take a text that is stored with spaces around it for no change', () => {
      expect(
        changing({}, { ...ratedReview, title: ' また行きます ', comment: '' }),
      ).toEqual({ type: 'unchanged' })
    })
  })

  describe('one value that was changed', () => {
    it.each<[string, Partial<Entered>, Record<string, unknown>]>([
      ['the rating', { overallRating: '2' }, { overallRating: 2 }],
      ['the rating of a side', { serviceRating: '1' }, { serviceRating: 1 }],
      [
        'the rating of a side that is taken back',
        { atmosphereRating: '' },
        { atmosphereRating: null },
      ],
      ['the rating of the staff', { staffRating: '3' }, { staffRating: 3 }],
      [
        'the rating of the staff that is taken back',
        { staffRating: '' },
        { staffRating: null },
      ],
      [
        'the rating of the cleanliness',
        { cleanlinessRating: '2' },
        { cleanlinessRating: 2 },
      ],
      ['the rating of the value', { valueRating: '5' }, { valueRating: 5 }],
      ['the title', { title: 'また行きます' }, { title: 'また行きます' }],
      ['the title that is emptied', { title: ' ' }, { title: null }],
      ['the text', { comment: '丁寧でした。' }, { comment: '丁寧でした。' }],
      ['the text that is emptied', { comment: '' }, { comment: null }],
      [
        'a picture that is taken away',
        { imageUrls: PICTURE },
        { imageUrls: [PICTURE] },
      ],
      [
        'the pictures that are all taken away',
        { imageUrls: '' },
        { imageUrls: [] },
      ],
      [
        'the pictures in another order',
        { imageUrls: `${OTHER_PICTURE}\n${PICTURE}` },
        { imageUrls: [OTHER_PICTURE, PICTURE] },
      ],
    ])('should send %s and nothing else', (_case, entered, request) => {
      expect(changing(entered)).toEqual({ type: 'valid', value: request })
    })
  })

  it('should send every value that was changed, and none that was not', () => {
    expect(
      changing({
        overallRating: '4',
        valueRating: '',
        comment: '丁寧でした。',
      }),
    ).toEqual({
      type: 'valid',
      value: { overallRating: 4, valueRating: null, comment: '丁寧でした。' },
    })
  })

  it('should send a value for what the review did not hold', () => {
    expect(
      changing(
        { serviceRating: '4', title: 'また行きます', imageUrls: PICTURE },
        plainReview,
      ),
    ).toEqual({
      type: 'valid',
      value: { serviceRating: 4, title: 'また行きます', imageUrls: [PICTURE] },
    })
  })

  it('should send nothing of the staff for a review that rates nobody: the form has no control for it', () => {
    expect(changing({ overallRating: '5' }, plainReview)).toEqual({
      type: 'valid',
      value: { overallRating: 5 },
    })
  })

  it('should not send a review without its rating, and say so at the rating', () => {
    expect(changing({ overallRating: '', title: 'また行きます' })).toEqual({
      type: 'invalid',
      errors: { overallRating: OVERALL_RATING_MISSING },
    })
  })

  it('should say everything that is wrong at once, and send nothing', () => {
    expect(
      changing({
        overallRating: '2',
        title: 'あ'.repeat(256),
        imageUrls: pictures(11),
      }),
    ).toEqual({
      type: 'invalid',
      errors: { title: TITLE_TOO_LONG, imageUrls: TOO_MANY_IMAGES },
    })
  })
})

describe('isOfTheVisit', () => {
  it('should be so when the API says that the visit cannot be written about', () => {
    expect(isOfTheVisit({ type: 'refused' })).toBe(true)
  })

  it.each(['bookingId', 'salonId', 'customerId'])(
    'should be so when the API does not take %s: the form has no control for it',
    (field) => {
      expect(
        isOfTheVisit({
          type: 'invalid',
          values: [
            { field: 'title', rule: 'too_big' },
            { field, rule: 'not_found' },
          ],
        }),
      ).toBe(true)
    },
  )

  it.each<[string, Parameters<typeof isOfTheVisit>[0]]>([
    [
      'does not take what a control holds',
      { type: 'invalid', values: [{ field: 'staffId', rule: 'not_found' }] },
    ],
    ['names no value', { type: 'invalid', values: [] }],
    ['limits the requests', { type: 'tooManyRequests' }],
    ['gives no answer', { type: 'failed' }],
  ])('should not be so when the API %s', (_case, outcome) => {
    expect(isOfTheVisit(outcome)).toBe(false)
  })
})

describe('afterReviewWriting', () => {
  it('should say that the visit was read again when the API says that it cannot be written about', () => {
    expect(afterReviewWriting({ type: 'refused' })).toEqual({
      message: VISIT_READ_AGAIN,
      errors: {},
    })
  })

  it.each(['bookingId', 'salonId', 'customerId'])(
    'should say that the visit was read again, and nothing at a control, when the API does not take %s',
    (field) => {
      expect(
        afterReviewWriting({
          type: 'invalid',
          values: [
            { field: 'title', rule: 'too_big' },
            { field, rule: 'not_found' },
          ],
        }),
      ).toEqual({ message: VISIT_READ_AGAIN, errors: {} })
    },
  )

  it('should say at the staff that the member can no longer be chosen, and what to choose', () => {
    expect(
      afterReviewWriting({
        type: 'invalid',
        values: [{ field: 'staffId', rule: 'not_found' }],
      }),
    ).toEqual({ message: undefined, errors: { staffId: STAFF_GONE } })
  })

  it('should say that there were too many requests', () => {
    expect(afterReviewWriting({ type: 'tooManyRequests' })).toEqual({
      message: TOO_MANY_REQUESTS,
      errors: {},
    })
  })

  it('should say that nothing was sent when there was no answer', () => {
    expect(afterReviewWriting({ type: 'failed' })).toEqual({
      message: NOT_SENT,
      errors: {},
    })
  })
})

describe.each([
  ['afterReviewWriting', afterReviewWriting],
  ['afterReviewChange', afterReviewChange],
])('%s', (_name, saysAfter) => {
  it.each([
    ['title', 'too_big', TITLE_TOO_LONG],
    ['title', 'invalid_type', UNACCEPTABLE],
    ['comment', 'invalid_type', UNACCEPTABLE],
    ['imageUrls', 'too_big', TOO_MANY_IMAGES],
    ['imageUrls', 'duplicate', UNACCEPTABLE],
    ['overallRating', 'too_big', UNACCEPTABLE],
    ['serviceRating', 'too_small', UNACCEPTABLE],
    ['staffRating', 'not_allowed', UNACCEPTABLE],
    ['atmosphereRating', 'too_big', UNACCEPTABLE],
    ['cleanlinessRating', 'too_big', UNACCEPTABLE],
    ['valueRating', 'too_big', UNACCEPTABLE],
  ])(
    'should say at the control of %s what the rule %s means there',
    (field, rule, message) => {
      expect(saysAfter({ type: 'invalid', values: [{ field, rule }] })).toEqual(
        {
          message: undefined,
          errors: { [field]: message },
        },
      )
    },
  )

  it('should say what the API says about one picture at the control of them all', () => {
    expect(
      saysAfter({
        type: 'invalid',
        values: [{ field: 'imageUrls.3', rule: 'invalid_format' }],
      }),
    ).toEqual({ message: undefined, errors: { imageUrls: UNACCEPTABLE } })
  })

  it('should say the first thing the API says about a value', () => {
    expect(
      saysAfter({
        type: 'invalid',
        values: [
          { field: 'imageUrls', rule: 'too_big' },
          { field: 'imageUrls.0', rule: 'invalid_format' },
          { field: 'title', rule: 'too_big' },
        ],
      }),
    ).toEqual({
      message: undefined,
      errors: { imageUrls: TOO_MANY_IMAGES, title: TITLE_TOO_LONG },
    })
  })

  it('should say of the attempt that something is wrong when the API names no value', () => {
    expect(saysAfter({ type: 'invalid', values: [] })).toEqual({
      message: CHECK_AGAIN,
      errors: {},
    })
  })

  it('should say of the attempt that something is wrong when the API names a value the form has no control for', () => {
    expect(
      saysAfter({
        type: 'invalid',
        values: [{ field: 'helpfulCount', rule: 'unrecognized_keys' }],
      }),
    ).toEqual({ message: CHECK_AGAIN, errors: {} })
  })

  it('should leave out a value the form has no control for when it can say something at a control', () => {
    expect(
      saysAfter({
        type: 'invalid',
        values: [
          { field: 'helpfulCount', rule: 'unrecognized_keys' },
          { field: 'comment', rule: 'invalid_type' },
        ],
      }),
    ).toEqual({ message: undefined, errors: { comment: UNACCEPTABLE } })
  })
})

describe('afterReviewChange', () => {
  it('should say that there were too many requests', () => {
    expect(afterReviewChange({ type: 'tooManyRequests' })).toEqual({
      message: TOO_MANY_REQUESTS,
      errors: {},
    })
  })

  it('should say that nothing was sent when there was no answer', () => {
    expect(afterReviewChange({ type: 'failed' })).toEqual({
      message: NOT_SENT,
      errors: {},
    })
  })
})
