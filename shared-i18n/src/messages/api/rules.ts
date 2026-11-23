import { text } from '../../languages/localized-text'

/**
 * What the API says of a value that breaks a rule which the requests of
 * more than one domain share. A property is named as the request names it,
 * in every language.
 */
export const ruleMessages = {
  unknownProperty: text({
    en: 'Unknown property',
    ja: 'このプロパティは指定できません',
  }),
  atLeastOneProperty: text({
    en: 'At least one property must be specified',
    ja: 'プロパティを 1 つ以上指定してください',
  }),
  notBlank: text({
    en: 'Must not be blank',
    ja: '空白だけにはできません',
  }),
  number: text({
    en: 'Must be a number',
    ja: '数にしてください',
  }),
  notZero: text({
    en: 'Must not be 0',
    ja: '0 にはできません',
  }),
  trueOrFalse: text({
    en: 'Must be true or false',
    ja: 'true か false にしてください',
  }),
  phoneNumber: text({
    en: 'Must be a phone number',
    ja: '電話番号にしてください',
  }),
  phoneDigits: (minimum: number) =>
    text({
      en: `Must contain at least ${minimum} digits`,
      ja: `数字を ${minimum} 桁以上含めてください`,
    }),
  timeOfDay: text({
    en: 'Must be a time in HH:mm or HH:mm:ss format',
    ja: 'HH:mm か HH:mm:ss の形式の時刻にしてください',
  }),
  timeZoneName: text({
    en: 'Must be the name of a time zone, such as Asia/Tokyo',
    ja: 'Asia/Tokyo のような、タイムゾーンの名前にしてください',
  }),
  /** `earlier` is a property of the request. */
  laterThan: (earlier: string) =>
    text({
      en: `Must be later than ${earlier}`,
      ja: `${earlier} より後にしてください`,
    }),
  /** `earliest` is a property of the request, or a day. */
  notEarlierThan: (earliest: string) =>
    text({
      en: `Must not be earlier than ${earliest}`,
      ja: `${earliest} より前にはできません`,
    }),
  /** `latest` is a property of the request, or a day. */
  notLaterThan: (latest: string) =>
    text({
      en: `Must not be later than ${latest}`,
      ja: `${latest} より後にはできません`,
    }),
  /** `least` is a property of the request. */
  notLessThan: (least: string) =>
    text({
      en: `Must not be less than ${least}`,
      ja: `${least} より小さくはできません`,
    }),
  /** `most` is a property of the request. */
  notMoreThan: (most: string) =>
    text({
      en: `Must not be more than ${most}`,
      ja: `${most} より大きくはできません`,
    }),
  /** `other` is a property of the request. */
  notNullWhenGiven: (other: string) =>
    text({
      en: `Must not be null when ${other} is given`,
      ja: `${other} を指定するときは、null にできません`,
    }),
  noRepeatedEntry: text({
    en: 'Must not repeat an earlier entry',
    ja: '前の要素と同じものは指定できません',
  }),
  notInFuture: text({
    en: 'Must not be in the future',
    ja: '未来の日付にはできません',
  }),
  aSalon: text({
    en: 'Must name a salon',
    ja: '存在するサロンを指定してください',
  }),
  aCustomer: text({
    en: 'Must name a customer',
    ja: '存在する顧客を指定してください',
  }),
  aStaffMember: text({
    en: 'Must name a staff member',
    ja: '存在するスタッフを指定してください',
  }),
  aStaffMemberOfSalon: text({
    en: 'Must name a staff member of the salon',
    ja: 'このサロンのスタッフを指定してください',
  }),
  aServiceOfSalon: text({
    en: 'Must name a service of the salon',
    ja: 'このサロンのサービスを指定してください',
  }),
  aProductOfSalon: text({
    en: 'Must name a product of the salon',
    ja: 'このサロンの商品を指定してください',
  }),
  aStockRowOfSalon: text({
    en: 'Must name a stock row of the salon',
    ja: 'このサロンの在庫の行を指定してください',
  }),
  aCategoryOfSameSalon: text({
    en: 'Must be a category of the same salon',
    ja: '同じサロンのカテゴリーにしてください',
  }),
}
