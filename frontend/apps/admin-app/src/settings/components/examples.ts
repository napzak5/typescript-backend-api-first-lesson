import type {
  ModelsDayOfWeekType,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import { salon } from '../../bookings/components/examples'

/*
 * Salons for the stories of the settings: one with something in every
 * value, with its week and a calendar around today (2026-11-21), and the
 * salon of the bookings, which has little recorded.
 */

/** The days the salon of the stories is open on all day long */
const WHOLE_DAYS: readonly ModelsDayOfWeekType[] = [
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
]

/** Today at the salons of the stories */
export const TODAY = '2026-11-21'

export const aDescribedSalon = (): ModelsSalonResponse => ({
  ...salon,
  nameKana: 'サロン ヒカリ オモテサンドウテン',
  description: '表参道の駅から歩いて 3 分です。\n個室もあります。',
  building: '光ビル 2 階',
  latitude: 35.665,
  longitude: 139.7121,
  alternativePhone: '090-1234-5678',
  websiteUrl: 'https://hikari.example.com',
  logoUrl: 'https://hikari.example.com/logo.png',
  imageUrls: [
    'https://hikari.example.com/photos/entrance.jpg',
    'https://hikari.example.com/photos/seats.jpg',
  ],
  features: ['カット', 'カラー', 'ヘッドスパ'],
  amenities: ['Wi-Fi', '個室'],
  rating: 4.5,
  reviewCount: 12,
  taxRate: 10,
  businessHours: [
    {
      dayOfWeek: 'monday',
      operatingSlots: [{ startTime: '10:00', endTime: '20:00' }],
      breakSlots: [{ startTime: '13:00', endTime: '14:00' }],
      isClosed: false,
      effectivePeriod: null,
    },
    ...WHOLE_DAYS.map((dayOfWeek) => ({
      dayOfWeek,
      operatingSlots: [{ startTime: '10:00', endTime: '20:00' }],
      breakSlots: null,
      isClosed: false,
      effectivePeriod: null,
    })),
    {
      dayOfWeek: 'saturday',
      operatingSlots: [{ startTime: '09:00', endTime: '18:00' }],
      breakSlots: null,
      isClosed: false,
      effectivePeriod: null,
    },
    {
      dayOfWeek: 'sunday',
      operatingSlots: [],
      breakSlots: null,
      isClosed: true,
      effectivePeriod: null,
    },
  ],
  openingHours: [
    {
      dayOfWeek: 'friday',
      date: '2026-11-20',
      openTime: '10:00:00',
      closeTime: '20:00:00',
      isHoliday: false,
      holidayName: null,
      notes: null,
    },
    {
      dayOfWeek: 'monday',
      date: '2026-11-23',
      openTime: '10:00:00',
      closeTime: '17:00:00',
      isHoliday: true,
      holidayName: '勤労感謝の日',
      notes: '短縮営業',
    },
    {
      dayOfWeek: 'thursday',
      date: '2026-12-31',
      openTime: null,
      closeTime: null,
      isHoliday: true,
      holidayName: '年末年始',
      notes: null,
    },
  ],
})
