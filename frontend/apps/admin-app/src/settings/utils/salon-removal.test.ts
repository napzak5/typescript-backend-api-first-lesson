import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { describe, expect, it } from 'vitest'
import type { SalonRemoval } from '../api/settings-api'
import { afterSalonRemoval } from './salon-removal'

const NAME = 'Salon Hikari 表参道店'

describe('afterSalonRemoval', () => {
  it('should say the salon removed by its name, for the notification at the start', () => {
    // Assert
    expect(afterSalonRemoval({ type: 'removed' }, NAME)).toEqual({
      type: 'done',
      message: {
        en: 'Removed the salon “Salon Hikari 表参道店”.',
        ja: 'サロン「Salon Hikari 表参道店」を削除しました。',
      },
    })
  })

  it('should say why bookings that are not finished keep the salon, and what finishes them', () => {
    // Assert
    expect(afterSalonRemoval({ type: 'bookingsUnfinished' }, NAME)).toEqual({
      type: 'refused',
      refusal: {
        type: 'bookingsUnfinished',
        message: {
          en: 'The salon “Salon Hikari 表参道店” has bookings that are not finished (draft, awaiting confirmation, confirmed, in progress), so it cannot be removed. In the booking ledger, complete them, cancel them or mark them as no-shows, then try again.',
          ja: 'サロン「Salon Hikari 表参道店」には、終わっていない予約（下書き、確定待ち、確定、施術中）があるため、削除できません。予約台帳で、予約を完了するか、キャンセルするか、無断キャンセルにしてから、もう一度お試しください。',
        },
      },
    })
  })

  it('should say who removes a salon to an account that no longer does', () => {
    // Assert
    expect(afterSalonRemoval({ type: 'forbidden' }, NAME)).toEqual({
      type: 'refused',
      refusal: {
        type: 'forbidden',
        message: {
          en: 'This account cannot remove this salon. Only the owners of that salon and administrators can remove a salon.',
          ja: 'このアカウントでは、このサロンを削除できません。サロンを削除できるのは、そのサロンのオーナーと、管理者です。',
        },
      },
    })
  })

  it('should leave a salon removed meanwhile to the screen, which says it is not found', () => {
    // Assert
    expect(afterSalonRemoval({ type: 'notFound' }, NAME)).toEqual({
      type: 'gone',
    })
  })

  it.each<[SalonRemoval, LocalizedText]>([
    [
      { type: 'tooManyRequests' },
      {
        en: 'There are too many requests. Wait a while and try again.',
        ja: 'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
      },
    ],
    [
      { type: 'failed' },
      {
        en: 'Could not remove the salon. Check your connection and try again.',
        ja: 'サロンを削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
      },
    ],
  ])(
    'should ask for another attempt after %j, in the dialog',
    (outcome, message) => {
      // Assert
      expect(afterSalonRemoval(outcome, NAME)).toEqual({
        type: 'again',
        message,
      })
    },
  )
})
