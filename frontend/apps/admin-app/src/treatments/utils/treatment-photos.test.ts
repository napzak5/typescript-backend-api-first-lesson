import type {
  ModelsTreatmentPhotoBulkCreateRequest,
  ModelsTreatmentPhotoResponse,
} from '@beauty-salon-frontend/api-client'
import type { FormSays } from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { describe, expect, it } from 'vitest'
import type { PhotoRemoval, PhotosAdding } from '../api/treatments-api'
import { aPhoto, aTreatment, photos } from '../components/examples'
import {
  afterPhotoRemoval,
  afterPhotosAdded,
  PHOTO_TYPE_CHOICES,
  type PhotoRemovalSays,
  type PhotosRead,
  photoNameOf,
  photoUseOf,
  readPhotos,
  roomOf,
} from './treatment-photos'

/** A photo as its row of the form holds it; the checkboxes that are not chosen are not sent */
type Row = Partial<
  Record<
    'photoType' | 'photoUrl' | 'thumbnailUrl' | 'angle' | 'description',
    string
  >
> & { customerConsent?: boolean; isPublic?: boolean }

/** The values of the form, with its rows in their order */
const formOf = (...rows: Row[]): FormData => {
  const values = new FormData()
  rows.forEach((row, index) => {
    values.set(`photos.${index}.photoType`, row.photoType ?? 'after')
    values.set(
      `photos.${index}.photoUrl`,
      row.photoUrl ?? `https://photos.example.com/${index}.jpg`,
    )
    values.set(`photos.${index}.thumbnailUrl`, row.thumbnailUrl ?? '')
    values.set(`photos.${index}.angle`, row.angle ?? '')
    values.set(`photos.${index}.description`, row.description ?? '')
    if (row.customerConsent === true) {
      values.set(`photos.${index}.customerConsent`, 'on')
    }
    if (row.isPublic === true) {
      values.set(`photos.${index}.isPublic`, 'on')
    }
  })

  return values
}

/** So many photos of a record, at the addresses and orders of their numbers */
const photosOf = (count: number): ModelsTreatmentPhotoResponse[] =>
  Array.from({ length: count }, (_, index) =>
    aPhoto({
      id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      photoUrl: `https://photos.example.com/held/${index}.jpg`,
      sortOrder: index,
    }),
  )

describe('photoNameOf', () => {
  it.each<[string, ModelsTreatmentPhotoResponse, LocalizedText]>([
    [
      'with its angle',
      aPhoto(),
      { en: 'Before the treatment (側面)', ja: '施術前の写真（側面）' },
    ],
    [
      'without an angle',
      aPhoto({ photoType: 'during', angle: null }),
      { en: 'During the treatment', ja: '施術中の写真' },
    ],
  ])('should name a photo %s', (_case, photo, name) => {
    // Act
    const named = photoNameOf(photo)

    // Assert
    expect(named).toEqual(name)
  })

  it('should offer when a photo was taken, in the order of a treatment', () => {
    // Assert
    expect(PHOTO_TYPE_CHOICES).toEqual([
      { value: 'before', label: { en: 'Before the treatment', ja: '施術前' } },
      { value: 'during', label: { en: 'During the treatment', ja: '施術中' } },
      { value: 'after', label: { en: 'After the treatment', ja: '施術後' } },
      { value: 'other', label: { en: 'Other', ja: 'そのほか' } },
    ])
  })
})

describe('photoUseOf', () => {
  it.each<[boolean, boolean, LocalizedText]>([
    [
      true,
      true,
      {
        en: 'The customer agreed. It may be shown outside the salon.',
        ja: 'お客様の同意あり。サロンの外にも見せられます。',
      },
    ],
    [
      false,
      true,
      {
        en: 'The customer agreed. It is used inside the salon only.',
        ja: 'お客様の同意あり。サロンの中だけで使います。',
      },
    ],
    [
      false,
      false,
      {
        en: 'The customer did not agree. It is used inside the salon only.',
        ja: 'お客様の同意なし。サロンの中だけで使います。',
      },
    ],
  ])(
    'should say how a photo public %s with consent %s may be used',
    (isPublic, customerConsent, use) => {
      // Act
      const said = photoUseOf({ isPublic, customerConsent })

      // Assert
      expect(said).toEqual(use)
    },
  )
})

describe('roomOf', () => {
  it.each<[number, number]>([
    [0, 20],
    [3, 17],
    [20, 0],
  ])('should leave a record of %i photos room for %i', (held, room) => {
    expect(roomOf({ photos: photosOf(held) })).toBe(room)
  })
})

