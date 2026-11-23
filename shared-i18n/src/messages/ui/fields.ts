import { numberOf } from '../../formats/numbers'
import { type LocalizedText, text } from '../../languages/localized-text'

/** A number of characters, as a sentence writes it: 「2,000 文字」, "2,000 characters". */
const characters = (count: number): LocalizedText => {
  const written = numberOf(count)

  return text({
    en: `${written.en} ${count === 1 ? 'character' : 'characters'}`,
    ja: `${written.ja} 文字`,
  })
}

/** What a form says of a text that is longer than the API takes */
const tooLong = (most: number): LocalizedText =>
  text({
    en: `Enter up to ${characters(most).en}.`,
    ja: `${characters(most).ja}以内で入力してください。`,
  })

/** An address of the web that the API takes, as a sentence names it */
const WEB_ADDRESS = text({
  en: 'a URL that begins with http:// or https:// and has a domain name (such as example.com)',
  ja: 'http:// か https:// で始まる、ドメイン名（example.com など）の URL',
})

/**
 * What the rules of the values a form takes say, in every application.
 * A sentence about a control the screen names (`tooLongOf`) puts the name
 * the screen gives first, as a label: English then needs no article.
 */
export const fieldMessages = {
  characters,
  tooLong,
  /** The same of a text the sentence names (「仕入先」) */
  tooLongOf: (what: LocalizedText, most: number) =>
    text({
      en: `${what.en}: enter up to ${characters(most).en}.`,
      ja: `${what.ja}は、${tooLong(most).ja}`,
    }),
  /** The same of the entries of a list, each of which may be so long */
  eachTooLongOf: (what: LocalizedText, most: number) =>
    text({
      en: `${what.en}: enter up to ${characters(most).en} for each entry.`,
      ja: `${what.ja}は、1 つ ${tooLong(most).ja}`,
    }),
  /** What a form says of a text that has to be written and may be so long */
  neededWithin: (what: LocalizedText, most: number) =>
    text({
      en: `${what.en}: enter 1 to ${characters(most).en}.`,
      ja: `${what.ja}を、${tooLong(most).ja}`,
    }),
  /** How long a text may be, as the description of its control says it */
  upTo: (most: number) =>
    text({
      en: `Up to ${characters(most).en}.`,
      ja: `${characters(most).ja}まで。`,
    }),
  /** A value that is none of those a form offers */
  unlisted: text({
    en: 'Choose one of the options.',
    ja: '選択肢から選んでください。',
  }),
  emailMissing: text({
    en: 'Enter an email address.',
    ja: 'メールアドレスを入力してください。',
  }),
  emailMalformed: text({
    en: 'Enter an email address in a form such as hanako@example.com.',
    ja: 'メールアドレスは、hanako@example.com のような形で入力してください。',
  }),
  lastNameMissing: text({
    en: 'Enter the last name.',
    ja: '姓を入力してください。',
  }),
  firstNameMissing: text({
    en: 'Enter the first name.',
    ja: '名を入力してください。',
  }),
  phoneMissing: text({
    en: 'Enter a phone number.',
    ja: '電話番号を入力してください。',
  }),
  phoneMalformed: text({
    en: 'Enter a phone number in digits and hyphens, with the area code (for example 03-1234-5678).',
    ja: '電話番号は、数字とハイフンで、市外局番から入力してください（例: 03-1234-5678）。',
  }),
  /**
   * An address that is none the API takes; `longest` is `null` where the
   * API takes an address of any length
   */
  notWebAddress: (longest: number | null) =>
    longest === null
      ? text({
          en: `Enter ${WEB_ADDRESS.en}.`,
          ja: `${WEB_ADDRESS.ja} を入力してください。`,
        })
      : text({
          en: `Enter ${WEB_ADDRESS.en}, up to ${characters(longest).en}.`,
          ja: `${WEB_ADDRESS.ja} を、${tooLong(longest).ja}`,
        }),
  /** What the description of a control says of the address it takes */
  webAddressDescription: (longest: number) =>
    text({
      en: `A URL that begins with http:// or https://. Up to ${characters(longest).en}.`,
      ja: `http:// か https:// で始まる URL。${characters(longest).ja}まで。`,
    }),
  /** The line of a list written a line each that is to be looked at, by the number a person counts it with */
  lineToCheck: (line: number, why: LocalizedText) =>
    text({
      en: `Check line ${numberOf(line).en}. ${why.en}`,
      ja: `${numberOf(line).ja} 行目を確かめてください。${why.ja}`,
    }),
  birthDateOutOfRange: text({
    en: 'Enter a date of birth from January 1, 1900 to today.',
    ja: '生年月日は、1900 年 1 月 1 日から今日までの日付を入力してください。',
  }),
}
