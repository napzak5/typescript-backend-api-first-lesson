import { text } from '../../languages/localized-text'
import { followed } from '../written'
import { menuBulkMessages } from './menu-bulk'
import { menuCategoryMessages } from './menu-categories'
import { menuServiceFormMessages } from './menu-service-form'
import { menuServiceMessages } from './menu-services'
import {
  AVAILABILITY_NAMES,
  inALine,
  MENU_KEPT_BY,
  MENU_WORDS,
  OPTION_TYPE_NAMES,
  PRICING_NAMES,
  REQUIREMENT_NAMES,
  SERVICE_STATUS_NAMES,
} from './menu-words'

/*
 * What the screens of the menu say in the admin application: the menu of
 * a salon with its services and categories, who may keep it, and the
 * names of the values of a service. The names of the categories, the
 * services and the options, and the name of the salon, stand as they were
 * written.
 *
 * The other parts of the menu are files of their own beside this one,
 * collected here under the same name: the categories, the services, the
 * form of a service, and the change of several services.
 */

const TITLE = text({ en: 'Menu', ja: 'メニュー' })

export const adminMenuMessages = {
  titles: {
    menu: TITLE,
    serviceEntry: MENU_WORDS.addService,
    service: text({ en: 'Service details', ja: 'サービスの内容' }),
    serviceChange: menuServiceMessages.change,
    servicesChange: menuBulkMessages.title,
    categoryEntry: MENU_WORDS.addCategory,
    categoryChange: text({ en: 'Edit the category', ja: 'カテゴリーを直す' }),
  },
  /** What a screen could not read, as a sentence names it */
  names: {
    menu: text({ en: 'the menu', ja: 'メニュー' }),
    category: text({ en: 'the category', ja: 'カテゴリー' }),
    categories: text({ en: 'the categories', ja: 'カテゴリー' }),
    service: text({ en: 'the service', ja: 'サービス' }),
  },
  words: MENU_WORDS,
  /** The words of the values of a service, by the values of the contract */
  pricing: PRICING_NAMES,
  serviceStatus: SERVICE_STATUS_NAMES,
  availability: AVAILABILITY_NAMES,
  requirement: REQUIREMENT_NAMES,
  optionType: OPTION_TYPE_NAMES,
  inALine,
  /** A service that was removed from the menu: one is named, though not by name */
  removedService: text({ en: 'Removed service', ja: '削除されたメニュー' }),
  /** The menu of a salon, with its services and its categories */
  menu: {
    addService: MENU_WORDS.addService,
    addCategory: MENU_WORDS.addCategory,
    changeServices: menuBulkMessages.open,
    services: text({ en: 'Services', ja: 'サービス' }),
    categories: text({ en: 'Categories', ja: 'カテゴリー' }),
    empty: text({
      en: 'No services on the menu',
      ja: 'メニューにサービスはありません',
    }),
    emptyDescription: text({
      en: 'Add categories to divide the menu into parts.',
      ja: 'カテゴリーを足して、メニューを分けておけます。',
    }),
  },
  /** What a screen for the keepers of the menu says to an account that does not keep it */
  keepers: {
    forbidden: followed(
      text({
        en: 'This account cannot change the menu.',
        ja: 'このアカウントでは、メニューを変えられません。',
      }),
      MENU_KEPT_BY,
    ),
    back: text({ en: 'Back to the menu', ja: 'メニューへ戻る' }),
  },
  /** An account that may not change the menu of the salon of the address, as the API says */
  forbidden: text({
    en: 'The menu of this salon cannot be changed. Only the owners and managers of that salon, and administrators, can change its menu.',
    ja: 'このサロンのメニューは、変えられません。メニューを変えられるのは、そのサロンのオーナーとマネージャーと、管理者です。',
  }),
  categories: menuCategoryMessages,
  services: menuServiceMessages,
  serviceForm: menuServiceFormMessages,
  bulk: menuBulkMessages,
}
