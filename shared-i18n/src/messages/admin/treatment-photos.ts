import { numberOf } from '../../formats/numbers'
import { type LocalizedText, text } from '../../languages/localized-text'
import { countedIn, followed } from '../written'
import { TREATMENT_WORDS } from './treatment-words'

/*
 * What the photos of a treatment record say: when a photo was taken and
 * how the customer let it be used, the list of the photos of a record with
 * the removal of one, the form that adds photos with what is wrong with
 * its values, and what is said after photos were added. The angles, the
 * descriptions and the addresses of the photos stand as they were written.
 */

/** A photo by its number, counted from 1: 「2 枚目の写真」 */
const photoNumbered = (number: number): LocalizedText =>
  text({
    en: `Photo ${numberOf(number).en}`,
    ja: `${numberOf(number).ja} 枚目の写真`,
  })

/** What is said of a form that holds the photo of the same address twice, or of one the record holds */
const ANOTHER_ADDRESS = text({
  en: 'Enter the URL of another photo, or remove the fields of this photo.',
  ja: 'ほかの写真の URL を入力するか、この写真の欄を外してください。',
})

/** How many more photos a record takes: 「2 枚」, "2 more photos" */
const morePhotos = (count: number): string =>
  countedIn(count, 'more photo', 'more photos')

/** The record has the most photos a record holds */
const full = (most: number): LocalizedText =>
  text({
    en: `This treatment record has ${countedIn(most, 'photo', 'photos')}. Remove a photo before adding one.`,
    ja: `この施術記録の写真は、${numberOf(most).ja} 枚になりました。写真を外してから足してください。`,
  })

