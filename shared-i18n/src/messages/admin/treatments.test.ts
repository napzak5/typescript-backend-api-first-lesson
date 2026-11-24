import { describe, expect, it } from 'vitest'
import type { LocalizedText } from '../../languages/localized-text'
import { messagesOf } from '../__tests__/found-messages'
import { fieldMessages } from '../ui/fields'
import { adminCustomerMessages, adminTreatmentMessages } from './index'

const { booking, form, frame, photos, record, removal, statistics } =
  adminTreatmentMessages

/** A customer as a sentence names them */
const NAME = adminCustomerMessages.naming.honored('山田 花子')

/** A day, a moment and a period, as the formats write them */
const DAY = { en: 'Fri, November 20, 2026', ja: '2026年11月20日（金）' }
const MOMENT = {
  en: 'Fri, November 20, 2026 at 10:05',
  ja: '2026年11月20日（金） 10:05',
}
const PERIOD = {
  en: 'Sun, November 1, 2026 – Fri, November 20, 2026',
  ja: '2026年11月1日（日）〜2026年11月20日（金）',
}

/** A photo taken after the treatment, from the side */
const PHOTO = photos.photoOf(photos.types.after, '側面')

/** Every message that is made from a value, with the value and what it says */
const MADE: [string, LocalizedText, LocalizedText][] = [
  [
    'adminTreatmentMessages.frame.customerOf',
    frame.customerOf(NAME),
    { en: 'Customer: 山田 花子', ja: 'お客様：山田 花子 様' },
  ],
  [
    'adminTreatmentMessages.frame.recordOf',
    frame.recordOf(NAME, 'BK-4F7H-2KQM'),
    {
      en: 'Treatment record of 山田 花子 (booking BK-4F7H-2KQM)',
      ja: '山田 花子 様の施術記録（予約番号 BK-4F7H-2KQM）',
    },
  ],
  [
    'adminTreatmentMessages.rated',
    adminTreatmentMessages.rated(5, adminTreatmentMessages.satisfactions[5]),
    { en: '5 (Very satisfied)', ja: '5（とても満足）' },
  ],
  [
    'adminTreatmentMessages.recordsOf',
    adminTreatmentMessages.recordsOf(1234),
    { en: '1,234 records', ja: '1,234 件' },
  ],
  [
    'adminTreatmentMessages.record.bookingOf',
    record.bookingOf('BK-4F7H-2KQM', DAY),
    {
      en: 'BK-4F7H-2KQM (Fri, November 20, 2026)',
      ja: 'BK-4F7H-2KQM（2026年11月20日（金））',
    },
  ],
  [
    'adminTreatmentMessages.table.servicesOf',
    adminTreatmentMessages.table.servicesOf(['カット', 'カラー']),
    { en: 'カット, カラー', ja: 'カット、カラー' },
  ],
  [
    'adminTreatmentMessages.removal.title',
    removal.title(NAME),
    {
      en: 'Remove the treatment record of 山田 花子?',
      ja: '山田 花子 様の施術記録を削除しますか？',
    },
  ],
  [
    'adminTreatmentMessages.removal.done',
    removal.done(NAME),
    {
      en: 'Removed the treatment record of 山田 花子.',
      ja: '山田 花子 様の施術記録を削除しました。',
    },
  ],
  [
    'adminTreatmentMessages.booking.writtenAt',
    booking.writtenAt(MOMENT),
    {
      en: 'A treatment record was written on Fri, November 20, 2026 at 10:05.',
      ja: '2026年11月20日（金） 10:05に書いた施術記録があります。',
    },
  ],
  [
    'adminTreatmentMessages.form.servicesDescription',
    form.servicesDescription(20),
    { en: 'Choose 1 to 20.', ja: '1 件から 20 件まで選びます。' },
  ],
  [
    'adminTreatmentMessages.form.techniquesDescription',
    form.techniquesDescription(20),
    {
      en: 'Separate the names of the techniques with commas. Up to 20.',
      ja: '技法の名前を、「、」か「,」で区切って書きます。20 件までです。',
    },
  ],
  [
    'adminTreatmentMessages.form.processingTimeDescription',
    form.processingTimeDescription(1440),
    { en: 'Minutes from 0 to 1,440.', ja: '0 から 1,440 までの分。' },
  ],
  [
    'adminTreatmentMessages.form.materialOf',
    form.materialOf(2),
    { en: 'Material 2', ja: '2 件目の商材' },
  ],
  [
    'adminTreatmentMessages.form.removeMaterial',
    form.removeMaterial(2),
    { en: 'Remove material 2', ja: '2 件目の商材を外す' },
  ],
  [
    'adminTreatmentMessages.form.mostMaterials',
    form.mostMaterials(50),
    {
      en: 'Up to 50 materials can be recorded.',
      ja: '使った商材は、50 件まで書けます。',
    },
  ],
  [
    'adminTreatmentMessages.form.nextRecommendedServicesDescription',
    form.nextRecommendedServicesDescription(20),
    { en: 'Up to 20 can be chosen.', ja: '20 件まで選べます。' },
  ],
  [
    'adminTreatmentMessages.form.errors.tooManyServices',
    form.errors.tooManyServices(20),
    {
      en: 'Choose up to 20 services provided.',
      ja: '提供したサービスは、20 件までにしてください。',
    },
  ],
  [
    'adminTreatmentMessages.form.errors.tooManyTechniques',
    form.errors.tooManyTechniques(20),
    {
      en: 'Enter up to 20 techniques.',
      ja: '技法は、20 件までで入力してください。',
    },
  ],
  [
    'adminTreatmentMessages.form.errors.processingTime',
    form.errors.processingTime(1440),
    {
      en: 'Enter the treatment time as a whole number of minutes from 0 to 1,440.',
      ja: '施術時間は、0 から 1,440 までの分の整数で入力してください。',
    },
  ],
  [
    'adminTreatmentMessages.form.errors.nextRecommendedDateTooEarly',
    form.errors.nextRecommendedDateTooEarly(DAY),
    {
      en: 'Make the next recommended date the day of the booking (Fri, November 20, 2026) or a later one.',
      ja: '次に勧める日は、予約の日（2026年11月20日（金））から後の日にしてください。',
    },
  ],
  [
    'adminTreatmentMessages.form.errors.tooManyNextServices',
    form.errors.tooManyNextServices(20),
    {
      en: 'Choose up to 20 next recommended services.',
      ja: '次に勧めるサービスは、20 件までにしてください。',
    },
  ],
  [
    'adminTreatmentMessages.form.written.entry',
    form.written.entry(NAME),
    {
      en: 'Wrote the treatment record of 山田 花子.',
      ja: '山田 花子 様の施術記録を書きました。',
    },
  ],
  [
    'adminTreatmentMessages.form.written.change',
    form.written.change(NAME),
    {
      en: 'Saved the treatment record of 山田 花子.',
      ja: '山田 花子 様の施術記録を直しました。',
    },
  ],
  [
    'adminTreatmentMessages.photos.photoOf',
    PHOTO,
    { en: 'After the treatment (側面)', ja: '施術後の写真（側面）' },
  ],
  [
    'adminTreatmentMessages.photos.list.photoAt',
    photos.list.photoAt(2, PHOTO),
    {
      en: 'Photo 2: After the treatment (側面)',
      ja: '2 枚目：施術後の写真（側面）',
    },
  ],
  [
    'adminTreatmentMessages.photos.list.openOf',
    photos.list.openOf(2),
    { en: 'Open photo 2', ja: '2 枚目の写真を開く' },
  ],
  [
    'adminTreatmentMessages.photos.list.removeOf',
    photos.list.removeOf(2),
    { en: 'Remove photo 2', ja: '2 枚目の写真を外す' },
  ],
  [
    'adminTreatmentMessages.photos.list.full',
    photos.list.full(20),
    {
      en: 'Up to 20 treatment photos can be recorded. Remove a photo before adding one.',
      ja: '施術写真は、20 枚まで記録できます。足すときは、写真を外してから足してください。',
    },
  ],
  [
    'adminTreatmentMessages.photos.removal.title',
    photos.removal.title(photos.list.photoAt(2, PHOTO)),
    {
      en: 'Remove “Photo 2: After the treatment (側面)”?',
      ja: '2 枚目：施術後の写真（側面）を外しますか？',
    },
  ],
  [
    'adminTreatmentMessages.photos.removal.done',
    photos.removal.done(PHOTO),
    {
      en: 'Removed the photo “After the treatment (側面)”.',
      ja: '施術後の写真（側面）を外しました。',
    },
  ],
  [
    'adminTreatmentMessages.photos.form.photoOf',
    photos.form.photoOf(2),
    { en: 'Photo 2', ja: '2 枚目の写真' },
  ],
  [
    'adminTreatmentMessages.photos.form.angleDescription',
    photos.form.angleDescription(fieldMessages.upTo(50)),
    {
      en: 'Front, side, back and so on. Up to 50 characters.',
      ja: '正面、側面、後ろなど。50 文字まで。',
    },
  ],
  [
    'adminTreatmentMessages.photos.form.removeRow',
    photos.form.removeRow(2),
    { en: 'Remove the fields of photo 2', ja: '2 枚目の写真の欄を外す' },
  ],
  [
    'adminTreatmentMessages.photos.form.room',
    photos.form.room(3),
    {
      en: 'This treatment record can take 3 more photos.',
      ja: 'この施術記録に足せる写真は、あと 3 枚です。',
    },
  ],
  [
    'adminTreatmentMessages.photos.errors.repeated',
    photos.errors.repeated(1),
    {
      en: 'This is the same URL as photo 1. Enter the URL of another photo, or remove the fields of this photo.',
      ja: '1 枚目と同じ URL です。ほかの写真の URL を入力するか、この写真の欄を外してください。',
    },
  ],
  [
    'adminTreatmentMessages.photos.errors.noRoom',
    photos.errors.noRoom(2, 20),
    {
      en: 'Up to 2 more photos can be added to this treatment record. Remove some of the fields of the photos.',
      ja: 'この施術記録には、あと 2 枚まで足せます。写真の欄を減らしてください。',
    },
  ],
  [
    'adminTreatmentMessages.photos.added',
    photos.added(2),
    { en: 'Added 2 treatment photos.', ja: '施術写真を 2 枚足しました。' },
  ],
  [
    'adminTreatmentMessages.photos.full',
    photos.full(20),
    {
      en: 'This treatment record has 20 photos. Remove a photo before adding one.',
      ja: 'この施術記録の写真は、20 枚になりました。写真を外してから足してください。',
    },
  ],
  [
    'adminTreatmentMessages.statistics.of',
    statistics.of(PERIOD),
    {
      en: 'Treatment records for Sun, November 1, 2026 – Fri, November 20, 2026',
      ja: '2026年11月1日（日）〜2026年11月20日（金）に書いた施術記録',
    },
  ],
]

