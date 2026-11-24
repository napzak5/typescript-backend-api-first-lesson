import { numberOf } from '../../formats/numbers'
import { text } from '../../languages/localized-text'
import { STAFF_WORDS } from './staff-words'

/*
 * How a member of the staff is introduced to the customers: the controls
 * that the form of the staff ledger and the form of the member's own
 * profile share, and what is wrong with their values.
 */

export const staffIntroduction = {
  specialties: STAFF_WORDS.specialties,
  specialtiesDescription: text({
    en: 'The services and techniques they are good at. Separate them with “,” or “、”.',
    ja: '得意なメニューや技術を、「、」か「,」で区切って書きます。',
  }),
  certifications: STAFF_WORDS.certifications,
  certificationsDescription: text({
    en: 'Separate them with “,” or “、”.',
    ja: '「、」か「,」で区切って書きます。',
  }),
  yearsOfExperience: text({
    en: 'Years of experience',
    ja: '経験年数（年）',
  }),
  /** The most years of experience the API takes */
  yearsOfExperienceDescription: (most: number) =>
    text({
      en: `A whole number from 0 to ${numberOf(most).en}.`,
      ja: `0 から ${numberOf(most).ja} までの整数。`,
    }),
  bio: STAFF_WORDS.bio,
  imageUrl: STAFF_WORDS.imageUrl,
  /** The years of experience are no whole number up to the most the API takes */
  yearsOfExperienceError: (most: number) =>
    text({
      en: `Enter the years of experience as a whole number from 0 to ${numberOf(most).en}.`,
      ja: `経験年数は、0 から ${numberOf(most).ja} までの整数で入力してください。`,
    }),
}