describe('readPhotos', () => {
  it('should read the photos after those the record holds, in the order of the rows', () => {
    // Arrange
    const record = aTreatment({ photos })

    // Act
    const read = readPhotos(
      formOf(
        {
          photoType: 'before',
          photoUrl: ' https://photos.example.com/a.jpg ',
          thumbnailUrl: 'http://photos.example.com/a-small.jpg',
          angle: ' 正面 ',
          description: ' 根元の伸び\n2 センチ ',
          customerConsent: true,
          isPublic: true,
        },
        { photoType: 'other', angle: ' ', description: ' ' },
      ),
      record,
    )

    // Assert
    expect(read).toEqual<PhotosRead>({
      type: 'valid',
      value: {
        photos: [
          {
            photoType: 'before',
            photoUrl: 'https://photos.example.com/a.jpg',
            thumbnailUrl: 'http://photos.example.com/a-small.jpg',
            angle: '正面',
            description: '根元の伸び\n2 センチ',
            isPublic: true,
            customerConsent: true,
            sortOrder: 3,
          },
          {
            photoType: 'other',
            photoUrl: 'https://photos.example.com/1.jpg',
            thumbnailUrl: null,
            angle: null,
            description: null,
            isPublic: false,
            customerConsent: false,
            sortOrder: 4,
          },
        ],
      },
    })
  })

  it('should give the photos of a record without photos the first orders', () => {
    // Act
    const read = readPhotos(formOf({}), aTreatment())

    // Assert
    expect(read).toMatchObject({
      type: 'valid',
      value: { photos: [{ sortOrder: 0 }] },
    })
  })

  it.each<[string, Row, string, LocalizedText]>([
    [
      'no time it was taken',
      { photoType: '' },
      'photoType',
      {
        en: 'Choose the kind of the photo.',
        ja: '写真の区分を選んでください。',
      },
    ],
    [
      'a time that is none',
      { photoType: 'later' },
      'photoType',
      {
        en: 'Choose the kind of the photo.',
        ja: '写真の区分を選んでください。',
      },
    ],
    [
      'no address',
      { photoUrl: ' ' },
      'photoUrl',
      {
        en: 'Enter the URL of the photo.',
        ja: '写真の URL を入力してください。',
      },
    ],
    [
      'an address that is no web address',
      { photoUrl: 'ftp://photos.example.com/a.jpg' },
      'photoUrl',
      {
        en: 'Enter a URL that begins with http:// or https:// and has a domain name (such as example.com), up to 500 characters.',
        ja: 'http:// か https:// で始まる、ドメイン名（example.com など）の URL を、500 文字以内で入力してください。',
      },
    ],
    [
      'an address that is not one',
      { photoUrl: 'photos.example.com/a.jpg' },
      'photoUrl',
      {
        en: 'Enter a URL that begins with http:// or https:// and has a domain name (such as example.com), up to 500 characters.',
        ja: 'http:// か https:// で始まる、ドメイン名（example.com など）の URL を、500 文字以内で入力してください。',
      },
    ],
    [
      'an address longer than the API keeps',
      { photoUrl: `https://photos.example.com/${'a'.repeat(474)}` },
      'photoUrl',
      {
        en: 'Enter a URL that begins with http:// or https:// and has a domain name (such as example.com), up to 500 characters.',
        ja: 'http:// か https:// で始まる、ドメイン名（example.com など）の URL を、500 文字以内で入力してください。',
      },
    ],
    [
      'an address of a machine by its number',
      { photoUrl: 'http://127.0.0.1:4100/a.jpg' },
      'photoUrl',
      {
        en: 'Enter a URL that begins with http:// or https:// and has a domain name (such as example.com), up to 500 characters.',
        ja: 'http:// か https:// で始まる、ドメイン名（example.com など）の URL を、500 文字以内で入力してください。',
      },
    ],
    [
      'an address of this machine',
      { photoUrl: 'http://localhost/a.jpg' },
      'photoUrl',
      {
        en: 'Enter a URL that begins with http:// or https:// and has a domain name (such as example.com), up to 500 characters.',
        ja: 'http:// か https:// で始まる、ドメイン名（example.com など）の URL を、500 文字以内で入力してください。',
      },
    ],
    [
      'a smaller photo at an address that is not one',
      { thumbnailUrl: 'small.jpg' },
      'thumbnailUrl',
      {
        en: 'Enter a URL that begins with http:// or https:// and has a domain name (such as example.com), up to 500 characters.',
        ja: 'http:// か https:// で始まる、ドメイン名（example.com など）の URL を、500 文字以内で入力してください。',
      },
    ],
    [
      'an angle longer than the API keeps',
      { angle: 'あ'.repeat(51) },
      'angle',
      {
        en: 'Angle: enter up to 50 characters.',
        ja: '撮った向きは、50 文字以内で入力してください。',
      },
    ],
    [
      'a photo shown outside without the consent of the customer',
      { isPublic: true },
      'isPublic',
      {
        en: 'A photo the customer did not agree to cannot be shown outside the salon. Check that the customer agrees, or clear this check box.',
        ja: 'お客様の同意がない写真は、サロンの外に見せられません。お客様の同意を確かめるか、このチェックを外してください。',
      },
    ],
    [
      'the address of a photo the record holds',
      { photoUrl: 'https://photos.example.com/treatments/before-side.jpg' },
      'photoUrl',
      {
        en: 'This treatment record has a photo with the same URL. Enter the URL of another photo, or remove the fields of this photo.',
        ja: 'この施術記録には、同じ URL の写真があります。ほかの写真の URL を入力するか、この写真の欄を外してください。',
      },
    ],
  ])('should refuse %s', (_case, row, control, message) => {
    // Act
    const read = readPhotos(formOf(row), aTreatment({ photos }))

    // Assert
    expect(read).toEqual<PhotosRead>({
      type: 'invalid',
      errors: { [`photos.0.${control}`]: message },
    })
  })

  it('should take an address of 500 characters and an angle of 50, counted as the API counts them', () => {
    // Act
    const read = readPhotos(
      formOf({
        photoUrl: `https://photos.example.com/${'a'.repeat(473)}`,
        angle: '𠮷'.repeat(50),
      }),
      aTreatment(),
    )

    // Assert
    expect(read.type).toBe('valid')
  })

  it('should refuse the address of an earlier row, named by its number', () => {
    // Act
    const read = readPhotos(
      formOf(
        { photoUrl: 'https://photos.example.com/a.jpg' },
        { photoUrl: 'https://photos.example.com/b.jpg' },
        { photoUrl: 'https://photos.example.com/a.jpg' },
      ),
      aTreatment(),
    )

    // Assert
    expect(read).toEqual<PhotosRead>({
      type: 'invalid',
      errors: {
        'photos.2.photoUrl': {
          en: 'This is the same URL as photo 1. Enter the URL of another photo, or remove the fields of this photo.',
          ja: '1 枚目と同じ URL です。ほかの写真の URL を入力するか、この写真の欄を外してください。',
        },
      },
    })
  })

  it.each<[number, number, LocalizedText]>([
    [
      18,
      3,
      {
        en: 'Up to 2 more photos can be added to this treatment record. Remove some of the fields of the photos.',
        ja: 'この施術記録には、あと 2 枚まで足せます。写真の欄を減らしてください。',
      },
    ],
    [
      20,
      1,
      {
        en: 'This treatment record has 20 photos. Remove a photo before adding one.',
        ja: 'この施術記録の写真は、20 枚になりました。写真を外してから足してください。',
      },
    ],
  ])(
    'should add nothing to a record of %i photos that has no room for %i',
    (held, count, message) => {
      // Act
      const read = readPhotos(
        formOf(...Array.from({ length: count }, (): Row => ({}))),
        aTreatment({ photos: photosOf(held) }),
      )

      // Assert
      expect(read).toEqual<PhotosRead>({ type: 'noRoom', message })
    },
  )
})

