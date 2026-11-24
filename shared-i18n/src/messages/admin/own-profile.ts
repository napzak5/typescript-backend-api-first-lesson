import { text } from '../../languages/localized-text'

/*
 * What the screen of the profile of the signed-in account says in the
 * admin application: the profile the customers are shown, and the form
 * that changes what the member writes of themselves. The controls of the
 * introduction are those of the staff ledger (`adminStaffMessages`).
 */

export const adminProfileMessages = {
  title: text({ en: 'Profile', ja: 'プロフィール' }),
  description: text({
    en: 'How you are introduced to customers. Customers read it on the page of the salon.',
    ja: 'お客様に見せる、あなたの紹介です。お客様は、サロンのページで読みます。',
  }),
  /** What the screen could not read, as a sentence names it */
  names: {
    profile: text({ en: 'the profile', ja: 'プロフィール' }),
  },
  loading: text({
    en: 'Loading the profile',
    ja: 'プロフィールを読み込んでいます',
  }),
  /** What an administrator is told: no member of a salon is theirs */
  administrator: text({
    en: 'An administrator account has no staff profile. A profile is shown and edited with an account linked to a staff member of a salon.',
    ja: '管理者のアカウントには、スタッフのプロフィールがありません。プロフィールは、サロンのスタッフに紐づいたアカウントで見て、直します。',
  }),
  /** The API has no profile for the account */
  unavailable: text({
    en: 'The profile of this account cannot be used now. The staff record was made inactive, or the sign-in account was unlinked. Ask the owner of the salon.',
    ja: 'このアカウントのプロフィールは、いまは使えません。スタッフ情報が無効になったか、ログインアカウントの紐づけが解除されています。サロンのオーナーに確かめてください。',
  }),
  record: {
    title: text({
      en: 'Profile shown to customers',
      ja: 'お客様に見せるプロフィール',
    }),
    note: text({
      en: 'The salon decides the display name, the level, the position and whether bookings are taken, in the staff ledger. To change them, ask the owner of the salon.',
      ja: '表示名、レベル、役職、予約の受け方は、サロンがスタッフ台帳で決めます。変えたいときは、サロンのオーナーに伝えてください。',
    }),
    customerView: text({
      en: 'See it as customers do, on the page of the salon',
      ja: 'お客様からの見え方を、サロンのページで見る',
    }),
  },
  form: {
    title: text({ en: 'Edit the introduction', ja: '紹介を直す' }),
    submit: text({ en: 'Save', ja: '保存する' }),
    saved: text({
      en: 'Saved the profile. Customers see it at once.',
      ja: 'プロフィールを保存しました。お客様の画面に、すぐに出ます。',
    }),
    failed: text({
      en: 'Could not save the profile. Check your connection and try again.',
      ja: 'プロフィールを保存できませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
  },
}