describe('the messages of the treatment records of the admin application', () => {
  it.each(MADE)(
    'should name the value it is made from: %s',
    (_where, made, expected) => {
      // Assert
      expect(made).toEqual(expected)
    },
  )

  it('should have a value in this test for every message that is made from one', () => {
    // Assert
    expect(MADE.map(([where]) => where).toSorted()).toEqual(
      messagesOf({ adminTreatmentMessages }, '').made.toSorted(),
    )
  })

  it('should name a photo without an angle by when it was taken alone', () => {
    // Assert
    expect(photos.photoOf(photos.types.before, null)).toEqual({
      en: 'Before the treatment',
      ja: '施術前の写真',
    })
  })

  it('should say that a record without room takes no photo, as its screen says', () => {
    // Assert
    expect(photos.errors.noRoom(0, 20)).toEqual(photos.full(20))
  })

  it('should count one in the singular', () => {
    // Assert
    expect([
      adminTreatmentMessages.recordsOf(1).en,
      photos.form.room(1).en,
      photos.added(1).en,
      photos.list.full(1).en,
      photos.full(1).en,
      form.mostMaterials(1).en,
    ]).toEqual([
      '1 record',
      'This treatment record can take 1 more photo.',
      'Added 1 treatment photo.',
      'Up to 1 treatment photo can be recorded. Remove a photo before adding one.',
      'This treatment record has 1 photo. Remove a photo before adding one.',
      'Up to 1 material can be recorded.',
    ])
  })
})
