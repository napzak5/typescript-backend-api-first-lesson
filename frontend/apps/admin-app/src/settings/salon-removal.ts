import { match } from 'ts-pattern'
import type { SalonRemoval } from './settings-api'

/** Why a salon was not removed, of what another attempt does not change. */
export type SalonRemovalRefusal =
  /** A booking of the salon is not finished: said with the way to the bookings */
  | { type: 'bookingsUnfinished'; message: string }
  /** The account does not remove the salon */
  | { type: 'forbidden'; message: string }

/** What a removal of a salon comes to on the screen. */
export type SalonRemovalSays =
  /** The salon was removed: said in a notification at the start */
  | { type: 'done'; message: string }
  /** Nothing was removed, and another attempt may: said in the dialog */
  | { type: 'again'; message: string }
  /** What another attempt does not change: said at the removal */
  | { type: 'refused'; refusal: SalonRemovalRefusal }
  /** The salon was removed meanwhile: the screen says it is not found */
  | { type: 'gone' }

/**
 * What is said after a salon was to be removed. A booking that is not
 * finished keeps the salon: it is completed, cancelled or marked as a
 * no-show first.
 */
export const afterSalonRemoval = (
  outcome: SalonRemoval,
  name: string,
): SalonRemovalSays =>
  match(outcome)
    .returnType<SalonRemovalSays>()
    .with({ type: 'removed' }, () => ({
      type: 'done',
      message: `サロン「${name}」を削除しました。`,
    }))
    .with({ type: 'bookingsUnfinished' }, () => ({
      type: 'refused',
      refusal: {
        type: 'bookingsUnfinished',
        message: `サロン「${name}」には、終わっていない予約（下書き、確定待ち、確定、施術中）があるため、削除できません。予約台帳で、予約を完了するか、キャンセルするか、無断キャンセルにしてから、もう一度お試しください。`,
      },
    }))
    .with({ type: 'notFound' }, () => ({ type: 'gone' }))
    // The account no longer removes the salon
    .with({ type: 'forbidden' }, () => ({
      type: 'refused',
      refusal: {
        type: 'forbidden',
        message:
          'このアカウントでは、このサロンを削除できません。サロンを削除できるのは、そのサロンのオーナーと、管理者です。',
      },
    }))
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'again',
      message:
        'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message:
        'サロンを削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
    }))
    .exhaustive()