export const treatmentPhotoMessages = {
  /** When a photo was taken, by the values the API keeps */
  types: {
    before: text({ en: 'Before the treatment', ja: '施術前' }),
    during: text({ en: 'During the treatment', ja: '施術中' }),
    after: text({ en: 'After the treatment', ja: '施術後' }),
    other: text({ en: 'Other', ja: 'そのほか' }),
  },
  /** What a photo shows, by when it was taken and from where: 「施術後の写真（正面）」 */
  photoOf: (type: LocalizedText, angle: string | null) =>
    angle === null
      ? text({ en: type.en, ja: `${type.ja}の写真` })
      : text({
          en: `${type.en} (${angle})`,
          ja: `${type.ja}の写真（${angle}）`,
        }),
  /** How a photo may be used, as the customer agreed */
  use: {
    public: text({
      en: 'The customer agreed. It may be shown outside the salon.',
      ja: 'お客様の同意あり。サロンの外にも見せられます。',
    }),
    inside: text({
      en: 'The customer agreed. It is used inside the salon only.',
      ja: 'お客様の同意あり。サロンの中だけで使います。',
    }),
    withoutConsent: text({
      en: 'The customer did not agree. It is used inside the salon only.',
      ja: 'お客様の同意なし。サロンの中だけで使います。',
    }),
  },
  /** The photos of a record */
  list: {
    title: text({ en: 'Treatment photos', ja: '施術写真' }),
    add: TREATMENT_WORDS.addPhotos,
    none: text({ en: 'No treatment photos.', ja: '施術写真はありません。' }),
    label: text({
      en: 'List of treatment photos',
      ja: '施術写真の一覧',
    }),
    /** A photo of the list, by its place and what it shows: 「2 枚目：施術後の写真（側面）」 */
    photoAt: (number: number, photo: LocalizedText) =>
      text({
        en: `Photo ${numberOf(number).en}: ${photo.en}`,
        ja: `${numberOf(number).ja} 枚目：${photo.ja}`,
      }),
    open: text({ en: 'Open the photo', ja: '写真を開く' }),
    openOf: (number: number) => {
      const photo = photoNumbered(number)

      return text({
        en: `Open ${photo.en.toLowerCase()}`,
        ja: `${photo.ja}を開く`,
      })
    },
    remove: TREATMENT_WORDS.remove,
    removeOf: (number: number) => {
      const photo = photoNumbered(number)

      return text({
        en: `Remove ${photo.en.toLowerCase()}`,
        ja: `${photo.ja}を外す`,
      })
    },
    /** The record holds the most photos it takes */
    full: (most: number) =>
      text({
        en: `Up to ${countedIn(most, 'treatment photo', 'treatment photos')} can be recorded. Remove a photo before adding one.`,
        ja: `施術写真は、${numberOf(most).ja} 枚まで記録できます。足すときは、写真を外してから足してください。`,
      }),
  },
  /** Taking a photo away from its record */
  removal: {
    /** The photo, as the list names it */
    title: (photo: LocalizedText) =>
      text({ en: `Remove “${photo.en}”?`, ja: `${photo.ja}を外しますか？` }),
    description: text({
      en: 'The photo is removed from the treatment record. A removed photo cannot be brought back. The file of the photo stays where it is kept.',
      ja: '施術記録から写真を外します。外した写真は、元に戻せません。写真のファイルは、置いてある場所に残ります。',
    }),
    back: TREATMENT_WORDS.back,
    submit: TREATMENT_WORDS.remove,
    /** The photo, as its image is named */
    done: (photo: LocalizedText) =>
      text({
        en: `Removed the photo “${photo.en}”.`,
        ja: `${photo.ja}を外しました。`,
      }),
    /** The photo, or its record, was taken away meanwhile */
    gone: text({
      en: 'This photo was removed meanwhile.',
      ja: 'この写真は、その間に外されていました。',
    }),
    /** The role of the account changed meanwhile */
    forbidden: text({
      en: 'This account cannot remove treatment photos.',
      ja: 'このアカウントでは、施術写真を外せません。',
    }),
    failed: text({
      en: 'The treatment photo could not be removed. Check your connection and try again.',
      ja: '施術写真を外せませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
  },
  /** The form that adds photos to a record */
  form: {
    submit: TREATMENT_WORDS.addPhotos,
    cancel: TREATMENT_WORDS.cancel,
    note: text({
      en: 'Put a photo where the salon keeps its photos (a photo storage service, for example) first, then write its URL. A treatment record does not keep the files of photos.',
      ja: '写真は、サロンが写真を置いている場所（写真の保存サービスなど）に置いてから、その URL を書きます。施術記録は、写真のファイルを預かりません。',
    }),
    /** The group of the controls of a photo */
    photoOf: photoNumbered,
    type: text({ en: 'Kind', ja: '区分' }),
    choose: text({ en: 'Choose', ja: '選んでください' }),
    angle: text({ en: 'Angle', ja: '撮った向き' }),
    /** What an angle is, and how long it may be */
    angleDescription: (upTo: LocalizedText) =>
      followed(
        text({
          en: 'Front, side, back and so on.',
          ja: '正面、側面、後ろなど。',
        }),
        upTo,
      ),
    photoUrl: text({ en: 'Photo URL', ja: '写真の URL' }),
    thumbnailUrl: text({ en: 'Thumbnail URL', ja: '縮小した写真の URL' }),
    thumbnailUrlDescription: text({
      en: 'The URL of a smaller copy of the photo, if there is one. It is shown in the list of the photos of the treatment record.',
      ja: '小さくした写真があれば、その URL。施術記録の写真の一覧に出します。',
    }),
    description: text({ en: 'Description of the photo', ja: '写真の説明' }),
    consent: text({
      en: 'The customer agrees to the photo being taken and used',
      ja: 'お客様が、写真の撮影と利用に同意している',
    }),
    public: text({
      en: 'May be shown outside the salon (on the page of the salon, for example)',
      ja: 'サロンの外（サロンのページなど）に見せてよい',
    }),
    publicDescription: text({
      en: 'Only photos the customer agreed to can be shown outside the salon.',
      ja: 'お客様の同意がある写真だけ、サロンの外に見せられます。',
    }),
    remove: TREATMENT_WORDS.remove,
    removeRow: (number: number) => {
      const photo = photoNumbered(number)

      return text({
        en: `Remove the fields of ${photo.en.toLowerCase()}`,
        ja: `${photo.ja}の欄を外す`,
      })
    },
    addRow: text({ en: 'Add fields for a photo', ja: '写真の欄を足す' }),
    /** How many more photos the record takes */
    room: (room: number) =>
      text({
        en: `This treatment record can take ${morePhotos(room)}.`,
        ja: `この施術記録に足せる写真は、あと ${numberOf(room).ja} 枚です。`,
      }),
  },
  /** What is wrong with the values of the form */
  errors: {
    type: text({
      en: 'Choose the kind of the photo.',
      ja: '写真の区分を選んでください。',
    }),
    photoUrl: text({
      en: 'Enter the URL of the photo.',
      ja: '写真の URL を入力してください。',
    }),
    withoutConsent: text({
      en: 'A photo the customer did not agree to cannot be shown outside the salon. Check that the customer agrees, or clear this check box.',
      ja: 'お客様の同意がない写真は、サロンの外に見せられません。お客様の同意を確かめるか、このチェックを外してください。',
    }),
    /** The record holds a photo of the same address */
    held: followed(
      text({
        en: 'This treatment record has a photo with the same URL.',
        ja: 'この施術記録には、同じ URL の写真があります。',
      }),
      ANOTHER_ADDRESS,
    ),
    /** An earlier row of the form holds the same address */
    repeated: (row: number) =>
      followed(
        text({
          en: `This is the same URL as photo ${numberOf(row).en}.`,
          ja: `${numberOf(row).ja} 枚目と同じ URL です。`,
        }),
        ANOTHER_ADDRESS,
      ),
    /** The form holds more photos than the record has room for */
    noRoom: (room: number, most: number) =>
      room === 0
        ? full(most)
        : text({
            en: `Up to ${morePhotos(room)} can be added to this treatment record. Remove some of the fields of the photos.`,
            ja: `この施術記録には、あと ${numberOf(room).ja} 枚まで足せます。写真の欄を減らしてください。`,
          }),
  },
  /** What the API refused, or what came to nothing */
  forbidden: text({
    en: 'This account cannot add treatment photos.',
    ja: 'このアカウントでは、施術写真を足せません。',
  }),
  failed: text({
    en: 'The treatment photos could not be added. Check your connection and try again.',
    ja: '施術写真を足せませんでした。通信の状態を確かめて、もう一度お試しください。',
  }),
  /** How many photos were added */
  added: (count: number) =>
    text({
      en: `Added ${countedIn(count, 'treatment photo', 'treatment photos')}.`,
      ja: `施術写真を ${numberOf(count).ja} 枚足しました。`,
    }),
  /** The screen of a record whose photos are as many as it takes */
  full,
  toRecord: text({
    en: 'Back to the treatment record',
    ja: '施術記録に戻る',
  }),
}
