import { type LocalizedText, text } from '../../languages/localized-text'
import { uiMessages } from '../ui/components'
import { followed } from '../written'
import { ANSWERED_BY_OTHERS } from './customer-words'

/*
 * The request of a customer to have the data held of them erased: what
 * erasing does, the latest request and what became of it, a new request
 * taken with its reason, and a pending one called off. The reason stands
 * as it was written.
 */

const REASON = text({ en: 'Reason for the request', ja: '依頼の理由' })
const ERASE_AFTER = text({
  en: 'Let the customer know that the data was erased.',
  ja: '消去したことを、ご本人にお知らせください。',
})

export const customerErasureMessages = {
  title: text({ en: 'Erasure of the data', ja: 'データの消去' }),
  /** What a screen could not read, as a sentence names it */
  names: {
    request: text({
      en: 'the request to erase the data',
      ja: '消去の依頼',
    }),
  },
  about: text({
    en: 'When a customer asks to have the personal data held of them erased, make sure it is the customer, then take the request. It can be cancelled for 14 days after it is taken, and the data is erased after that. The sales, and the bookings they were made from, are kept for the books, without what identifies the customer. Erased data cannot be brought back.',
    ja: 'お客様ご本人から、保有している個人データの消去を求められたときは、ご本人であることを確かめてから、依頼を受け付けます。受け付けてから 14 日のあいだは取り消せ、そのあとで消去します。売上と、売上のもとになった予約は、帳簿の保存のために残し、お客様を特定できる情報を消します。消去したデータは、元に戻せません。',
  }),
  ask: text({
    en: 'Take a request to erase the data',
    ja: '消去の依頼を受け付ける',
  }),
  none: text({
    en: 'There is no request to erase the data.',
    ja: '消去の依頼はありません。',
  }),
  loading: text({
    en: 'Loading the request to erase the data',
    ja: '消去の依頼を読み込んでいます',
  }),
  /** A pending request */
  pending: {
    requestedAt: text({ en: 'Taken', ja: '受け付けた日時' }),
    scheduled: text({ en: 'To be erased', ja: '消去の予定' }),
    scheduledOf: (moment: LocalizedText) =>
      text({ en: `On or after ${moment.en}`, ja: `${moment.ja} 以降` }),
    reason: REASON,
    about: text({
      en: 'The data is erased after the scheduled time. Until then, the request can be cancelled.',
      ja: '予定の日時を過ぎたあとに、消去が実行されます。それまでは、依頼を取り消せます。',
    }),
    cancel: text({ en: 'Cancel the request', ja: '依頼を取り消す' }),
  },
  /** What became of the latest request: when it was taken, and when it was called off or run, if the API says */
  cancelled: (asked: LocalizedText, at: LocalizedText | null) =>
    at === null
      ? text({
          en: `The request taken on ${asked.en} was cancelled.`,
          ja: `${asked.ja} に受け付けた依頼は、取り消しました。`,
        })
      : text({
          en: `The request taken on ${asked.en} was cancelled on ${at.en}.`,
          ja: `${asked.ja} に受け付けた依頼は、${at.ja} に取り消しました。`,
        }),
  completed: (asked: LocalizedText, at: LocalizedText | null) =>
    followed(
      at === null
        ? text({
            en: `The data was erased on the request taken on ${asked.en}.`,
            ja: `${asked.ja} に受け付けた依頼により、データを消去しました。`,
          })
        : text({
            en: `The data was erased on ${at.en}, on the request taken on ${asked.en}.`,
            ja: `${asked.ja} に受け付けた依頼により、${at.ja} にデータを消去しました。`,
          }),
      ERASE_AFTER,
    ),
  /** The dialog that takes a request */
  asking: {
    title: text({
      en: 'Take the request to erase the data?',
      ja: '消去の依頼を受け付けますか？',
    }),
    description: (name: string) =>
      text({
        en: `The request to erase the data of ${name} will be taken. It can be cancelled for 14 days after it is taken.`,
        ja: `${name} 様のデータの消去の依頼を受け付けます。受け付けてから 14 日のあいだは、取り消せます。`,
      }),
    submit: text({ en: 'Take the request', ja: '受け付ける' }),
    reason: REASON,
    reasonDescription: text({
      en: 'Write the reason the customer gave, and how the request was received. It is kept with the request.',
      ja: 'ご本人が述べた理由や、依頼を受けた方法を書きます。依頼の記録に残ります。',
    }),
    blankReason: text({
      en: 'Enter the reason for the request.',
      ja: '依頼の理由を入力してください。',
    }),
  },
  /** The dialog that calls a pending request off */
  cancelling: {
    title: text({
      en: 'Cancel the request to erase the data?',
      ja: '消去の依頼を取り消しますか？',
    }),
    description: (name: string) =>
      text({
        en: `The data of ${name} will not be erased. Cancel a request when the customer withdraws it, or when it was taken by mistake.`,
        ja: `${name} 様のデータは消去されません。ご本人が依頼を撤回したときや、誤って受け付けたときに取り消します。`,
      }),
    back: uiMessages.back,
    confirm: text({ en: 'Cancel it', ja: '取り消す' }),
  },
  /** What follows taking a request */
  asked: (name: string, scheduled: LocalizedText) =>
    text({
      en: `The request to erase the data of ${name} was taken. The data will be erased on or after ${scheduled.en}.`,
      ja: `${name} 様のデータの消去の依頼を受け付けました。${scheduled.ja} 以降に消去します。`,
    }),
  takenMeanwhile: text({
    en: 'In the meantime, another account took a request to erase the data of this customer.',
    ja: 'その間に、ほかのアカウントがこのお客様の消去の依頼を受け付けていました。',
  }),
  askForbidden: followed(
    text({
      en: 'This account cannot take requests to erase data.',
      ja: 'このアカウントでは、消去の依頼を受け付けられません。',
    }),
    ANSWERED_BY_OTHERS,
  ),
  askFailed: text({
    en: 'The request could not be taken. Check your connection and try again.',
    ja: '消去の依頼を受け付けられませんでした。通信の状態を確かめて、もう一度お試しください。',
  }),
  /** What follows calling a request off */
  cancelledDone: (name: string) =>
    text({
      en: `The request to erase the data of ${name} was cancelled.`,
      ja: `${name} 様のデータの消去の依頼を取り消しました。`,
    }),
  goneMeanwhile: text({
    en: 'In the meantime, this request was cancelled or the data was erased.',
    ja: 'この依頼は、その間に取り消されたか、消去が実行されていました。',
  }),
  cancelForbidden: followed(
    text({
      en: 'This account cannot cancel requests to erase data.',
      ja: 'このアカウントでは、消去の依頼を取り消せません。',
    }),
    ANSWERED_BY_OTHERS,
  ),
  cancelFailed: text({
    en: 'The request could not be cancelled. Check your connection and try again.',
    ja: '消去の依頼を取り消せませんでした。通信の状態を確かめて、もう一度お試しください。',
  }),
  /** The role of the account changed while the part was shown */
  readForbidden: followed(
    text({
      en: 'This account cannot load requests to erase data.',
      ja: 'このアカウントでは、消去の依頼を読み込めません。',
    }),
    ANSWERED_BY_OTHERS,
  ),
}
