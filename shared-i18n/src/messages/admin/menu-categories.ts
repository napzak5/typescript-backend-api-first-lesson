import { text } from '../../languages/localized-text'
import { fieldMessages } from '../ui/fields'
import { followed } from '../written'
import { MENU_WORDS } from './menu-words'

/*
 * What the screens of the categories of the menu say: the table of the
 * categories, the form that adds and changes one, what the API refused of
 * it, and its removal. The names of the categories, their descriptions,
 * colours and icons stand as they were written.
 */

export const menuCategoryMessages = {
  /** The categories of the menu, in its order */
  table: {
    caption: text({ en: 'Categories', ja: 'カテゴリー' }),
    name: MENU_WORDS.name,
    parent: text({ en: 'Parent', ja: '親' }),
    type: MENU_WORDS.type,
    displayOrder: MENU_WORDS.displayOrder,
    color: MENU_WORDS.color,
    status: MENU_WORDS.status,
    empty: text({ en: 'No categories', ja: 'カテゴリーはありません' }),
  },
  /** The form of a category */
  form: {
    name: MENU_WORDS.name,
    /** How long the name may be, and where it is shown */
    nameDescription: (most: number) =>
      followed(
        fieldMessages.upTo(most),
        text({
          en: 'It heads its part of the menu the customers see.',
          ja: 'お客様のメニューの見出しになります。',
        }),
      ),
    parent: text({ en: 'Parent category', ja: '親カテゴリー' }),
    noParent: text({
      en: 'None (a top category)',
      ja: 'なし（最上位のカテゴリー）',
    }),
    parentDescription: text({
      en: 'Puts this category below another category.',
      ja: 'このカテゴリーを、ほかのカテゴリーの下に置きます。',
    }),
    type: MENU_WORDS.type,
    choose: MENU_WORDS.choose,
    displayOrder: MENU_WORDS.displayOrder,
    displayOrderDescription: MENU_WORDS.displayOrderDescription,
    description: MENU_WORDS.description,
    color: MENU_WORDS.color,
    colorDescription: text({
      en: 'A # and 6 hexadecimal digits, such as #C8A2C8.',
      ja: '#C8A2C8 のように、# と 16 進数 6 桁で。',
    }),
    icon: text({ en: 'Icon URL', ja: 'アイコンの URL' }),
    active: MENU_WORDS.active,
    activeDescription: text({
      en: 'When cleared, this heading no longer appears on the menu the customers see, and the services of this category are listed under “Other”.',
      ja: '外すと、お客様のメニューにこの見出しが出なくなり、このカテゴリーのサービスは「その他」に並びます。',
    }),
  },
  /** What is wrong with the values of the form, and what the API refused */
  errors: {
    /** The name of a category, as a sentence names it */
    name: text({ en: 'Category name', ja: 'カテゴリーの名前' }),
    type: text({ en: 'Choose a type.', ja: '種類を選んでください。' }),
    displayOrder: MENU_WORDS.displayOrderError,
    color: text({
      en: 'Enter the color as a # and 6 hexadecimal digits, such as #C8A2C8.',
      ja: '色は、#C8A2C8 のように、# と 16 進数 6 桁で入力してください。',
    }),
    /** The parent that was chosen was removed meanwhile */
    parentGone: text({
      en: 'This parent category was removed meanwhile. Choose the parent again.',
      ja: 'この親カテゴリーは、その間に削除されていました。親を選び直してください。',
    }),
    /** The parent that was chosen is below the category now */
    parentBelow: text({
      en: 'A category below this one cannot be its parent. The parents changed meanwhile: choose again.',
      ja: 'このカテゴリーの下にあるカテゴリーは、親にできません。その間に、親が変わっていました。選び直してください。',
    }),
  },
  saveFailed: text({
    en: 'The category could not be saved. Check your connection and try again.',
    ja: 'カテゴリーを保存できませんでした。通信の状態を確かめて、もう一度お試しください。',
  }),
  /** What follows a category that was written */
  added: (name: string) =>
    text({
      en: `Added the category “${name}” to the menu.`,
      ja: `カテゴリー「${name}」を、メニューに足しました。`,
    }),
  changed: (name: string) =>
    text({
      en: `Saved the category “${name}”.`,
      ja: `カテゴリー「${name}」を直しました。`,
    }),
  /** The removal of a category */
  removal: {
    confirm: (name: string) =>
      text({
        en: `Remove the category “${name}”?`,
        ja: `カテゴリー「${name}」を削除しますか？`,
      }),
    description: text({
      en: 'The categories below this one become top categories, and the services of this category become uncategorized. Neither is removed. A removed category cannot be brought back.',
      ja: 'このカテゴリーの下にあるカテゴリーは、最上位のカテゴリーになります。このカテゴリーのサービスは、未分類になります。どちらも削除されません。削除したカテゴリーは、元に戻せません。',
    }),
    done: (name: string) =>
      text({
        en: `Removed the category “${name}” from the menu.`,
        ja: `カテゴリー「${name}」を、メニューから削除しました。`,
      }),
    failed: text({
      en: 'The category could not be removed. Check your connection and try again.',
      ja: 'カテゴリーを削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
  },
  /** The screens of a category */
  loading: text({
    en: 'Loading the categories',
    ja: 'カテゴリーを読み込んでいます',
  }),
  notFound: {
    title: text({ en: 'Category not found', ja: 'カテゴリーが見つかりません' }),
    description: text({
      en: 'Check that the address is right. A removed category cannot be shown.',
      ja: 'アドレスが正しいか、お確かめください。削除したカテゴリーは、表示できません。',
    }),
  },
}
