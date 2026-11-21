import { describe, expect, it } from 'vitest'
import { afterSalonRemoval } from './salon-removal'
import type { SalonRemoval } from './settings-api'

const NAME = 'Salon Hikari 表参道店'

describe('afterSalonRemoval', () => {
  it('should say the salon removed by its name, for the notification at the start', () => {
    expect(afterSalonRemoval({ type: 'removed' }, NAME)).toEqual({
      type: 'done',
      message: 'サロン「Salon Hikari 表参道店」を削除しました。',
    })
  })

  it('should say why bookings that are not finished keep the salon, and what finishes them', () => {
    expect(afterSalonRemoval({ type: 'bookingsUnfinished' }, NAME)).toEqual({
      type: 'refused',
      refusal: {
        type: 'bookingsUnfinished',
        message:
          'サロン「Salon Hikari 表参道店」には、終わっていない予約（下書き、確定待ち、確定、施術中）があるため、削除できません。予約台帳で、予約を完了するか、キャンセルするか、無断キャンセルにしてから、もう一度お試しください。',
      },
    })
  })

  it('should say who removes a salon to an account that no longer does', () => {
    expect(afterSalonRemoval({ type: 'forbidden' }, NAME)).toEqual({
      type: 'refused',
      refusal: {
        type: 'forbidden',
        message:
          'このアカウントでは、このサロンを削除できません。サロンを削除できるのは、そのサロンのオーナーと、管理者です。',
      },
    })
  })

  it('should leave a salon removed meanwhile to the screen, which says it is not found', () => {
    expect(afterSalonRemoval({ type: 'notFound' }, NAME)).toEqual({
      type: 'gone',
    })
  })

  it.each<[SalonRemoval, string]>([
    [
      { type: 'tooManyRequests' },
      'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
    ],
    [
      { type: 'failed' },
      'サロンを削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
    ],
  ])(
    'should ask for another attempt after %j, in the dialog',
    (outcome, message) => {
      expect(afterSalonRemoval(outcome, NAME)).toEqual({
        type: 'again',
        message,
      })
    },
  )
})
