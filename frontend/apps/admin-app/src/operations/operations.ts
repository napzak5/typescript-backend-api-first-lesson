import { TOO_MANY_REQUESTS_MESSAGE } from '@beauty-salon-frontend/answers'
import type {
  ModelsCustomerDeletionRequestResponse,
  ModelsHealthCheck,
  ModelsHealthStatus,
} from '@beauty-salon-frontend/api-client'
import { match, P } from 'ts-pattern'
import type {
  Erasure,
  Expiry,
  Liveness,
  Purge,
  Readiness,
} from './operations-api'

/*
 * What an administrator reads of the state of the system, and what the
 * screen says after each of the operations that are run by hand.
 */

/** Whether a role runs the platform: an administrator alone. */
export const runsOperations = (role: string): boolean => role === 'admin'

/** What an account that does not run the platform is told */
export const ADMINISTRATORS_ONLY =
  'このアカウントでは、運用の操作を行えません。システムの状態を確かめ、ポイントの失効、データの消去の依頼の実行、添付ファイルの掃除を行うのは、管理者です。'

const DEPENDENCY_NAMES: Record<string, string> = {
  database: 'データベース',
}

/** What the API depends on, in words: the name the API gives it when it is not known here. */
export const dependencyNameOf = (name: string): string =>
  DEPENDENCY_NAMES[name] ?? name

/** Whether the process answers, in words. */
export const livenessNameOf = (liveness: Liveness): string =>
  match(liveness)
    .with({ type: 'alive' }, () => '動いています')
    .with({ type: 'silent' }, () => '応答がありません')
    .exhaustive()

/** Whether the API takes requests, in words, with what keeps it from doing so. */
export const readinessNameOf = (readiness: Readiness): string =>
  match(readiness)
    .with({ type: 'ready' }, () => '受け付けています')
    .with({ type: 'notReady', reason: null }, () => '受け付けていません')
    .with(
      { type: 'notReady', reason: P.string },
      ({ reason }) =>
        `受け付けていません（${dependencyNameOf(reason)}に接続できません）`,
    )
    .with({ type: 'silent' }, () => '応答がありません')
    .exhaustive()

const HEALTH_NAMES: Record<ModelsHealthStatus['status'], string> = {
  healthy: '正常です',
  degraded: '性能が落ちています',
  unhealthy: '止まっています',
}

/** The state of the whole API, in words. */
export const healthNameOf = (status: ModelsHealthStatus['status']): string =>
  HEALTH_NAMES[status]

const CHECK_NAMES: Record<ModelsHealthCheck['status'], string> = {
  up: '動いています',
  down: '止まっています',
  degraded: '性能が落ちています',
}

/** The state of one thing the API depends on, in words. */
export const checkNameOf = (status: ModelsHealthCheck['status']): string =>
  CHECK_NAMES[status]

/** How long the API waited for what it depends on, in words. */
export const responseTimeNameOf = (responseTime: number | null): string =>
  responseTime === null ? '測れませんでした' : `${responseTime} ミリ秒`

/** What the part of an operation that is run by hand says, and asks before it runs. */
export type RunCopy = {
  /** The heading of the part */
  title: string
  /** What the operation does */
  text: string
  /** The button that asks */
  button: string
  /** The question of the dialog */
  question: string
  /** What cannot be undone, in the dialog */
  warning: string
  /** The button of the dialog that runs it */
  confirm: string
}

export const EXPIRY_COPY: RunCopy = {
  title: 'ポイントの失効',
  text: '有効期限の過ぎたポイントを、すべてのお客様について失効させ、残高から引きます。失効させるのは、どのタイムゾーンでも有効期限の日が終わったポイント（有効期限が一昨日（UTC）以前のもの）です。',
  button: 'ポイントを失効させる',
  question: '有効期限の過ぎたポイントを失効させますか？',
  warning:
    '失効させたポイントは、もう使えません。取り消せません。ポイントを失効させたお客様ごとに、失効の取引を 1 件記録します。',
  confirm: '失効させる',
}

export const ERASURE_COPY: RunCopy = {
  title: 'データの消去の依頼の実行',
  text: '受け付けてから 14 日たった、データの消去の依頼をすべて実行し、お客様の氏名、連絡先、住所などを消します。売上と予約の記録は、帳簿書類の保存のために残します。',
  button: '消去の依頼を実行する',
  question: '予定日時を過ぎた消去の依頼を、すべて実行しますか？',
  warning:
    '消したデータは、元に戻せません。お客様のアカウントも削除し、ログインしている端末は使えなくなります。消去したことを本人に知らせるのは、依頼を受け付けたサロンです。',
  confirm: '実行する',
}