const request: ModelsTreatmentPhotoBulkCreateRequest = {
  photos: [
    {
      photoType: 'after',
      photoUrl: 'https://photos.example.com/a.jpg',
      thumbnailUrl: null,
      angle: null,
      description: null,
      isPublic: false,
      customerConsent: true,
      sortOrder: 3,
    },
    {
      photoType: 'after',
      photoUrl: 'https://photos.example.com/b.jpg',
      thumbnailUrl: null,
      angle: null,
      description: null,
      isPublic: false,
      customerConsent: true,
      sortOrder: 4,
    },
  ],
}

describe('afterPhotosAdded', () => {
  it('should say under the controls what the API refused, the first thing it says of each', () => {
    // Act
    const said = afterPhotosAdded(
      {
        type: 'invalid',
        values: [
          { field: 'photos.1.photoUrl', rule: 'invalid_format' },
          { field: 'photos.1.photoUrl', rule: 'custom' },
          { field: 'photos.0.isPublic', rule: 'custom' },
          { field: 'photos.0.photoType', rule: 'invalid_value' },
          { field: 'photos.0.angle', rule: 'too_big' },
        ],
      },
      request,
    )

    // Assert
    expect(said).toEqual<FormSays<LocalizedText>>({
      message: undefined,
      errors: {
        'photos.1.photoUrl': {
          en: 'Enter a URL that begins with http:// or https:// and has a domain name (such as example.com), up to 500 characters.',
          ja: 'http:// か https:// で始まる、ドメイン名（example.com など）の URL を、500 文字以内で入力してください。',
        },
        'photos.0.isPublic': {
          en: 'A photo the customer did not agree to cannot be shown outside the salon. Check that the customer agrees, or clear this check box.',
          ja: 'お客様の同意がない写真は、サロンの外に見せられません。お客様の同意を確かめるか、このチェックを外してください。',
        },
        'photos.0.photoType': {
          en: 'Choose the kind of the photo.',
          ja: '写真の区分を選んでください。',
        },
        'photos.0.angle': {
          en: 'Angle: enter up to 50 characters.',
          ja: '撮った向きは、50 文字以内で入力してください。',
        },
      },
    })
  })

  it('should ask to check the form again for what it has no control of', () => {
    // Act
    const said = afterPhotosAdded(
      {
        type: 'invalid',
        values: [{ field: 'photos.0.sortOrder', rule: 'too_big' }],
      },
      request,
    )

    // Assert
    expect(said).toEqual<FormSays<LocalizedText>>({
      message: {
        en: 'Check what you entered and try again.',
        ja: '入力した内容を確かめて、もう一度お試しください。',
      },
      errors: {},
    })
  })

  it('should say under its control an address the record holds now', () => {
    // Act
    const said = afterPhotosAdded(
      {
        type: 'held',
        record: aTreatment({
          photos: [aPhoto({ photoUrl: 'https://photos.example.com/b.jpg' })],
        }),
      },
      request,
    )

    // Assert
    expect(said).toEqual<FormSays<LocalizedText>>({
      message: undefined,
      errors: {
        'photos.1.photoUrl': {
          en: 'This treatment record has a photo with the same URL. Enter the URL of another photo, or remove the fields of this photo.',
          ja: 'この施術記録には、同じ URL の写真があります。ほかの写真の URL を入力するか、この写真の欄を外してください。',
        },
      },
    })
  })

  it('should say how many photos a record that was added to meanwhile has room for', () => {
    // Act
    const said = afterPhotosAdded(
      { type: 'held', record: aTreatment({ photos: photosOf(19) }) },
      request,
    )

    // Assert
    expect(said).toEqual<FormSays<LocalizedText>>({
      message: {
        en: 'Up to 1 more photo can be added to this treatment record. Remove some of the fields of the photos.',
        ja: 'この施術記録には、あと 1 枚まで足せます。写真の欄を減らしてください。',
      },
      errors: {},
    })
  })

  it.each<
    [
      string,
      PhotosAdding & { type: 'forbidden' | 'tooManyRequests' | 'failed' },
      LocalizedText,
    ]
  >([
    [
      'a refusal of the role',
      { type: 'forbidden' },
      {
        en: 'This account cannot add treatment photos.',
        ja: 'このアカウントでは、施術写真を足せません。',
      },
    ],
    [
      'too many requests',
      { type: 'tooManyRequests' },
      {
        en: 'There are too many requests. Wait a while and try again.',
        ja: 'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
      },
    ],
    [
      'a failure',
      { type: 'failed' },
      {
        en: 'The treatment photos could not be added. Check your connection and try again.',
        ja: '施術写真を足せませんでした。通信の状態を確かめて、もう一度お試しください。',
      },
    ],
  ])('should say what came of %s', (_case, outcome, message) => {
    // Act
    const says = afterPhotosAdded(outcome, request)

    // Assert
    expect(says).toEqual<FormSays<LocalizedText>>({ message, errors: {} })
  })
})

