import type { ModelsCustomerPreferencesResponse } from '@beauty-salon-frontend/api-client'
import type { StaffChoice } from '@beauty-salon-frontend/preferences'

/*
 * What the stories of the components of the preferences show: a customer
 * who goes to two salons and has said what they wish for, and one who has
 * said nothing yet.
 */

const TOKYO = '5d0c3f6a-2b9e-4c71-8a54-e1f7b3d9c026'
const OSAKA = '9b7e1d42-6f3a-4e08-b5c9-2a4d8f0e6713'

export const misaki: StaffChoice = {
  id: 'a41f7c3e-58d2-4b96-9e0a-7c2b5d1f8e34',
  displayName: '田中 美咲',
  salonId: TOKYO,
  salonName: 'Beauty Salon Tokyo',
}

export const kenta: StaffChoice = {
  id: 'c7d2e9b4-1a6f-4c83-b05e-3f8a6d2c9b17',
  displayName: '佐藤 健太',
  salonId: TOKYO,
  salonName: 'Beauty Salon Tokyo',
}

export const yui: StaffChoice = {
  id: 'e3b8a5d1-9c4f-4d27-a6e0-1b7c4f9d2a58',
  displayName: '鈴木 結衣',
  salonId: OSAKA,
  salonName: 'Hair Studio Osaka',
}

/** The staff of the salons the customer has a booking at, as a form offers them */
export const staff: StaffChoice[] = [misaki, kenta, yui]

/** Somebody who has said everything a salon can keep in mind */
export const preferences: ModelsCustomerPreferencesResponse = {
  preferredStaffId: misaki.id,
  avoidStaffIds: [kenta.id, yui.id],
  preferredTimeSlots: [
    { startTime: '10:00', endTime: '12:00' },
    { startTime: '18:00', endTime: '20:30' },
  ],
  stylePreferences: {
    preferredLength: '肩にかかるくらい',
    preferredColors: ['アッシュブラウン', 'ベージュ'],
    avoidStyles: ['前髪を短くすること', '強いパーマ'],
    inspirationImages: [
      'https://images.example.com/styles/bob-ash-brown.jpg',
      'https://images.example.com/styles/layered-medium.jpg',
    ],
  },
  communicationStyle: '静かに過ごしたい',
  specialRequests:
    '首が疲れやすいので、シャンプーのときにタオルを入れてもらえると助かります。',
}

/** Somebody who has said nothing yet: what the API answers for a customer without preferences */
export const noPreferences: ModelsCustomerPreferencesResponse = {
  preferredStaffId: null,
  avoidStaffIds: [],
  preferredTimeSlots: [],
  stylePreferences: null,
  communicationStyle: null,
  specialRequests: null,
}

/** Long values, and an address without a place to break a line */
export const wordyPreferences: ModelsCustomerPreferencesResponse = {
  ...preferences,
  stylePreferences: {
    preferredLength:
      '後ろは肩甲骨の下あたりまで、顔まわりはあごのラインで段をつけてほしい',
    preferredColors: [
      '地毛に近い、暗めのアッシュブラウン',
      '色が抜けても黄色くなりにくい色',
    ],
    avoidStyles: ['前髪を眉より上に切ること'],
    inspirationImages: [
      'https://images.example.com/styles/2026/autumn/long-layered-ash-brown-with-face-framing-highlights-front-and-side-view-collection-0123456789.jpg',
    ],
  },
  communicationStyle:
    '施術の説明は聞きたいが、それ以外の世間話は少なめがうれしい',
  specialRequests:
    '首が疲れやすいので、シャンプーのときにタオルを入れてもらえると助かります。\n\nカラーの薬剤がしみやすいので、頭皮につかないように塗ってください。',
}

/**
 * Preferences that name somebody no screen can show: the member who was
 * wished for, and one of those to avoid, no longer work at their salon.
 */
export const preferencesOfStaffThatLeft: ModelsCustomerPreferencesResponse = {
  ...noPreferences,
  preferredStaffId: '0f6d3b8a-7e21-4c95-b4a0-6d9e2c5f1a73',
  avoidStaffIds: ['2a9c5e7f-4b10-4d68-a3f2-8e1b6c0d4f95', yui.id],
}
