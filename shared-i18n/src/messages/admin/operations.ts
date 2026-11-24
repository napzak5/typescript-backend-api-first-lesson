import { numberOf } from '../../formats/numbers'
import { type LocalizedText, text } from '../../languages/localized-text'
import { uiMessages } from '../ui/components'
import { frameMessages } from '../ui/frame'
import { countedIn, followed } from '../written'
import { customerErasureMessages } from './customer-erasure'
import { adminFrameMessages } from './frame'

/*
 * What the admin application says of running the platform: the state of
 * the system, and the operations that are meant to run at intervals, run
 * by hand by an administrator. The version of the API, the names of what
 * it depends on that are not known here, its errors and the reasons of the
 * requests to erase data stand as they were written.
 */

const NO_ANSWER = text({ en: 'No answer', ja: '応答がありません' })
const DOWN = text({ en: 'Down', ja: '止まっています' })
const DEGRADED = text({ en: 'Degraded', ja: '性能が落ちています' })

export const adminOperationMessages = {
  title: adminFrameMessages.navigation.operations,
  description: text({
    en: 'The state of the system, and the operations run at intervals',
    ja: 'システムの状態と、定期的に行う操作',
  }),
  /** What an account that does not run the platform is told */
  administratorsOnly: text({
    en: 'This account cannot run the operations. Only an administrator checks the state of the system, expires points, carries out the requests to erase data and cleans up the attachments.',
    ja: 'このアカウントでは、運用の操作を行えません。システムの状態を確かめ、ポイントの失効、データの消去の依頼の実行、添付ファイルの掃除を行うのは、管理者です。',
  }),
  toTop: frameMessages.notFound.back,
  /** What the operations that are run by hand have in common, said above them */
  lead: text({
    en: 'Expiring points, carrying out the requests to erase data and cleaning up the attachments are operations run at intervals, which an administrator runs by hand here. Each handles everything that is due at the time, and never handles the same thing twice.',
    ja: 'ポイントの失効、データの消去の依頼の実行、添付ファイルの掃除は、定期的に行う操作で、ここでは管理者が手で実行します。どれも、そのときに期限の来たものをすべて処理し、同じものを二度は処理しません。',
  }),
  /** The state of the system */
  system: {
    title: text({ en: 'State of the system', ja: 'システムの状態' }),
    checking: text({
      en: 'Checking the state of the system',
      ja: 'システムの状態を確かめています',
    }),
    checkAgain: text({ en: 'Check again', ja: 'もう一度確かめる' }),
    process: text({ en: 'Process', ja: 'プロセス' }),
    requests: text({ en: 'Accepting requests', ja: 'リクエストの受け付け' }),
    overall: text({ en: 'Overall state', ja: '全体の状態' }),
    version: text({ en: 'API version', ja: 'API のバージョン' }),
    checkedAt: text({ en: 'Checked', ja: '確かめた日時' }),
    noAnswer: NO_ANSWER,
    /** Whether the process answers */
    alive: text({ en: 'Running', ja: '動いています' }),
    /** Whether the API takes requests */
    ready: text({ en: 'Accepting', ja: '受け付けています' }),
    notReady: text({ en: 'Not accepting', ja: '受け付けていません' }),
    notReadyFor: (dependency: LocalizedText) =>
      text({
        en: `Not accepting (${dependency.en} cannot be reached)`,
        ja: `受け付けていません（${dependency.ja}に接続できません）`,
      }),
    /** The state the API says it is in, by the values of the API */
    health: {
      healthy: text({ en: 'Healthy', ja: '正常です' }),
      degraded: DEGRADED,
      unhealthy: DOWN,
    },
    /** The state of what the API depends on, by the values of the API */
    checks: {
      up: text({ en: 'Up', ja: '動いています' }),
      down: DOWN,
      degraded: DEGRADED,
    },
    /** What the API depends on, by the names the API gives them */
    dependencies: {
      database: text({ en: 'Database', ja: 'データベース' }),
    },
    table: {
      caption: text({
        en: 'State of the dependencies',
        ja: '依存先の状態',
      }),
      dependency: text({ en: 'Dependency', ja: '依存先' }),
      status: text({ en: 'Status', ja: '状態' }),
      responseTime: text({ en: 'Response time', ja: '応答時間' }),
      error: text({ en: 'Error', ja: 'エラー' }),
      noError: text({ en: 'None', ja: 'ありません' }),
      none: text({
        en: 'The API checks no dependencies',
        ja: 'API が確かめる依存先はありません',
      }),
    },
    notMeasured: text({ en: 'Could not be measured', ja: '測れませんでした' }),
    /** How long the API waited for what it depends on: 「12 ミリ秒」 */
    millisecondsOf: (milliseconds: number) =>
      text({
        en: `${numberOf(milliseconds).en} ms`,
        ja: `${numberOf(milliseconds).ja} ミリ秒`,
      }),
  },
  /** What the parts of the operations share */
  runs: {
    back: uiMessages.back,
    /** When an operation was run on this screen, with what it did */
    ranAt: (moment: LocalizedText, result: LocalizedText) =>
      followed(
        text({
          en: `Ran on ${moment.en}.`,
          ja: `${moment.ja}に実行しました。`,
        }),
        result,
      ),
  },
  /** The expiry of the points */
  expiry: {
    title: text({ en: 'Expiring points', ja: 'ポイントの失効' }),
    text: text({
      en: 'Expires the points past their date of expiry for every customer, and takes them off the balances. The points expired are those whose date of expiry has ended in every time zone (a date of expiry of the day before yesterday (UTC) or earlier).',
      ja: '有効期限の過ぎたポイントを、すべてのお客様について失効させ、残高から引きます。失効させるのは、どのタイムゾーンでも有効期限の日が終わったポイント（有効期限が一昨日（UTC）以前のもの）です。',
    }),
    button: text({ en: 'Expire the points', ja: 'ポイントを失効させる' }),
    question: text({
      en: 'Expire the points past their date of expiry?',
      ja: '有効期限の過ぎたポイントを失効させますか？',
    }),
    warning: text({
      en: 'Expired points can no longer be used. This cannot be undone. One expiry transaction is recorded for each customer whose points expire.',
      ja: '失効させたポイントは、もう使えません。取り消せません。ポイントを失効させたお客様ごとに、失効の取引を 1 件記録します。',
    }),
    confirm: text({ en: 'Expire', ja: '失効させる' }),
    failed: text({
      en: 'Could not finish expiring the points. If it stopped partway, the points up to then are expired. Check your connection: running it again expires the rest.',
      ja: 'ポイントの失効を終えられませんでした。途中で止まったときも、それまでの分は失効させてあります。通信の状態を確かめて、もう一度実行すると、残りを失効させます。',
    }),
    none: text({
      en: 'There were no points to expire.',
      ja: '失効させるポイントはありませんでした。',
    }),
    done: (customers: number, points: number) =>
      text({
        en: `Expired ${countedIn(points, 'point', 'points')} of ${countedIn(customers, 'customer', 'customers')} in all.`,
        ja: `${numberOf(customers).ja} 人のお客様の、合わせて ${numberOf(points).ja} ポイントを失効させました。`,
      }),
  },
  /** The requests to erase data that are due, carried out */
  erasure: {
    title: text({
      en: 'Carrying out the requests to erase data',
      ja: 'データの消去の依頼の実行',
    }),
    text: text({
      en: 'Carries out every request to erase data taken 14 days ago or earlier, and erases the names, the contact details, the addresses and the like of the customers. The records of the sales and the bookings are kept for the books.',
      ja: '受け付けてから 14 日たった、データの消去の依頼をすべて実行し、お客様の氏名、連絡先、住所などを消します。売上と予約の記録は、帳簿書類の保存のために残します。',
    }),
    button: text({ en: 'Carry out the requests', ja: '消去の依頼を実行する' }),
    question: text({
      en: 'Carry out every request to erase data past its scheduled time?',
      ja: '予定日時を過ぎた消去の依頼を、すべて実行しますか？',
    }),
    warning: text({
      en: 'Erased data cannot be brought back. The accounts of the customers are deleted too, and their signed-in devices can no longer be used. The salon that took the request lets the customer know of the erasure.',
      ja: '消したデータは、元に戻せません。お客様のアカウントも削除し、ログインしている端末は使えなくなります。消去したことを本人に知らせるのは、依頼を受け付けたサロンです。',
    }),
    confirm: text({ en: 'Carry out', ja: '実行する' }),
    failed: text({
      en: 'Could not finish carrying out the requests to erase data. If it stopped partway, the requests up to then are carried out. Check your connection: running it again carries out the rest.',
      ja: 'データの消去の依頼の実行を終えられませんでした。途中で止まったときも、それまでの依頼は実行してあります。通信の状態を確かめて、もう一度実行すると、残りを実行します。',
    }),
    none: text({
      en: 'There were no requests past their scheduled time.',
      ja: '予定日時を過ぎた依頼はありませんでした。',
    }),
    done: (requests: number) =>
      text({
        en: `Carried out ${countedIn(requests, 'request', 'requests')}, and erased the data of the customers. Let each customer know through the salon that took the request.`,
        ja: `${numberOf(requests).ja} 件の依頼を実行して、お客様のデータを消去しました。消去したことは、依頼を受け付けたサロンから本人に知らせてください。`,
      }),
    /** The requests a run carried out */
    table: {
      caption: text({ en: 'Requests carried out', ja: '実行した依頼' }),
      requestedAt: customerErasureMessages.pending.requestedAt,
      scheduledAt: text({ en: 'Scheduled erasure', ja: '消去の予定日時' }),
      reason: customerErasureMessages.pending.reason,
      none: text({
        en: 'No requests were carried out',
        ja: '実行した依頼はありません',
      }),
    },
  },
  /** The removal of the attachments that are no longer needed */
  purge: {
    title: text({
      en: 'Cleaning up the attachments',
      ja: '添付ファイルの掃除',
    }),
    text: text({
      en: 'Removes the uploads that were never finished and the deleted attachments, together with their stored files. Only those whose upload URL has expired are removed.',
      ja: '完了しなかったアップロードと、削除した添付ファイルを、保存先のファイルと一緒に消します。消すのは、アップロード用の URL の有効期限が過ぎたものだけです。',
    }),
    button: text({
      en: 'Clean up the attachments',
      ja: '添付ファイルを掃除する',
    }),
    question: text({
      en: 'Remove the attachments that are no longer needed?',
      ja: '要らなくなった添付ファイルを消しますか？',
    }),
    warning: text({
      en: 'The stored files are removed too, so this cannot be undone. The share links of the deleted attachments go with them.',
      ja: '保存先のファイルも消すので、元に戻せません。削除した添付ファイルの共有リンクも、一緒に消えます。',
    }),
    confirm: text({ en: 'Remove', ja: '消す' }),
    failed: text({
      en: 'Could not finish cleaning up the attachments. If it stopped partway, the attachments up to then are removed. Check your connection: running it again removes the rest.',
      ja: '添付ファイルの掃除を終えられませんでした。途中で止まったときも、それまでの分は消してあります。通信の状態を確かめて、もう一度実行すると、残りを消します。',
    }),
    none: text({
      en: 'There were no attachments to remove.',
      ja: '消す添付ファイルはありませんでした。',
    }),
    done: (attachments: number) =>
      text({
        en: `Removed ${countedIn(attachments, 'attachment', 'attachments')}, stored files included.`,
        ja: `${numberOf(attachments).ja} 件の添付ファイルを、保存先のファイルと一緒に消しました。`,
      }),
  },
}
