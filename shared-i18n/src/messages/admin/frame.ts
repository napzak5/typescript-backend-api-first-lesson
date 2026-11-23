import { text } from '../../languages/localized-text'
import { salonScreenMessages } from '../ui/salon-screens'

/**
 * What the frame of the admin application says: the links of the header,
 * a word for each area of a salon, and the start, where an administrator
 * chooses a salon or registers one.
 */
export const adminFrameMessages = {
  navigation: {
    chooseSalon: salonScreenMessages.salonChoice.title,
    operations: text({ en: 'Operations', ja: '運用' }),
    profile: text({ en: 'Profile', ja: 'プロフィール' }),
    bookings: text({ en: 'Bookings', ja: '予約' }),
    sales: text({ en: 'Sales', ja: '売上' }),
    customers: text({ en: 'Customers', ja: '顧客' }),
    reviews: text({ en: 'Reviews', ja: 'レビュー' }),
    files: text({ en: 'Files', ja: 'ファイル' }),
    treatments: text({ en: 'Treatment records', ja: '施術記録' }),
    shifts: text({ en: 'Shifts', ja: 'シフト' }),
    menu: text({ en: 'Menu', ja: 'メニュー' }),
    products: text({ en: 'Products', ja: '商品' }),
    inventory: text({ en: 'Inventory', ja: '在庫' }),
    purchaseOrders: text({ en: 'Purchase orders', ja: '発注' }),
    staff: text({ en: 'Staff', ja: 'スタッフ' }),
    settings: text({ en: 'Settings', ja: '設定' }),
  },
  /** What the start says to an administrator, above the salons */
  choice: text({
    en: 'Choose the salon whose bookings to open.',
    ja: '予約台帳を開くサロンを選びます。',
  }),
  /** The link of the start to the screen that adds a salon */
  registerSalon: text({ en: 'Register a salon', ja: 'サロンを登録する' }),
}