export const PURGE_COPY: RunCopy = {
  title: '添付ファイルの掃除',
  text: '完了しなかったアップロードと、削除した添付ファイルを、保存先のファイルと一緒に消します。消すのは、アップロード用の URL の有効期限が過ぎたものだけです。',
  button: '添付ファイルを掃除する',
  question: '要らなくなった添付ファイルを消しますか？',
  warning:
    '保存先のファイルも消すので、元に戻せません。削除した添付ファイルの共有リンクも、一緒に消えます。',
  confirm: '消す',
}

/** What the screen does after one of the operations that are run by hand. */
export type RunSays<Result> =
  /** It was done: the result is shown in the part of the operation, and the notification says so */
  | { type: 'done'; result: Result }
  /** It may be done on another attempt: said in the dialog */
  | { type: 'again'; message: string }
  /** Another attempt changes nothing: the dialog closes, and the part says why */
  | { type: 'refused'; message: string }

const REFUSED: { type: 'refused'; message: string } = {
  type: 'refused',
  message: ADMINISTRATORS_ONLY,
}

/** What is expired: the points whose date of expiry has ended in every time zone */
export type ExpiryResult = { processedCount: number; totalPoints: number }

/** What follows a run of the expiry of the points. */
export const afterExpiry = (outcome: Expiry): RunSays<ExpiryResult> =>
  match(outcome)
    .returnType<RunSays<ExpiryResult>>()
    .with({ type: 'expired' }, ({ processedCount, totalPoints }) => ({
      type: 'done',
      result: { processedCount, totalPoints },
    }))
    .with({ type: 'forbidden' }, () => REFUSED)
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'again',
      message: TOO_MANY_REQUESTS_MESSAGE,
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message:
        'ポイントの失効を終えられませんでした。途中で止まったときも、それまでの分は失効させてあります。通信の状態を確かめて、もう一度実行すると、残りを失効させます。',
    }))
    .exhaustive()

/** What a run of the expiry did, in words. */
export const expiryResultOf = ({
  processedCount,
  totalPoints,
}: ExpiryResult): string =>
  processedCount === 0
    ? '失効させるポイントはありませんでした。'
    : `${processedCount.toLocaleString('ja-JP')} 人のお客様の、合わせて ${totalPoints.toLocaleString('ja-JP')} ポイントを失効させました。`

/** What follows a run of the deletion requests that are due. */
export const afterErasure = (
  outcome: Erasure,
): RunSays<ModelsCustomerDeletionRequestResponse[]> =>
  match(outcome)
    .returnType<RunSays<ModelsCustomerDeletionRequestResponse[]>>()
    .with({ type: 'erased' }, ({ requests }) => ({
      type: 'done',
      result: requests,
    }))
    .with({ type: 'forbidden' }, () => REFUSED)
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'again',
      message: TOO_MANY_REQUESTS_MESSAGE,
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message:
        'データの消去の依頼の実行を終えられませんでした。途中で止まったときも、それまでの依頼は実行してあります。通信の状態を確かめて、もう一度実行すると、残りを実行します。',
    }))
    .exhaustive()

/** What a run of the deletion requests did, in words. */
export const erasureResultOf = (
  requests: readonly ModelsCustomerDeletionRequestResponse[],
): string =>
  requests.length === 0
    ? '予定日時を過ぎた依頼はありませんでした。'
    : `${requests.length.toLocaleString('ja-JP')} 件の依頼を実行して、お客様のデータを消去しました。消去したことは、依頼を受け付けたサロンから本人に知らせてください。`

/** What follows a run of the removal of the attachments that are no longer needed. */
export const afterPurge = (outcome: Purge): RunSays<number> =>
  match(outcome)
    .returnType<RunSays<number>>()
    .with({ type: 'purged' }, ({ purgedCount }) => ({
      type: 'done',
      result: purgedCount,
    }))
    .with({ type: 'forbidden' }, () => REFUSED)
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'again',
      message: TOO_MANY_REQUESTS_MESSAGE,
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message:
        '添付ファイルの掃除を終えられませんでした。途中で止まったときも、それまでの分は消してあります。通信の状態を確かめて、もう一度実行すると、残りを消します。',
    }))
    .exhaustive()

/** What a run of the removal of the attachments did, in words. */
export const purgeResultOf = (purgedCount: number): string =>
  purgedCount === 0
    ? '消す添付ファイルはありませんでした。'
    : `${purgedCount.toLocaleString('ja-JP')} 件の添付ファイルを、保存先のファイルと一緒に消しました。`

/** When an operation was run, with what it did */
export const ranAtOf = (moment: string, result: string): string =>
  `${moment}に実行しました。${result}`
