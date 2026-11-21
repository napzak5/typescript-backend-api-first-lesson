/**
 * The name of the product. It is a name, not a word: the screens in English
 * carry it as it is.
 */
export const PRODUCT_NAME = 'Kushi'

/** One of the applications, as the brand names it. */
export type Application = {
  /** Its name: in its header, in the title of its pages and of a link to it */
  name: string
  /** What it is for, in a sentence: the description of a link to it */
  description: string
}

/** The applications under `frontend/apps`, by the first word of their directory */
export type ApplicationKey = 'portal' | 'admin' | 'dashboard'

export const applications: Record<ApplicationKey, Application> = {
  portal: {
    name: PRODUCT_NAME,
    description:
      'サロンを探して予約し、自分の予約、好み、レビューを管理できます。',
  },
  admin: {
    name: `${PRODUCT_NAME} Admin`,
    description:
      'サロンの予約、会計、顧客、スタッフ、メニュー、在庫を管理します。',
  },
  dashboard: {
    name: `${PRODUCT_NAME} Dashboard`,
    description: 'サロンの売上を、期間、スタッフ、区分ごとに見られます。',
  },
}