describe('afterPhotoRemoval', () => {
  it.each<[string, PhotoRemoval, PhotoRemovalSays]>([
    [
      'a removal',
      { type: 'removed' },
      {
        type: 'done',
        message: {
          en: 'Removed the photo “Before the treatment (側面)”.',
          ja: '施術前の写真（側面）を外しました。',
        },
      },
    ],
    [
      'a photo taken away meanwhile',
      { type: 'notFound' },
      {
        type: 'refused',
        message: {
          en: 'This photo was removed meanwhile.',
          ja: 'この写真は、その間に外されていました。',
        },
      },
    ],
    [
      'a refusal of the role',
      { type: 'forbidden' },
      {
        type: 'refused',
        message: {
          en: 'This account cannot remove treatment photos.',
          ja: 'このアカウントでは、施術写真を外せません。',
        },
      },
    ],
    [
      'too many requests',
      { type: 'tooManyRequests' },
      {
        type: 'again',
        message: {
          en: 'There are too many requests. Wait a while and try again.',
          ja: 'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
        },
      },
    ],
    [
      'a failure',
      { type: 'failed' },
      {
        type: 'again',
        message: {
          en: 'The treatment photo could not be removed. Check your connection and try again.',
          ja: '施術写真を外せませんでした。通信の状態を確かめて、もう一度お試しください。',
        },
      },
    ],
  ])('should say what came of %s', (_case, outcome, says) => {
    // Act
    const said = afterPhotoRemoval(outcome, {
      en: 'Before the treatment (側面)',
      ja: '施術前の写真（側面）',
    })

    // Assert
    expect(said).toEqual(says)
  })
})
