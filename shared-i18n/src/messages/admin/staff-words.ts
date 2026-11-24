import { type LocalizedText, text } from '../../languages/localized-text'

/*
 * The words that the parts of the staff catalogue share: the fields of a
 * member, which the form, the record and the ledger name alike, and a
 * member as a sentence names them.
 */

/** The words of the fields of a member, and of the parts they are grouped in */
export const STAFF_WORDS = {
  member: text({ en: 'Staff member', ja: 'スタッフ' }),
  name: text({ en: 'Name', ja: '名前' }),
  lastName: text({ en: 'Last name', ja: '姓' }),
  firstName: text({ en: 'First name', ja: '名' }),
  lastNameKana: text({ en: 'Phonetic last name', ja: '姓（フリガナ）' }),
  firstNameKana: text({ en: 'Phonetic first name', ja: '名（フリガナ）' }),
  displayName: text({ en: 'Display name', ja: '表示名' }),
  fullName: text({ en: 'Full name', ja: '氏名' }),
  contact: text({ en: 'Contact', ja: '連絡先' }),
  email: text({ en: 'Email address', ja: 'メールアドレス' }),
  phoneNumber: text({ en: 'Phone number', ja: '電話番号' }),
  alternativePhone: text({
    en: 'Alternative phone number',
    ja: '予備の電話番号',
  }),
  employment: text({ en: 'Employment', ja: '雇用' }),
  staffCode: text({ en: 'Staff code', ja: 'スタッフコード' }),
  level: text({ en: 'Level', ja: 'レベル' }),
  position: text({ en: 'Position', ja: '役職' }),
  employmentType: text({ en: 'Employment type', ja: '雇用形態' }),
  hireDate: text({ en: 'Hire date', ja: '入社日' }),
  baseSalary: text({ en: 'Base salary', ja: '基本給' }),
  commissionRate: text({ en: 'Commission rate', ja: '歩合率' }),
  introduction: text({ en: 'Introduction', ja: '紹介' }),
  specialties: text({ en: 'Specialties', ja: '専門' }),
  certifications: text({ en: 'Certifications', ja: '資格' }),
  yearsOfExperience: text({ en: 'Years of experience', ja: '経験年数' }),
  bio: text({ en: 'Bio', ja: '紹介文' }),
  imageUrl: text({ en: 'Photo URL', ja: '写真の URL' }),
  bookingSettings: text({ en: 'Bookings', ja: '予約の受け方' }),
  bookings: text({ en: 'Online bookings', ja: '予約' }),
  maxConcurrentBookings: text({
    en: 'Concurrent bookings',
    ja: '同時に担当できる予約',
  }),
  bufferTimeBefore: text({
    en: 'Time kept before a booking',
    ja: '予約の前に確保する時間',
  }),
  bufferTimeAfter: text({
    en: 'Time kept after a booking',
    ja: '予約の後に確保する時間',
  }),
  status: text({ en: 'Status', ja: '状態' }),
  account: text({ en: 'Sign-in account', ja: 'ログインアカウント' }),
  createdAt: text({ en: 'Registered at', ja: '登録した日時' }),
  cancel: text({ en: 'Cancel', ja: 'やめる' }),
  toLedger: text({ en: 'Back to the staff ledger', ja: 'スタッフ台帳へ' }),
}

/** Who keeps the staff ledger, said after what the account may not do */
export const STAFF_KEPT_BY = text({
  en: 'Only the owner of the salon and administrators can keep the staff ledger.',
  ja: 'スタッフ台帳を扱えるのは、サロンのオーナーと管理者です。',
})

/**
 * A member as the screens call them, by the name the customers see: in
 * Japanese with the honorific, 「Hiroshi Tanaka さん」, in English by the
 * name alone. The name stands as it was written.
 */
export const staffCalled = (displayName: string): LocalizedText =>
  text({ en: displayName, ja: `${displayName} さん` })
